import fs from 'node:fs';
import path from 'node:path';

import { isStressScenario, type StressScenario } from '../seeder/types';
import { renderReportMarkdown, type SummaryArtifact, type VerifierArtifact } from './write-report';

/** Reporter-local results path — do not import seeder/paths (reporting must not depend on seeding). */
function reporterResultsDir(scenario: string, profile: string): string {
  return path.resolve(__dirname, '..', 'results', `${scenario}-${profile}`);
}

function printHelp(): void {
  process.stdout.write(`Usage: tsx tests/stress/reporter/cli.ts [options]

Options:
  --scenario <name>   Stress scenario (default: harness-smoke)
  --profile <name>    Intensity profile (default: smoke)
  --summary <path>    Override k6-summary.json path
  --verifier <path>   Override verifier.json path
  --out <path>        Override report.md path
  --help              Show this help

Reads completed machine artifacts and writes a thin factual report.md.
Never reruns k6 or verification. Explicit path flags override scenario/profile defaults.
Duplicate flags are rejected.
`);
}

function parseArgs(argv: string[]): {
  help: boolean;
  outPath?: string;
  profile: string;
  scenario: StressScenario;
  summaryPath?: string;
  verifierPath?: string;
} {
  let help = false;
  let scenario: StressScenario = 'harness-smoke';
  let profile = 'smoke';
  let summaryPath: string | undefined;
  let verifierPath: string | undefined;
  let outPath: string | undefined;
  const seen = new Set<string>();

  const take = (flag: string): string => {
    if (seen.has(flag)) {
      throw new Error(`duplicate flag: ${flag}`);
    }
    seen.add(flag);
    return flag;
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      help = true;
      continue;
    }
    if (arg === '--scenario') {
      take(arg);
      i += 1;
      const value = argv[i];
      if (!value || !isStressScenario(value)) {
        throw new Error(`--scenario requires a valid scenario (got ${value ?? 'missing'})`);
      }
      scenario = value;
      continue;
    }
    if (arg === '--profile') {
      take(arg);
      i += 1;
      const value = argv[i];
      if (!value) throw new Error('--profile requires a value');
      profile = value;
      continue;
    }
    if (arg === '--summary') {
      take(arg);
      i += 1;
      const value = argv[i];
      if (!value) throw new Error('--summary requires a path');
      summaryPath = path.resolve(value);
      continue;
    }
    if (arg === '--verifier') {
      take(arg);
      i += 1;
      const value = argv[i];
      if (!value) throw new Error('--verifier requires a path');
      verifierPath = path.resolve(value);
      continue;
    }
    if (arg === '--out') {
      take(arg);
      i += 1;
      const value = argv[i];
      if (!value) throw new Error('--out requires a path');
      outPath = path.resolve(value);
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }

  return { help, outPath, profile, scenario, summaryPath, verifierPath };
}

function normalizeArgv(argv: string[]): string[] {
  // pnpm/npm and nested wrappers may forward one or more lone `--` tokens.
  let out = argv;
  while (out[0] === '--') {
    out = out.slice(1);
  }
  return out;
}

function readJson<T>(filePath: string): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing artifact: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

export function writeReport(options: {
  outPath: string;
  summaryPath: string;
  verifierPath: string;
}): void {
  const summary = readJson<SummaryArtifact>(options.summaryPath);
  const verifier = readJson<VerifierArtifact>(options.verifierPath);
  const md = renderReportMarkdown(summary, verifier);
  fs.mkdirSync(path.dirname(options.outPath), { recursive: true });
  fs.writeFileSync(options.outPath, md, 'utf8');
}

function main(argv: string[]): number {
  const parsed = parseArgs(normalizeArgv(argv));
  if (parsed.help) {
    printHelp();
    return 0;
  }
  const outDir = reporterResultsDir(parsed.scenario, parsed.profile);
  const summaryPath = parsed.summaryPath ?? path.join(outDir, 'k6-summary.json');
  const verifierPath = parsed.verifierPath ?? path.join(outDir, 'verifier.json');
  const outPath = parsed.outPath ?? path.join(outDir, 'report.md');
  writeReport({ outPath, summaryPath, verifierPath });
  process.stdout.write(`Wrote ${outPath}\n`);
  return 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`stress:report error: ${message}\n`);
  process.exitCode = 1;
}
