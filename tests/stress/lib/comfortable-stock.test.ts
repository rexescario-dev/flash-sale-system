import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  comfortableStock,
  constrainedStock,
  resolveComfortableStock,
  resolveStock,
} from './comfortable-stock';
import { DUPLICATE_RACE_STOCK } from './scenario-policy';

describe('comfortableStock', () => {
  it('never returns less than the generic seeder default (1000)', () => {
    assert.equal(comfortableStock(100), 1000);
    assert.equal(comfortableStock(0), 1000);
  });

  it('applies 20% headroom above attempts when that exceeds 1000', () => {
    assert.equal(comfortableStock(1000), 1200);
    assert.equal(comfortableStock(10000), 12000);
  });

  it('ceils fractional products', () => {
    assert.equal(comfortableStock(1001), Math.max(1000, Math.ceil(1001 * 1.2)));
  });
});

describe('constrainedStock', () => {
  it('uses 10% of attempts clamped to [10, 100]', () => {
    assert.equal(constrainedStock(100), 10);
    assert.equal(constrainedStock(1000), 100);
    assert.equal(constrainedStock(10000), 100);
  });

  it('floors fractional products before clamp', () => {
    assert.equal(constrainedStock(199), 19); // floor(19.9)
    assert.equal(constrainedStock(50), 10); // max(10, floor(5))
  });
});

describe('resolveComfortableStock', () => {
  it('maps smoke / standard / full via shared profiles', () => {
    assert.equal(resolveComfortableStock('smoke'), 1000);
    assert.equal(resolveComfortableStock('standard'), 1200);
    assert.equal(resolveComfortableStock('full'), 12000);
  });

  it('rejects unknown profiles', () => {
    assert.throws(() => resolveComfortableStock('nope'), /Unknown profile/);
  });
});

describe('resolveStock', () => {
  it('routes purchase-load to comfortable stock', () => {
    assert.equal(resolveStock('smoke', 'purchase-load'), 1000);
    assert.equal(resolveStock('standard', 'purchase-load'), 1200);
    assert.equal(resolveStock('full', 'purchase-load'), 12000);
  });

  it('routes oversell to constrained stock', () => {
    assert.equal(resolveStock('smoke', 'oversell'), 10);
    assert.equal(resolveStock('standard', 'oversell'), 100);
    assert.equal(resolveStock('full', 'oversell'), 100);
  });

  it('routes duplicate-race to profile-independent DUPLICATE_RACE_STOCK', () => {
    assert.equal(resolveStock('smoke', 'duplicate-race'), DUPLICATE_RACE_STOCK);
    assert.equal(resolveStock('standard', 'duplicate-race'), DUPLICATE_RACE_STOCK);
    assert.equal(resolveStock('full', 'duplicate-race'), DUPLICATE_RACE_STOCK);
  });

  it('rejects unknown profiles and unsupported scenarios', () => {
    assert.throws(() => resolveStock('nope', 'oversell'), /Unknown profile/);
    assert.throws(() => resolveStock('smoke', 'high-volume'), /Unsupported scenario/);
  });
});
