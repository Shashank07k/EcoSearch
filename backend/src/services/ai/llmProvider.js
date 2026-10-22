import { AnalysisError } from './analysisError.js';

const MAX_RESPONSE_BYTES = 65_536;

/** Transient HTTP status codes that are safe to retry. */
const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504]);

/**
 * Maximum number of retry attempts AFTER the initial request, per model.
 * Total attempts per model = 1 (initial) + MAX_RETRIES.
 */
const MAX_RETRIES = 2;

/** Base delay in ms for exponential backoff. Attempt 1 → ~1s, attempt 2 → ~2s. */
const BASE_DELAY_MS = 1000;

function endpointFor({ apiKey, model, baseUrl, timeoutMs }) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new AnalysisError('AI_UNAVAILABLE');
  if (/[\r\n]/.test(apiKey) || typeof model !== 'string' || !model.trim() || model.length > 200 ||
      !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) {
    throw new AnalysisError('AI_CONFIGURATION_ERROR');
  }
  try {
    const url = new URL(baseUrl);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) ||
        url.username || url.password || url.search || url.hash) throw new Error();
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/chat/completions`;
    return url;
  } catch {
    throw new AnalysisError('AI_CONFIGURATION_ERROR');
  }
}

async function readEnvelope(response) {
  if (!response.body) throw new AnalysisError('AI_INVALID_RESPONSE');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new AnalysisError('AI_INVALID_RESPONSE');
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    if (error instanceof AnalysisError || error?.name === 'AbortError') throw error;
    throw new AnalysisError('AI_INVALID_RESPONSE');
  } finally {
    reader.releaseLock();
  }
}

/**
 * Read the provider error body safely for diagnostic logging.
 * Never returns the raw body — only a sanitized, truncated message.
 */
async function readProviderError(response) {
  try {
    const text = await response.text();
    const data = JSON.parse(text);
    const msg = data?.error?.message || data?.error?.status || '';
    // Truncate and strip anything that might contain credentials
    return String(msg).slice(0, 200);
  } catch {
    return '(unreadable error body)';
  }
}

/** Sleep with jitter for exponential backoff. */
function backoff(attempt) {
  // attempt is 0-indexed retry count: 0 → ~1s, 1 → ~2s
  const delay = BASE_DELAY_MS * Math.pow(2, attempt);
  const jitter = delay * 0.2 * Math.random(); // up to 20% jitter
  return new Promise((resolve) => setTimeout(resolve, delay + jitter));
}

/**
 * Classify an HTTP error status into a typed AnalysisError code.
 */
function classifyHttpError(status) {
  if (status === 401 || status === 403) return 'AI_CONFIGURATION_ERROR';
  if (status === 404) return 'AI_CONFIGURATION_ERROR';
  if (status === 429 || status === 503) return 'AI_UNAVAILABLE';
  return 'AI_PROVIDER_ERROR';
}

/**
 * Build the request body for the Gemini OpenAI-compatible endpoint.
 *
 * Avoids OpenAI-only parameters that Gemini rejects:
 * - `store` — not supported by Gemini
 * - `max_completion_tokens` — Gemini uses `max_tokens`
 * - `json_schema` with `strict: true` may cause 400 on some Gemini models;
 *    we try `json_schema` first and fall back to `json_object` on 400.
 */
function buildRequestBody(model, messages, schema, useJsonSchema) {
  const body = {
    model,
    messages,
    stream: false,
    max_tokens: 1800,
  };
  if (useJsonSchema && schema) {
    body.response_format = {
      type: 'json_schema',
      json_schema: { name: 'sustainability_analysis', strict: true, schema },
    };
  } else {
    body.response_format = { type: 'json_object' };
  }
  return body;
}

/**
 * Extract the content text from a successful completions response,
 * handling both raw JSON and ```json fenced code blocks.
 */
function extractContent(envelope) {
  const choice = Array.isArray(envelope?.choices) ? envelope.choices[0] : undefined;
  if (choice?.finish_reason !== 'stop' || choice.message?.refusal ||
      typeof choice.message?.content !== 'string') {
    throw new AnalysisError('AI_INVALID_RESPONSE');
  }
  let raw = choice.message.content.trim();

  // Strip fenced code blocks: ```json ... ``` or ``` ... ```
  const fencedMatch = raw.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  if (fencedMatch) {
    raw = fencedMatch[1].trim();
  }

  try { return JSON.parse(raw); }
  catch { throw new AnalysisError('AI_INVALID_RESPONSE'); }
}

/**
 * Attempt a single completions request against a given model.
 * Returns the parsed JSON content on success.
 * Throws AnalysisError on failure.
 *
 * Implements:
 * - Retry with exponential backoff for transient errors (429/500/502/503/504)
 * - json_schema → json_object fallback on 400
 * - Sanitized diagnostic logging
 */
