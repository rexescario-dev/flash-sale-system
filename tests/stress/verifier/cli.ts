import path from 'node:path';

import type { VerifyResult } from './verify-stress';

import { resultsDir, statePath } from '../seeder/paths';
import { isStressScenario, type StressScenario } from '../seeder/types';

function printHelp(): void {
  process.stdout.write(`Usage: tsx tests/stress/verifier/cli.ts [options]

Options:
  --scenario <name>          Stress scenario (default: harness-smoke)
  --profile <name>           Intensity profile (default: smoke)
  --state <path>             Override state JSON path
  --summary <path>           Override k6-summary.json path
  --allow-missing-summary    Skip dual-oracle match when summary is absent
  --stock <n>                Accepted for stress:test UX; ignored by verifier
  --help                     Show this help

By default the verifier requires results/<scenario>-<profile>/k6-summary.json
so dual-oracle checks (DB vs k6 success counters) run. Use
--allow-missing-summary only for seed-only DB invariant checks.

Example:
  pnpm --filter api exec tsx ../../tests/stress/verifier/cli.ts --scenario harness-smoke --profile smoke
`);
}

function parseArgs(argv: string[]): {
  allowMissingSummary: boolean;
  help: boolean;
  profile: string;
  scenario: StressScenario;
  stateFilePath?: string;
  summaryFilePath?: string;
} {
  let allowMissingSummary = false;
  let help = false;
  let scenario: StressScenario = 'harness-smoke';
  let profile = 'smoke';
  let stateFilePath: string | undefined;
  let summaryFilePath: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      help = true;
      continue;
    }
    if (arg === '--scenario') {
      const value = argv[++i];
      if (!value || !isStressScenario(value)) {
        throw new Error(
          `Invalid --scenario: ${String(value)}. Expected harness-smoke | purchase-load | oversell | duplicate-race | high-volume`,
        );
      }
      scenario = value;
      continue;
    }
    if (arg === '--profile') {
      const value = argv[++i];
      if (!value) {
        throw new Error('--profile requires a value');
      }
      profile = value;
      continue;
    }
    if (arg === '--state') {
      const value = argv[++i];
      if (!value) {
        throw new Error('--state requires a path');
      }
      stateFilePath = path.resolve(value);
      continue;
    }
    if (arg === '--summary') {
      const value = argv[++i];
      if (!value) {
        throw new Error('--summary requires a path');
      }
      summaryFilePath = path.resolve(value);
      continue;
    }
    if (arg === '--allow-missing-summary') {
      allowMissingSummary = true;
      continue;
    }
    if (arg === '--stock') {
      // Forwarded by stress:test for the seeder; ignored by verifier.
      const value = argv[++i];
      if (!value) {
        throw new Error('--stock requires a value');
      }
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { allowMissingSummary, help, profile, scenario, stateFilePath, summaryFilePath };
}

function formatResult(result: VerifyResult): string {
  const lines: string[] = [];
  lines.push(result.ok ? 'PASS' : 'FAIL');
  lines.push(
    `scenario=${result.scenario} profile=${result.profile} purchases=${result.purchaseCount}/${result.stock}`,
  );
  for (const check of result.checks) {
    lines.push(`  ${check.ok ? '✓' : '✗'} ${check.name}: ${check.detail}`);
  }
  lines.push(`artifact: ${result.artifactPath}`);
  return `${lines.join('\n')}\n`;
}

function normalizeArgv(argv: string[]): string[] {
  // pnpm/npm and nested wrappers may forward one or more lone `--` tokens.
  let out = argv;
  while (out[0] === '--') {
    out = out.slice(1);
  }
  return out;
}

async function main(): Promise<void> {
  const parsed = parseArgs(normalizeArgv(process.argv.slice(2)));
  if (parsed.help) {
    printHelp();
    return;
  }

  // Lazy-load so --help does not require a generated Prisma client.
  const { verifyStress } = await import('./verify-stress');

  const stateFile = parsed.stateFilePath ?? statePath(parsed.scenario);
  const outDir = resultsDir(parsed.scenario, parsed.profile);
  const summaryFile = parsed.summaryFilePath ?? path.join(outDir, 'k6-summary.json');

  process.stdout.write(
    `Verifying scenario=${parsed.scenario} profile=${parsed.profile}\n` +
      `  state: ${stateFile}\n` +
      `  summary: ${summaryFile}${parsed.allowMissingSummary ? ' (optional)' : ' (required)'}\n`,
  );

  const result = await verifyStress({
    allowMissingSummary: parsed.allowMissingSummary,
    profile: parsed.profile,
    scenario: parsed.scenario,
    stateFilePath: parsed.stateFilePath,
    summaryFilePath: parsed.summaryFilePath,
  });

  process.stdout.write(formatResult(result));
  if (!result.ok) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
