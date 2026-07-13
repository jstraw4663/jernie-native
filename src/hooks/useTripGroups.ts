import { useTripLiveCollection } from '@/src/hooks/useTripLiveCollection';
import type { Group } from '@/src/types';

export interface TripGroupsState {
  groups: Group[];
  status: 'loading' | 'ready' | 'error';
}

export function useTripGroups(tripId: string): TripGroupsState {
  const { items, status } = useTripLiveCollection<Group>(
    tripId,
    'groups',
    (raw, key) => ({ ...(raw as Omit<Group, 'id'>), id: (raw as { id?: string }).id ?? key }),
  );
  return { groups: items, status };
}
