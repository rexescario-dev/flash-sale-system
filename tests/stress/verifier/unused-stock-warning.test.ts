import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { unusedStockWarnings } from './unused-stock-warning';

describe('unusedStockWarnings', () => {
  it('is empty when inventory is exhausted', () => {
    assert.deepEqual(unusedStockWarnings(100, 100, true), []);
  });

  it('is empty when purchaseCount exceeds stock', () => {
    assert.deepEqual(unusedStockWarnings(100, 101, true), []);
  });

  it('emits a warning when purchases are below stock and exhaustion is expected', () => {
    assert.deepEqual(unusedStockWarnings(100, 99, true), [
      'WARNING: Inventory not fully exhausted. stock=100 purchaseCount=99 unusedStock=1',
    ]);
  });

  it('is empty when leftover stock is expected (no exhaustion expectation)', () => {
    assert.deepEqual(unusedStockWarnings(10, 1, false), []);
  });
});
