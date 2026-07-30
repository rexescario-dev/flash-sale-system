const STORAGE_KEY = 'flash-sale.userId';

export const identityStorage = {
  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  },
  get(): null | string {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      if (value === null || /^\s*$/.test(value)) {
        return null;
      }
      return value;
    } catch {
      return null;
    }
  },
  set(userId: string): void {
    try {
      localStorage.setItem(STORAGE_KEY, userId);
    } catch {
      // session continues via in-memory provider state
    }
  },
};
