import { check } from 'k6';

import { classifyPurchaseResponse } from '../helpers/classify.js';
import { graphqlRequest, PURCHASE_ITEM } from '../helpers/graphql.js';
import { buildHandleSummary, recordBucket } from '../helpers/metrics.js';
import { resolveProfile } from '../helpers/profiles.js';
import { loadState } from '../helpers/state.js';

const profile = resolveProfile(__ENV.PROFILE);
const graphqlUrl = __ENV.GRAPHQL_URL || 'http://localhost:3000/graphql';
// Metadata only — API limiter is operator-configured (performance.env.example).
const limiterProfile = __ENV.LIMITER_PROFILE || 'performance';
const environment = __ENV.STRESS_ENVIRONMENT || 'local';

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
  // Ensure p50/p95/p99 appear in handleSummary metrics (k6 defaults omit some percentiles).
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
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

function metricValue(data, name, key) {
  const m = data && data.metrics ? data.metrics[name] : undefined;
  if (!m || !m.values) return null;
  const v = m.values[key];
  return typeof v === 'number' ? v : null;
}

export function handleSummary(data) {
  const enrich = buildHandleSummary({
    environment,
    limiterProfile,
    profile: profile.name,
    scenario: 'high-volume',
  });
  const base = enrich(data);
  const c = base.counters;
  const purchaseSuccess = c.purchase_success ?? 0;
  const purchaseDuplicate = c.purchase_duplicate ?? 0;
  const purchaseSoldOut = c.purchase_sold_out ?? 0;
  const purchaseRateLimited = c.purchase_rate_limited ?? 0;
  const purchaseUnexpected = c.purchase_unexpected ?? 0;
  const classifiedTotal =
    purchaseSuccess +
    purchaseDuplicate +
    purchaseSoldOut +
    purchaseRateLimited +
    purchaseUnexpected;
  const accountingOk = classifiedTotal === attempts;

  const performance = {
    http_req_duration_ms: {
      avg: metricValue(data, 'http_req_duration', 'avg'),
      p50:
        metricValue(data, 'http_req_duration', 'p(50)') ??
        metricValue(data, 'http_req_duration', 'med'),
      p95: metricValue(data, 'http_req_duration', 'p(95)'),
      p99: metricValue(data, 'http_req_duration', 'p(99)'),
    },
    http_reqs: {
      count: metricValue(data, 'http_reqs', 'count'),
      rate: metricValue(data, 'http_reqs', 'rate'),
    },
  };

  const summary = {
    ...base,
    accountingOk,
    attempts,
    classifiedTotal,
    performance,
    purchaseSuccess,
    stock: seededStock,
    warnings: accountingOk
      ? []
      : [`Accounting mismatch: classifiedTotal=${classifiedTotal} attempts=${attempts}`],
  };

  const json = JSON.stringify(summary, null, 2);
  const out = { stdout: `${json}\n` };
  const summaryPath = __ENV.STRESS_SUMMARY_PATH;
  if (summaryPath) {
    out[summaryPath] = `${json}\n`;
  }
  return out;
}
