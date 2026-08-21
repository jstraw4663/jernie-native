const mockStagedStore: Record<string, string> = {};
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (k: string) => mockStagedStore[k],
    set: (k: string, v: string) => { mockStagedStore[k] = v; },
    remove: (k: string) => { delete mockStagedStore[k]; },
  }),
}));

const mockOnce = jest.fn();
const mockUpdate = jest.fn();
const mockRefPath = jest.fn();
let mockCurrentUid = 'account-uid';
jest.mock('@/src/lib/firebase', () => ({
  database: () => ({
    ref: (path?: string) => { mockRefPath(path); return { once: mockOnce, update: mockUpdate }; },
  }),
  getAuthedUser: () => Promise.resolve({ uid: mockCurrentUid }),
}));

const mockWriteTripOnce = jest.fn();
jest.mock('@/src/lib/atomicTripWrite', () => ({
  writeTripOnce: (...a: unknown[]) => mockWriteTripOnce(...a),
}));

let mockIdSeq = 0;
jest.mock('@/src/utils/id', () => ({ generateId: () => `gen-${++mockIdSeq}` }));

import {
  migratableTripIds, captureTrips, remap, migrateStagedTrips, adoptAccount,
} from '@/src/lib/tripMigration';
import { readStagedMigration, stageMigration } from '@/src/lib/migrationStaging';

const ANON = 'anon-uid';

function snapshot(val: unknown) {
  return { exists: () => val !== null, val: () => val };
}

const tripA = {
  id: 'trip-a',
  name: 'Maine Coast',
  ownerUid: ANON,
  inviteToken: 'tok-old',
  createdAt: 100,
  members: { [ANON]: { uid: ANON, handle: 'Jeremy', role: 'organizer', joinedAt: 100 } },
  joinProofs: { [ANON]: 'tok-old' },
  stops: { 'stop-1': { id: 'stop-1', tripId: 'trip-a', city: 'Portland' } },
  places: { 'place-1': { id: 'place-1', tripId: 'trip-a', addedBy: ANON } },
  groups: { 'group-1': { id: 'group-1', tripId: 'trip-a', createdBy: ANON } },
};

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(mockStagedStore).forEach(k => delete mockStagedStore[k]);
  mockIdSeq = 0;
  mockCurrentUid = 'account-uid';
  mockWriteTripOnce.mockResolvedValue(undefined);
  mockUpdate.mockResolvedValue(undefined);
});

describe('migratableTripIds', () => {
  it('takes only live trips the uid owns', () => {
    expect(migratableTripIds([
      { tripId: 'owned', role: 'organizer', deletedAt: null },
      { tripId: 'joined', role: 'traveler', deletedAt: null },
      { tripId: 'archived', role: 'organizer', deletedAt: 123 },
    ])).toEqual(['owned']);
  });
});

describe('remap', () => {
  it('substitutes both map keys and string values, at any depth', () => {
    const out = remap(tripA, { 'trip-a': 'trip-new', [ANON]: 'account-uid' }) as any;
    expect(out.ownerUid).toBe('account-uid');
    expect(out.id).toBe('trip-new');
    expect(out.members['account-uid'].uid).toBe('account-uid');
    expect(out.members[ANON]).toBeUndefined();
    expect(out.stops['stop-1'].tripId).toBe('trip-new');
    expect(out.places['place-1'].addedBy).toBe('account-uid');
    expect(out.groups['group-1'].createdBy).toBe('account-uid');
  });

  it('leaves unrelated strings, numbers and nulls alone', () => {
    const out = remap({ name: 'Maine Coast', createdAt: 100, deletedAt: null }, { x: 'y' });
    expect(out).toEqual({ name: 'Maine Coast', createdAt: 100, deletedAt: null });
  });
});

describe('captureTrips', () => {
  it('reads each trip subtree verbatim', async () => {
    mockOnce.mockResolvedValue(snapshot(tripA));
    const captured = await captureTrips(['trip-a']);
    expect(mockRefPath).toHaveBeenCalledWith('trips/trip-a');
    expect(captured).toEqual([{ tripId: 'trip-a', data: tripA }]);
  });

  it('drops a trip that no longer exists rather than staging a null', async () => {
    mockOnce.mockResolvedValue(snapshot(null));
    await expect(captureTrips(['trip-a'])).resolves.toEqual([]);
  });
});

