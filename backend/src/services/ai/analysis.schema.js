import { AnalysisError } from './analysisError.js';

export const IMPACTS = ['positive', 'neutral', 'negative'];

// The wire schema follows the existing Product factors / ecoAlternatives shape.
// No invented product references, certificates, or external links are requested.
export const analysisSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['score', 'summary', 'factors', 'alternatives'],
  properties: {
    score: { type: 'number', minimum: 0, maximum: 100 },
    summary: { type: 'string' },
    factors: {
      type: 'array',
      maxItems: 12,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'impact', 'description'],
        properties: {
          name: { type: 'string' },
          impact: { type: 'string', enum: IMPACTS },
          description: { type: 'string' },
        },
      },
    },
    alternatives: {
      type: 'array',
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'reason'],
        properties: { name: { type: 'string' }, reason: { type: 'string' } },
      },
    },
  },
};

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = () => { throw new AnalysisError('AI_INVALID_RESPONSE'); };
const exactKeys = (object, keys) => {
  if (!isObject(object) || Object.keys(object).length !== keys.length ||
      !keys.every((key) => Object.hasOwn(object, key))) fail();
};
const text = (value, maxLength) => {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) fail();
  return value.trim();
};

/** Strict independent validation before persistence. No coercion or JSON repair. */
export function validateAnalysis(raw) {
  let value = raw;
  if (typeof raw === 'string') {
    if (raw.length > 32_000) fail();
    try { value = JSON.parse(raw); } catch { fail(); }
  }
  exactKeys(value, ['score', 'summary', 'factors', 'alternatives']);
  if (typeof value.score !== 'number' || !Number.isFinite(value.score) ||
      value.score < 0 || value.score > 100) fail();
  if (!Array.isArray(value.factors) || value.factors.length > 12 ||
      !Array.isArray(value.alternatives) || value.alternatives.length > 6) fail();

  return {
    score: value.score,
    summary: text(value.summary, 2400),
    factors: value.factors.map((factor) => {
      exactKeys(factor, ['name', 'impact', 'description']);
      if (!IMPACTS.includes(factor.impact)) fail();
      return {
        name: text(factor.name, 120),
        impact: factor.impact,
        description: text(factor.description, 1200),
      };
    }),
    alternatives: value.alternatives.map((alternative) => {
      exactKeys(alternative, ['name', 'reason']);
      return { name: text(alternative.name, 160), reason: text(alternative.reason, 1200) };
    }),
  };
}
