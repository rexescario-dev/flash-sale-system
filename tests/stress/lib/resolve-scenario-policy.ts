import { isStressScenario } from '../seeder/types';
import { getScenarioPolicy, type ScenarioPolicy } from './scenario-policy';

export const POLICY_FIELDS = [
  'expectedLimiterProfile',
  'stockKind',
  'expectsStockExhaustion',
  'fixedUserId',
  'stockConstant',
] as const;

export type PolicyField = (typeof POLICY_FIELDS)[number];

function isPolicyField(value: string): value is PolicyField {
  return (POLICY_FIELDS as readonly string[]).includes(value);
}

export function resolvePolicyField(scenario: string, field: string): string {
  if (!isStressScenario(scenario)) {
    throw new Error(`Unsupported scenario: ${scenario}`);
  }
  if (!isPolicyField(field)) {
    throw new Error(`Unknown field: ${field}. Expected one of ${POLICY_FIELDS.join(', ')}`);
  }
  const policy: ScenarioPolicy = getScenarioPolicy(scenario);
  const value = policy[field];
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function normalizeArgv(argv: string[]): string[] {
  let out = argv;
  while (out[0] === '--') out = out.slice(1);
  return out;
}

function requireFlagValue(flag: string, value: string | undefined): string {
  if (!value || value.startsWith('-')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

export function parsePolicyArgs(argv: string[]): {
  field: string;
  help: boolean;
  scenario: string;
} {
  let help = false;
  let scenario: string | undefined;
  let field: string | undefined;
  const args = normalizeArgv(argv);

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!;
    if (arg === '--help' || arg === '-h') {
      help = true;
      continue;
    }
    if (arg.startsWith('--scenario=')) {
      scenario = requireFlagValue('--scenario', arg.slice('--scenario='.length));
      continue;
    }
    if (arg === '--scenario') {
      scenario = requireFlagValue('--scenario', args[++i]);
      continue;
    }
    if (arg.startsWith('--field=')) {
      field = requireFlagValue('--field', arg.slice('--field='.length));
      continue;
    }
    if (arg === '--field') {
      field = requireFlagValue('--field', args[++i]);
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (help) {
    return { field: 'expectedLimiterProfile', help: true, scenario: 'high-volume' };
  }
  if (!scenario) throw new Error('Missing --scenario');
  if (!field) throw new Error('Missing --field');
  return { field, help: false, scenario };
}

function printHelp(): void {
  process.stderr.write(`Usage:
  pnpm stress:policy --scenario=<name> --field=<${POLICY_FIELDS.join('|')}>

Prints a single policy field value on stdout.
`);
}

const scriptPath = process.argv[1] ?? '';
const isDirect = scriptPath.endsWith('resolve-scenario-policy.ts');

if (isDirect) {
  try {
    const parsed = parsePolicyArgs(process.argv.slice(2));
    if (parsed.help) {
      printHelp();
      process.exit(0);
    }
    process.stdout.write(`${resolvePolicyField(parsed.scenario, parsed.field)}\n`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}
