import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreRating, isAnalysisResponse } from '../src/utils/analysis.js';

for (const [score, label] of [[0, 'Low'], [39, 'Low'], [40, 'Moderate'], [59, 'Moderate'], [60, 'Good'], [79, 'Good'], [80, 'Excellent'], [100, 'Excellent']]) {
  test(`score ${score} is ${label}`, () => assert.equal(scoreRating(score).label, label));
}
for (const score of [-1, 101, NaN, Infinity, '84', null, undefined]) {
  test(`invalid score ${String(score)} is not assessed`, () => assert.equal(scoreRating(score).band, 'unknown'));
}
const valid = { success: true, cached: false, data: { score: 84, summary: 'An estimate.', factors: [{ name: 'Use', impact: 'neutral', description: 'Uncertain.' }], alternatives: [{ name: 'Another option', reason: 'A possible choice.' }] } };
test('valid and cached responses pass frontend validation', () => {
  assert.equal(isAnalysisResponse(valid), true);
  assert.equal(isAnalysisResponse({ ...valid, cached: true }), true);
});
for (const [name, data] of [
  ['missing score', { ...valid.data, score: undefined }],
  ['invalid score', { ...valid.data, score: 101 }],
  ['missing summary', { ...valid.data, summary: undefined }],
  ['invalid factors', { ...valid.data, factors: [{}] }],
  ['missing alternatives', { ...valid.data, alternatives: undefined }],
]) {
  test(`frontend rejects ${name}`, () => assert.equal(isAnalysisResponse({ ...valid, data }), false));
}
test('missing cached flag and invalid envelope are rejected', () => {
  assert.equal(isAnalysisResponse({ ...valid, cached: undefined }), false);
  assert.equal(isAnalysisResponse(null), false);
});
