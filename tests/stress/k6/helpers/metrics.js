import { Counter } from 'k6/metrics';

export const purchaseSuccess = new Counter('purchase_success');
export const purchaseSoldOut = new Counter('purchase_sold_out');
export const purchaseDuplicate = new Counter('purchase_duplicate');
export const purchaseRateLimited = new Counter('purchase_rate_limited');
export const purchaseUnexpected = new Counter('purchase_unexpected');

/**
 * @param {'SUCCESS'|'SOLD_OUT'|'ALREADY_PURCHASED'|'RATE_LIMITED'|'UNEXPECTED_ERROR'} bucket
 */
export function recordBucket(bucket) {
  switch (bucket) {
    case 'SUCCESS':
      purchaseSuccess.add(1);
      break;
    case 'SOLD_OUT':
      purchaseSoldOut.add(1);
      break;
    case 'ALREADY_PURCHASED':
      purchaseDuplicate.add(1);
      break;
    case 'RATE_LIMITED':
      purchaseRateLimited.add(1);
      break;
    case 'UNEXPECTED_ERROR':
    default:
      purchaseUnexpected.add(1);
      break;
  }
}

function metricCount(data, name) {
  const m = data && data.metrics ? data.metrics[name] : undefined;
  if (!m || !m.values) return 0;
  if (typeof m.values.count === 'number') return m.values.count;
  return 0;
}

/**
 * Returns a handleSummary-compatible builder that embeds metadata + counters
 * into a JSON summary object for later #58 / verifier consumption.
 *
 * @param {{ scenario: string, profile: string, limiterProfile: string, environment: string }} meta
 * @returns {(data: object) => object}
 */
export function buildHandleSummary({ environment, limiterProfile, profile, scenario }) {
  return function enrichSummary(data) {
    return {
      counters: {
        purchase_duplicate: metricCount(data, 'purchase_duplicate'),
        purchase_rate_limited: metricCount(data, 'purchase_rate_limited'),
        purchase_sold_out: metricCount(data, 'purchase_sold_out'),
        purchase_success: metricCount(data, 'purchase_success'),
        purchase_unexpected: metricCount(data, 'purchase_unexpected'),
      },
      environment,
      limiterProfile,
      profile,
      scenario,
      startedAt: new Date().toISOString(),
    };
  };
}
