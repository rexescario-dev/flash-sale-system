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

// Stock is immutable input from seed state — never recalculated from profile here.
const seededState = loadState();
const stock = seededState.stock;

export const options = {
  scenarios: {
    default: {
      executor: 'shared-iterations',
      iterations: profile.attempts,
      vus: profile.vus,
    },
  },
  summaryTrendStats: SUMMARY_TREND_STATS,
  thresholds: {
    purchase_duplicate: ['count==0'],
    purchase_rate_limited: ['count==0'],
    // purchase_sold_out intentionally ungated — expected business outcomes under constrained stock
    purchase_success: [`count>0`, `count<=${stock}`],
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
    attempts: profile.attempts,
    environment,
    limiterProfile,
    profile: profile.name,
    scenario: 'oversell',
    startedAt,
  });
  const base = enrich(data);
  const purchaseSuccess = base.counters.purchase_success ?? 0;
  const unusedStock = Math.max(0, stock - purchaseSuccess);
  const oversold = purchaseSuccess > stock;
  const warnings = [];
  if (!oversold && unusedStock > 0) {
    warnings.push(
      `Inventory not fully exhausted (${unusedStock} item${unusedStock === 1 ? '' : 's'} remaining).`,
    );
  }

  const summary = {
    ...base,
    oversell: oversold,
    purchaseSuccess,
    stock,
    unusedStock,
    warnings,
  };

  const json = JSON.stringify(summary, null, 2);
  const out = {
    stdout: `${json}\n`,
  };

  const summaryPath = __ENV.STRESS_SUMMARY_PATH;
  if (summaryPath) {
    out[summaryPath] = `${json}\n`;
  }

  return out;
}
