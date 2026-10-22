import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createLlmProvider } from '../src/services/ai/llmProvider.js';
import { analysisSchema } from '../src/services/ai/analysis.schema.js';
import { validAnalysis } from './fixtures/analysis.js';

const settings = { apiKey: `test-only-${randomUUID()}`, model: 'test-model', baseUrl: 'https://provider.example/v1', timeoutMs: 1000 };
const args = { messages: [{ role: 'system', content: 'Return JSON' }], schema: analysisSchema };
const envelope = (content = JSON.stringify(validAnalysis), finish_reason = 'stop') => ({ choices: [{ finish_reason, message: { content } }] });

test('HTTP adapter sends server-side auth and structured output without an SDK', async () => {
  const provider = createLlmProvider({ ...settings, fetchImpl: async (url, options) => {
    assert.equal(url.href, 'https://provider.example/v1/chat/completions');
    assert.equal(options.headers.Authorization, `Bearer ${settings.apiKey}`);
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    const request = JSON.parse(options.body);
    assert.equal(request.model, 'test-model');
    // Gemini-compatible: no `store`, uses `max_tokens` instead of `max_completion_tokens`
    assert.equal(request.store, undefined);
    assert.equal(request.max_tokens, 1800);
    assert.equal(request.max_completion_tokens, undefined);
    assert.deepEqual(request.messages, args.messages);
    assert.deepEqual(request.response_format.json_schema.schema, analysisSchema);
    assert.equal(request.response_format.json_schema.strict, true);
    return Response.json(envelope());
  } });
  assert.deepEqual(await provider.generateAnalysis(args), validAnalysis);
});

for (const [name, overrides, code] of [
  ['missing key', { apiKey: '' }, 'AI_UNAVAILABLE'],
  ['missing model', { model: '' }, 'AI_CONFIGURATION_ERROR'],
  ['bad URL', { baseUrl: 'invalid' }, 'AI_CONFIGURATION_ERROR'],
  ['URL credentials', { baseUrl: 'https://user:private@provider.example/v1' }, 'AI_CONFIGURATION_ERROR'],
  ['insecure remote URL', { baseUrl: 'http://provider.example/v1' }, 'AI_CONFIGURATION_ERROR'],
  ['query in URL', { baseUrl: 'https://provider.example/v1?token=private' }, 'AI_CONFIGURATION_ERROR'],
  ['header injection', { apiKey: 'test\r\nX-Test: value' }, 'AI_CONFIGURATION_ERROR'],
  ['invalid timeout', { timeoutMs: -1 }, 'AI_CONFIGURATION_ERROR'],
]) {
  test(`configuration: ${name} fails lazily and safely`, async () => {
    const provider = createLlmProvider({ ...settings, ...overrides, fetchImpl() { assert.fail('Network should not be called'); } });
    await assert.rejects(provider.generateAnalysis(args), (error) => {
      assert.equal(error.code, code);
      assert.equal(error.status, 503);
      assert.ok(!JSON.stringify(error).includes(settings.apiKey));
      return true;
    });
  });
}

// Non-transient HTTP errors (no retries needed, single call)
for (const [status, code, resultStatus] of [
  [401, 'AI_CONFIGURATION_ERROR', 503],
  [403, 'AI_CONFIGURATION_ERROR', 503],
  [404, 'AI_CONFIGURATION_ERROR', 503],
]) {
  test(`provider HTTP ${status} maps to safe ${resultStatus}`, async () => {
    const provider = createLlmProvider({ ...settings, fetchImpl: async () => new Response(`private upstream detail ${settings.apiKey}`, { status }) });
    await assert.rejects(provider.generateAnalysis(args), (error) => {
      assert.equal(error.code, code);
      assert.equal(error.status, resultStatus);
      assert.ok(!error.message.includes('private'));
      assert.ok(!JSON.stringify(error).includes(settings.apiKey));
      return true;
    });
  });
}

// Transient HTTP errors: retried MAX_RETRIES times, then fail
for (const [status, code, resultStatus] of [
  [429, 'AI_UNAVAILABLE', 503],
  [500, 'AI_PROVIDER_ERROR', 502],
  [502, 'AI_PROVIDER_ERROR', 502],
  [503, 'AI_UNAVAILABLE', 503],
  [504, 'AI_PROVIDER_ERROR', 502],
]) {
  test(`provider HTTP ${status} retries then maps to safe ${code} (${resultStatus})`, async () => {
    let calls = 0;
    const provider = createLlmProvider({ ...settings, fetchImpl: async () => {
      calls++;
      return new Response(`private upstream detail ${settings.apiKey}`, { status });
    } });
    await assert.rejects(provider.generateAnalysis(args), (error) => {
      assert.equal(error.code, code);
      assert.equal(error.status, resultStatus);
      assert.ok(!error.message.includes('private'));
      assert.ok(!JSON.stringify(error).includes(settings.apiKey));
      return true;
    });
    // Should have retried: 1 initial + 2 retries = 3 total
    assert.equal(calls, 3);
  });
}

