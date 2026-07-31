export const STRESS_SCENARIOS = [
  'harness-smoke',
  'purchase-load',
  'oversell',
  'duplicate-race',
  'high-volume',
] as const;

export type StressScenario = (typeof STRESS_SCENARIOS)[number];

/** Scenarios with a runnable k6 script (#53 harness-smoke, #54 purchase-load). */
export const RUNNABLE_K6_SCENARIOS = ['harness-smoke', 'purchase-load'] as const;

export type RunnableK6Scenario = (typeof RUNNABLE_K6_SCENARIOS)[number];

export type StressState = {
  fixedUserId: null | string;
  flashSaleId: string;
  productId: string;
  runId: string;
  scenario: StressScenario;
  stock: number;
  userIdPrefix: string;
};

export function isStressScenario(value: string): value is StressScenario {
  return (STRESS_SCENARIOS as readonly string[]).includes(value);
}

export function isRunnableK6Scenario(value: string): value is RunnableK6Scenario {
  return (RUNNABLE_K6_SCENARIOS as readonly string[]).includes(value);
}
