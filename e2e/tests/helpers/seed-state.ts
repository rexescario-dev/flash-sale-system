import { readFileSync } from 'node:fs';
import path from 'node:path';

export type SeedState = {
  sales: { activeStock10Id: string; activeStock1Id: string };
};

export function loadSeedState(): SeedState {
  const file = path.join(__dirname, '../../seed-state.json');
  return JSON.parse(readFileSync(file, 'utf8')) as SeedState;
}
