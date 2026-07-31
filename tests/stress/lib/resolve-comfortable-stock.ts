import { resolveStock, type StockPolicyScenario } from './comfortable-stock';

function printHelp(): void {
  process.stderr.write(`Usage:
  pnpm stress:stock --profile=<name> --scenario=<purchase-load|oversell|duplicate-race|high-volume>
  pnpm stress:stock <profile>   # compat: scenario defaults to purchase-load

Prints a single integer stock value on stdout.
`);
}

function normalizeArgv(argv: string[]): string[] {
  // pnpm/npm and nested wrappers may forward one or more lone `--` tokens.
  let out = argv;
  while (out[0] === '--') {
    out = out.slice(1);
  }
  return out;
}

function requireFlagValue(flag: string, value: string | undefined): string {
  if (!value || value.startsWith('-')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function parseArgs(argv: string[]): {
  help: boolean;
  profile: string;
  scenario: StockPolicyScenario;
} {
  let help = false;
  let profile: string | undefined;
  let scenario: StockPolicyScenario = 'purchase-load';
  const positionals: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === '--help' || arg === '-h') {
      help = true;
      continue;
    }
    if (arg.startsWith('--profile=')) {
      profile = requireFlagValue('--profile', arg.slice('--profile='.length));
      continue;
    }
    if (arg === '--profile') {
      profile = requireFlagValue('--profile', argv[++i]);
      continue;
    }
    if (arg.startsWith('--scenario=')) {
      scenario = requireFlagValue(
        '--scenario',
        arg.slice('--scenario='.length),
      ) as StockPolicyScenario;
      continue;
    }
    if (arg === '--scenario') {
      scenario = requireFlagValue('--scenario', argv[++i]) as StockPolicyScenario;
      continue;
    }
    if (arg.startsWith('-')) {
      throw new Error(`Unknown argument: ${arg}`);
    }
    positionals.push(arg);
  }

  if (help) {
    return { help: true, profile: 'smoke', scenario: 'purchase-load' };
  }

  if (!profile) {
    if (positionals.length === 1) {
      profile = positionals[0];
    } else {
      throw new Error('Missing --profile (or positional profile)');
    }
  } else if (positionals.length > 0) {
    throw new Error('Do not mix positional profile with --profile');
  }

  if (
    scenario !== 'purchase-load' &&
    scenario !== 'oversell' &&
    scenario !== 'duplicate-race' &&
    scenario !== 'high-volume'
  ) {
    throw new Error(
      `Unsupported --scenario: ${String(scenario)}. Expected purchase-load | oversell | duplicate-race | high-volume`,
    );
  }

  return { help: false, profile, scenario };
}

try {
  const parsed = parseArgs(normalizeArgv(process.argv.slice(2)));
  if (parsed.help) {
    printHelp();
    process.exit(0);
  }

  process.stdout.write(`${resolveStock(parsed.profile, parsed.scenario)}\n`);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
