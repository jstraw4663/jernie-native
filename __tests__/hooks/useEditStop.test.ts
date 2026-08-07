jest.mock('@react-native-firebase/database');
jest.mock('@/src/lib/firebase', () => ({
  authReady: Promise.resolve({ uid: 'test-uid' }),
  database: require('@react-native-firebase/database').default,
}));

import { renderHook } from '@testing-library/react-native';
import { useEditStop } from '@/src/hooks/useEditStop';
import { updateStop, removeStop } from '@/src/lib/stopWrites';

describe('useEditStop', () => {
  test('returns the exact same updateStop function reference exported from stopWrites', () => {
    const { result } = renderHook(() => useEditStop());
    expect(result.current.updateStop).toBe(updateStop);
  });

  test('returns the exact same removeStop function reference exported from stopWrites', () => {
    const { result } = renderHook(() => useEditStop());
    expect(result.current.removeStop).toBe(removeStop);
  });

  test('returns stable references across re-renders (no wrapping/recreation)', () => {
    const { result, rerender } = renderHook(() => useEditStop());
    const first = result.current;
    rerender({});
    const second = result.current;
    expect(second.updateStop).toBe(first.updateStop);
    expect(second.removeStop).toBe(first.removeStop);
  });
});
