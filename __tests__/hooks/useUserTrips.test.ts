jest.mock('@react-native-firebase/database');
jest.mock('@/src/lib/firebase', () => ({
  getAuthedUser: () => Promise.resolve({ uid: 'test-uid' }),
  auth: jest.fn(() => ({ currentUser: { uid: 'test-uid', displayName: 'Test User' } })),
  database: require('@react-native-firebase/database').default,
}));

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useUserTrips } from '@/src/hooks/useUserTrips';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { mockOn, mockOff, mockOnce, mockRef } = jest.requireMock('@react-native-firebase/database');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { auth: mockAuth } = jest.requireMock('@/src/lib/firebase');

let capturedOnCallback: ((snap: { val: () => unknown }) => void) | null = null;
let capturedCancelCallback: ((err: Error) => void) | null = null;
beforeEach(() => {
  jest.clearAllMocks();
  capturedOnCallback = null;
  capturedCancelCallback = null;
  (mockAuth as jest.Mock).mockReturnValue({ currentUser: { uid: 'test-uid', displayName: 'Test User' } });
  (mockOn as jest.Mock).mockImplementation(
    (_event: string, cb: (snap: { val: () => unknown }) => void, cancelCb?: (err: Error) => void) => {
      capturedOnCallback = cb;
      capturedCancelCallback = cancelCb ?? null;
      return cb;
    },
  );
  (mockOnce as jest.Mock).mockResolvedValue({ val: () => null });
});

