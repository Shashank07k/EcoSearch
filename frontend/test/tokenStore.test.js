import { test } from 'node:test';
import assert from 'node:assert/strict';

// Install a tiny in-memory localStorage before importing the store.
class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
  clear() { this.map.clear(); }
}
globalThis.localStorage = new MemoryStorage();

const store = await import('../src/services/tokenStore.js');

test('token persists, can be read back, and notifies subscribers', () => {
  let calls = 0;
  const unsubscribe = store.subscribeToToken(() => { calls += 1; });
  assert.equal(store.getToken(), null);
  store.setToken('jwt-abc');
  assert.equal(store.getToken(), 'jwt-abc');
  store.clearToken();
  assert.equal(store.getToken(), null);
  assert.equal(calls, 2);
  unsubscribe();
  store.setToken('jwt-xyz');
  assert.equal(calls, 2, 'unsubscribed listeners are not called');
  store.clearToken();
});

test('a separate storage instance with the same key stays isolated from secrets shape', () => {
  // The store only ever holds an opaque token string, never provider secrets.
  store.setToken('eyJhbGciOiJIUzI1NiJ9.payload.signature');
  const token = store.getToken();
  assert.ok(token.startsWith('eyJ'));
  assert.ok(!token.includes('AI_API_KEY'));
  store.clearToken();
});

// --- Regression: cached public profile (fixes "logged out" flash + logout on
// transient backend errors). A logged-in user must be recognised instantly on
// reload, without waiting for /api/auth/me.
test('setSession stores token and public user; getStoredUser restores it', () => {
  const user = { id: 'user-1', name: 'Walk User', email: 'walk@example.com', role: 'user' };
  store.setSession('jwt-session', user);
  assert.equal(store.getToken(), 'jwt-session');
  assert.deepEqual(store.getStoredUser(), user);
});

test('cached user never contains secret fields', () => {
  store.setSession('jwt-session', { id: 'user-1', name: 'A', email: 'a@b.com', role: 'user' });
  const raw = globalThis.localStorage.getItem('ecosearch_user');
  assert.ok(raw && !raw.includes('passwordHash') && !raw.includes('AI_API_KEY') && !raw.includes('JWT_SECRET'));
});

test('clearSession and clearToken both wipe token AND cached user', () => {
  const user = { id: 'user-2', name: 'B', email: 'b@b.com', role: 'user' };
  store.setSession('jwt-a', user);
  store.clearSession();
  assert.equal(store.getToken(), null);
  assert.equal(store.getStoredUser(), null);

  store.setSession('jwt-b', user);
  store.clearToken();
  assert.equal(store.getToken(), null);
  assert.equal(store.getStoredUser(), null, 'clearToken also clears the cached profile');
});

test('getStoredUser returns null for corrupt entries and self-heals', () => {
  globalThis.localStorage.setItem('ecosearch_user', '{not json');
  assert.equal(store.getStoredUser(), null);
  // corrupt entry is removed so it cannot wedge the app on later reads
  assert.equal(globalThis.localStorage.getItem('ecosearch_user'), null);
});

test('setStoredUser(null) and non-shape values do not restore a user', () => {
  store.setStoredUser(null);
  assert.equal(store.getStoredUser(), null);
  globalThis.localStorage.setItem('ecosearch_user', JSON.stringify({ email: 'x@y.com' })); // missing id
  assert.equal(store.getStoredUser(), null);
  store.clearSession();
});
