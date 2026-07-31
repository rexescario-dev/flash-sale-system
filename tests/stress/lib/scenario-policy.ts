import type { StressScenario } from '../seeder/types';

export const DUPLICATE_RACE_STOCK = 10;
export const DUPLICATE_RACE_FIXED_USER_ID = 'stress-user-duplicate-race';

export type StockKind = 'comfortable' | 'constrained' | 'constant';
export type LimiterProfile = 'correctness' | 'performance';

export type ScenarioPolicy = {
  fixedUserId: null | string;
  expectsStockExhaustion: boolean;
  stockConstant: null | number;
  stockKind: StockKind;
  expectedLimiterProfile: LimiterProfile;
};

export function getScenarioPolicy(scenario: StressScenario): ScenarioPolicy {
  switch (scenario) {
    case 'duplicate-race':
      return {
        fixedUserId: DUPLICATE_RACE_FIXED_USER_ID,
        expectsStockExhaustion: false,
        stockConstant: DUPLICATE_RACE_STOCK,
        stockKind: 'constant',
        expectedLimiterProfile: 'correctness',
      };
    case 'oversell':
      return {
        fixedUserId: null,
        expectsStockExhaustion: true,
        stockConstant: null,
        stockKind: 'constrained',
        expectedLimiterProfile: 'correctness',
      };
    case 'high-volume':
      return {
        fixedUserId: null,
        expectsStockExhaustion: false,
        stockConstant: null,
        stockKind: 'comfortable',
        expectedLimiterProfile: 'performance',
      };
    case 'harness-smoke':
    case 'purchase-load':
      return {
        fixedUserId: null,
        expectsStockExhaustion: false,
        stockConstant: null,
        stockKind: 'comfortable',
        expectedLimiterProfile: 'correctness',
      };
  }
}
