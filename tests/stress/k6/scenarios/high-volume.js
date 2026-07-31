import { check } from 'k6';

import { classifyPurchaseResponse } from '../helpers/classify.js';
import { graphqlRequest, PURCHASE_ITEM } from '../helpers/graphql.js';
import { buildHandleSummary, recordBucket, SUMMARY_TREND_STATS } from '../helpers/metrics.js';
import { resolveProfile } from '../helpers/profiles.js';
import { loadState } from '../helpers/state.js';

const profile = resolveProfile(__ENV.PROFILE);
const graphqlUrl = __ENV.GRAPHQL_URL || 'http://localhost:3000/graphql';
// Metadata only — API limiter is operator-configured (performance.env.example).
const limiterProfile = __ENV.LIMITER_PROFILE || 'performance';
const environment = __ENV.STRESS_ENVIRONMENT || 'local';
const startedAt = new Date().toISOString();

const seededState = loadState();
const seededStock = seededState.stock;
const attempts = profile.attempts;

export const options = {
  scenarios: {
    default: {
      executor: 'shared-iterations',
      iterations: attempts,
      vus: profile.vus,
    },
  },
  summaryTrendStats: SUMMARY_TREND_STATS,
  thresholds: {
    // Correctness gates (comfortable stock ⇒ sold_out impossible).
    // purchase_rate_limited intentionally ungated — capacity signal.
    purchase_duplicate: ['count==0'],
    purchase_sold_out: ['count==0'],
    // 0 <= success <= seededStock (k6 count is always >= 0)
    purchase_success: [`count<=${seededStock}`],
    purchase_unexpected: ['count==0'],
  },
};

export function setup() {
  return {
    flashSaleId: seededState.flashSaleId,
    stock: seededState.stock,
    userIdPrefix: seededState.userIdPrefix,
  };
}

export default function (data) {
  const userId = `${data.userIdPrefix}-${__ITER}-${__VU}`;
  const res = graphqlRequest(graphqlUrl, {
    query: PURCHASE_ITEM,
    variables: {
      flashSaleId: data.flashSaleId,
      userId,
    },
  });

  const bucket = classifyPurchaseResponse(res.body, res.transportError);
  recordBucket(bucket);

  check(res, {
    'transport ok': (r) => r.transportError === false,
  });
}

export function handleSummary(data) {
  const enrich = buildHandleSummary({
    attempts,
    environment,
    limiterProfile,
    profile: profile.name,
    scenario: 'high-volume',
    startedAt,
  });
  const base = enrich(data);
  const purchaseSuccess = base.counters.purchase_success ?? 0;

  const summary = {
    ...base,
    purchaseSuccess,
    stock: seededStock,
    warnings: base.accountingOk
      ? []
      : [`Accounting mismatch: classifiedTotal=${base.classifiedTotal} attempts=${base.attempts}`],
  };

  const json = JSON.stringify(summary, null, 2);
  const out = { stdout: `${json}\n` };
  const summaryPath = __ENV.STRESS_SUMMARY_PATH;
  if (summaryPath) {
    out[summaryPath] = `${json}\n`;
  }
  return out;
}
