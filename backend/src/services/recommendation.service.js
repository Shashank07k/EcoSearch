/**
 * Deterministic comparison/recommendation engine.
 *
 * Design (simple, explainable, interview-defensible):
 *   1. Pick the product with the highest sustainability score.
 *   2. When products tie within SCORE_TIE_MARGIN points, the cheaper product wins.
 *   3. If the tie survives price comparison, the winner is declared by stable id order
 *      and the recommendation type becomes "tied".
 *   4. The recommendationType distinguishes:
 *        "best_sustainability"  — winner has a clear score advantage
 *        "better_value"         — winner wins on price after a score tie
 *        "tied"                 — genuine tie
 *        "no_data"              — none of the products have usable score data
 *   5. Reason codes are additive and factual (never invented):
 *        higher_sustainability_score
 *        similar_score_lower_price
 *        similar_score_similar_price
 *        no_sustainability_data
 *        better_reusability
 *        better_durability
 *
 * Trade-offs are explicit. A product with a lower score but much lower price
 * is surfaced as a "value_alternative" in the tradeoffs list.
 */

export const SCORE_TIE_MARGIN = 3;

const RECOMMENDATION_TYPES = {
  BEST: 'best_sustainability',
  VALUE: 'better_value',
  TIED: 'tied',
  NO_DATA: 'no_data',
};

function factorNamed(factors, name) {
  if (!Array.isArray(factors)) return null;
  return factors.find((f) => typeof f?.name === 'string' && f.name.toLowerCase() === name.toLowerCase()) || null;
}

function priceRatio(a, b) {
  if (typeof a !== 'number' || typeof b !== 'number' || a <= 0 || b <= 0) return 1;
  return Math.min(a, b) / Math.max(a, b);
}

export function buildRecommendation(products) {
  if (!Array.isArray(products) || products.length < 2) {
    throw new Error('Recommendation requires at least 2 products.');
  }

  const scored = products
    .map((product, index) => ({
      product,
      index,
      score: typeof product.sustainability?.score === 'number' ? product.sustainability.score : null,
      price: typeof product.price === 'number' && product.price >= 0 ? product.price : null,
    }))
    .sort((a, b) => {
      const sa = a.score ?? -Infinity;
      const sb = b.score ?? -Infinity;
      if (sa !== sb) return sb - sa;
      const pa = a.price ?? Infinity;
      const pb = b.price ?? Infinity;
      return pa - pb;
    });

  const hasAnyScore = scored.some((entry) => entry.score !== null);
  if (!hasAnyScore) {
    return {
      recommendedProductId: scored[0].product.id,
      recommendationType: RECOMMENDATION_TYPES.NO_DATA,
      reasonCodes: ['no_sustainability_data'],
      explanation: 'None of the selected products have a sustainability estimate, so the system cannot pick a best choice. Compare the available details yourself and re-analyze any product to get an estimate.',
      tradeoffs: scored.map((entry) => ({
        productName: entry.product.name,
        reason: 'No sustainability estimate available for this product.',
      })),
    };
  }

  const best = scored[0];
  const runnerUp = scored[1];
  const scoreDelta = (best.score ?? 0) - (runnerUp.score ?? 0);
  const isScoreTie = scoreDelta <= SCORE_TIE_MARGIN;

  const reasonCodes = [];
  let recommendationType;
  let explanation;
  const tradeoffs = [];

  if (isScoreTie) {
    if (best.price !== null && runnerUp.price !== null && best.price < runnerUp.price) {
      recommendationType = RECOMMENDATION_TYPES.VALUE;
      reasonCodes.push('similar_score_lower_price');
      explanation = `${best.product.name} and ${runnerUp.product.name} have similar sustainability estimates (within ${SCORE_TIE_MARGIN} points). ${best.product.name} is cheaper, so it is highlighted as the better-value pick.`;
    } else if (best.price !== null && runnerUp.price !== null && best.price > runnerUp.price) {
      recommendationType = RECOMMENDATION_TYPES.VALUE;
      reasonCodes.push('similar_score_lower_price');
      // The cheaper product is actually runnerUp; swap winner.
      [scored[0], scored[1]] = [scored[1], scored[0]];
      explanation = `${runnerUp.product.name} has a similar sustainability estimate to ${best.product.name} and is cheaper, so it is highlighted as the better-value pick.`;
    } else {
      recommendationType = RECOMMENDATION_TYPES.TIED;
      reasonCodes.push('similar_score_similar_price');
      explanation = `${best.product.name} and ${runnerUp.product.name} have similar sustainability estimates and similar prices. Either could be a reasonable choice.`;
    }
  } else {
    recommendationType = RECOMMENDATION_TYPES.BEST;
    reasonCodes.push('higher_sustainability_score');
    explanation = `${best.product.name} has the highest sustainability estimate in this comparison.`;
  }

  // Surface the runner-up as an explicit trade-off when scores differ.
  if (recommendationType === RECOMMENDATION_TYPES.BEST) {
    const priceMessage = runnerUp.price !== null && best.price !== null && runnerUp.price < best.price
      ? `It is cheaper (${formatPrice(runnerUp.price)} vs ${formatPrice(best.price)}), which may matter if budget is a priority.`
      : '';
    tradeoffs.push({
      productName: runnerUp.product.name,
      reason: `${runnerUp.product.name} scores lower on sustainability${priceMessage ? `, but ${priceMessage.toLowerCase()}` : ''}.`,
    });
  }

  // Factor-based reasons (reusability / durability) — factual, never invented.
  for (const factorName of ['Reusability', 'Durability']) {
    const winnerFactor = factorNamed(best.product.sustainability?.factors, factorName);
    const runnerFactor = factorNamed(runnerUp.product.sustainability?.factors, factorName);
    if (winnerFactor?.impact === 'positive' && (!runnerFactor || runnerFactor.impact !== 'positive')) {
      reasonCodes.push(`better_${factorName.toLowerCase()}`);
    }
  }

  // Surface any "value alternative" — a product with notably lower price but
  // still a positive sustainability score.
  for (const entry of scored.slice(1)) {
    if (entry.price === null || best.price === null) continue;
    if (entry.score === null) continue;
    if (entry.price < best.price && priceRatio(entry.price, best.price) <= 0.5 && entry.score >= 40) {
      tradeoffs.push({
        productName: entry.product.name,
        reason: `${entry.product.name} is much cheaper. It still has a ${scoreBandLabel(entry.score)} sustainability estimate, which may be acceptable depending on your priorities.`,
      });
    }
  }

  return {
    recommendedProductId: scored[0].product.id,
    recommendationType,
    reasonCodes: Array.from(new Set(reasonCodes)),
    explanation,
    tradeoffs,
  };
}

function formatPrice(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 'price not supplied';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

function scoreBandLabel(score) {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'moderate';
  return 'low';
}
