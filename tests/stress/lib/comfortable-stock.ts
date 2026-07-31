import fs from 'node:fs';
import path from 'node:path';

export const GENERIC_SEEDER_DEFAULT_STOCK = 1000;
export const COMFORTABLE_STOCK_MULTIPLIER = 1.2;

type Profile = {
  attempts: number;
  vus: number;
};

type Profiles = Record<string, Profile>;

function profilesPath(): string {
  return path.resolve(__dirname, '../shared/profiles.json');
}

export function loadProfiles(): Profiles {
  const raw = fs.readFileSync(profilesPath(), 'utf8');
  return JSON.parse(raw) as Profiles;
}

export function comfortableStock(attempts: number): number {
  return Math.max(GENERIC_SEEDER_DEFAULT_STOCK, Math.ceil(attempts * COMFORTABLE_STOCK_MULTIPLIER));
}

export function resolveComfortableStock(profileName: string): number {
  const profiles = loadProfiles();
  const profile = profiles[profileName];
  if (!profile) {
    throw new Error(`Unknown profile: ${profileName}`);
  }
  return comfortableStock(profile.attempts);
}
