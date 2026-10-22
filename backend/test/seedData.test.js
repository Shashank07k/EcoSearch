import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoProducts } from '../src/scripts/seedData.js';

const CATEGORIES = ['Home', 'Clothing', 'Personal Care', 'Electronics', 'Food', 'Transportation'];

test('demo catalog contains 25–30 products', () => {
  assert.ok(
    demoProducts.length >= 25 && demoProducts.length <= 30,
    `expected 25–30 demo products, got ${demoProducts.length}`,
  );
});

test('every demo product has complete catalog fields', () => {
  for (const product of demoProducts) {
    assert.equal(typeof product.name, 'string');
    assert.ok(product.name.length > 2, `name: ${product.name}`);
    assert.equal(typeof product.description, 'string');
    assert.ok(CATEGORIES.includes(product.category), `category: ${product.category}`);
    assert.equal(typeof product.brand, 'string');
    assert.ok(Array.isArray(product.ecoAlternatives), `ecoAlternatives: ${product.name}`);
  }
  const names = demoProducts.map((p) => p.name);
  assert.equal(new Set(names).size, names.length, 'product names must be unique');
});

test('every demo price is a non-negative whole-rupee number', () => {
  for (const product of demoProducts) {
    assert.equal(typeof product.price, 'number', `price type: ${product.name}`);
    assert.ok(Number.isFinite(product.price) && product.price >= 0, `price value: ${product.name}`);
    assert.ok(Number.isInteger(product.price), `price must be whole rupees: ${product.name}`);
  }
});

test('every demo product has a valid illustrative sustainability estimate', () => {
  for (const product of demoProducts) {
    const score = product.sustainability?.score;
    assert.equal(typeof score, 'number', `score: ${product.name}`);
    assert.ok(score >= 0 && score <= 100, `score range: ${product.name}`);
    assert.equal(typeof product.sustainability.summary, 'string', `summary: ${product.name}`);
    assert.ok(Array.isArray(product.sustainability.factors), `factors: ${product.name}`);
    for (const factor of product.sustainability.factors) {
      assert.equal(typeof factor.name, 'string');
      assert.ok(['positive', 'neutral', 'negative'].includes(factor.impact));
    }
  }
});

test('new search terms resolve to useful demo results', () => {
  for (const term of ['bamboo', 'organic', 'solar', 'reusable', 'cotton', 'electric', 'glass', 'water']) {
    const matches = demoProducts.filter((p) =>
      [p.name, p.description, p.brand, p.category].join(' ').toLowerCase().includes(term),
    );
    assert.ok(matches.length >= 1, `expected at least one demo match for "${term}"`);
  }
});
