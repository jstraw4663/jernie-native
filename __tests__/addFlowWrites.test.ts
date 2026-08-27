jest.mock('@react-native-firebase/database');
jest.mock('@/src/lib/firebase', () => ({
  getAuthedUser: jest.fn(() => Promise.resolve({ uid: 'test-uid' })),
  database: require('@react-native-firebase/database').default,
}));

import { mockRef, mockUpdate } from '@react-native-firebase/database';
import { getAuthedUser } from '@/src/lib/firebase';
import { commitCandidates, undoCommit } from '@/src/lib/addFlowWrites';
import type { Candidate } from '@/src/domain/candidate';
import type { ItineraryDay } from '@/src/types';

const STOP = 'stop-bar-harbor';
const DAY = '2026-09-27';

const itinerary: Record<string, ItineraryDay[]> = {
  [STOP]: [{ id: 'day-4', stopId: STOP, dateIso: DAY, items: [] }],
};

function candidate(label: string): Candidate {
  return {
    id: `cand-${label}`,
    type: 'eat',
    typeConfidence: 'guessed',
    identity: { name: label, subtitle: 'Seafood', icon: 'fork-knife' },
    fields: [],
    commit: {
      target: 'booking',
      booking: { stopId: STOP, type: 'restaurant', restaurantName: label, date: DAY },
      item: { stopId: STOP, dateIso: DAY, label, category: 'restaurant' },
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  (mockUpdate as jest.Mock).mockResolvedValue(undefined);
});

describe('commitCandidates', () => {
  test('writes the whole tray in a SINGLE root update', async () => {
    await commitCandidates('trip-1', [candidate('Thurstons'), candidate('Havana')], itinerary);

    // "Add 2 items writes once" — two bookings and one merged items array, one call.
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockRef).toHaveBeenCalledWith();

    const written = (mockUpdate as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(written).filter(p => p.includes('/bookings/'))).toHaveLength(2);
    expect(Object.keys(written).filter(p => p.endsWith('/items'))).toHaveLength(1);
  });

  test('requires an authenticated user', async () => {
    await commitCandidates('trip-1', [candidate('Thurstons')], itinerary);

    expect(getAuthedUser).toHaveBeenCalled();
  });

  test('returns the inverse, so one undo can reverse the batch', async () => {
    const inverse = await commitCandidates('trip-1', [candidate('Thurstons')], itinerary);

    const written = (mockUpdate as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(inverse).sort()).toEqual(Object.keys(written).sort());
    expect(Object.values(inverse).some(v => v === null)).toBe(true);
  });

  test('an empty tray writes nothing at all', async () => {
    const inverse = await commitCandidates('trip-1', [], itinerary);

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(inverse).toEqual({});
  });
});

describe('undoCommit', () => {
  test('applies the inverse in a single root update', async () => {
    const inverse = await commitCandidates('trip-1', [candidate('Thurstons')], itinerary);
    jest.clearAllMocks();
    (mockUpdate as jest.Mock).mockResolvedValue(undefined);

    await undoCommit(inverse);

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect((mockUpdate as jest.Mock).mock.calls[0][0]).toEqual(inverse);
  });

  test('undoing nothing writes nothing', async () => {
    await undoCommit({});

    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
