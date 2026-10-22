/**
 * Prompt for the AI explanation layer of the recommendation feature.
 *
 * The model receives ONLY:
 *   - structured comparison data already computed by the deterministic engine
 *   - the deterministic recommendation + reason codes
 *   - optional personalization context (recent search terms) if supplied
 *
 * The model must NOT:
 *   - invent product facts, certifications, or measurements
 *   - override the deterministic recommendation
 *   - produce HTML, markdown, or structured JSON outside the schema
 */
import { RECOMMENDATION_POLICY_VERSION } from '../recommendation.cache.js';

function formatProduct(product) {
  const score = typeof product.sustainability?.score === 'number' ? product.sustainability.score : 'no estimate';
  const summary = product.sustainability?.summary || 'no summary provided';
  const factors = Array.isArray(product.sustainability?.factors) && product.sustainability.factors.length
    ? product.sustainability.factors.map((f) => `  - ${f.name}: ${f.impact}${f.description ? ` — ${f.description}` : ''}`).join('\n')
    : '  (no factors supplied)';
  const price = typeof product.price === 'number' && product.price >= 0
    ? `$${product.price.toFixed(2)}`
    : 'price not supplied';
  return `${product.name} (${product.category || 'category not supplied'})
  Brand: ${product.brand || 'not supplied'}
  Price: ${price}
  Sustainability score: ${score}
  Summary: ${summary}
  Factors:
${factors}`;
}

export function buildRecommendationPrompt({ products, recommendation, reasonCodes, personalization }) {
  const productText = products.map(formatProduct).join('\n\n');
  const reasonText = reasonCodes.length ? reasonCodes.join(', ') : 'none';
  const personalizationText = Array.isArray(personalization) && personalization.length
    ? `\n\nPersonalization hint (secondary, do not let this override product facts): the user recently searched for: ${personalization.join(', ')}.`
    : '';
  const system = `You are explaining a deterministic eco-product recommendation for an interview-defensible decision-support UI. The backend has already selected the recommended product based on structured data. Your job is to explain why and call out trade-offs.

Rules:
- Do NOT invent product facts, certifications, precise measurements, or manufacturer claims.
- Do NOT contradict the backend recommendation. You may only explain or surface trade-offs.
- Do NOT use markdown, HTML, or structured JSON outside the requested schema.
- Use only the supplied product data. If something is missing, say so plainly.
- Acknowledge uncertainty when the information is incomplete.
- The sustainability score is an estimated assessment, not a scientific certification.
- Recommendation policy version: ${RECOMMENDATION_POLICY_VERSION}.
Return ONLY the requested JSON object with keys: explanation, tradeoffs.`;

  const user = `Products in this comparison:

${productText}

Backend recommendation: ${recommendation.recommendedProductId} (${recommendation.recommendationType}).
Reason codes: ${reasonText}.
Backend explanation draft: ${recommendation.explanation}
${personalizationText}

Please return the JSON object now.`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}
