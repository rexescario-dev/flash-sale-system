import { readFileSync } from 'node:fs';
import path from 'node:path';

export type SeedState = {
  products: {
    activeStock10Name: string;
    activeStock1Name: string;
    endedName: string;
    soldOutName: string;
    upcomingName: string;
  };
  sales: {
    activeStock10Id: string;
    activeStock1Id: string;
    endedId: string;
    soldOutId: string;
    upcomingId: string;
  };
};

export function loadSeedState(): SeedState {
  const file = path.join(__dirname, '../../seed-state.json');
  return JSON.parse(readFileSync(file, 'utf8')) as SeedState;
}
