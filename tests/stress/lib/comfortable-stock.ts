import fs from 'node:fs';
import path from 'node:path';

import { isStressScenario } from '../seeder/types';
import { getScenarioPolicy } from './scenario-policy';

export const GENERIC_SEEDER_DEFAULT_STOCK = 1000;
export const COMFORTABLE_STOCK_MULTIPLIER = 1.2;
export const CONSTRAINED_STOCK_RATIO = 0.1;
export const CONSTRAINED_STOCK_MIN = 10;
export const CONSTRAINED_STOCK_MAX = 100;

export type StockPolicyScenario = 'duplicate-race' | 'oversell' | 'purchase-load';

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

/** @internal formula — exported for unit testing only; callers must use resolveStock */
export function comfortableStock(attempts: number): number {
  return Math.max(GENERIC_SEEDER_DEFAULT_STOCK, Math.ceil(attempts * COMFORTABLE_STOCK_MULTIPLIER));
}

/** @internal formula — exported for unit testing only; callers must use resolveStock */
export function constrainedStock(attempts: number): number {
  return Math.min(
    CONSTRAINED_STOCK_MAX,
    Math.max(CONSTRAINED_STOCK_MIN, Math.floor(attempts * CONSTRAINED_STOCK_RATIO)),
  );
}

/** Public stock-policy API: sole entry point for recommended seed stock. */
export function resolveStock(profileName: string, scenario: string): number {
  const profiles = loadProfiles();
  const profile = profiles[profileName];
  if (!profile) {
    throw new Error(`Unknown profile: ${profileName}`);
  }

  if (!isStressScenario(scenario)) {
    throw new Error(`Unsupported scenario for stock policy: ${scenario}`);
  }

  const policy = getScenarioPolicy(scenario);
  if (policy.stockConstant !== null) {
    return policy.stockConstant;
  }

  switch (scenario) {
    case 'purchase-load':
      return comfortableStock(profile.attempts);
    case 'oversell':
      return constrainedStock(profile.attempts);
    default:
      throw new Error(`Unsupported scenario for stock policy: ${scenario}`);
  }
}

/** Thin wrapper for #54 callers/tests — prefer resolveStock. */
export function resolveComfortableStock(profileName: string): number {
  return resolveStock(profileName, 'purchase-load');
}
