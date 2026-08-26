import {
  seededShuffle,
  getShuffleSeed,
  getExploreDefaultStopId,
  matchesCategoryFilter,
  matchesStopFilter,
  matchesSearch,
  matchesMustFilter,
  matchesFilters,
  sheetFilterCount,
  sortPlaces,
  buildFeaturedPlaces,
  FILTER_PILLS,
  FEATURED_LIMIT,
  isPlaceAdded,
  getAddedPlaceIds,
  getDefaultDayForStop,
  buildAddToItineraryItem,
} from '@/src/domain/explore';
import type { Place, PlaceEnrichment, ItineraryDay, ItineraryItem, Stop } from '@/src/types';

function place(overrides: Partial<Place> & Pick<Place, 'id' | 'name' | 'category'>): Place {
  return {
    tripId: 'trip-1', stopId: 'stop-1', must: false, source: 'curator', addedBy: 'uid-1',
    ...overrides,
  };
}

function stop(overrides: Partial<Stop> & Pick<Stop, 'id' | 'dates'>): Stop {
  return {
    tripId: 'trip-1', city: 'Test', region: 'Test', emoji: '📍', lat: 0, lon: 0,
    order: 0,
    ...overrides,
  };
}

describe('seededShuffle', () => {
  test('same seed produces the same order every time', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(seededShuffle(arr, 42)).toEqual(seededShuffle(arr, 42));
  });

  test('different seeds usually produce different orders', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(seededShuffle(arr, 1)).not.toEqual(seededShuffle(arr, 2));
  });

  test('produces a true permutation — same elements, same length', () => {
    const arr = [1, 2, 3, 4, 5];
    const shuffled = seededShuffle(arr, 7);
    expect(shuffled).toHaveLength(arr.length);
    expect([...shuffled].sort()).toEqual([...arr].sort());
  });

  test('does not mutate the input array', () => {
    const arr = [1, 2, 3];
    const copy = [...arr];
    seededShuffle(arr, 5);
    expect(arr).toEqual(copy);
  });
});

describe('getShuffleSeed', () => {
  const FOUR_HOURS = 4 * 3600 * 1000;

  test('two timestamps in the same 4-hour bucket produce the same seed', () => {
    expect(getShuffleSeed(0)).toBe(getShuffleSeed(FOUR_HOURS - 1));
  });

  test('crossing a 4-hour boundary changes the seed', () => {
    expect(getShuffleSeed(0)).not.toBe(getShuffleSeed(FOUR_HOURS));
  });
});

describe('getExploreDefaultStopId', () => {
  test('returns null when stops is empty', () => {
    expect(getExploreDefaultStopId([], new Date('2026-08-25'))).toBeNull();
  });

  test('returns the stop containing today', () => {
    const stops = [
      stop({ id: 'stop-1', dates: { start: '2026-08-20', end: '2026-08-23' } }),
      stop({ id: 'stop-2', dates: { start: '2026-08-24', end: '2026-08-27' } }),
      stop({ id: 'stop-3', dates: { start: '2026-08-28', end: '2026-08-31' } }),
    ];
    expect(getExploreDefaultStopId(stops, new Date('2026-08-25'))).toBe('stop-2');
  });

  test('returns the earliest stop that starts after today (next stop, gap between stops)', () => {
    const stops = [
      stop({ id: 'stop-1', dates: { start: '2026-08-20', end: '2026-08-23' } }),
      stop({ id: 'stop-2', dates: { start: '2026-08-25', end: '2026-08-27' } }),
      stop({ id: 'stop-3', dates: { start: '2026-08-29', end: '2026-08-31' } }),
    ];
    // Today is 2026-08-24 (in the gap between stop-1 and stop-2)
    expect(getExploreDefaultStopId(stops, new Date('2026-08-24'))).toBe('stop-2');
  });

  test('returns the first stop when today is before the trip', () => {
    const stops = [
      stop({ id: 'stop-1', dates: { start: '2026-08-25', end: '2026-08-27' } }),
      stop({ id: 'stop-2', dates: { start: '2026-08-28', end: '2026-08-31' } }),
    ];
    expect(getExploreDefaultStopId(stops, new Date('2026-08-20'))).toBe('stop-1');
  });

  test('returns the last stop when today is after the trip', () => {
    const stops = [
      stop({ id: 'stop-1', dates: { start: '2026-08-20', end: '2026-08-23' } }),
      stop({ id: 'stop-2', dates: { start: '2026-08-24', end: '2026-08-27' } }),
    ];
    expect(getExploreDefaultStopId(stops, new Date('2026-08-28'))).toBe('stop-2');
  });
});

