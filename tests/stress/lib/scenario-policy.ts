import type { StressScenario } from '../seeder/types';

export const DUPLICATE_RACE_STOCK = 10;
export const DUPLICATE_RACE_FIXED_USER_ID = 'stress-user-duplicate-race';

export type ScenarioPolicy = {
  fixedUserId: null | string;
  expectsStockExhaustion: boolean;
  stockConstant: null | number;
};

export function getScenarioPolicy(scenario: StressScenario): ScenarioPolicy {
  switch (scenario) {
    case 'duplicate-race':
      return {
        fixedUserId: DUPLICATE_RACE_FIXED_USER_ID,
        expectsStockExhaustion: false,
        stockConstant: DUPLICATE_RACE_STOCK,
      };
    case 'oversell':
      return {
        fixedUserId: null,
        expectsStockExhaustion: true,
        stockConstant: null,
      };
    case 'harness-smoke':
    case 'purchase-load':
    case 'high-volume':
      return {
        fixedUserId: null,
        expectsStockExhaustion: false,
        stockConstant: null,
      };
  }
}
