import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DUPLICATE_RACE_FIXED_USER_ID,
  DUPLICATE_RACE_STOCK,
  getScenarioPolicy,
} from './scenario-policy';

describe('getScenarioPolicy', () => {
  it('defines DUPLICATE_RACE_STOCK as 10 (canonical literal)', () => {
    assert.equal(DUPLICATE_RACE_STOCK, 10);
  });

  it('defines duplicate-race as constant stock, fixed user, no exhaustion expectation', () => {
    const policy = getScenarioPolicy('duplicate-race');
    assert.equal(policy.stockConstant, DUPLICATE_RACE_STOCK);
    assert.equal(policy.fixedUserId, DUPLICATE_RACE_FIXED_USER_ID);
    assert.equal(policy.expectsStockExhaustion, false);
    assert.ok(typeof policy.fixedUserId === 'string' && policy.fixedUserId.length > 0);
  });

  it('defines oversell as exhaustion-expected with no fixed user', () => {
    const policy = getScenarioPolicy('oversell');
    assert.equal(policy.stockConstant, null);
    assert.equal(policy.fixedUserId, null);
    assert.equal(policy.expectsStockExhaustion, true);
  });

  it('defines purchase-load / harness / high-volume without fixed user or exhaustion expectation', () => {
    for (const scenario of ['purchase-load', 'harness-smoke', 'high-volume'] as const) {
      const policy = getScenarioPolicy(scenario);
      assert.equal(policy.stockConstant, null);
      assert.equal(policy.fixedUserId, null);
      assert.equal(policy.expectsStockExhaustion, false);
    }
  });
});
