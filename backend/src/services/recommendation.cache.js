import { createHash } from 'node:crypto';

export const RECOMMENDATION_POLICY_VERSION = 'recommendation-v1';

/**
 * Stable fingerprint for a comparison. Identical product sets, regardless of
 * request order, hash to the same key. Combined with per-product
 * analysis versions + updatedAt to invalidate stale AI explanations.
 */
export function recommendationFingerprint(productIds, products) {
  const ids = [...productIds].map(String).sort();
  const versions = (products || []).map((p) => {
    const version = p?.sustainability?.analysisVersion || '';
    const updated = p?.updatedAt ? new Date(p.updatedAt).getTime() : 0;
    return `${p.id}:${version}:${updated}`;
  }).sort();
  return createHash('sha256')
    .update(RECOMMENDATION_POLICY_VERSION)
    .update('\n')
    .update(ids.join(','))
    .update('\n')
    .update(versions.join(','))
    .digest('hex');
}
