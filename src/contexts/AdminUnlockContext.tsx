import React, { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { registerTap, isUnlocked, NO_TAPS, type TapState } from '@/src/domain/profile';

interface AdminUnlockContextValue {
  unlocked: boolean;
  /** Called on every press of the Profile tab. Five inside the window opens the panel. */
  registerTabPress: () => void;
  lock: () => void;
}

const AdminUnlockContext = createContext<AdminUnlockContextValue>({
  unlocked: false,
  registerTabPress: () => {},
  lock: () => {},
});

/**
 * Holds the 5-tap admin unlock. It lives in a provider around the tab navigator rather than in
 * the Profile screen because the taps land on the tab BAR, which the screen does not own.
 *
 * All the counting logic is in src/domain/profile.ts — this is only the React plumbing around
 * it, which is what keeps the gesture unit-testable.
 */
export function AdminUnlockProvider({ children }: { children: ReactNode }) {
  const [taps, setTaps] = useState<TapState>(NO_TAPS);
  const [unlocked, setUnlocked] = useState(false);

  const registerTabPress = useCallback(() => {
    setTaps(prev => {
      const next = registerTap(prev, Date.now());
      if (isUnlocked(next)) setUnlocked(true);
      return next;
    });
  }, []);

  const lock = useCallback(() => {
    setUnlocked(false);
    // Reset the counter too: without this, closing the panel leaves the count at 5 and the
    // very next tap re-opens it, which reads as the panel refusing to close.
    setTaps(NO_TAPS);
  }, []);

  const value = useMemo(
    () => ({ unlocked, registerTabPress, lock }),
    [unlocked, registerTabPress, lock],
  );

  return <AdminUnlockContext.Provider value={value}>{children}</AdminUnlockContext.Provider>;
}

export function useAdminUnlock(): AdminUnlockContextValue {
  return useContext(AdminUnlockContext);
}
