jest.mock('@react-native-firebase/database');
jest.mock('@/src/lib/firebase', () => ({
  authReady: Promise.resolve({ uid: 'test-uid' }),
  database: require('@react-native-firebase/database').default,
}));

import { renderHook, act } from '@testing-library/react-native';
import { useTripMembers } from '@/src/hooks/useTripMembers';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { mockOn, mockOff, mockRef } = jest.requireMock('@react-native-firebase/database');

// Capture the onValue callback (and optional cancel callback) so tests can fire them manually
let capturedOnCallback: ((snap: { val: () => unknown }) => void) | null = null;
let capturedCancelCallback: ((err: Error) => void) | null = null;
beforeEach(() => {
  jest.clearAllMocks();
  capturedOnCallback = null;
  capturedCancelCallback = null;
  (mockOn as jest.Mock).mockImplementation(
    (_event: string, cb: (snap: { val: () => unknown }) => void, cancelCb?: (err: Error) => void) => {
      capturedOnCallback = cb;
      capturedCancelCallback = cancelCb ?? null;
      return cb;
    },
  );
});

describe('useTripMembers', () => {
  test('starts in loading state with no members', () => {
    const { result } = renderHook(() => useTripMembers('trip-1'));
    expect(result.current.status).toBe('loading');
    expect(result.current.members).toEqual([]);
  });

  test('registers the listener at trips/{tripId}/members', () => {
    renderHook(() => useTripMembers('trip-1'));
    expect(mockRef).toHaveBeenCalledWith('trips/trip-1/members');
  });

  test('normalizes keyed member object into an array, using RTDB key as uid fallback', () => {
    const { result } = renderHook(() => useTripMembers('trip-1'));
    act(() => {
      capturedOnCallback?.({
        val: () => ({
          'uid-a': { uid: 'uid-a', handle: 'Alice', role: 'organizer', joinedAt: 1000 },
          'uid-b': { handle: 'Bob', role: 'traveler', joinedAt: 2000 },  // no explicit uid field
        }),
      });
    });
    expect(result.current.status).toBe('ready');
    expect(result.current.members).toHaveLength(2);
    const bob = result.current.members.find(m => m.handle === 'Bob');
    expect(bob?.uid).toBe('uid-b');  // injected from RTDB key
  });

  test('treats a null snapshot as ready with an empty array (valid empty-collection state)', () => {
    const { result } = renderHook(() => useTripMembers('trip-1'));
    act(() => { capturedOnCallback?.({ val: () => null }); });
    expect(result.current.status).toBe('ready');
    expect(result.current.members).toEqual([]);
  });

  test('cancel callback surfaces status: error', () => {
    const { result } = renderHook(() => useTripMembers('trip-1'));
    act(() => { capturedCancelCallback?.(new Error('permission denied')); });
    expect(result.current.status).toBe('error');
  });

  test('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useTripMembers('trip-1'));
    unmount();
    expect(mockOff).toHaveBeenCalled();
  });
});