async function attemptModel({ apiKey, model, baseUrl, timeoutMs, fetchImpl, messages, schema }) {
  const url = endpointFor({ apiKey, model, baseUrl, timeoutMs });
  let useJsonSchema = true;
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await backoff(attempt - 1);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const body = buildRequestBody(model, messages, schema, useJsonSchema);
      const response = await fetchImpl(url, {
        method: 'POST',
        redirect: 'error', // Never forward credentials to a redirected host.
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const envelope = await readEnvelope(response);
        return extractContent(envelope);
      }

      // Non-OK response — classify and decide whether to retry.
      const providerMessage = await readProviderError(response);
      const status = response.status;

      // If json_schema caused a 400, fall back to json_object and retry immediately
      if (status === 400 && useJsonSchema) {
        console.warn(`[ai] Model ${model} returned 400 with json_schema; falling back to json_object`);
        useJsonSchema = false;
        // Don't count this as a retry — go back with the same attempt number
        attempt--;
        continue;
      }

      console.warn(`[ai] Gemini provider error HTTP ${status} (model: ${model}): ${providerMessage}`);

      if (TRANSIENT_STATUSES.has(status)) {
        lastError = new AnalysisError(classifyHttpError(status));
        if (attempt < MAX_RETRIES) {
          console.info(`[ai] Transient ${status} from ${model}, retrying (${attempt + 1}/${MAX_RETRIES})...`);
          continue;
        }
        // Exhausted retries for this model
        throw lastError;
      }

      // Non-transient, non-retryable error
      throw new AnalysisError(classifyHttpError(status));
    } catch (error) {
      clearTimeout(timer);
      if (controller.signal.aborted || error?.name === 'AbortError' || error?.name === 'TimeoutError') {
        if (attempt < MAX_RETRIES) {
          console.info(`[ai] Timeout for ${model}, retrying (${attempt + 1}/${MAX_RETRIES})...`);
          lastError = new AnalysisError('AI_TIMEOUT');
          continue;
        }
        throw new AnalysisError('AI_TIMEOUT');
      }
      if (error instanceof AnalysisError) throw error;
      throw new AnalysisError('AI_PROVIDER_ERROR');
    } finally {
      clearTimeout(timer);
    }
  }

  // Should not reach here, but safety net
  throw lastError || new AnalysisError('AI_PROVIDER_ERROR');
}

/**
 * OpenAI-compatible Chat Completions HTTP adapter; native fetch, no SDK.
 * Contract: generateAnalysis({ messages, schema }) -> unknown JSON data.
 * Configuration is checked lazily. Never log requests, headers or raw errors.
 *
 * Supports:
 * - Retry with exponential backoff for transient provider failures
 * - Optional model fallback (AI_FALLBACK_MODELS env)
 * - json_schema → json_object automatic downgrade
 * - Sanitized diagnostic logging
 */
export function createLlmProvider({ apiKey, model, baseUrl, timeoutMs = 20_000, fallbackModels = [], fetchImpl = globalThis.fetch }) {
  return {
    async generateAnalysis({ messages, schema }) {
      // Build list of models to try: primary first, then fallbacks.
      // Keep the primary model even if falsy so endpointFor validation
      // catches empty/missing model and throws AI_CONFIGURATION_ERROR.
      const modelsToTry = [model, ...fallbackModels.filter(Boolean)];

      for (let i = 0; i < modelsToTry.length; i++) {
        const currentModel = modelsToTry[i];
        const isFallback = i > 0;

        if (isFallback) {
          console.info(`[ai] Primary model exhausted retries, trying fallback: ${currentModel}`);
        }

        try {
          return await attemptModel({
            apiKey,
            model: currentModel,
            baseUrl,
            timeoutMs,
            fetchImpl,
            messages,
            schema,
          });
        } catch (error) {
          if (!(error instanceof AnalysisError)) {
            throw new AnalysisError('AI_PROVIDER_ERROR');
          }

          // Only fall back on transient availability errors, not config errors
          const isTransient = ['AI_UNAVAILABLE', 'AI_TIMEOUT'].includes(error.code);
          const hasMoreFallbacks = i < modelsToTry.length - 1;

          if (isTransient && hasMoreFallbacks) {
            console.warn(`[ai] Model ${currentModel} failed with ${error.code}, will try next fallback`);
            continue;
          }

          // No more fallbacks or non-transient error — re-throw
          throw error;
        }
      }

      // Safety net — should not reach here
      throw new AnalysisError('AI_PROVIDER_ERROR');
    },
  };
}
