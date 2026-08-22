import { useCallback, useEffect, useState } from 'react';
import { database, getAuthedUser } from '@/src/lib/firebase';

export interface UserProfileState {
  displayName: string | null;
  email: string | null;
  plan: string | undefined;
  status: 'loading' | 'ready' | 'error';
  refetch: () => void;
}

/**
 * Reads the signed-in user's own `users/{uid}` record.
 *
 * Separate from TripContext deliberately: this is the user across all trips, not their
 * membership in one. `users/{uid}` is readable only by its owner
 * (database.rules.json — `$uid === auth.uid`), so this can never be used to read anyone else.
 */
export function useUserProfile(uid: string | null): UserProfileState {
  const [state, setState] = useState<Omit<UserProfileState, 'refetch'>>({
    displayName: null, email: null, plan: undefined, status: 'loading',
  });

  const load = useCallback(async () => {
    if (!uid) {
      setState({ displayName: null, email: null, plan: undefined, status: 'ready' });
      return;
    }
    try {
      await getAuthedUser();
      const snap = await database().ref(`users/${uid}`).once('value');
      const val = (snap.val() ?? {}) as { displayName?: string; email?: string; plan?: string };
      setState({
        displayName: val.displayName ?? null,
        email: val.email ?? null,
        plan: val.plan,
        status: 'ready',
      });
    } catch {
      // Non-fatal: the You card falls back to the member handle and a Guest badge. A profile
      // read failing must never take the Profile tab down with it.
      setState(prev => ({ ...prev, status: 'error' }));
    }
  }, [uid]);

  useEffect(() => { void load(); }, [load]);

  return { ...state, refetch: () => { void load(); } };
}