describe('matchesCategoryFilter', () => {
  test('"all" matches every category', () => {
    expect(matchesCategoryFilter(place({ id: 'p1', name: 'X', category: 'bar' }), 'all')).toBe(true);
  });

  test('"sights" folds sight and other together', () => {
    expect(matchesCategoryFilter(place({ id: 'p1', name: 'X', category: 'sight' }), 'sights')).toBe(true);
    expect(matchesCategoryFilter(place({ id: 'p2', name: 'X', category: 'other' }), 'sights')).toBe(true);
    expect(matchesCategoryFilter(place({ id: 'p3', name: 'X', category: 'restaurant' }), 'sights')).toBe(false);
  });

  test('"bar" only matches the bar category (regression: previously bar was indistinguishable from other)', () => {
    expect(matchesCategoryFilter(place({ id: 'p1', name: 'The Annex', category: 'bar' }), 'bar')).toBe(true);
    expect(matchesCategoryFilter(place({ id: 'p2', name: 'Some Shop', category: 'other' }), 'bar')).toBe(false);
  });

  test('every FILTER_PILLS id round-trips through matchesCategoryFilter without throwing', () => {
    const p = place({ id: 'p1', name: 'X', category: 'restaurant' });
    for (const pill of FILTER_PILLS) {
      expect(() => matchesCategoryFilter(p, pill.id)).not.toThrow();
    }
  });
});

describe('matchesStopFilter', () => {
  test('"all" matches every stop', () => {
    expect(matchesStopFilter(place({ id: 'p1', name: 'X', category: 'sight', stopId: 'stop-a' }), 'all')).toBe(true);
  });

  test('a specific stopId only matches that stop', () => {
    const p = place({ id: 'p1', name: 'X', category: 'sight', stopId: 'stop-a' });
    expect(matchesStopFilter(p, 'stop-a')).toBe(true);
    expect(matchesStopFilter(p, 'stop-b')).toBe(false);
  });
});

describe('matchesSearch', () => {
  const p = place({ id: 'p1', name: 'Eventide Oyster Co.', category: 'restaurant', curatorNote: 'Brown butter lobster roll', subcategory: 'seafood' });

  test('empty query matches everything', () => {
    expect(matchesSearch(p, '')).toBe(true);
    expect(matchesSearch(p, '   ')).toBe(true);
  });

  test('matches on name, curatorNote, or subcategory, case-insensitively', () => {
    expect(matchesSearch(p, 'eventide')).toBe(true);
    expect(matchesSearch(p, 'LOBSTER')).toBe(true);
    expect(matchesSearch(p, 'seafood')).toBe(true);
    expect(matchesSearch(p, 'nonexistent')).toBe(false);
  });

  test('does not throw when subcategory/curatorNote are absent', () => {
    const bare = place({ id: 'p2', name: 'X', category: 'sight' });
    expect(() => matchesSearch(bare, 'anything')).not.toThrow();
    expect(matchesSearch(bare, 'anything')).toBe(false);
  });
});

