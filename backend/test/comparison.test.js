import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseComparisonIds, MIN_COMPARE, MAX_COMPARE } from '../src/services/comparison.service.js';

test('rejects fewer than the minimum products', () => {
  assert.throws(() => parseComparisonIds('507f1f77bcf86cd799439011'), { status: 400 });
  assert.throws(() => parseComparisonIds(''), { status: 400 });
  assert.throws(() => parseComparisonIds(undefined), { status: 400 });
});

test('rejects more than the maximum products', () => {
  const ids = Array.from({ length: 5 }, (_, i) => `507f1f77bcf86cd79943901${i}`);
  assert.throws(() => parseComparisonIds(ids.join(',')), { status: 400 });
});

test('rejects invalid ObjectIds', () => {
  assert.throws(() => parseComparisonIds('not-an-id,also-not'), { status: 400 });
});

test('dedupes identical ids before enforcing limits', () => {
  const id = '507f1f77bcf86cd799439011';
  const other = '507f1f77bcf86cd799439012';
  assert.deepEqual(parseComparisonIds(`${id},${id},${other}`), [id, other]);
});

test('enforces the documented 2-4 comparison window', () => {
  assert.equal(MIN_COMPARE, 2);
  assert.equal(MAX_COMPARE, 4);
});

test('accepts a valid list of 2-4 ids', () => {
  const ids = parseComparisonIds('507f1f77bcf86cd799439011,507f1f77bcf86cd799439012,507f1f77bcf86cd799439013');
  assert.equal(ids.length, 3);
});
