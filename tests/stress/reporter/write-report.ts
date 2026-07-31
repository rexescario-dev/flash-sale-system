export type SummaryArtifact = {
  accountingOk?: boolean;
  attempts?: number;
  classifiedTotal?: number;
  counters?: Record<string, number | undefined>;
  environment?: string;
  limiterProfile?: string;
  performance?: {
    http_req_duration_ms?: {
      avg?: null | number;
      p50?: null | number;
      p95?: null | number;
      p99?: null | number;
    };
    http_reqs?: {
      count?: null | number;
      rate?: null | number;
    };
  };
  profile?: string;
  scenario?: string;
  startedAt?: string;
  warnings?: string[];
};

export type VerifierArtifact = {
  checks?: Array<{ detail?: string; name?: string; ok?: boolean }>;
  ok?: boolean;
  profile?: string;
  scenario?: string;
  warnings?: string[];
};

function fmt(value: null | number | undefined): string {
  return typeof value === 'number' ? String(value) : 'unavailable';
}

/**
 * Pure renderer. Derives no metrics, performs no verification, invents no values.
 */
export function renderReportMarkdown(summary: SummaryArtifact, verifier: VerifierArtifact): string {
  const c = summary.counters ?? {};
  const dur = summary.performance?.http_req_duration_ms ?? {};
  const reqs = summary.performance?.http_reqs ?? {};
  const warnings = [
    ...(Array.isArray(summary.warnings) ? summary.warnings : []),
    ...(Array.isArray(verifier.warnings) ? verifier.warnings : []),
  ];

  const lines: string[] = [
    '# Stress run report',
    '',
    '## Metadata',
    '',
    `- scenario: ${summary.scenario ?? 'unavailable'}`,
    `- profile: ${summary.profile ?? 'unavailable'}`,
    `- limiterProfile: ${summary.limiterProfile ?? 'unavailable'}`,
    `- environment: ${summary.environment ?? 'unavailable'}`,
    `- startedAt: ${summary.startedAt ?? 'unavailable'}`,
    `- attempts: ${fmt(summary.attempts)}`,
    `- classifiedTotal: ${fmt(summary.classifiedTotal)}`,
    `- accountingOk: ${summary.accountingOk === undefined ? 'unavailable' : String(summary.accountingOk)}`,
    '',
    '## Counters',
    '',
    `- purchase_success: ${fmt(c.purchase_success)}`,
    `- purchase_sold_out: ${fmt(c.purchase_sold_out)}`,
    `- purchase_duplicate: ${fmt(c.purchase_duplicate)}`,
    `- purchase_rate_limited: ${fmt(c.purchase_rate_limited)}`,
    `- purchase_unexpected: ${fmt(c.purchase_unexpected)}`,
    '',
    '## Performance',
    '',
    `- avg: ${fmt(dur.avg)}`,
    `- p50: ${fmt(dur.p50)}`,
    `- p95: ${fmt(dur.p95)}`,
    `- p99: ${fmt(dur.p99)}`,
    `- http_reqs.count: ${fmt(reqs.count)}`,
    `- throughput (http_reqs.rate): ${fmt(reqs.rate)}`,
    '',
    '## Verification',
    '',
    `- Result: ${verifier.ok === true ? 'PASS' : verifier.ok === false ? 'FAIL' : 'unavailable'}`,
  ];

  for (const check of verifier.checks ?? []) {
    const status = check.ok === true ? 'PASS' : check.ok === false ? 'FAIL' : '?';
    lines.push(`- [${status}] ${check.name ?? 'check'}: ${check.detail ?? ''}`);
  }

  lines.push('', '## Warnings', '');
  if (warnings.length === 0) {
    lines.push('- (none)');
  } else {
    for (const w of warnings) {
      lines.push(`- ${w}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}
