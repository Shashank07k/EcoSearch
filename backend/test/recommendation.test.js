import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRecommendation, SCORE_TIE_MARGIN } from '../src/services/recommendation.service.js';

const base = (overrides) => ({
  id: overrides.id || '000000000000000000000001',
  name: overrides.name || 'Product',
  category: overrides.category || 'Home',
  brand: overrides.brand,
  price: overrides.price,
  sustainability: overrides.sustainability || {},
});

test('higher sustainability score wins by default', () => {
  const products = [
    base({ id: 'a', name: 'A', sustainability: { score: 70 } }),
    base({ id: 'b', name: 'B', sustainability: { score: 85 } }),
  ];
  const rec = buildRecommendation(products);
  assert.equal(rec.recommendedProductId, 'b');
  assert.equal(rec.recommendationType, 'best_sustainability');
  assert.ok(rec.reasonCodes.includes('higher_sustainability_score'));
});

test('tied score with cheaper runner-up picks better_value', () => {
  const products = [
    base({ id: 'a', name: 'A', sustainability: { score: 85 }, price: 1000 }),
    base({ id: 'b', name: 'B', sustainability: { score: 84 }, price: 300 }),
  ];
  const rec = buildRecommendation(products);
  assert.equal(rec.recommendationType, 'better_value');
  assert.equal(rec.recommendedProductId, 'b');
  assert.ok(rec.reasonCodes.includes('similar_score_lower_price'));
});

test('tied score and similar price yields a tied recommendation', () => {
  const products = [
    base({ id: 'a', name: 'A', sustainability: { score: 85 }, price: 500 }),
    base({ id: 'b', name: 'B', sustainability: { score: 84 }, price: 500 }),
  ];
  const rec = buildRecommendation(products);
  assert.equal(rec.recommendationType, 'tied');
  assert.ok(rec.reasonCodes.includes('similar_score_similar_price'));
});

test('missing sustainability data yields no_data recommendation', () => {
  const products = [base({ id: 'a', name: 'A' }), base({ id: 'b', name: 'B' })];
  const rec = buildRecommendation(products);
  assert.equal(rec.recommendationType, 'no_data');
  assert.ok(rec.reasonCodes.includes('no_sustainability_data'));
});

test('reusability factor on the winner adds better_reusability reason', () => {
  const products = [
    base({ id: 'a', name: 'A', sustainability: { score: 60, factors: [{ name: 'Reusability', impact: 'neutral' }] } }),
    base({ id: 'b', name: 'B', sustainability: { score: 82, factors: [{ name: 'Reusability', impact: 'positive' }] } }),
  ];
  const rec = buildRecommendation(products);
  assert.equal(rec.recommendedProductId, 'b');
  assert.ok(rec.reasonCodes.includes('better_reusability'));
});

test('tradeoffs include cheaper high-scoring alternatives when present', () => {
  const products = [
    base({ id: 'a', name: 'Premium', sustainability: { score: 92 }, price: 3000 }),
    base({ id: 'b', name: 'Budget', sustainability: { score: 55 }, price: 400 }),
  ];
  const rec = buildRecommendation(products);
  assert.equal(rec.recommendedProductId, 'a');
  assert.ok(rec.tradeoffs.some((t) => t.productName === 'Budget'));
});

test('score tie margin is a documented positive value', () => {
  assert.ok(SCORE_TIE_MARGIN > 0 && SCORE_TIE_MARGIN <= 10);
});
