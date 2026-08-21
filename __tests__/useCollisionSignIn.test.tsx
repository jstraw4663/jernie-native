let mockAuthState: { user: { uid: string } | null };
jest.mock('@/src/contexts/AuthContext', () => ({ useAuth: () => mockAuthState }));

let mockUserTripsState: { trips: unknown[]; status: 'loading' | 'ready' | 'error' };
jest.mock('@/src/hooks/useUserTrips', () => ({ useUserTrips: () => mockUserTripsState }));

const mockConfirmCollision = jest.fn();
jest.mock('@/src/lib/collisionPrompt', () => ({
  confirmCollision: (...a: unknown[]) => mockConfirmCollision(...a),
}));

const mockAdoptAccount = jest.fn();
// Mocked wholesale rather than partially: the real module imports src/lib/firebase, which
// pulls the RNFB native module into a test that has no business loading it. migratableTripIds
// is pure, so mirroring it here costs nothing — __tests__/tripMigration.test.ts owns its
// behaviour.
jest.mock('@/src/lib/tripMigration', () => ({
  adoptAccount: (...a: unknown[]) => mockAdoptAccount(...a),
  migratableTripIds: (trips: { tripId: string; role: string; deletedAt?: number | null }[]) =>
    trips.filter(t => t.role === 'organizer' && !t.deletedAt).map(t => t.tripId),
}));

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { useCollisionSignIn, type CollisionOutcome } from '@/src/hooks/useCollisionSignIn';

let captured!: ReturnType<typeof useCollisionSignIn>;
function Probe() {
  captured = useCollisionSignIn();
  return <Text>probe</Text>;
}
function render() {
  act(() => { renderer.create(<Probe />); });
}

const signIn = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthState = { user: { uid: 'anon-uid' } };
  mockUserTripsState = {
    trips: [
      { tripId: 'owned', role: 'organizer', deletedAt: null },
      { tripId: 'joined', role: 'traveler', deletedAt: null },
    ],
    status: 'ready',
  };
  mockAdoptAccount.mockResolvedValue({ created: ['new-trip'], failed: 0 });
  signIn.mockResolvedValue(undefined);
});

async function run(): Promise<CollisionOutcome> {
  render();
  let out!: CollisionOutcome;
  await act(async () => { out = await captured(signIn); });
  return out;
}

describe('useCollisionSignIn', () => {
  it('splits owned from joined when asking', async () => {
    mockConfirmCollision.mockResolvedValue('cancel');
    await run();
    expect(mockConfirmCollision).toHaveBeenCalledWith({ owned: 1, joined: 1 });
  });

  it('carries the owned trips across when the user says bring them', async () => {
    mockConfirmCollision.mockResolvedValue('migrate');
    const out = await run();

    expect(mockAdoptAccount).toHaveBeenCalledWith(signIn, {
      fromUid: 'anon-uid', tripIds: ['owned'], migrate: true,
    });
    expect(out).toEqual({ status: 'signed-in', failed: 0 });
  });

  it('signs in without migrating when the user abandons', async () => {
    mockConfirmCollision.mockResolvedValue('abandon');
    await run();
    expect(mockAdoptAccount).toHaveBeenCalledWith(signIn, expect.objectContaining({ migrate: false }));
  });

  it('does not sign in at all when the user cancels', async () => {
    mockConfirmCollision.mockResolvedValue('cancel');
    await expect(run()).resolves.toEqual({ status: 'cancelled' });
    expect(mockAdoptAccount).not.toHaveBeenCalled();
  });

  // An empty trips array while loading would read as "nothing to lose".
  it('refuses while the trip count is still loading', async () => {
    mockUserTripsState = { trips: [], status: 'loading' };
    await expect(run()).resolves.toEqual({ status: 'untrusted' });
    expect(mockConfirmCollision).not.toHaveBeenCalled();
  });

  it('refuses when the trip count failed to load', async () => {
    mockUserTripsState = { trips: [], status: 'error' };
    await expect(run()).resolves.toEqual({ status: 'untrusted' });
  });

  it('refuses when there is no uid to migrate from', async () => {
    mockAuthState = { user: null };
    await expect(run()).resolves.toEqual({ status: 'untrusted' });
    expect(mockConfirmCollision).not.toHaveBeenCalled();
  });

  it('reports a capture or sign-in failure without throwing', async () => {
    mockConfirmCollision.mockResolvedValue('migrate');
    mockAdoptAccount.mockRejectedValue(new Error('offline'));
    await expect(run()).resolves.toEqual({ status: 'failed' });
  });

  // The sign-in succeeded; only the copy is outstanding, and it stays staged for retry.
  it('reports a partial copy as signed-in with a failure count', async () => {
    mockConfirmCollision.mockResolvedValue('migrate');
    mockAdoptAccount.mockResolvedValue({ created: [], failed: 1 });
    await expect(run()).resolves.toEqual({ status: 'signed-in', failed: 1 });
  });

  it('never offers to migrate an archived trip', async () => {
    mockUserTripsState = {
      trips: [{ tripId: 'archived', role: 'organizer', deletedAt: 123 }],
      status: 'ready',
    };
    mockConfirmCollision.mockResolvedValue('cancel');
    await run();
    expect(mockConfirmCollision).toHaveBeenCalledWith({ owned: 0, joined: 0 });
  });
});
