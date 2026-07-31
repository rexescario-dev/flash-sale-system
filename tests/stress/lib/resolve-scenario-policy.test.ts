import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  POLICY_FIELDS,
  parsePolicyArgs,
  resolvePolicyField,
} from './resolve-scenario-policy';

describe('resolvePolicyField', () => {
  it('returns expectedLimiterProfile for high-volume', () => {
    assert.equal(resolvePolicyField('high-volume', 'expectedLimiterProfile'), 'performance');
  });

  it('returns expectedLimiterProfile for purchase-load', () => {
    assert.equal(resolvePolicyField('purchase-load', 'expectedLimiterProfile'), 'correctness');
  });

  it('returns stockKind for oversell', () => {
    assert.equal(resolvePolicyField('oversell', 'stockKind'), 'constrained');
  });

  it('rejects unknown field / scenario', () => {
    assert.throws(() => resolvePolicyField('high-volume', 'notAField'), /Unknown field/);
    assert.throws(() => resolvePolicyField('nope', 'stockKind'), /Unsupported scenario|Unknown scenario/);
  });
});

describe('parsePolicyArgs', () => {
  it('parses --scenario and --field', () => {
    assert.deepEqual(parsePolicyArgs(['--scenario=high-volume', '--field=expectedLimiterProfile']), {
      help: false,
      scenario: 'high-volume',
      field: 'expectedLimiterProfile',
    });
  });

  it('requires both flags', () => {
    assert.throws(() => parsePolicyArgs(['--scenario=high-volume']), /--field/);
    assert.throws(() => parsePolicyArgs(['--field=stockKind']), /--scenario/);
  });
});

describe('POLICY_FIELDS', () => {
  it('includes expectedLimiterProfile and stockKind', () => {
    assert.ok(POLICY_FIELDS.includes('expectedLimiterProfile'));
    assert.ok(POLICY_FIELDS.includes('stockKind'));
  });
});
