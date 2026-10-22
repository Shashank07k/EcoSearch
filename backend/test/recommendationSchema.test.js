import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRecommendationExplanation } from '../src/services/ai/recommendation.schema.js';

test('accepts a valid explanation and tradeoffs', () => {
  const out = validateRecommendationExplanation({
    explanation: 'Both bottles are reusable; the steel option is slightly better for longevity.',
    tradeoffs: [{ productName: 'Glass Bottle', reason: 'Heavier to ship.' }],
  });
  assert.equal(out.explanation.length > 0, true);
  assert.equal(out.tradeoffs.length, 1);
});

test('rejects missing explanation', () => {
  assert.throws(() => validateRecommendationExplanation({ explanation: '', tradeoffs: [] }));
});

test('rejects invalid tradeoff shape', () => {
  assert.throws(() => validateRecommendationExplanation({
    explanation: 'x',
    tradeoffs: [{ productName: 'A' }],
  }));
});

test('parses valid JSON strings', () => {
  const out = validateRecommendationExplanation(JSON.stringify({
    explanation: 'ok',
    tradeoffs: [],
  }));
  assert.equal(out.explanation, 'ok');
});

test('rejects invalid JSON strings', () => {
  assert.throws(() => validateRecommendationExplanation('{broken'));
});
