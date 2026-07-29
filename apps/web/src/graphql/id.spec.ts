import { describe, expect, it } from 'vitest';

import { isNonWhitespaceId } from './id';

describe('isNonWhitespaceId', () => {
  it('rejects empty and whitespace-only', () => {
    expect(isNonWhitespaceId('')).toBe(false);
    expect(isNonWhitespaceId('   ')).toBe(false);
    expect(isNonWhitespaceId('\t\n')).toBe(false);
  });

  it('accepts ids with surrounding spaces without claiming they are trimmed', () => {
    expect(isNonWhitespaceId(' user-123 ')).toBe(true);
    expect(isNonWhitespaceId('user-123')).toBe(true);
  });
});
