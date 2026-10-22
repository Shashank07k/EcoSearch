/**
 * Turns validated sustainability data into plain-language groupings for the
 * product details page. Everything here is derived from data that already
 * exists on the product or in a validated AI analysis — nothing is invented.
 */

const KNOWN_DIMENSIONS = [
  'Reusability',
  'Durability',
  'Materials',
  'Packaging',
  'Repairability',
  'Product lifespan',
  'Energy/resource implications',
  'End-of-life/recyclability',
];

/** Loose keyword match so AI factor names map onto the documented dimensions. */
const DIMENSION_KEYWORDS = {
  Reusability: ['reusab', 'reuse', 'refill'],
  Durability: ['durab', 'long-term', 'long term', 'sturdy', 'lifespan'],
  Materials: ['material', 'fibre', 'fiber', 'steel', 'bamboo', 'glass', 'plastic', 'cotton', 'organic'],
  Packaging: ['packag'],
  Repairability: ['repair', 'replaceab', 'spare'],
  'Product lifespan': ['lifespan', 'service life', 'longevity'],
  'Energy/resource implications': ['energy', 'manufactur', 'production', 'water use', 'resource', 'battery'],
  'End-of-life/recyclability': ['recycl', 'compost', 'end of life', 'end-of-life', 'disposal', 'biodegrad'],
};

function normalisedFactors(factors) {
  if (!Array.isArray(factors)) return [];
  return factors
    .filter((factor) => factor && typeof factor.name === 'string' && factor.name.trim())
    .map((factor) => ({
      name: factor.name.trim(),
      impact: ['positive', 'neutral', 'negative'].includes(factor.impact) ? factor.impact : 'neutral',
      description: typeof factor.description === 'string' && factor.description.trim()
        ? factor.description.trim()
        : 'Information not available.',
    }));
}

/**
 * @returns {{
 *   factors: Array, positives: Array, tradeoffs: Array,
 *   coverage: Array<{ dimension: string, covered: boolean }>,
 *   hasFactors: boolean
 * }}
 */
export function explainSustainability(factors) {
  const all = normalisedFactors(factors);
  const positives = all.filter((factor) => factor.impact === 'positive');
  // Neutral factors are genuine uncertainty, so they belong with the trade-offs.
  const tradeoffs = all.filter((factor) => factor.impact !== 'positive');

  const coverage = KNOWN_DIMENSIONS.map((dimension) => {
    const keywords = DIMENSION_KEYWORDS[dimension] || [dimension.toLowerCase()];
    const covered = all.some((factor) => {
      const haystack = `${factor.name} ${factor.description}`.toLowerCase();
      return keywords.some((keyword) => haystack.includes(keyword));
    });
    return { dimension, covered };
  });

  return { factors: all, positives, tradeoffs, coverage, hasFactors: all.length > 0 };
}

/** Alternatives are suggestions unless they reference a real catalog product. */
export function normaliseAlternatives(alternatives) {
  if (!Array.isArray(alternatives)) return [];
  return alternatives
    .filter((item) => item && typeof item.name === 'string' && item.name.trim())
    .map((item) => ({
      name: item.name.trim(),
      reason: typeof item.reason === 'string' && item.reason.trim() ? item.reason.trim() : 'No reason supplied.',
      productId: typeof item.productId === 'string' ? item.productId : null,
    }));
}

export { KNOWN_DIMENSIONS };
