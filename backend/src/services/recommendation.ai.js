import RecommendationCache from '../models/RecommendationCache.js';
import { buildRecommendationPrompt } from './ai/recommendation.prompt.js';
import { recommendationExplanationSchema, validateRecommendationExplanation } from './ai/recommendation.schema.js';
import { recommendationFingerprint, RECOMMENDATION_POLICY_VERSION } from './recommendation.cache.js';
import { AnalysisError } from './ai/analysisError.js';

/**
 * Optionally enrich a deterministic recommendation with an AI explanation.
 *
 * - If a cached explanation matches the current fingerprint, return it.
 * - Otherwise ask the provider for an explanation and validate it.
 * - Invalid provider output or provider failure returns null (caller falls
 *   back to the deterministic explanation). Cache is never written on failure.
 *
 * Personalization is a small list of recent search terms for the current user.
 * It is included in the prompt but is explicitly secondary.
 */
export async function maybeExplainRecommendation({
  provider,
  products,
  productIds,
  recommendation,
  personalization = [],
}) {
  if (!provider) return null;
  const fingerprint = recommendationFingerprint(productIds, products);

  try {
    const cached = await RecommendationCache.findOne({
      fingerprint,
      policyVersion: RECOMMENDATION_POLICY_VERSION,
    }).lean();
    if (cached) {
      return {
        explanation: cached.explanation,
        tradeoffs: Array.isArray(cached.tradeoffs) ? cached.tradeoffs : [],
        cached: true,
      };
    }
  } catch (error) {
    return null;
  }

  let raw;
  try {
    raw = await provider.generateAnalysis({
      messages: buildRecommendationPrompt({
        products,
        recommendation,
        reasonCodes: recommendation.reasonCodes,
        personalization,
      }),
      schema: recommendationExplanationSchema,
    });
  } catch (error) {
    if (error instanceof AnalysisError) return null;
    return null;
  }

  try {
    const validated = validateRecommendationExplanation(raw);
    try {
      await RecommendationCache.findOneAndUpdate(
        { fingerprint },
        {
          $set: {
            explanation: validated.explanation,
            tradeoffs: validated.tradeoffs,
            policyVersion: RECOMMENDATION_POLICY_VERSION,
            productSnapshot: products.map((p) => ({
              id: p.id,
              analysisVersion: p.sustainability?.analysisVersion || null,
              updatedAt: p.updatedAt || null,
            })),
          },
        },
        { upsert: true, new: true },
      );
    } catch {
      // Cache write failures do not fail the recommendation.
    }
    return { ...validated, cached: false };
  } catch {
    return null;
  }
}