describe('matchesMustFilter', () => {
  test('returns true for all places when mustOnly is false', () => {
    const p = place({ id: 'p1', name: 'X', category: 'restaurant', must: false });
    expect(matchesMustFilter(p, false)).toBe(true);
  });

  test('returns true only for must places when mustOnly is true', () => {
    const mustPlace = place({ id: 'p1', name: 'X', category: 'restaurant', must: true });
    const nonMustPlace = place({ id: 'p2', name: 'Y', category: 'restaurant', must: false });
    expect(matchesMustFilter(mustPlace, true)).toBe(true);
    expect(matchesMustFilter(nonMustPlace, true)).toBe(false);
  });
});

describe('matchesFilters', () => {
  const p1 = place({ id: 'p1', name: 'Restaurant X', category: 'restaurant', stopId: 'stop-1', must: true });
  const p2 = place({ id: 'p2', name: 'Hike Y', category: 'hike', stopId: 'stop-2', must: false });

  test('composites all four filters', () => {
    const filters = { stopId: 'all', category: 'all', search: '', mustOnly: false, sort: 'rating' as const };
    expect(matchesFilters(p1, filters)).toBe(true);
    expect(matchesFilters(p2, filters)).toBe(true);
  });

  test('respects stopId filter', () => {
    const filters = { stopId: 'stop-1', category: 'all', search: '', mustOnly: false, sort: 'rating' as const };
    expect(matchesFilters(p1, filters)).toBe(true);
    expect(matchesFilters(p2, filters)).toBe(false);
  });

  test('respects category filter', () => {
    const filters = { stopId: 'all', category: 'restaurant', search: '', mustOnly: false, sort: 'rating' as const };
    expect(matchesFilters(p1, filters)).toBe(true);
    expect(matchesFilters(p2, filters)).toBe(false);
  });

  test('respects search filter', () => {
    const filters = { stopId: 'all', category: 'all', search: 'restaurant', mustOnly: false, sort: 'rating' as const };
    expect(matchesFilters(p1, filters)).toBe(true);
    expect(matchesFilters(p2, filters)).toBe(false);
  });

  test('respects mustOnly filter', () => {
    const filters = { stopId: 'all', category: 'all', search: '', mustOnly: true, sort: 'rating' as const };
    expect(matchesFilters(p1, filters)).toBe(true);
    expect(matchesFilters(p2, filters)).toBe(false);
  });
});

describe('sheetFilterCount', () => {
  test('returns 0 when search is empty and mustOnly is false', () => {
    const filters = { stopId: 'all', category: 'all', search: '', mustOnly: false, sort: 'rating' as const };
    expect(sheetFilterCount(filters)).toBe(0);
  });

  test('returns 1 when search is non-empty', () => {
    const filters = { stopId: 'all', category: 'all', search: 'restaurant', mustOnly: false, sort: 'rating' as const };
    expect(sheetFilterCount(filters)).toBe(1);
  });

  test('returns 1 when mustOnly is true', () => {
    const filters = { stopId: 'all', category: 'all', search: '', mustOnly: true, sort: 'rating' as const };
    expect(sheetFilterCount(filters)).toBe(1);
  });

  test('returns 2 when both search and mustOnly are active', () => {
    const filters = { stopId: 'all', category: 'all', search: 'restaurant', mustOnly: true, sort: 'rating' as const };
    expect(sheetFilterCount(filters)).toBe(2);
  });

  test('ignores stopId, category, and sort in the count', () => {
    const filters = { stopId: 'stop-1', category: 'restaurant', search: '', mustOnly: false, sort: 'name' as const };
    expect(sheetFilterCount(filters)).toBe(0);
  });
});

