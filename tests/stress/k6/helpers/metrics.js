import { Counter } from 'k6/metrics';

import {
  buildSharedDiagnostics,
  extractPerformance,
  getMetricCount,
  SUMMARY_TREND_STATS,
} from './summary-fields.js';

export { SUMMARY_TREND_STATS };

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

/**
 * Canonical base summary for all runnable scenarios.
 * Scenario-specific fields must be spread on by the caller (additive only).
 *
 * @param {{ scenario: string, profile: string, limiterProfile: string, environment: string, attempts: number, startedAt: string }} meta
 * @returns {(data: object) => object}
 */
export function buildHandleSummary({
  attempts,
  environment,
  limiterProfile,
  profile,
  scenario,
  startedAt,
}) {
  return function enrichSummary(data) {
    const counters = {
      purchase_duplicate: getMetricCount(data, 'purchase_duplicate'),
      purchase_rate_limited: getMetricCount(data, 'purchase_rate_limited'),
      purchase_sold_out: getMetricCount(data, 'purchase_sold_out'),
      purchase_success: getMetricCount(data, 'purchase_success'),
      purchase_unexpected: getMetricCount(data, 'purchase_unexpected'),
    };
    const diagnostics = buildSharedDiagnostics(counters, attempts);
    return {
      counters,
      environment,
      limiterProfile,
      performance: extractPerformance(data),
      profile,
      scenario,
      startedAt,
      ...diagnostics,
    };
  };
}
