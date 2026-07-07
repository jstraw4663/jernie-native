import { useEffect, useState } from 'react';
import { database } from '@/src/lib/firebase';
import type { TripMember } from '@/src/types';

export interface TripMembersState {
  members: TripMember[];
  status: 'loading' | 'ready' | 'error';
}

export function useTripMembers(tripId: string): TripMembersState {
  const [state, setState] = useState<TripMembersState>({ members: [], status: 'loading' });

  useEffect(() => {
    setState({ members: [], status: 'loading' });
    const membersRef = database().ref(`trips/${tripId}/members`);

    const listener = (snap: { val: () => Record<string, Omit<TripMember, 'uid'> & { uid?: string }> | null }) => {
      const val = snap.val();
      if (val === null) {
        // Empty collection is a valid, common state (e.g. a trip with no travelers yet) —
        // not an error, unlike useTripData's once()-fetch null guard.
        setState({ members: [], status: 'ready' });
        return;
      }
      const members: TripMember[] = Object.entries(val)
        .map(([key, m]) => ({ ...m, uid: m.uid ?? key } as TripMember));
      setState({ members, status: 'ready' });
    };

    const onCancel = () => setState(prev => ({ ...prev, status: 'error' }));

    membersRef.on('value', listener, onCancel);
    return () => membersRef.off('value', listener);
  }, [tripId]);

  return state;
}
