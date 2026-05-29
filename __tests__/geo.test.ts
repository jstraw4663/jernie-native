import { haversineDistanceMiles, haversineDistanceKm, formatMiles } from '@/src/domain/geo';

test('distance between same point is 0', () => {
  expect(haversineDistanceMiles(44.3876, -68.2039, 44.3876, -68.2039)).toBe(0);
});

test('Portland ME to Bar Harbor ME is ~114 miles straight-line', () => {
  // Portland ME: 43.6591, -70.2568  |  Bar Harbor ME: 44.3876, -68.2039
  const dist = haversineDistanceMiles(43.6591, -70.2568, 44.3876, -68.2039);
  expect(dist).toBeGreaterThan(110);
  expect(dist).toBeLessThan(118);
});

test('haversineDistanceKm is ~1.609x the miles value', () => {
  const miles = haversineDistanceMiles(43.6591, -70.2568, 44.3876, -68.2039);
  const km = haversineDistanceKm(43.6591, -70.2568, 44.3876, -68.2039);
  expect(km / miles).toBeCloseTo(1.60934, 2);
});

test('formatMiles: < 10 miles shows one decimal', () => {
  expect(formatMiles(0.3)).toBe('0.3 mi');
  expect(formatMiles(9.9)).toBe('9.9 mi');
});

test('formatMiles: >= 10 miles rounds to integer', () => {
  expect(formatMiles(12.4)).toBe('12 mi');
  expect(formatMiles(50.6)).toBe('51 mi');
});
