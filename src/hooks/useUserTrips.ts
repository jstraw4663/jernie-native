import { useEffect, useState } from 'react';
import type { FirebaseDatabaseTypes } from '@react-native-firebase/database';
import { auth, authReady, database } from '@/src/lib/firebase';
import type { TripMemberRole } from '@/src/types';

export interface UserTripEntry {
  tripId: string;
  role: TripMemberRole;
  joinedAt: number;
  name: string;
  deletedAt: number | null;
}

export interface UserTripsState {
  trips: UserTripEntry[];
  status: 'loading' | 'ready' | 'error';
}

export function useUserTrips(): UserTripsState {
  const [state, setState] = useState<UserTripsState>({ trips: [], status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    let tripsRef: FirebaseDatabaseTypes.Reference | null = null;
    let listener: ((snap: { val: () => Record<string, { role: TripMemberRole; joinedAt: number }> | null }) => void | Promise<void>) | null = null;

    setState({ trips: [], status: 'loading' });

    (async () => {
      await authReady;
      const uid = auth().currentUser?.uid;
      if (!uid) {
        if (!cancelled) setState({ trips: [], status: 'error' });
        return;
      }
      if (cancelled) return;

      const ref = database().ref(`users/${uid}/trips`);
      const onValue = async (snap: { val: () => Record<string, { role: TripMemberRole; joinedAt: number }> | null }) => {
        const val = snap.val();
        if (val === null) {
          // A brand-new user who hasn't joined any trip yet is a normal state.
          if (!cancelled) setState({ trips: [], status: 'ready' });
          return;
        }
        const trips: UserTripEntry[] = await Promise.all(
          Object.entries(val).map(async ([tripId, v]) => {
            const tripSnap = await database().ref(`trips/${tripId}`).once('value');
            const t = (tripSnap.val() ?? {}) as { name?: string; deletedAt?: number | null };
            return {
              tripId,
              role: v.role,
              joinedAt: v.joinedAt,
              // A trip the user was removed from (or one mid-deletion) can read back null —
              // fall back to the id rather than rendering an empty row.
              name: t.name ?? tripId,
              deletedAt: t.deletedAt ?? null,
            };
          }),
        );
        // The per-trip reads above are async, so the component may have unmounted
        // while they were in flight — re-check before touching state.
        if (cancelled) return;
        setState({ trips, status: 'ready' });
      };
      const onCancel = () => setState(prev => ({ ...prev, status: 'error' }));

      ref.on('value', onValue, onCancel);
      tripsRef = ref;
      listener = onValue;
    })();

    return () => {
      cancelled = true;
      if (tripsRef && listener) tripsRef.off('value', listener);
    };
  }, []);

  return state;
}
