export const SUMMARY_TREND_STATS = ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'];

export function getMetricCount(data, name) {
  const m = data && data.metrics ? data.metrics[name] : undefined;
  if (!m || !m.values) return 0;
  if (typeof m.values.count === 'number') return m.values.count;
  return 0;
}

export function getMetricValue(data, name, key) {
  const m = data && data.metrics ? data.metrics[name] : undefined;
  if (!m || !m.values) return null;
  const v = m.values[key];
  return typeof v === 'number' ? v : null;
}

export function extractPerformance(data) {
  return {
    http_req_duration_ms: {
      avg: getMetricValue(data, 'http_req_duration', 'avg'),
      p50:
        getMetricValue(data, 'http_req_duration', 'p(50)') ??
        getMetricValue(data, 'http_req_duration', 'med'),
      p95: getMetricValue(data, 'http_req_duration', 'p(95)'),
      p99: getMetricValue(data, 'http_req_duration', 'p(99)'),
    },
    http_reqs: {
      count: getMetricValue(data, 'http_reqs', 'count'),
      rate: getMetricValue(data, 'http_reqs', 'rate'),
    },
  };
}

/**
 * @param {{ purchase_success: number, purchase_sold_out: number, purchase_duplicate: number, purchase_rate_limited: number, purchase_unexpected: number }} counters
 * @param {number} attempts
 */
export function buildSharedDiagnostics(counters, attempts) {
  const classifiedTotal =
    (counters.purchase_success ?? 0) +
    (counters.purchase_sold_out ?? 0) +
    (counters.purchase_duplicate ?? 0) +
    (counters.purchase_rate_limited ?? 0) +
    (counters.purchase_unexpected ?? 0);
  return {
    accountingOk: classifiedTotal === attempts,
    attempts,
    classifiedTotal,
  };
}
