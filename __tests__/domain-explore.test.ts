import {
  seededShuffle,
  getShuffleSeed,
  matchesCategoryFilter,
  matchesStopFilter,
  matchesSearch,
  sortPlaces,
  buildCarouselRows,
  FILTER_PILLS,
  isPlaceAdded,
  getAddedPlaceIds,
  getDefaultDayForStop,
  buildAddToItineraryItem,
} from '@/src/domain/explore';
import type { Place, PlaceEnrichment, ItineraryDay, ItineraryItem } from '@/src/types';

function place(overrides: Partial<Place> & Pick<Place, 'id' | 'name' | 'category'>): Place {
  return {
    tripId: 'trip-1', stopId: 'stop-1', must: false, source: 'curator', addedBy: 'uid-1',
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

describe('buildCarouselRows', () => {
  const places: Place[] = [
    place({ id: 'p1', name: 'A', category: 'restaurant', must: true }),
    place({ id: 'p2', name: 'B', category: 'restaurant' }),
    place({ id: 'p3', name: 'C', category: 'hike' }),
    place({ id: 'p4', name: 'D', category: 'hike' }),
    place({ id: 'p5', name: 'E', category: 'bar' }),
    place({ id: 'p6', name: 'F', category: 'sight' }),
    place({ id: 'p7', name: 'G', category: 'other' }),
    place({ id: 'p8', name: 'H', category: 'restaurant', stopId: 'stop-2' }),
  ];

  test('Must Do is always the first row', () => {
    const rows = buildCarouselRows(places, 1, 'all', 'all');
    expect(rows[0].id).toBe('must-do');
    expect(rows[0].places.map(p => p.id)).toEqual(['p1']);
  });

  test('Sights & More folds sight and other together', () => {
    const rows = buildCarouselRows(places, 1, 'all', 'all');
    const sightsRow = rows.find(r => r.id === 'sights')!;
    expect(sightsRow.places.map(p => p.id).sort()).toEqual(['p6', 'p7']);
  });

  test('Bars row contains only the bar category', () => {
    const rows = buildCarouselRows(places, 1, 'all', 'all');
    const barsRow = rows.find(r => r.id === 'bars')!;
    expect(barsRow.places.map(p => p.id)).toEqual(['p5']);
  });

  test('respects the active category filter', () => {
    const rows = buildCarouselRows(places, 1, 'hike', 'all');
    const eatsRow = rows.find(r => r.id === 'eats')!;
    expect(eatsRow.places).toEqual([]);
  });

  test('respects the active stop filter', () => {
    const rows = buildCarouselRows(places, 1, 'all', 'stop-2');
    const eatsRow = rows.find(r => r.id === 'eats')!;
    expect(eatsRow.places.map(p => p.id)).toEqual(['p8']);
  });

  test('same seed produces the same row order and per-row shuffle', () => {
    const rowsA = buildCarouselRows(places, 99, 'all', 'all');
    const rowsB = buildCarouselRows(places, 99, 'all', 'all');
    expect(rowsA).toEqual(rowsB);
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