describe('sortPlaces', () => {
  const a = place({ id: 'a', name: 'Zebra', category: 'restaurant', rating: 4.2, price: '$$' });
  const b = place({ id: 'b', name: 'Apple', category: 'restaurant', rating: 4.8, price: '$$$$' });
  const c = place({ id: 'c', name: 'Mango', category: 'restaurant', rating: 4.5, price: '$' });
  const enrichmentMap: Record<string, PlaceEnrichment> = {};

  test('rating: descending, curated Place.rating takes priority over enrichment', () => {
    const sorted = sortPlaces([a, b, c], enrichmentMap, 'rating');
    expect(sorted.map(p => p.id)).toEqual(['b', 'c', 'a']);
  });

  test('falls back to enrichment rating when Place.rating is absent', () => {
    const noRating = place({ id: 'd', name: 'D', category: 'restaurant', lat: 0, lon: 0 });
    const sorted = sortPlaces(
      [noRating, a],
      { 'd_0.0000_0.0000': { name: 'D', lat: 0, lon: 0, cached_at: 1, place_id_locked: true, rating: 5, photos: [] } },
      'rating',
    );
    expect(sorted[0].id).toBe('d');
  });

  test('price-asc / price-desc', () => {
    expect(sortPlaces([a, b, c], enrichmentMap, 'price-asc').map(p => p.id)).toEqual(['c', 'a', 'b']);
    expect(sortPlaces([a, b, c], enrichmentMap, 'price-desc').map(p => p.id)).toEqual(['b', 'a', 'c']);
  });

  test('name: A–Z', () => {
    expect(sortPlaces([a, b, c], enrichmentMap, 'name').map(p => p.id)).toEqual(['b', 'c', 'a']);
  });

  test('does not mutate the input array', () => {
    const arr = [a, b, c];
    const copy = [...arr];
    sortPlaces(arr, enrichmentMap, 'rating');
    expect(arr).toEqual(copy);
  });
});

describe('buildFeaturedPlaces', () => {
  const places: Place[] = [
    place({ id: 'p1', name: 'Must Restaurant A', category: 'restaurant', stopId: 'stop-1', must: true }),
    place({ id: 'p2', name: 'Non-must Restaurant B', category: 'restaurant', stopId: 'stop-1', must: false }),
    place({ id: 'p3', name: 'Must Hike C', category: 'hike', stopId: 'stop-1', must: true }),
    place({ id: 'p4', name: 'Must Sight D', category: 'sight', stopId: 'stop-2', must: true }),
    place({ id: 'p5', name: 'Must Activity E', category: 'activity', stopId: 'stop-1', must: true }),
  ];

  test('returns only must places', () => {
    const filters = { stopId: 'all', category: 'all', search: '', mustOnly: false, sort: 'rating' as const };
    const featured = buildFeaturedPlaces(places, filters, 1);
    expect(featured.every(p => p.must)).toBe(true);
  });

  test('respects filters', () => {
    const filters = { stopId: 'stop-1', category: 'all', search: '', mustOnly: false, sort: 'rating' as const };
    const featured = buildFeaturedPlaces(places, filters, 1);
    expect(featured.every(p => p.stopId === 'stop-1')).toBe(true);
  });

  test('applies seeded shuffle', () => {
    const filters = { stopId: 'all', category: 'all', search: '', mustOnly: false, sort: 'rating' as const };
    const featured1 = buildFeaturedPlaces(places, filters, 42);
    const featured2 = buildFeaturedPlaces(places, filters, 42);
    expect(featured1).toEqual(featured2);
  });

  test('caps at FEATURED_LIMIT', () => {
    const manyMust = Array.from({ length: 20 }, (_, i) =>
      place({ id: `p${i}`, name: `Must ${i}`, category: 'restaurant', stopId: 'stop-1', must: true }),
    );
    const filters = { stopId: 'all', category: 'all', search: '', mustOnly: false, sort: 'rating' as const };
    const featured = buildFeaturedPlaces(manyMust, filters, 1);
    expect(featured).toHaveLength(FEATURED_LIMIT);
  });

  test('includes must places that match the category filter', () => {
    const filters = { stopId: 'all', category: 'restaurant', search: '', mustOnly: false, sort: 'rating' as const };
    const featured = buildFeaturedPlaces(places, filters, 1);
    expect(featured.some(p => p.id === 'p1')).toBe(true);
    expect(featured.some(p => p.id === 'p3')).toBe(false); // hike filtered out
  });

  test('returns empty when no must places match the filters', () => {
    const filters = { stopId: 'stop-2', category: 'restaurant', search: '', mustOnly: false, sort: 'rating' as const };
    const featured = buildFeaturedPlaces(places, filters, 1);
    expect(featured).toEqual([]);
  });
});

