import type { StressScenario } from './types';

import { statePath } from './paths';
import { isStressScenario, seedStress } from './seed-stress';

function printHelp(): void {
  process.stdout.write(`Usage: tsx tests/stress/seeder/cli.ts [options]

Options:
  --scenario <name>   Stress scenario (default: harness-smoke)
                      One of: harness-smoke | purchase-load | oversell |
                      duplicate-race | high-volume
  --profile <name>    Accepted for stress:test UX; ignored by seeder
  --stock <n>         Initial total/remaining stock (default: 1000)
  --help              Show this help

Example:
  pnpm --filter api exec tsx ../../tests/stress/seeder/cli.ts --scenario harness-smoke
`);
}

function parseArgs(argv: string[]): {
  help: boolean;
  scenario: StressScenario;
  stock?: number;
} {
  let help = false;
  let scenario: StressScenario = 'harness-smoke';
  let stock: number | undefined;

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
      // Forwarded by stress:test; seeder does not use intensity profiles.
      const value = argv[++i];
      if (!value) {
        throw new Error('--profile requires a value');
      }
      continue;
    }
    if (arg === '--stock') {
      const value = argv[++i];
      if (value === undefined) {
        throw new Error('--stock requires a non-negative integer');
      }
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 0) {
        throw new Error(`Invalid --stock: ${value}`);
      }
      stock = parsed;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { help, scenario, stock };
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

  const state = await seedStress({
    scenario: parsed.scenario,
    stock: parsed.stock,
  });
  const out = statePath(state.scenario);
  process.stdout.write(`Stress seed complete → ${out}\n${JSON.stringify(state, null, 2)}\n`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
