import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSearchQuery, HISTORY_DEDUP_WINDOW_MS } from '../src/services/history.service.js';

test('normalizes search queries by trim, case and collapsed whitespace', () => {
  assert.equal(normalizeSearchQuery('  Water  Bottle '), 'water bottle');
  assert.equal(normalizeSearchQuery('BAMBOO'), 'bamboo');
  assert.equal(normalizeSearchQuery(''), '');
});

test('dedup window is a short, documented interval (10 minutes)', () => {
  assert.equal(HISTORY_DEDUP_WINDOW_MS, 10 * 60 * 1000);
});
