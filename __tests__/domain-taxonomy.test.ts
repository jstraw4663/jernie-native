import { CATEGORY_ICONS, type ItemCategory } from '@/src/design/icons';
import {
  bookingCategory, generatesGaps, normalizeCategory, ROLE_OF_CATEGORY, roleOf, roleOfBooking,
} from '@/src/domain/taxonomy';
import type { Booking } from '@/src/types';

describe('roleOf', () => {
  test('the four roles are exactly the design\'s gap rule', () => {
    expect(Object.entries(ROLE_OF_CATEGORY).filter(([, r]) => r === 'move').map(([c]) => c))
      .toEqual(['flight', 'transit', 'car']);
    expect(Object.entries(ROLE_OF_CATEGORY).filter(([, r]) => r === 'sleep').map(([c]) => c))
      .toEqual(['stay']);
  });

  test('only sleep and move generate gaps — eating and doing are preferences', () => {
    expect(generatesGaps('sleep')).toBe(true);
    expect(generatesGaps('move')).toBe(true);
    expect(generatesGaps('eat')).toBe(false);
    expect(generatesGaps('do')).toBe(false);
  });

  // The whole point of the fallback: unrecognised data must not raise a false alarm.
  test('an absent or unknown category is `do`, which generates nothing', () => {
    expect(roleOf(null)).toBe('do');
    expect(roleOf(undefined)).toBe('do');
    expect(roleOf('nonsense' as ItemCategory)).toBe('do');
    expect(generatesGaps(roleOf(null))).toBe(false);
  });

  // Compile-time already enforces this via the total Record; the test catches a category
  // added to `icons.ts` and given a role somewhere else, or a role map that drifts.
  test('every category in the icon registry has a role', () => {
    expect(Object.keys(ROLE_OF_CATEGORY).sort()).toEqual(Object.keys(CATEGORY_ICONS).sort());
  });
});

describe('normalizeCategory', () => {
  test('absorbs the legacy spellings rather than picking a winner', () => {
    expect(normalizeCategory('restaurant')).toBe('food');
    expect(normalizeCategory('food')).toBe('food');
    expect(normalizeCategory('bar')).toBe('bars');
    expect(normalizeCategory('bars')).toBe('bars');
    expect(normalizeCategory('transport')).toBe('car');
    expect(normalizeCategory('sights')).toBe('sight');
  });

  test('canonical values pass through untouched', () => {
    for (const key of Object.keys(ROLE_OF_CATEGORY)) {
      expect(normalizeCategory(key)).toBe(key);
    }
  });

  test('values that carry no category resolve to null, not to a guess', () => {
    expect(normalizeCategory('other')).toBeNull();
    expect(normalizeCategory('custom')).toBeNull();
    expect(normalizeCategory('all')).toBeNull();
    expect(normalizeCategory(undefined)).toBeNull();
    expect(normalizeCategory('')).toBeNull();
    expect(normalizeCategory('something nobody registered')).toBeNull();
  });

  test('normalises case and whitespace, as iconFor does', () => {
    expect(normalizeCategory('  Restaurant ')).toBe('food');
    expect(normalizeCategory('SIGHT')).toBe('sight');
  });
});

describe('bookingCategory', () => {
  const b = (type: Booking['type']) => ({ type }) as Booking;

  test('is the one adapter between BookingType and the taxonomy', () => {
    expect(bookingCategory(b('flight'))).toBe('flight');
    expect(bookingCategory(b('hotel'))).toBe('stay');
    expect(bookingCategory(b('rental'))).toBe('car');
    expect(bookingCategory(b('restaurant'))).toBe('food');
  });

  test('a hotel sleeps, a rental and a flight move, a table is a preference', () => {
    expect(roleOfBooking(b('hotel'))).toBe('sleep');
    expect(roleOfBooking(b('rental'))).toBe('move');
    expect(roleOfBooking(b('flight'))).toBe('move');
    expect(roleOfBooking(b('restaurant'))).toBe('eat');
  });
});
