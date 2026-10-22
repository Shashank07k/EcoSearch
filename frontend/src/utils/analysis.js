// UI interpretation only, not an official or scientific rating standard.
export function scoreRating(score) {
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 100) return { label: 'Not assessed', band: 'unknown' };
  if (score >= 80) return { label: 'Excellent', band: 'excellent' };
  if (score >= 60) return { label: 'Good', band: 'good' };
  if (score >= 40) return { label: 'Moderate', band: 'moderate' };
  return { label: 'Low', band: 'low' };
}

const text = (v) => typeof v === 'string' && v.trim().length > 0;
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Never render a malformed successful response as an assessment. */
export function isAnalysisResponse(response) {
  const data = response?.data;
  return response?.success === true && typeof response.cached === 'boolean' && object(data) &&
    scoreRating(data.score).band !== 'unknown' && text(data.summary) && data.summary.length <= 2400 &&
    Array.isArray(data.factors) && data.factors.length <= 12 &&
    data.factors.every((f) => object(f) && text(f.name) && text(f.description) && ['positive', 'neutral', 'negative'].includes(f.impact)) &&
    Array.isArray(data.alternatives) && data.alternatives.length <= 6 &&
    data.alternatives.every((a) => object(a) && text(a.name) && text(a.reason));
}
