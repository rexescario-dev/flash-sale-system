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

// open() is init-context only — load here; setup() returns the VU-facing slice.
const seededState = loadState();

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
    purchase_rate_limited: ['count==0'],
    // Harness proof: must exercise GraphQL successfully (comfortable stock +
    // correctness limiter on the API process — see k6/config/correctness.env.example).
    purchase_success: ['count>0'],
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
    scenario: 'harness-smoke',
    startedAt,
  });
  const summary = enrich(data);
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
