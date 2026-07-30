import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';

import { isNonWhitespaceId } from '../../graphql/id';
import { identityStorage } from './identity-storage';

type UserIdentityContextValue = {
  userId: null | string;
  clearIdentity: () => void;
  setIdentity: (userId: string) => boolean;
};

const UserIdentityContext = createContext<null | UserIdentityContextValue>(null);

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<null | string>(() => identityStorage.get());

  const setIdentity = useCallback(
    (raw: string): boolean => {
      if (!isNonWhitespaceId(raw)) {
        return false;
      }
      if (userId === raw) {
        return true;
      }
      identityStorage.set(raw);
      setUserId(raw);
      return true;
    },
    [userId],
  );

  const clearIdentity = useCallback(() => {
    identityStorage.clear();
    setUserId(null);
  }, []);

  const value = useMemo(
    () => ({ userId, clearIdentity, setIdentity }),
    [clearIdentity, setIdentity, userId],
  );

  return <UserIdentityContext.Provider value={value}>{children}</UserIdentityContext.Provider>;
}

export function useUserIdentity(): UserIdentityContextValue {
  const ctx = useContext(UserIdentityContext);
  if (!ctx) {
    throw new Error('useUserIdentity must be used within IdentityProvider');
  }
  return ctx;
}
