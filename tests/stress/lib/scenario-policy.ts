import type { StressScenario } from '../seeder/types';

export const DUPLICATE_RACE_STOCK = 10;
export const DUPLICATE_RACE_FIXED_USER_ID = 'stress-user-duplicate-race';

export type StockKind = 'comfortable' | 'constant' | 'constrained';
export type LimiterProfile = 'correctness' | 'performance';

export type ScenarioPolicy = {
  fixedUserId: null | string;
  expectedLimiterProfile: LimiterProfile;
  expectsStockExhaustion: boolean;
  stockConstant: null | number;
  stockKind: StockKind;
};

export function getScenarioPolicy(scenario: StressScenario): ScenarioPolicy {
  switch (scenario) {
    case 'duplicate-race':
      return {
        fixedUserId: DUPLICATE_RACE_FIXED_USER_ID,
        expectedLimiterProfile: 'correctness',
        expectsStockExhaustion: false,
        stockConstant: DUPLICATE_RACE_STOCK,
        stockKind: 'constant',
      };
    case 'oversell':
      return {
        fixedUserId: null,
        expectedLimiterProfile: 'correctness',
        expectsStockExhaustion: true,
        stockConstant: null,
        stockKind: 'constrained',
      };
    case 'high-volume':
      return {
        fixedUserId: null,
        expectedLimiterProfile: 'performance',
        expectsStockExhaustion: false,
        stockConstant: null,
        stockKind: 'comfortable',
      };
    case 'harness-smoke':
    case 'purchase-load':
      return {
        fixedUserId: null,
        expectedLimiterProfile: 'correctness',
        expectsStockExhaustion: false,
        stockConstant: null,
        stockKind: 'comfortable',
      };
  }
}
