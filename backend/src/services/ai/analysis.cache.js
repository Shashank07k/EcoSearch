import { createHash } from 'node:crypto';
import { analysisProductInput } from './sustainability.prompt.js';
import { validateAnalysis } from './analysis.schema.js';

// Bump when changing the prompt/assessment policy or intentionally refreshing a model.
export const ANALYSIS_VERSION = 'sustainability-v1';

export function analysisInputHash(product) {
  return createHash('sha256')
    .update(JSON.stringify({ version: ANALYSIS_VERSION, product: analysisProductInput(product) }))
    .digest('hex');
}

/** Seed/manual scores are NOT AI cache entries. Validate persisted data again. */
export function cachedAnalysis(product) {
  const saved = product.sustainability;
  if (!saved?.analyzedAt || !Number.isFinite(new Date(saved.analyzedAt).getTime()) ||
      saved.analysisVersion !== ANALYSIS_VERSION || saved.analysisInputHash !== analysisInputHash(product)) {
    return null;
  }
  try {
    return validateAnalysis({
      score: saved.score,
      summary: saved.summary,
      factors: saved.factors?.map(({ name, impact, description }) => ({ name, impact, description })),
      alternatives: product.ecoAlternatives?.map(({ name, reason }) => ({ name, reason })),
    });
  } catch {
    return null;
  }
}
