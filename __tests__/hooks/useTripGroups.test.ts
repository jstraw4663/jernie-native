jest.mock('@react-native-firebase/database');
jest.mock('@/src/lib/firebase', () => ({
  getAuthedUser: () => Promise.resolve({ uid: 'test-uid' }),
  database: require('@react-native-firebase/database').default,
}));

import { renderHook, act } from '@testing-library/react-native';
import { useTripGroups } from '@/src/hooks/useTripGroups';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { mockOn, mockOff, mockRef } = jest.requireMock('@react-native-firebase/database');

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

describe('useTripGroups', () => {
  test('starts in loading state with no groups', () => {
    const { result } = renderHook(() => useTripGroups('trip-1'));
    expect(result.current.status).toBe('loading');
    expect(result.current.groups).toEqual([]);
  });

  test('registers the listener at trips/{tripId}/groups', () => {
    renderHook(() => useTripGroups('trip-1'));
    expect(mockRef).toHaveBeenCalledWith('trips/trip-1/groups');
  });

  test('normalizes keyed group object into an array, using RTDB key as id fallback', () => {
    const { result } = renderHook(() => useTripGroups('trip-1'));
    act(() => {
      capturedOnCallback?.({
        val: () => ({
          'group-a': { id: 'group-a', tripId: 'trip-1', name: 'Adults', memberUids: ['uid-a'], createdBy: 'uid-a', createdAt: 1000 },
          'group-b': { tripId: 'trip-1', name: 'Kids', memberUids: ['uid-b'], createdBy: 'uid-a', createdAt: 2000 },  // no explicit id
        }),
      });
    });
    expect(result.current.status).toBe('ready');
    expect(result.current.groups).toHaveLength(2);
    const kids = result.current.groups.find(g => g.name === 'Kids');
    expect(kids?.id).toBe('group-b');  // injected from RTDB key
  });

  test('treats a null snapshot as ready with an empty array (a trip with no custom groups is normal)', () => {
    const { result } = renderHook(() => useTripGroups('trip-1'));
    act(() => { capturedOnCallback?.({ val: () => null }); });
    expect(result.current.status).toBe('ready');
    expect(result.current.groups).toEqual([]);
  });

  test('cancel callback surfaces status: error', () => {
    const { result } = renderHook(() => useTripGroups('trip-1'));
    act(() => { capturedCancelCallback?.(new Error('permission denied')); });
    expect(result.current.status).toBe('error');
  });

  test('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useTripGroups('trip-1'));
    unmount();
    expect(mockOff).toHaveBeenCalled();
  });
});
