jest.mock('@react-native-firebase/database');
jest.mock('@/src/lib/firebase', () => ({
  getAuthedUser: () => Promise.resolve({ uid: 'test-uid' }),
  database: require('@react-native-firebase/database').default,
}));

import { mockRef, mockSet, mockUpdate } from '@react-native-firebase/database';
import { createTrip } from '@/src/lib/createTrip';
import { TRIP_COLOR_PACKS } from '@/src/design/tripPacks';
import type { SetupIntent } from '@/src/types';

const setupIntent: SetupIntent = { flights: true, stays: true, car: false, restaurants: true };

// A fixed, valid pack (copied down to just id/stopColors/heroGradient, same as
// OnboardingDraftContext does) — used by every call in this file that isn't specifically
// exercising colorPack pass-through behavior.
const testColorPack = {
  id: TRIP_COLOR_PACKS[0].id,
  stopColors: TRIP_COLOR_PACKS[0].stopColors,
  heroGradient: TRIP_COLOR_PACKS[0].heroGradient,
};

const baseInput = {
  name: 'NYC Summer',
  organizerHandle: 'Jeremy',
  pills: ['Food-forward'],
  firstStop: {
    city: 'Manhattan',
    region: 'NY',
    lat: 40.7831,
    lon: -73.9712,
    dates: { start: '2026-08-10', end: '2026-08-14' },
  },
  setupIntent,
  colorPack: testColorPack,
};

beforeEach(() => {
  jest.clearAllMocks();
  (mockSet as jest.Mock).mockResolvedValue(undefined);
  (mockUpdate as jest.Mock).mockResolvedValue(undefined);
});

