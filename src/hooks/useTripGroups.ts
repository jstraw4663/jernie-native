import { useEffect, useState } from 'react';
import { database } from '@/src/lib/firebase';
import type { Group } from '@/src/types';

export interface TripGroupsState {
  groups: Group[];
  status: 'loading' | 'ready' | 'error';
}

export function useTripGroups(tripId: string): TripGroupsState {
  const [state, setState] = useState<TripGroupsState>({ groups: [], status: 'loading' });

  useEffect(() => {
    setState({ groups: [], status: 'loading' });
    const groupsRef = database().ref(`trips/${tripId}/groups`);

    const listener = (snap: { val: () => Record<string, Omit<Group, 'id'> & { id?: string }> | null }) => {
      const val = snap.val();
      if (val === null) {
        // A trip with no custom groups is a normal, common state — not an error.
        setState({ groups: [], status: 'ready' });
        return;
      }
      const groups: Group[] = Object.entries(val)
        .map(([key, g]) => ({ ...g, id: g.id ?? key } as Group));
      setState({ groups, status: 'ready' });
    };

    const onCancel = () => setState(prev => ({ ...prev, status: 'error' }));

    groupsRef.on('value', listener, onCancel);
    return () => groupsRef.off('value', listener);
  }, [tripId]);

  return state;
}
