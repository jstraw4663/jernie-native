import { formatCacheAge } from '@/src/utils/cacheAge';

test('returns "just now" for < 1 minute ago', () => {
  expect(formatCacheAge(Date.now() - 30_000)).toBe('just now');
});

test('returns minutes for < 1 hour ago', () => {
  expect(formatCacheAge(Date.now() - 5 * 60_000)).toBe('5m ago');
});

test('returns hours for < 24 hours ago', () => {
  expect(formatCacheAge(Date.now() - 3 * 60 * 60_000)).toBe('3h ago');
});

test('returns days for >= 24 hours ago', () => {
  expect(formatCacheAge(Date.now() - 2 * 24 * 60 * 60_000)).toBe('2d ago');
});
