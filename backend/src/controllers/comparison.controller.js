import mongoose from 'mongoose';
import { compareProducts, attachComparisonFavoriteFlags } from '../services/comparison.service.js';
import { buildRecommendation } from '../services/recommendation.service.js';
import { maybeExplainRecommendation } from '../services/recommendation.ai.js';
import { getProviderForRecommendation } from '../services/ai/aiProvider.js';
import SearchHistory from '../models/SearchHistory.js';

export async function compare(req, res) {
  const data = await compareProducts(req.query.ids);
  if (req.user) {
    data.products = await attachComparisonFavoriteFlags(req.user.id, data.products);
  }
  res.json({ success: true, data });
}

async function loadPersonalization(userId) {
  if (!userId || !mongoose.isObjectIdOrHexString(userId)) return [];
  try {
    const rows = await SearchHistory.find({ user: userId })
      .sort({ searchedAt: -1 })
      .limit(5)
      .select('query normalizedQuery')
      .lean();
    const seen = new Set();
    const terms = [];
    for (const row of rows) {
      const term = row.normalizedQuery || row.query;
      if (term && !seen.has(term)) {
        seen.add(term);
        terms.push(term);
      }
    }
    return terms;
  } catch {
    return [];
  }
}

export function createRecommendController(providerOverride) {
  return async function recommend(req, res) {
    const rawIds = Array.isArray(req.body?.productIds) ? req.body.productIds : [];
    if (rawIds.length < 2) {
      return res.status(400).json({ success: false, error: { status: 400, message: 'Select at least 2 products to compare.' } });
    }
    const data = await compareProducts(rawIds.join(','));
    const recommendation = buildRecommendation(data.products);
    const personalization = req.user ? await loadPersonalization(req.user.id) : [];
    const provider = providerOverride || getProviderForRecommendation();
    const explanation = provider
      ? await maybeExplainRecommendation({
          provider,
          products: data.products,
          productIds: data.products.map((p) => p.id),
          recommendation,
          personalization,
        })
      : null;

    const payload = {
      ...recommendation,
      personalization,
    };
    if (explanation) {
      payload.aiExplanation = {
        explanation: explanation.explanation,
        tradeoffs: explanation.tradeoffs,
        cached: Boolean(explanation.cached),
      };
    }
    res.json({ success: true, data: payload });
  };
}

export const recommend = createRecommendController();