describe('useUserTrips', () => {
  test('starts in loading state with no trips', () => {
    const { result } = renderHook(() => useUserTrips());
    expect(result.current.status).toBe('loading');
    expect(result.current.trips).toEqual([]);
  });

  test('registers the listener at users/{uid}/trips after getAuthedUser resolves', async () => {
    renderHook(() => useUserTrips());
    await waitFor(() => expect(mockRef).toHaveBeenCalledWith('users/test-uid/trips'));
  });

  test('normalizes keyed trips-index object into an array of {tripId, role, joinedAt}', async () => {
    const { result } = renderHook(() => useUserTrips());
    await waitFor(() => expect(mockOn).toHaveBeenCalled());
    await act(async () => {
      await capturedOnCallback?.({
        val: () => ({
          'trip-1': { role: 'organizer', joinedAt: 1000 },
          'trip-2': { role: 'traveler', joinedAt: 2000 },
        }),
      });
    });
    expect(result.current.status).toBe('ready');
    expect(result.current.trips).toHaveLength(2);
    const trip1 = result.current.trips.find(t => t.tripId === 'trip-1');
    expect(trip1?.role).toBe('organizer');
    expect(trip1?.joinedAt).toBe(1000);
  });

  test('fetches each trip name and deletedAt from trips/{tripId}, normalizing an absent deletedAt to null', async () => {
    const responses = [
      { val: () => ({ name: 'Paris Getaway', deletedAt: 1700000000000 }) },
      { val: () => ({ name: 'Rome Weekend' }) }, // no deletedAt field at all in this snapshot
    ];
    let call = 0;
    (mockOnce as jest.Mock).mockImplementation(() => Promise.resolve(responses[call++]));

    const { result } = renderHook(() => useUserTrips());
    await waitFor(() => expect(mockOn).toHaveBeenCalled());
    await act(async () => {
      await capturedOnCallback?.({
        val: () => ({
          'trip-1': { role: 'organizer', joinedAt: 1000 },
          'trip-2': { role: 'traveler', joinedAt: 2000 },
        }),
      });
    });

    expect(result.current.status).toBe('ready');
    const trip1 = result.current.trips.find(t => t.tripId === 'trip-1');
    const trip2 = result.current.trips.find(t => t.tripId === 'trip-2');
    expect(trip1?.name).toBe('Paris Getaway');
    expect(trip1?.deletedAt).toBe(1700000000000);
    expect(trip2?.name).toBe('Rome Weekend');
    expect(trip2?.deletedAt).toBeNull();
    expect(mockOnce).toHaveBeenCalledTimes(2);
  });

  test('treats a null snapshot as ready with an empty array (a brand-new user has joined no trips)', async () => {
    const { result } = renderHook(() => useUserTrips());
    await waitFor(() => expect(mockOn).toHaveBeenCalled());
    await act(async () => { await capturedOnCallback?.({ val: () => null }); });
    expect(result.current.status).toBe('ready');
    expect(result.current.trips).toEqual([]);
  });

  test('a denied per-trip read (once() rejects) surfaces status: error rather than leaving the hook stuck', async () => {
    // Per database.rules.json, trips/{tripId}'s .read rule denies a non-owner/non-member
    // outright — that's a rejection, not a null/empty snapshot.
    (mockOnce as jest.Mock).mockImplementation(() => Promise.reject(new Error('permission-denied')));

    const { result } = renderHook(() => useUserTrips());
    await waitFor(() => expect(mockOn).toHaveBeenCalled());
    await act(async () => {
      await capturedOnCallback?.({
        val: () => ({ 'trip-1': { role: 'organizer', joinedAt: 1000 } }),
      });
    });

    expect(result.current.status).toBe('error');
  });

  test("a stale, slower enrichment run cannot clobber a newer one's state (sequence guard)", async () => {
    let resolveFirst: (v: { val: () => unknown }) => void = () => {};
    const firstRead = new Promise<{ val: () => unknown }>(resolve => { resolveFirst = resolve; });
    let call = 0;
    (mockOnce as jest.Mock).mockImplementation(() => {
      call += 1;
      // The first onValue firing's per-trip read stays pending until resolveFirst() is
      // called below; the second firing's per-trip read resolves immediately, so it can
      // finish (and setState) first, simulating out-of-order completion.
      return call === 1 ? firstRead : Promise.resolve({ val: () => ({ name: 'Fresh Name', deletedAt: null }) });
    });

    const { result } = renderHook(() => useUserTrips());
    await waitFor(() => expect(mockOn).toHaveBeenCalled());

    let firstInvocation: Promise<void> | undefined;
    act(() => {
      firstInvocation = capturedOnCallback?.({
        val: () => ({ 'trip-1': { role: 'organizer', joinedAt: 1000 } }),
      }) as Promise<void> | undefined;
    });

    // The index listener fires again before the first firing's per-trip read resolves.
    await act(async () => {
      await capturedOnCallback?.({
        val: () => ({ 'trip-1': { role: 'organizer', joinedAt: 1000 } }),
      });
    });
    expect(result.current.trips[0]?.name).toBe('Fresh Name');

    // Now let the stale first firing's read resolve — its setState must be discarded.
    await act(async () => {
      resolveFirst({ val: () => ({ name: 'Stale Name', deletedAt: null }) });
      await firstInvocation;
    });

    expect(result.current.trips[0]?.name).toBe('Fresh Name');
  });

  test('refetch() re-runs per-trip enrichment against the last-known index without waiting for the index listener to refire', async () => {
    // Mirrors restoreTrip/archiveTrip: they write only trips/{tripId}, never
    // users/{uid}/trips, so the index the on('value') listener watches never changes.
    let call = 0;
    (mockOnce as jest.Mock).mockImplementation(() =>
      Promise.resolve(
        call++ === 0
          ? { val: () => ({ name: 'Trip', deletedAt: 1700000000000 }) }
          : { val: () => ({ name: 'Trip', deletedAt: null }) },
      ),
    );

    const { result } = renderHook(() => useUserTrips());
    await waitFor(() => expect(mockOn).toHaveBeenCalled());
    await act(async () => {
      await capturedOnCallback?.({
        val: () => ({ 'trip-1': { role: 'organizer', joinedAt: 1000 } }),
      });
    });
    expect(result.current.trips[0]?.deletedAt).toBe(1700000000000);

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => expect(result.current.trips[0]?.deletedAt).toBeNull());
    expect(mockOnce).toHaveBeenCalledTimes(2);
  });

  test('cancel callback surfaces status: error', async () => {
    const { result } = renderHook(() => useUserTrips());
    await waitFor(() => expect(mockOn).toHaveBeenCalled());
    act(() => { capturedCancelCallback?.(new Error('permission denied')); });
    expect(result.current.status).toBe('error');
  });

  test('surfaces status: error when there is no authenticated uid', async () => {
    (mockAuth as jest.Mock).mockReturnValue({ currentUser: null });
    const { result } = renderHook(() => useUserTrips());
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(mockRef).not.toHaveBeenCalled();
  });

  test('unsubscribes on unmount', async () => {
    const { unmount } = renderHook(() => useUserTrips());
    await waitFor(() => expect(mockOn).toHaveBeenCalled());
    unmount();
    expect(mockOff).toHaveBeenCalled();
  });
});
