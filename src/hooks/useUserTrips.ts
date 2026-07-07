import { useEffect, useState } from 'react';
import type { FirebaseDatabaseTypes } from '@react-native-firebase/database';
import { auth, authReady, database } from '@/src/lib/firebase';
import type { TripMemberRole } from '@/src/types';

export interface UserTripEntry {
  tripId: string;
  role: TripMemberRole;
  joinedAt: number;
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
    let listener: ((snap: { val: () => Record<string, { role: TripMemberRole; joinedAt: number }> | null }) => void) | null = null;

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
      const onValue = (snap: { val: () => Record<string, { role: TripMemberRole; joinedAt: number }> | null }) => {
        const val = snap.val();
        if (val === null) {
          // A brand-new user who hasn't joined any trip yet is a normal state.
          setState({ trips: [], status: 'ready' });
          return;
        }
        const trips: UserTripEntry[] = Object.entries(val)
          .map(([tripId, v]) => ({ tripId, role: v.role, joinedAt: v.joinedAt }));
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
