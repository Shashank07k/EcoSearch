import { test } from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}
globalThis.localStorage = new MemoryStorage();

const { apiRequest, API_TIMEOUT_MS } = await import('../src/services/apiClient.js');

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('a hung request is bounded by the client timeout instead of pending forever', async () => {
  const original = globalThis.fetch;
  // A hung backend: never responds, but honours the abort signal like real fetch.
  globalThis.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  });
  try {
    const started = Date.now();
    await assert.rejects(
      apiRequest('/products', { timeoutMs: 60 }),
      (error) => {
        assert.equal(error.code, 'TIMEOUT');
        assert.match(error.message, /too long/i);
        return true;
      },
    );
    const elapsed = Date.now() - started;
    assert.ok(elapsed < 2000, `should reject promptly, took ${elapsed}ms`);
  } finally {
    globalThis.fetch = original;
  }
});

test('the default timeout is bounded and sane for catalog browsing (10-15s)', () => {
  assert.ok(API_TIMEOUT_MS >= 10_000 && API_TIMEOUT_MS <= 15_000, `got ${API_TIMEOUT_MS}`);
});

test('a caller-initiated abort stays an AbortError, not a TIMEOUT', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
  });
  try {
    const controller = new AbortController();
    const pending = apiRequest('/products', { signal: controller.signal, timeoutMs: 5000 });
    controller.abort();
    await assert.rejects(pending, (error) => {
      assert.equal(error.name, 'AbortError');
      assert.notEqual(error.code, 'TIMEOUT');
      return true;
    });
  } finally {
    globalThis.fetch = original;
  }
});

test('an already-aborted caller signal rejects immediately without fetching', async () => {
  const original = globalThis.fetch;
  let called = false;
  globalThis.fetch = () => { called = true; return Promise.resolve(jsonResponse({ success: true })); };
  try {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(apiRequest('/products', { signal: controller.signal }), { name: 'AbortError' });
    assert.equal(called, false);
  } finally {
    globalThis.fetch = original;
  }
});

test('a 503 from the proxy surfaces as API_UNAVAILABLE and does not clear the token', async () => {
  const original = globalThis.fetch;
  globalThis.localStorage.setItem('ecosearch_token', 'valid-jwt');
  globalThis.fetch = () => Promise.resolve(jsonResponse({
    success: false,
    error: { status: 503, message: 'The EcoSearch API is temporarily unavailable.', code: 'API_UNAVAILABLE' },
  }, 503));
  try {
    await assert.rejects(apiRequest('/products'), (error) => {
      assert.equal(error.status, 503);
      assert.equal(error.code, 'API_UNAVAILABLE');
      return true;
    });
    assert.equal(globalThis.localStorage.getItem('ecosearch_token'), 'valid-jwt', 'a 503 must not log the user out');
  } finally {
    globalThis.fetch = original;
    globalThis.localStorage.removeItem('ecosearch_token');
  }
});

test('a 401 on a protected path ends the session and is labelled SESSION_EXPIRED', async () => {
  const original = globalThis.fetch;
  globalThis.localStorage.setItem('ecosearch_token', 'stale-jwt');
  globalThis.fetch = () => Promise.resolve(jsonResponse({
    success: false, error: { status: 401, message: 'Authentication required' },
  }, 401));
  try {
    await assert.rejects(apiRequest('/products/abc/analyze', { method: 'POST' }), (error) => {
      assert.equal(error.status, 401);
      assert.equal(error.code, 'SESSION_EXPIRED');
      return true;
    });
    assert.equal(globalThis.localStorage.getItem('ecosearch_token'), null);
  } finally {
    globalThis.fetch = original;
  }
});

test('a 401 on an auth path does NOT clear the token (login errors must not loop)', async () => {
  const original = globalThis.fetch;
  globalThis.localStorage.setItem('ecosearch_token', 'keep-me');
  globalThis.fetch = () => Promise.resolve(jsonResponse({
    success: false, error: { status: 401, message: 'Invalid email or password' },
  }, 401));
  try {
    await assert.rejects(apiRequest('/auth/login', { method: 'POST', body: {} }), (error) => {
      assert.equal(error.status, 401);
      assert.notEqual(error.code, 'SESSION_EXPIRED');
      return true;
    });
    assert.equal(globalThis.localStorage.getItem('ecosearch_token'), 'keep-me');
  } finally {
    globalThis.fetch = original;
    globalThis.localStorage.removeItem('ecosearch_token');
  }
});

test('the catalog response contract is consumed as returned (success + products)', async () => {
  const original = globalThis.fetch;
  const payload = { success: true, products: [{ id: 'p1', name: 'Bottle', category: 'Home' }], page: 1, limit: 9, total: 1, totalPages: 1 };
  globalThis.fetch = () => Promise.resolve(jsonResponse(payload));
  try {
    const data = await apiRequest('/products', { params: { page: 1, limit: 9 } });
    assert.equal(data.success, true);
    assert.equal(data.products.length, 1);
    assert.equal(data.total, 1);
  } finally {
    globalThis.fetch = original;
  }
});
