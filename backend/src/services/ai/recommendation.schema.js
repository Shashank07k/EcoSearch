import { AnalysisError } from './analysisError.js';

// Wire schema for the AI recommendation explanation.
export const recommendationExplanationSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['explanation', 'tradeoffs'],
  properties: {
    explanation: { type: 'string', minLength: 1, maxLength: 4000 },
    tradeoffs: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['productName', 'reason'],
        properties: {
          productName: { type: 'string', minLength: 1, maxLength: 160 },
          reason: { type: 'string', minLength: 1, maxLength: 800 },
        },
      },
    },
  },
};

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function fail(message) {
  const err = new AnalysisError('AI_INVALID_RESPONSE');
  err.detail = message;
  throw err;
}

/** Validate and normalise AI output. Throws AnalysisError on any failure. */
export function validateRecommendationExplanation(raw) {
  let value = raw;
  if (typeof raw === 'string') {
    if (raw.length > 32_000) fail('response too large');
    try { value = JSON.parse(raw); }
    catch { fail('invalid JSON'); }
  }
  if (!isPlainObject(value)) fail('response must be an object');
  if (!Array.isArray(Object.keys(value)) || !value.explanation || !Array.isArray(value.tradeoffs)) {
    fail('missing required fields');
  }
  if (typeof value.explanation !== 'string' || value.explanation.trim().length === 0 || value.explanation.length > 4000) {
    fail('invalid explanation');
  }
  if (value.tradeoffs.length > 8) fail('too many tradeoffs');
  const tradeoffs = value.tradeoffs.map((item, i) => {
    if (!isPlainObject(item) || typeof item.productName !== 'string' || typeof item.reason !== 'string') {
      fail(`invalid tradeoff at index ${i}`);
    }
    const name = item.productName.trim();
    const reason = item.reason.trim();
    if (!name || name.length > 160) fail(`invalid tradeoff product name at index ${i}`);
    if (!reason || reason.length > 800) fail(`invalid tradeoff reason at index ${i}`);
    return { productName: name, reason };
  });
  return { explanation: value.explanation.trim(), tradeoffs };
}
