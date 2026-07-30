import { describe, expect, it } from 'vitest';

import { formatIdentityStatus } from './format-identity-status';

describe('formatIdentityStatus', () => {
  it('returns Guest copy for null', () => {
    expect(formatIdentityStatus(null)).toBe('Shopping as Guest');
  });

  it('returns copy with the identified userId', () => {
    expect(formatIdentityStatus('buyer-1')).toBe('Shopping as buyer-1');
  });
});
