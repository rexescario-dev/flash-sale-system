import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildSharedDiagnostics,
  extractPerformance,
  getMetricCount,
  getMetricValue,
  SUMMARY_TREND_STATS,
} from './summary-fields.js';

describe('SUMMARY_TREND_STATS', () => {
  it('includes p(95) and p(99) so canonical latency fields can populate', () => {
    assert.ok(SUMMARY_TREND_STATS.includes('p(95)'));
    assert.ok(SUMMARY_TREND_STATS.includes('p(99)'));
    assert.ok(SUMMARY_TREND_STATS.includes('med'));
  });
});

describe('getMetricCount / getMetricValue', () => {
  it('reads count and named values; returns 0 / null when missing', () => {
    const data = {
      metrics: {
        http_req_duration: { values: { avg: 12.5, med: 10, 'p(95)': 40, 'p(99)': 90 } },
        purchase_success: { values: { count: 7 } },
      },
    };
    assert.equal(getMetricCount(data, 'purchase_success'), 7);
    assert.equal(getMetricCount(data, 'missing'), 0);
    assert.equal(getMetricValue(data, 'http_req_duration', 'avg'), 12.5);
    assert.equal(getMetricValue(data, 'missing', 'avg'), null);
  });
});

describe('extractPerformance', () => {
  it('always returns nested keys; maps med to p50; null when absent', () => {
    const empty = extractPerformance({});
    assert.deepEqual(empty, {
      http_req_duration_ms: { avg: null, p50: null, p95: null, p99: null },
      http_reqs: { count: null, rate: null },
    });

    const data = {
      metrics: {
        http_req_duration: {
          values: { avg: 1, med: 2, 'p(95)': 3, 'p(99)': 4 },
        },
        http_reqs: { values: { count: 100, rate: 25.5 } },
      },
    };
    assert.deepEqual(extractPerformance(data), {
      http_req_duration_ms: { avg: 1, p50: 2, p95: 3, p99: 4 },
      http_reqs: { count: 100, rate: 25.5 },
    });
  });
});

describe('buildSharedDiagnostics', () => {
  it('sums counters and derives accountingOk from attempts', () => {
    const counters = {
      purchase_duplicate: 99,
      purchase_rate_limited: 0,
      purchase_sold_out: 0,
      purchase_success: 1,
      purchase_unexpected: 0,
    };
    assert.deepEqual(buildSharedDiagnostics(counters, 100), {
      accountingOk: true,
      attempts: 100,
      classifiedTotal: 100,
    });
    assert.equal(buildSharedDiagnostics(counters, 99).accountingOk, false);
  });
});
