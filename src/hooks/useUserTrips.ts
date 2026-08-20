import { useCallback, useEffect, useRef, useState } from 'react';
import type { FirebaseDatabaseTypes } from '@react-native-firebase/database';
import { auth, getAuthedUser, database } from '@/src/lib/firebase';
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
  refetch: () => void;
}

type TripIndex = Record<string, { role: TripMemberRole; joinedAt: number }>;

export function useUserTrips(): UserTripsState {
  const [state, setState] = useState<Omit<UserTripsState, 'refetch'>>({ trips: [], status: 'loading' });

  // The most recent users/{uid}/trips index, so refetch() can re-run per-trip enrichment
  // without waiting on the index listener. archiveTrip/restoreTrip write only to
  // trips/{tripId}.deletedAt (see tripWrites.ts) — they never touch this index — so the
  // `ref.on('value', ...)` listener below never re-fires after a restore, and without this,
  // a restored trip would stay stuck in "Recently Deleted" until the screen remounted.
  const indexRef = useRef<TripIndex | null>(null);
  // Shared by the live listener effect and refetch() so a response landing after unmount
  // (from either path) can't set state on a torn-down component.
  const cancelledRef = useRef(false);
  // Monotonic token: only the most recently *started* enrichment run may setState. Without
  // this, two overlapping runs (e.g. the index listener refiring while a refetch() from a
  // prior run is still in flight) could have the earlier one resolve last and clobber newer
  // state with stale data — a risk the old synchronous handler never had.
  const seqRef = useRef(0);

  // Reads trips/{tripId} for every id in `index` and normalizes into UserTripEntry[], then
  // commits it to state. Shared by the live listener and refetch(). Per database.rules.json,
  // trips/{tripId}'s .read rule requires being the owner or a current member — a read this
  // user is no longer permitted to make (e.g. they were removed as a member) *rejects*, it
  // does not resolve a null/empty snapshot, so Promise.all needs a catch here or that
  // rejection goes unhandled and the hook silently stops updating instead of surfacing
  // status: 'error'.
  const enrichAndSetState = useCallback(async (index: TripIndex) => {
    const seq = ++seqRef.current;
    try {
      const trips: UserTripEntry[] = await Promise.all(
        Object.entries(index).map(async ([tripId, v]) => {
          const tripSnap = await database().ref(`trips/${tripId}`).once('value');
          const t = (tripSnap.val() ?? {}) as { name?: string; deletedAt?: number | null };
          return {
            tripId,
            role: v.role,
            joinedAt: v.joinedAt,
            // `name` should always be present by the time a trip's index entry exists —
            // createTrip.ts writes the full trip object to trips/{tripId} in one .set() call
            // *before* it ever adds the index entry this hook is keyed on (see
            // atomicTripWrite.ts) — so this is defensive, not modeling a real gap. A denied
            // read is a rejection (handled by the catch below), not a null/empty snapshot.
            name: t.name ?? tripId,
            deletedAt: t.deletedAt ?? null,
          };
        }),
      );
      if (cancelledRef.current || seq !== seqRef.current) return;
      setState({ trips, status: 'ready' });
    } catch {
      if (cancelledRef.current || seq !== seqRef.current) return;
      setState(prev => ({ ...prev, status: 'error' }));
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    let tripsRef: FirebaseDatabaseTypes.Reference | null = null;
    let listener: ((snap: { val: () => TripIndex | null }) => void | Promise<void>) | null = null;

    setState({ trips: [], status: 'loading' });

    (async () => {
      await getAuthedUser();
      const uid = auth().currentUser?.uid;
      if (!uid) {
        if (!cancelledRef.current) setState({ trips: [], status: 'error' });
        return;
      }
      if (cancelledRef.current) return;

      const ref = database().ref(`users/${uid}/trips`);
      const onValue = (snap: { val: () => TripIndex | null }) => {
        const val = snap.val();
        indexRef.current = val;
        if (val === null) {
          // A brand-new user who hasn't joined any trip yet is a normal state.
          const seq = ++seqRef.current;
          if (!cancelledRef.current && seq === seqRef.current) setState({ trips: [], status: 'ready' });
          return;
        }
        return enrichAndSetState(val);
      };
      const onCancel = () => setState(prev => ({ ...prev, status: 'error' }));

      ref.on('value', onValue, onCancel);
      tripsRef = ref;
      listener = onValue;
    })();

    return () => {
      cancelledRef.current = true;
      if (tripsRef && listener) tripsRef.off('value', listener);
    };
  }, [enrichAndSetState]);

  // After a write that only touches trips/{tripId} (restore/archive), re-run enrichment
  // against the last-known index instead of waiting on a listener that will never refire.
  const refetch = useCallback(() => {
    if (indexRef.current) enrichAndSetState(indexRef.current);
  }, [enrichAndSetState]);

  return { ...state, refetch };
}
