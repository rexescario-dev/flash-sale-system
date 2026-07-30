import { afterEach, describe, expect, it, vi } from 'vitest';

import { identityStorage } from './identity-storage';

describe('identityStorage', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns null when missing', () => {
    expect(identityStorage.get()).toBeNull();
  });

  it('round-trips exact string', () => {
    identityStorage.set(' user-123 ');
    expect(identityStorage.get()).toBe(' user-123 ');
  });

  it('clear returns to null', () => {
    identityStorage.set('a');
    identityStorage.clear();
    expect(identityStorage.get()).toBeNull();
  });

  it('returns null when value is empty string', () => {
    localStorage.setItem('flash-sale.userId', '');
    expect(identityStorage.get()).toBeNull();
  });

  it('returns null when value is whitespace-only', () => {
    localStorage.setItem('flash-sale.userId', '   ');
    expect(identityStorage.get()).toBeNull();
  });

  it('returns null when getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(identityStorage.get()).toBeNull();
  });

  it('set does not throw when setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => identityStorage.set('x')).not.toThrow();
  });

  it('clear does not throw when removeItem throws', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => identityStorage.clear()).not.toThrow();
  });
});
