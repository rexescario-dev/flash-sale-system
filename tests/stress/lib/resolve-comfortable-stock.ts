import { resolveComfortableStock } from './comfortable-stock';

function printHelp(): void {
  process.stderr.write(`Usage: pnpm stress:stock <profile>

Profiles are defined in tests/stress/shared/profiles.json (smoke, standard, full).
Prints a single integer stock value on stdout.
`);
}

const args = process.argv.slice(2);
if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  printHelp();
  process.exit(args.length === 0 ? 1 : 0);
}

if (args.length > 1) {
  process.stderr.write('error: expected exactly one profile argument\n');
  process.exit(1);
}

try {
  const stock = resolveComfortableStock(args[0]!);
  process.stdout.write(`${stock}\n`);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