describe('migrateStagedTrips', () => {
  it('does nothing when nothing is staged', async () => {
    await expect(migrateStagedTrips()).resolves.toEqual({ created: [], failed: 0 });
    expect(mockWriteTripOnce).not.toHaveBeenCalled();
  });

  // members carries a .validate that reads trips/{id}/ownerUid back out of the tree, which is
  // uncommitted during the set() — the same two-step split createTrip and devSeed use.
  it('writes the trip without members first, then the membership, index and invite token', async () => {
    stageMigration({ fromUid: ANON, trips: [{ tripId: 'trip-a', data: tripA }] });

    const result = await migrateStagedTrips();

    const [newTripId, step1] = mockWriteTripOnce.mock.calls[0];
    expect(step1).not.toHaveProperty('members');
    expect(step1).not.toHaveProperty('joinProofs');
    expect(step1.ownerUid).toBe('account-uid');
    expect(step1.id).toBe(newTripId);
    expect(step1.inviteToken).not.toBe('tok-old');
    expect(step1.stops['stop-1'].tripId).toBe(newTripId);
    expect(mockWriteTripOnce.mock.calls[0][2]).toBe('throw');

    const update = mockUpdate.mock.calls[0][0];
    expect(update[`trips/${newTripId}/members/account-uid`]).toMatchObject({
      uid: 'account-uid', handle: 'Jeremy', role: 'organizer',
    });
    expect(update[`users/account-uid/trips/${newTripId}`]).toMatchObject({ role: 'organizer' });
    expect(update[`inviteTokens/${step1.inviteToken}`]).toBe(newTripId);
    expect(result).toEqual({ created: [newTripId], failed: 0 });
  });

  it('clears the staged payload once every trip has landed', async () => {
    stageMigration({ fromUid: ANON, trips: [{ tripId: 'trip-a', data: tripA }] });
    await migrateStagedTrips();
    expect(readStagedMigration()).toBeNull();
  });

  // The payload is the only copy of a trip whose uid is already gone — dropping it on failure
  // would destroy the very thing staging exists to protect.
  it('keeps a failed trip staged for the next launch instead of discarding it', async () => {
    stageMigration({ fromUid: ANON, trips: [{ tripId: 'trip-a', data: tripA }] });
    mockWriteTripOnce.mockRejectedValue(new Error('offline'));

    await expect(migrateStagedTrips()).resolves.toEqual({ created: [], failed: 1 });
    expect(readStagedMigration()).toEqual({
      fromUid: ANON, trips: [{ tripId: 'trip-a', data: tripA }],
    });
  });

  it('one failing trip does not strand the others', async () => {
    stageMigration({
      fromUid: ANON,
      trips: [{ tripId: 'trip-a', data: tripA }, { tripId: 'trip-b', data: { ...tripA, id: 'trip-b' } }],
    });
    mockWriteTripOnce.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);

    const result = await migrateStagedTrips();

    expect(result.created).toHaveLength(1);
    expect(result.failed).toBe(1);
    expect(readStagedMigration()?.trips.map(t => t.tripId)).toEqual(['trip-a']);
  });

  // Copying a trip onto the uid that already owns it would just duplicate it.
  it('refuses to run while still signed in as the uid the payload came from', async () => {
    mockCurrentUid = ANON;
    stageMigration({ fromUid: ANON, trips: [{ tripId: 'trip-a', data: tripA }] });

    await expect(migrateStagedTrips()).resolves.toEqual({ created: [], failed: 0 });
    expect(mockWriteTripOnce).not.toHaveBeenCalled();
    expect(readStagedMigration()).not.toBeNull();
  });
});

describe('adoptAccount', () => {
  // Ordering is the whole feature: once signIn() resolves the anonymous credential is gone
  // and these trips can never be read again.
  it('captures and stages before signing in', async () => {
    mockOnce.mockResolvedValue(snapshot(tripA));
    const order: string[] = [];
    mockOnce.mockImplementation(() => { order.push('read'); return Promise.resolve(snapshot(tripA)); });
    const signIn = jest.fn(() => {
      order.push('signIn');
      expect(readStagedMigration()).not.toBeNull();
      mockCurrentUid = 'account-uid';
      return Promise.resolve();
    });

    await adoptAccount(signIn, { fromUid: ANON, tripIds: ['trip-a'], migrate: true });

    expect(order).toEqual(['read', 'signIn']);
    expect(signIn).toHaveBeenCalled();
  });

  it('signs in without capturing anything when the user chose to abandon', async () => {
    const signIn = jest.fn().mockResolvedValue(undefined);
    await adoptAccount(signIn, { fromUid: ANON, tripIds: ['trip-a'], migrate: false });

    expect(mockOnce).not.toHaveBeenCalled();
    expect(mockWriteTripOnce).not.toHaveBeenCalled();
    expect(signIn).toHaveBeenCalled();
  });

  // A capture failure must abort before the sign-in, while the anonymous uid is still usable.
  it('does not sign in when the capture fails', async () => {
    mockOnce.mockRejectedValue(new Error('offline'));
    const signIn = jest.fn();

    await expect(
      adoptAccount(signIn, { fromUid: ANON, tripIds: ['trip-a'], migrate: true }),
    ).rejects.toThrow('offline');
    expect(signIn).not.toHaveBeenCalled();
  });

  it('reports a sign-in failure rather than swallowing it', async () => {
    mockOnce.mockResolvedValue(snapshot(tripA));
    const signIn = jest.fn().mockRejectedValue(new Error('credential rejected'));

    await expect(
      adoptAccount(signIn, { fromUid: ANON, tripIds: ['trip-a'], migrate: true }),
    ).rejects.toThrow('credential rejected');
    // Still staged, so the next successful sign-in picks it up.
    expect(readStagedMigration()).not.toBeNull();
  });
});
