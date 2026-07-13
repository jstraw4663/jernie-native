import { useTripLiveCollection } from '@/src/hooks/useTripLiveCollection';
import type { TripMember } from '@/src/types';

export interface TripMembersState {
  members: TripMember[];
  status: 'loading' | 'ready' | 'error';
}

export function useTripMembers(tripId: string): TripMembersState {
  const { items, status } = useTripLiveCollection<TripMember>(
    tripId,
    'members',
    (raw, key) => ({ ...(raw as Omit<TripMember, 'uid'>), uid: (raw as { uid?: string }).uid ?? key }),
  );
  return { members: items, status };
}
