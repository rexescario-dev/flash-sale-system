import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { comfortableStock, resolveComfortableStock } from './comfortable-stock';

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