// 400 with json_schema triggers fallback to json_object, then succeeds
test('400 with json_schema falls back to json_object', async () => {
  let calls = 0;
  const provider = createLlmProvider({ ...settings, fetchImpl: async (_url, options) => {
    calls++;
    const body = JSON.parse(options.body);
    if (body.response_format?.type === 'json_schema') {
      return new Response('{"error":{"message":"unsupported"}}', { status: 400 });
    }
    // json_object mode should succeed
    assert.equal(body.response_format.type, 'json_object');
    return Response.json(envelope());
  } });
  const result = await provider.generateAnalysis(args);
  assert.deepEqual(result, validAnalysis);
  assert.equal(calls, 2); // first 400, then success with json_object
});

// Transient error with fallback model succeeds
test('fallback model is tried when primary fails with transient error', async () => {
  let calls = [];
  const provider = createLlmProvider({
    ...settings,
    fallbackModels: ['fallback-model'],
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body);
      calls.push(body.model);
      if (body.model === 'test-model') {
        return new Response('{"error":{"message":"unavailable"}}', { status: 503 });
      }
      return Response.json(envelope());
    },
  });
  const result = await provider.generateAnalysis(args);
  assert.deepEqual(result, validAnalysis);
  // Primary tried 3 times (1 + 2 retries), then fallback once
  const primaryCalls = calls.filter(m => m === 'test-model');
  const fallbackCalls = calls.filter(m => m === 'fallback-model');
  assert.equal(primaryCalls.length, 3);
  assert.ok(fallbackCalls.length >= 1);
});

// Fenced JSON code block is parsed correctly
test('fenced JSON code block in response is parsed', async () => {
  const fenced = '```json\n' + JSON.stringify(validAnalysis) + '\n```';
  const provider = createLlmProvider({ ...settings, fetchImpl: async () => Response.json(envelope(fenced)) });
  assert.deepEqual(await provider.generateAnalysis(args), validAnalysis);
});

for (const [name, response] of [
  ['bad envelope JSON', () => new Response('broken JSON')],
  ['missing choices', () => Response.json({})],
  ['non-array choices', () => Response.json({ choices: { 0: envelope().choices[0] } })],
  ['invalid content JSON', () => Response.json(envelope('{broken'))],
  ['null content', () => Response.json(envelope(null))],
  ['truncated generation', () => Response.json(envelope('{}', 'length'))],
  ['content filter', () => Response.json(envelope('{}', 'content_filter'))],
  ['refusal', () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{}', refusal: 'private' } }] })],
  ['oversized envelope', () => new Response('x'.repeat(65_537))],
]) {
  test(`malformed provider response: ${name}`, async () => {
    await assert.rejects(createLlmProvider({ ...settings, fetchImpl: async () => response() }).generateAnalysis(args), { code: 'AI_INVALID_RESPONSE', status: 502 });
  });
}

test('native timeout aborts an in-flight provider request', async () => {
  const provider = createLlmProvider({ ...settings, timeoutMs: 10, fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('timed out', 'AbortError')), { once: true });
  }) });
  await assert.rejects(provider.generateAnalysis(args), { code: 'AI_TIMEOUT', status: 504 });
});

test('deadline remains active while reading the response body', async () => {
  const provider = createLlmProvider({ ...settings, timeoutMs: 10, fetchImpl: async (_url, { signal }) => new Response(new ReadableStream({
    start(controller) { signal.addEventListener('abort', () => controller.error(new DOMException('timeout', 'AbortError')), { once: true }); },
  })) });
  await assert.rejects(provider.generateAnalysis(args), { code: 'AI_TIMEOUT' });
});

test('network failures never forward raw internal messages', async () => {
  const provider = createLlmProvider({ ...settings, fetchImpl() { throw new Error(`DNS detail ${settings.apiKey}`); } });
  await assert.rejects(provider.generateAnalysis(args), (error) => {
    assert.equal(error.code, 'AI_PROVIDER_ERROR');
    assert.ok(!error.message.includes(settings.apiKey));
    return true;
  });
});
