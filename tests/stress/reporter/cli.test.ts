import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { writeReport } from './cli';

describe('writeReport', () => {
  it('throws on missing summary and does not create report.md', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stress-report-'));
    const summaryPath = path.join(dir, 'k6-summary.json');
    const verifierPath = path.join(dir, 'verifier.json');
    const outPath = path.join(dir, 'report.md');
    fs.writeFileSync(verifierPath, JSON.stringify({ checks: [], ok: true, warnings: [] }));

    assert.throws(() => writeReport({ outPath, summaryPath, verifierPath }), /Missing artifact/);
    assert.equal(fs.existsSync(outPath), false);
  });

  it('throws on missing verifier and does not create report.md', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stress-report-'));
    const summaryPath = path.join(dir, 'k6-summary.json');
    const verifierPath = path.join(dir, 'verifier.json');
    const outPath = path.join(dir, 'report.md');
    fs.writeFileSync(
      summaryPath,
      JSON.stringify({
        counters: {},
        performance: {
          http_req_duration_ms: { avg: null, p50: null, p95: null, p99: null },
          http_reqs: { count: null, rate: null },
        },
        scenario: 'harness-smoke',
      }),
    );

    assert.throws(() => writeReport({ outPath, summaryPath, verifierPath }), /Missing artifact/);
    assert.equal(fs.existsSync(outPath), false);
  });
});
