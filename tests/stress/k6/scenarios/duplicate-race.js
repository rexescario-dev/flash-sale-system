import { check } from 'k6';

import { classifyPurchaseResponse } from '../helpers/classify.js';
import { graphqlRequest, PURCHASE_ITEM } from '../helpers/graphql.js';
import { buildHandleSummary, recordBucket, SUMMARY_TREND_STATS } from '../helpers/metrics.js';
import { resolveProfile } from '../helpers/profiles.js';
import { loadState } from '../helpers/state.js';

const profile = resolveProfile(__ENV.PROFILE);
const graphqlUrl = __ENV.GRAPHQL_URL || 'http://localhost:3000/graphql';
const limiterProfile = __ENV.LIMITER_PROFILE || 'correctness';
const environment = __ENV.STRESS_ENVIRONMENT || 'local';
const startedAt = new Date().toISOString();

const seededState = loadState();
const stock = seededState.stock;
const attempts = profile.attempts;

if (!seededState.fixedUserId) {
  throw new Error('duplicate-race requires fixedUserId in stress state');
}

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
    purchase_duplicate: [`count==${attempts - 1}`],
    purchase_rate_limited: ['count==0'],
    purchase_sold_out: ['count==0'],
    purchase_success: ['count==1'],
    purchase_unexpected: ['count==0'],
  },
};

export function setup() {
  return {
    fixedUserId: seededState.fixedUserId,
    flashSaleId: seededState.flashSaleId,
    stock: seededState.stock,
  };
}

export default function (data) {
  const res = graphqlRequest(graphqlUrl, {
    query: PURCHASE_ITEM,
    variables: {
      flashSaleId: data.flashSaleId,
      userId: data.fixedUserId,
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
    scenario: 'duplicate-race',
    startedAt,
  });
  const base = enrich(data);
  const purchaseSuccess = base.counters.purchase_success ?? 0;
  const unusedStock = Math.max(0, stock - purchaseSuccess);

  const summary = {
    ...base,
    fixedUserId: seededState.fixedUserId,
    purchaseSuccess,
    stock,
    unusedStock,
    warnings: [],
  };

  const json = JSON.stringify(summary, null, 2);
  const out = { stdout: `${json}\n` };
  const summaryPath = __ENV.STRESS_SUMMARY_PATH;
  if (summaryPath) {
    out[summaryPath] = `${json}\n`;
  }
  return out;
}
