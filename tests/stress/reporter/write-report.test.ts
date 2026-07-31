import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { renderReportMarkdown } from './write-report';

const summary = {
  accountingOk: true,
  attempts: 100,
  classifiedTotal: 100,
  counters: {
    purchase_duplicate: 99,
    purchase_rate_limited: 0,
    purchase_sold_out: 0,
    purchase_success: 1,
    purchase_unexpected: 0,
  },
  environment: 'local',
  limiterProfile: 'correctness',
  performance: {
    http_req_duration_ms: { avg: 10, p50: 8, p95: 20, p99: 40 },
    http_reqs: { count: 100, rate: 50 },
  },
  profile: 'smoke',
  scenario: 'duplicate-race',
  startedAt: '2026-07-31T12:26:36.191Z',
  warnings: ['example warning'],
};

const verifier = {
  checks: [
    { detail: 'Loaded k6 summary (1 successes)', name: 'k6_summary_present', ok: true },
    { detail: 'purchase_count=1 stock=10', name: 'purchase_count_lte_stock', ok: true },
  ],
  ok: true,
  profile: 'smoke',
  scenario: 'duplicate-race',
  warnings: [],
};

describe('renderReportMarkdown', () => {
  it('includes major sections in order', () => {
    const md = renderReportMarkdown(summary, verifier);
    const idxMeta = md.indexOf('## Metadata');
    const idxCounters = md.indexOf('## Counters');
    const idxPerf = md.indexOf('## Performance');
    const idxVerify = md.indexOf('## Verification');
    const idxWarn = md.indexOf('## Warnings');
    assert.ok(idxMeta >= 0);
    assert.ok(idxCounters > idxMeta);
    assert.ok(idxPerf > idxCounters);
    assert.ok(idxVerify > idxPerf);
    assert.ok(idxWarn > idxVerify);
  });

  it('renders counters, p95/p99, throughput rate, and verifier PASS', () => {
    const md = renderReportMarkdown(summary, verifier);
    assert.match(md, /purchase_success:\s*1/);
    assert.match(md, /p95:\s*20/);
    assert.match(md, /p99:\s*40/);
    assert.match(md, /throughput \(http_reqs\.rate\):\s*50/);
    assert.match(md, /Result:\s*PASS/);
  });

  it('shows unavailable for null performance values; never invents numbers', () => {
    const md = renderReportMarkdown(
      {
        ...summary,
        performance: {
          http_req_duration_ms: { avg: null, p50: null, p95: null, p99: null },
          http_reqs: { count: null, rate: null },
        },
        warnings: [],
      },
      { ...verifier, ok: false, warnings: ['vwarn'] },
    );
    assert.match(md, /p95:\s*unavailable/);
    assert.match(md, /throughput \(http_reqs\.rate\):\s*unavailable/);
    assert.match(md, /Result:\s*FAIL/);
    assert.match(md, /vwarn/);
  });

  it('prints unavailable for counters when counters object is missing; does not throw', () => {
    const { counters: _omit, ...summaryWithoutCounters } = summary;
    const md = renderReportMarkdown(summaryWithoutCounters, verifier);
    assert.match(md, /purchase_success:\s*unavailable/);
    assert.match(md, /purchase_unexpected:\s*unavailable/);
  });
});
