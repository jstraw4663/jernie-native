jest.mock('@react-native-firebase/database');
jest.mock('@/src/lib/firebase', () => ({
  authReady: Promise.resolve({ uid: 'test-uid' }),
  database: require('@react-native-firebase/database').default,
}));

import { renderHook } from '@testing-library/react-native';
import { useTripAdmin } from '@/src/hooks/useTripAdmin';
import { updateTrip, archiveTrip, restoreTrip } from '@/src/lib/tripWrites';

describe('useTripAdmin', () => {
  test('returns the exact same updateTrip function reference exported from tripWrites', () => {
    const { result } = renderHook(() => useTripAdmin());
    expect(result.current.updateTrip).toBe(updateTrip);
  });

  test('returns the exact same archiveTrip function reference exported from tripWrites', () => {
    const { result } = renderHook(() => useTripAdmin());
    expect(result.current.archiveTrip).toBe(archiveTrip);
  });

  test('returns the exact same restoreTrip function reference exported from tripWrites', () => {
    const { result } = renderHook(() => useTripAdmin());
    expect(result.current.restoreTrip).toBe(restoreTrip);
  });

  test('returns stable references across re-renders (no wrapping/recreation)', () => {
    const { result, rerender } = renderHook(() => useTripAdmin());
    const first = result.current;
    rerender({});
    const second = result.current;
    expect(second.updateTrip).toBe(first.updateTrip);
    expect(second.archiveTrip).toBe(first.archiveTrip);
    expect(second.restoreTrip).toBe(first.restoreTrip);
  });
});
