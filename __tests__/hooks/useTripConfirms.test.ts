jest.mock('@react-native-firebase/database');
jest.mock('@/src/lib/firebase', () => ({
  getAuthedUser: () => Promise.resolve({ uid: 'test-uid' }),
  database: require('@react-native-firebase/database').default,
}));

import { renderHook, act } from '@testing-library/react-native';
import { useTripConfirms } from '@/src/hooks/useTripConfirms';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { mockOn, mockOff, mockSet, mockRef } = jest.requireMock('@react-native-firebase/database');

// Capture the onValue callback so tests can fire it manually
let capturedOnCallback: ((snap: { val: () => unknown }) => void) | null = null;
beforeEach(() => {
  jest.clearAllMocks();
  capturedOnCallback = null;
  (mockOn as jest.Mock).mockImplementation((_event: string, cb: (snap: { val: () => unknown }) => void) => {
    capturedOnCallback = cb;
    return cb;  // @react-native-firebase returns the callback from .on()
  });
});

describe('useTripConfirms', () => {
  test('starts with empty confirms', () => {
    const { result } = renderHook(() => useTripConfirms('trip-1'));
    expect(result.current.confirms).toEqual({});
  });

  test('null guard: ignores snapshot with null value', () => {
    const { result } = renderHook(() => useTripConfirms('trip-1'));
    act(() => { capturedOnCallback?.({ val: () => null }); });
    expect(result.current.confirms).toEqual({});  // unchanged
  });

  test('updates confirms when onValue fires with data', () => {
    const { result } = renderHook(() => useTripConfirms('trip-1'));
    act(() => { capturedOnCallback?.({ val: () => ({ 'item-1': true, 'item-2': false }) }); });
    expect(result.current.confirms['item-1']).toBe(true);
    expect(result.current.confirms['item-2']).toBe(false);
  });

  test('setConfirm applies optimistic update immediately', () => {
    const { result } = renderHook(() => useTripConfirms('trip-1'));
    act(() => { result.current.setConfirm('item-3', true); });
    expect(result.current.confirms['item-3']).toBe(true);
  });

  test('setConfirm calls database().ref().set() with correct path and value', () => {
    const { result } = renderHook(() => useTripConfirms('trip-1'));
    act(() => { result.current.setConfirm('item-3', true); });
    expect(mockRef).toHaveBeenCalledWith('trips/trip-1/confirms/item-3');
    expect(mockSet).toHaveBeenCalledWith(true);
  });

  test('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useTripConfirms('trip-1'));
    unmount();
    expect(mockOff).toHaveBeenCalled();
  });
});