function item(overrides: Partial<ItineraryItem> & Pick<ItineraryItem, 'id' | 'order'>): ItineraryItem {
  return { type: 'place', ...overrides };
}

function day(overrides: Partial<ItineraryDay> & Pick<ItineraryDay, 'id' | 'stopId' | 'dateIso'>): ItineraryDay {
  return { items: [], ...overrides };
}

describe('isPlaceAdded / getAddedPlaceIds', () => {
  const itinerary: Record<string, ItineraryDay[]> = {
    'stop-a': [
      day({ id: 'day-1', stopId: 'stop-a', dateIso: '2026-07-10', items: [item({ id: 'i1', order: 0, placeId: 'place-1' })] }),
      day({ id: 'day-2', stopId: 'stop-a', dateIso: '2026-07-11', items: [item({ id: 'i2', order: 0, placeId: 'place-2' })] }),
    ],
    'stop-b': [
      day({ id: 'day-3', stopId: 'stop-b', dateIso: '2026-07-12', items: [item({ id: 'i3', order: 0 })] }), // no placeId
    ],
  };

  test('isPlaceAdded finds a place across multiple stops and days', () => {
    expect(isPlaceAdded('place-1', itinerary)).toBe(true);
    expect(isPlaceAdded('place-2', itinerary)).toBe(true);
    expect(isPlaceAdded('place-999', itinerary)).toBe(false);
  });

  test('getAddedPlaceIds returns every referenced placeId, ignoring items with none', () => {
    expect(getAddedPlaceIds(itinerary)).toEqual(new Set(['place-1', 'place-2']));
  });

  test('both handle an empty itinerary', () => {
    expect(isPlaceAdded('place-1', {})).toBe(false);
    expect(getAddedPlaceIds({})).toEqual(new Set());
  });
});

describe('getDefaultDayForStop', () => {
  test('returns the first day for a stop with days', () => {
    const itinerary = { 'stop-a': [day({ id: 'day-1', stopId: 'stop-a', dateIso: '2026-07-10' }), day({ id: 'day-2', stopId: 'stop-a', dateIso: '2026-07-11' })] };
    expect(getDefaultDayForStop(itinerary, 'stop-a')?.id).toBe('day-1');
  });

  test('returns null for a stop with zero days', () => {
    expect(getDefaultDayForStop({}, 'stop-a')).toBeNull();
    expect(getDefaultDayForStop({ 'stop-a': [] }, 'stop-a')).toBeNull();
  });
});

describe('buildAddToItineraryItem', () => {
  const restaurant = { id: 'place-1', tripId: 'trip-1', stopId: 'stop-a', name: 'Eventide', category: 'restaurant' as const, must: true, source: 'curator' as const, addedBy: 'uid-1', curatorNote: 'Great lobster roll' };

  test('order is 0 for an empty day', () => {
    expect(buildAddToItineraryItem(restaurant, [], 'new-id').order).toBe(0);
  });

  test('order is max existing + 1', () => {
    const existing = [item({ id: 'i1', order: 0 }), item({ id: 'i2', order: 3 })];
    expect(buildAddToItineraryItem(restaurant, existing, 'new-id').order).toBe(4);
  });

  test('label combines name and curatorNote; category/placeId/type/id are set correctly', () => {
    const built = buildAddToItineraryItem(restaurant, [], 'new-id');
    expect(built.label).toBe('Eventide — Great lobster roll');
    expect(built.category).toBe('restaurant');
    expect(built.placeId).toBe('place-1');
    expect(built.type).toBe('place');
    expect(built.id).toBe('new-id');
  });

  test('label is just the name when curatorNote is absent', () => {
    const noNote: Place = { ...restaurant, curatorNote: undefined };
    expect(buildAddToItineraryItem(noNote, [], 'new-id').label).toBe('Eventide');
  });
});
