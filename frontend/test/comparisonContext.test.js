import { test } from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
  removeItem(key) { this.map.delete(key); }
  clear() { this.map.clear(); }
}
globalThis.localStorage = new MemoryStorage();

test('comparison localStorage key is namespaced', () => {
  assert.equal(globalThis.localStorage.getItem('ecosearch_compare'), null);
});

test('comparison localStorage roundtrips JSON', () => {
  const items = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
  globalThis.localStorage.setItem('ecosearch_compare', JSON.stringify(items));
  assert.deepEqual(JSON.parse(globalThis.localStorage.getItem('ecosearch_compare')), items);
  globalThis.localStorage.removeItem('ecosearch_compare');
});
