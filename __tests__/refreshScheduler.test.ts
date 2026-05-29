jest.mock('react-native-mmkv', () => {
  const store: Record<string, string> = {};
  return {
    createMMKV: jest.fn().mockReturnValue({
      getString: (key: string) => store[key] ?? null,
      set: (key: string, value: string) => { store[key] = value; },
      remove: (key: string) => { delete store[key]; },
    }),
  };
});

import { shouldReadFirestore, markRead, invalidate } from '@/src/lib/refreshScheduler';

beforeEach(() => {
  invalidate('places');
  invalidate('trails');
});

test('shouldReadFirestore returns true when no read recorded', () => {
  expect(shouldReadFirestore('places')).toBe(true);
});

test('shouldReadFirestore returns false immediately after markRead', () => {
  markRead('places');
  expect(shouldReadFirestore('places')).toBe(false);
});

test('shouldReadFirestore returns true after invalidate', () => {
  markRead('places');
  invalidate('places');
  expect(shouldReadFirestore('places')).toBe(true);
});

test('keys are independent — marking one does not affect another', () => {
  markRead('places');
  expect(shouldReadFirestore('trails')).toBe(true);
});
