import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  explainSustainability,
  normaliseAlternatives,
  KNOWN_DIMENSIONS,
} from '../src/utils/sustainabilityExplanation.js';

const factors = [
  { name: 'Reusability', impact: 'positive', description: 'Designed for repeated use.' },
  { name: 'Durability', impact: 'positive', description: 'Long service life.' },
  { name: 'Manufacturing', impact: 'neutral', description: 'Manufacturing still uses energy.' },
  { name: 'Packaging', impact: 'negative', description: 'Single-use packaging.' },
];

test('splits positives from trade-offs, treating neutral as uncertain', () => {
  const result = explainSustainability(factors);
  assert.deepEqual(result.positives.map((f) => f.name), ['Reusability', 'Durability']);
  assert.deepEqual(result.tradeoffs.map((f) => f.name), ['Manufacturing', 'Packaging']);
  assert.equal(result.hasFactors, true);
});

test('reports which documented dimensions have no information', () => {
  const { coverage } = explainSustainability(factors);
  assert.equal(coverage.length, KNOWN_DIMENSIONS.length);
  const covered = coverage.filter((entry) => entry.covered).map((entry) => entry.dimension);
  assert.ok(covered.includes('Reusability'));
  assert.ok(covered.includes('Packaging'));
  const missing = coverage.filter((entry) => !entry.covered).map((entry) => entry.dimension);
  assert.ok(missing.includes('Repairability'), 'repairability was never mentioned');
});

test('handles missing/empty factor data without inventing claims', () => {
  for (const input of [undefined, null, [], 'nope']) {
    const result = explainSustainability(input);
    assert.equal(result.hasFactors, false);
    assert.deepEqual(result.positives, []);
    assert.deepEqual(result.tradeoffs, []);
    assert.equal(result.coverage.every((entry) => entry.covered === false), true);
  }
});

test('normalises malformed factors instead of dropping the explanation', () => {
  const result = explainSustainability([
    { name: '  Materials  ', impact: 'bogus', description: '   ' },
    { name: '', impact: 'positive', description: 'ignored' },
  ]);
  assert.equal(result.factors.length, 1);
  assert.equal(result.factors[0].name, 'Materials');
  assert.equal(result.factors[0].impact, 'neutral', 'unknown impact falls back to neutral');
  assert.equal(result.factors[0].description, 'Information not available.');
});

test('alternatives keep catalog links but mark suggestions', () => {
  const result = normaliseAlternatives([
    { name: 'Glass bottle', reason: 'Reusable option.', productId: '507f1f77bcf86cd799439011' },
    { name: 'Refill station', reason: '' },
    { name: '   ', reason: 'dropped' },
  ]);
  assert.equal(result.length, 2);
  assert.equal(result[0].productId, '507f1f77bcf86cd799439011');
  assert.equal(result[1].productId, null);
  assert.equal(result[1].reason, 'No reason supplied.');
  assert.deepEqual(normaliseAlternatives(undefined), []);
});
