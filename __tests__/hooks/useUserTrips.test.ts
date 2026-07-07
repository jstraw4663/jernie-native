jest.mock('@react-native-firebase/database');
jest.mock('@/src/lib/firebase', () => ({
  authReady: Promise.resolve({ uid: 'test-uid' }),
  auth: jest.fn(() => ({ currentUser: { uid: 'test-uid', displayName: 'Test User' } })),
  database: require('@react-native-firebase/database').default,
}));

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useUserTrips } from '@/src/hooks/useUserTrips';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { mockOn, mockOff, mockRef } = jest.requireMock('@react-native-firebase/database');
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
});

describe('useUserTrips', () => {
  test('starts in loading state with no trips', () => {
    const { result } = renderHook(() => useUserTrips());
    expect(result.current.status).toBe('loading');
    expect(result.current.trips).toEqual([]);
  });

  test('registers the listener at users/{uid}/trips after authReady resolves', async () => {
    renderHook(() => useUserTrips());
    await waitFor(() => expect(mockRef).toHaveBeenCalledWith('users/test-uid/trips'));
  });

  test('normalizes keyed trips-index object into an array of {tripId, role, joinedAt}', async () => {
    const { result } = renderHook(() => useUserTrips());
    await waitFor(() => expect(mockOn).toHaveBeenCalled());
    act(() => {
      capturedOnCallback?.({
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

  test('treats a null snapshot as ready with an empty array (a brand-new user has joined no trips)', async () => {
    const { result } = renderHook(() => useUserTrips());
    await waitFor(() => expect(mockOn).toHaveBeenCalled());
    act(() => { capturedOnCallback?.({ val: () => null }); });
    expect(result.current.status).toBe('ready');
    expect(result.current.trips).toEqual([]);
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
