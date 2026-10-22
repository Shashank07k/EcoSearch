import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPrice } from '../src/utils/format.js';

test('formats whole-rupee demo prices with the Indian numbering system', () => {
  assert.equal(formatPrice(799), '₹799');
  assert.equal(formatPrice(1299), '₹1,299');
  assert.equal(formatPrice(24999), '₹24,999');
  assert.equal(formatPrice(74999), '₹74,999');
});

test('rounds fractional input and never shows cents', () => {
  assert.equal(formatPrice(199.49), '₹199');
  assert.equal(formatPrice(199.5), '₹200');
  assert.ok(!formatPrice(1299).includes('.'));
});

test('rejects invalid or negative values with the shared fallback', () => {
  for (const value of [undefined, null, Number.NaN, Number.POSITIVE_INFINITY, -1, '799']) {
    assert.equal(formatPrice(value), 'Price not supplied');
  }
  assert.equal(formatPrice(0), '₹0');
});