describe('createTrip', () => {
  test('step 1 (trip set()) resolves before step 2 (bundled update()) fires', async () => {
    // Hold step 1's set() pending so we can prove step 2's update() only fires after step 1
    // actually RESOLVES — not merely after it's been called. This is what would catch a
    // regression back to a single bundled update() that also creates the trip node.
    let resolveSet!: () => void;
    (mockSet as jest.Mock).mockReturnValue(new Promise<void>(res => { resolveSet = res; }));

    const createPromise = createTrip(baseInput);

    // Drain the microtask queue with a macrotask flush so this holds regardless of how many
    // awaits precede the set() call, even against a regressed implementation that fires
    // update() as an unawaited microtask right after calling set().
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(mockSet).toHaveBeenCalledTimes(1);
    // LOAD-BEARING: while step 1's write is still pending, step 2 must not have started.
    expect(mockUpdate).not.toHaveBeenCalled();

    resolveSet();
    await createPromise;

    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  test('step 1: writes a complete Trip object to trips/{tripId}, ownerUid from getAuthedUser', async () => {
    const tripId = await createTrip(baseInput);

    expect(mockRef).toHaveBeenCalledWith(`trips/${tripId}`);
    const tripArg = (mockSet as jest.Mock).mock.calls[0][0];

    expect(tripArg).toMatchObject({
      id: tripId,
      name: 'NYC Summer',
      ownerUid: 'test-uid',
      pills: ['Food-forward'],
      setupIntent,
    });
    expect(typeof tripArg.createdAt).toBe('number');
    expect(typeof tripArg.inviteToken).toBe('string');
    expect(tripArg.inviteToken.length).toBeGreaterThan(0);
  });

  test('step 2: bundles exactly the member, users-index, inviteToken, and first-stop paths', async () => {
    const tripId = await createTrip(baseInput);

    // Step 2 is a single bundled update() rooted at the database root.
    expect(mockRef).toHaveBeenCalledWith();
    expect(mockUpdate).toHaveBeenCalledTimes(1);

    const updateArg = (mockUpdate as jest.Mock).mock.calls[0][0];
    const tripArg = (mockSet as jest.Mock).mock.calls[0][0];
    const inviteToken = tripArg.inviteToken as string;

    const keys = Object.keys(updateArg);
    const stopKey = keys.find(k => k.startsWith(`trips/${tripId}/stops/`));
    expect(stopKey).toBeDefined();
    const firstStopId = stopKey!.split('/').pop()!;

    expect(keys.sort()).toEqual([
      `inviteTokens/${inviteToken}`,
      `trips/${tripId}/members/test-uid`,
      `trips/${tripId}/stops/${firstStopId}`,
      `users/test-uid/trips/${tripId}`,
    ].sort());

    expect(updateArg[`trips/${tripId}/members/test-uid`]).toEqual({
      uid: 'test-uid',
      handle: 'Jeremy',
      role: 'organizer',
      joinedAt: tripArg.createdAt,
    });
    expect(updateArg[`users/test-uid/trips/${tripId}`]).toEqual({
      role: 'organizer',
      joinedAt: tripArg.createdAt,
    });
    expect(updateArg[`inviteTokens/${inviteToken}`]).toBe(tripId);
    expect(updateArg[stopKey!]).toEqual({
      id: firstStopId,
      tripId,
      city: 'Manhattan',
      region: 'NY',
      emoji: '',
      lat: 40.7831,
      lon: -73.9712,
      dates: { start: '2026-08-10', end: '2026-08-14' },
      order: 0,
    });
  });

  test('carries a different firstStop\'s lat/lon/dates through unchanged (not hardcoded)', async () => {
    const tripId = await createTrip({
      ...baseInput,
      firstStop: {
        city: 'Brooklyn',
        region: 'NY',
        lat: 40.6782,
        lon: -73.9442,
        dates: { start: '2026-08-10', end: '2026-08-14' },
      },
    });

    const updateArg = (mockUpdate as jest.Mock).mock.calls[0][0];
    const stopKey = Object.keys(updateArg).find(k => k.startsWith(`trips/${tripId}/stops/`))!;

    expect(updateArg[stopKey]).toMatchObject({
      city: 'Brooklyn',
      region: 'NY',
      lat: 40.6782,
      lon: -73.9442,
      dates: { start: '2026-08-10', end: '2026-08-14' },
    });
  });

  test('resolves to the tripId used consistently across every write', async () => {
    const tripId = await createTrip(baseInput);
    expect(typeof tripId).toBe('string');
    expect(tripId.length).toBeGreaterThan(0);
  });

  // Mirrors useJoinTrip.test.ts's "a step-2 rejection surfaces as status: error without the hook
  // silently retrying" (lines 154-168). createTrip() has no client-side recovery for a step-2
  // failure after step 1 already committed (the trip node becomes un-deletable by rule once it
  // exists — see the comment above the update() call in createTrip.ts) — so the only thing this
  // path is responsible for is not swallowing or silently retrying the rejection.
  test('a step-2 update() rejection propagates to the caller rather than being swallowed or retried', async () => {
    (mockSet as jest.Mock).mockResolvedValue(undefined);
    (mockUpdate as jest.Mock).mockRejectedValue(new Error('network unavailable'));

    await expect(createTrip(baseInput)).rejects.toThrow('network unavailable');

    // Step 1 (the trip write) already committed and is not retried; step 2 was attempted
    // exactly once — no auto-retry masking the failure.
    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  test('uses the colour pack supplied by the caller rather than picking one', async () => {
    const pack = { id: 'chosen-pack', stopColors: ['#111111'], heroGradient: ['#000000', '#222222'] };
    await createTrip({
      name: 'Maine', organizerHandle: 'ada', pills: [],
      firstStop: { city: 'Portland', region: 'ME', lat: 43.6, lon: -70.2, dates: { start: '2026-08-10', end: '2026-08-14' } },
      setupIntent: { flights: true, stays: true, car: true, restaurants: true },
      colorPack: pack,
    });
    const written = mockSet.mock.calls[0][0];
    expect(written.colorPack).toEqual(pack);
  });
});
