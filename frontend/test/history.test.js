import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatSearchTime, historySearchPath } from '../src/utils/history.js';

test('historySearchPath encodes the query into the home hash route', () => {
  assert.equal(historySearchPath('water'), '/?q=water');
  assert.equal(historySearchPath('steel bottle'), '/?q=steel%20bottle');
});

test('formatSearchTime returns a readable string for valid dates', () => {
  const formatted = formatSearchTime('2026-01-15T12:00:00.000Z');
  assert.equal(typeof formatted, 'string');
  assert.notEqual(formatted, 'Unknown time');
  assert.equal(formatSearchTime('not-a-date'), 'Unknown time');
});
