import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { unusedStockWarnings } from './unused-stock-warning';

describe('unusedStockWarnings', () => {
  it('is empty when inventory is exhausted', () => {
    assert.deepEqual(unusedStockWarnings(100, 100), []);
  });

  it('is empty when purchaseCount exceeds stock (oversell handled by hard gates)', () => {
    assert.deepEqual(unusedStockWarnings(100, 101), []);
  });

  it('emits a single warning when purchases are below stock', () => {
    assert.deepEqual(unusedStockWarnings(100, 99), [
      'WARNING: Inventory not fully exhausted. stock=100 purchaseCount=99 unusedStock=1',
    ]);
  });
});
