import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoProducts } from '../src/scripts/seedData.js';

test('every seeded product has a non-empty imageUrl string', () => {
  for (const product of demoProducts) {
    assert.equal(typeof product.imageUrl, 'string', `imageUrl must be a string: ${product.name}`);
    assert.ok(
      product.imageUrl.trim().length > 0,
      `imageUrl must be non-empty: ${product.name}`,
    );
  }
  assert.equal(demoProducts.length, 28, 'demo catalog must stay at 28 products');
});

test('seeded image URLs are unique so no two products share a photo', () => {
  const urls = demoProducts.map((p) => p.imageUrl);
  assert.equal(new Set(urls).size, urls.length, 'image URLs must be unique per product');
});

test('seeded image URLs are remote https URLs', () => {
  for (const product of demoProducts) {
    assert.ok(product.imageUrl.startsWith('https://'), `must be https: ${product.name}`);
    assert.ok(!product.imageUrl.includes('localhost'), `must not be localhost: ${product.name}`);
    assert.ok(!product.imageUrl.startsWith('data:'), `must not be base64: ${product.name}`);
  }
});
