jest.mock('@react-native-firebase/database');
jest.mock('@/src/lib/firebase', () => ({
  authReady: Promise.resolve({ uid: 'test-uid' }),
  database: require('@react-native-firebase/database').default,
}));

import { renderHook } from '@testing-library/react-native';
import { useBooking } from '@/src/hooks/useBooking';
import { addBooking, updateBooking, removeBooking } from '@/src/lib/bookingWrites';

describe('useBooking', () => {
  test('returns the exact same addBooking function reference exported from bookingWrites', () => {
    const { result } = renderHook(() => useBooking());
    expect(result.current.addBooking).toBe(addBooking);
  });

  test('returns the exact same updateBooking function reference exported from bookingWrites', () => {
    const { result } = renderHook(() => useBooking());
    expect(result.current.updateBooking).toBe(updateBooking);
  });

  test('returns the exact same removeBooking function reference exported from bookingWrites', () => {
    const { result } = renderHook(() => useBooking());
    expect(result.current.removeBooking).toBe(removeBooking);
  });

  test('returns stable references across re-renders (no wrapping/recreation)', () => {
    const { result, rerender } = renderHook(() => useBooking());
    const first = result.current;
    rerender({});
    const second = result.current;
    expect(second.addBooking).toBe(first.addBooking);
    expect(second.updateBooking).toBe(first.updateBooking);
    expect(second.removeBooking).toBe(first.removeBooking);
  });
});
