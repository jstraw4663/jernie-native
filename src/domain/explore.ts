// Domain logic for the Explore tab: filtering, search, sort, and the seeded-shuffle
// carousel rows. Ported from the retired PWA's ExploreScreen.tsx/ExplorePlaceList.tsx,
// adapted to this project's camelCase Place shape and coarser category enum.

import { getPlaceEnrichment } from '@/src/domain/placeEnrichment';
import type { Place, PlaceCategory, PlaceEnrichment, ItineraryDay, ItineraryItem, Stop } from '@/src/types';

// ── Seeded shuffle ────────────────────────────────────────────────────────────
// Deterministic PRNG so carousel row order is stable within a session but rotates
// every 4 hours, keeping the Explore tab feeling fresh across separate opens.

function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const rand = mulberry32(seed);
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** 4-hour bucket, keyed off an explicit `now` (not Date.now() internally) for testability. */
export function getShuffleSeed(now: number): number {
  return Math.floor(now / (4 * 3600 * 1000));
}

// ── Default stop selection ─────────────────────────────────────────────────────

/**
 * Returns the default stop ID for the Explore tab.
 * 1. The stop whose span contains today
 * 2. Otherwise the earliest stop that starts after today
 * 3. Otherwise the chronologically last stop
 * 4. null only when stops is empty
 *
 * This function orders its own input by dates.start so it cannot depend on the caller
 * having pre-sorted the stops array.
 */
export function getExploreDefaultStopId(stops: Stop[], now: Date): string | null {
  if (stops.length === 0) return null;
  const todayIso = now.toISOString().split('T')[0];

  // 1. Check if today is inside a stop's span (order-independent)
  const current = stops.find(s => todayIso >= s.dates.start && todayIso < s.dates.end);
  if (current) return current.id;

  // Sort by dates.start for steps 2–3; don't mutate the input
  const sorted = [...stops].sort((a, b) => a.dates.start.localeCompare(b.dates.start));

  // 2. Find the earliest stop that starts after today
  const next = sorted.find(s => s.dates.start > todayIso);
  if (next) return next.id;

  // 3. Return the chronologically last stop
  return sorted[sorted.length - 1].id;
}

// ── Category filter ───────────────────────────────────────────────────────────

export type FilterId = 'all' | 'restaurant' | 'hike' | 'bar' | 'sights' | 'activity';

export const FILTER_PILLS: { id: FilterId; label: string }[] = [
  { id: 'all',        label: 'All' },
  { id: 'restaurant', label: 'Eats' },
  { id: 'hike',       label: 'Hikes' },
  { id: 'bar',        label: 'Bars' },
  { id: 'sights',     label: 'Sights & More' },
  { id: 'activity',   label: 'Activities' },
];

const FILTER_CATEGORIES: Record<FilterId, PlaceCategory[]> = {
  all: [],
  restaurant: ['restaurant'],
  hike: ['hike'],
  bar: ['bar'],
  sights: ['sight', 'other'],
  activity: ['activity'],
};

export function matchesCategoryFilter(place: Place, filter: FilterId): boolean {
  if (filter === 'all') return true;
  return FILTER_CATEGORIES[filter].includes(place.category);
}

// ── Stop filter ────────────────────────────────────────────────────────────────

export function matchesStopFilter(place: Place, activeStopId: string | 'all'): boolean {
  return activeStopId === 'all' || place.stopId === activeStopId;
}

// ── Search ─────────────────────────────────────────────────────────────────────

export function matchesSearch(place: Place, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    place.name.toLowerCase().includes(q) ||
    !!place.curatorNote?.toLowerCase().includes(q) ||
    !!place.subcategory?.toLowerCase().includes(q)
  );
}

// ── Filter model ───────────────────────────────────────────────────────────────

export interface ExploreFilters {
  stopId: string | 'all';
  category: FilterId;
  search: string;
  mustOnly: boolean;
  sort: SortKey;
}

export function matchesMustFilter(place: Place, mustOnly: boolean): boolean {
  if (!mustOnly) return true;
  return place.must;
}

export function matchesFilters(place: Place, f: ExploreFilters): boolean {
  return (
    matchesStopFilter(place, f.stopId) &&
    matchesCategoryFilter(place, f.category) &&
    matchesSearch(place, f.search) &&
    matchesMustFilter(place, f.mustOnly)
  );
}

export function sheetFilterCount(f: ExploreFilters): number {
  let count = 0;
  if (f.search.trim().length > 0) count += 1;
  if (f.mustOnly) count += 1;
  return count;
}

// ── Sort ───────────────────────────────────────────────────────────────────────

export type SortKey = 'rating' | 'price-asc' | 'price-desc' | 'name';

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'rating',     label: 'Top rated' },
  { value: 'price-asc',  label: 'Price, low first' },
  { value: 'price-desc', label: 'Price, high first' },
  { value: 'name',       label: 'A – Z' },
];

const PRICE_RANK: Record<string, number> = { '$': 1, '$$': 2, '$$$': 3, '$$$$': 4 };

export function sortPlaces(
  places: Place[],
  enrichmentMap: Record<string, PlaceEnrichment>,
  sort: SortKey,
): Place[] {
  return [...places].sort((a, b) => {
    if (sort === 'rating') {
      const ra = a.rating ?? getPlaceEnrichment(enrichmentMap, a)?.rating ?? 0;
      const rb = b.rating ?? getPlaceEnrichment(enrichmentMap, b)?.rating ?? 0;
      return rb - ra;
    }
    if (sort === 'price-asc' || sort === 'price-desc') {
      const pa = PRICE_RANK[a.price ?? ''] ?? 99;
      const pb = PRICE_RANK[b.price ?? ''] ?? 99;
      return sort === 'price-asc' ? pa - pb : pb - pa;
    }
    return a.name.localeCompare(b.name);
  });
}

// ── Featured places ───────────────────────────────────────────────────────────

export const FEATURED_LIMIT = 12;

/**
 * Builds a featured places list: must-do places passing matchesFilters,
 * seeded-shuffled, capped at FEATURED_LIMIT.
 */
export function buildFeaturedPlaces(
  places: Place[],
  filters: ExploreFilters,
  shuffleSeed: number,
): Place[] {
  const filtered = places.filter(p => p.must && matchesFilters(p, filters));
  const shuffled = seededShuffle(filtered, shuffleSeed);
  return shuffled.slice(0, FEATURED_LIMIT);
}

// ── Add to itinerary ────────────────────────────────────────────────────────────

export function isPlaceAdded(placeId: string, itinerary: Record<string, ItineraryDay[]>): boolean {
  return Object.values(itinerary).some(days => days.some(day => day.items.some(item => item.placeId === placeId)));
}

export function getAddedPlaceIds(itinerary: Record<string, ItineraryDay[]>): Set<string> {
  const ids = new Set<string>();
  for (const days of Object.values(itinerary)) {
    for (const day of days) {
      for (const item of day.items) {
        if (item.placeId) ids.add(item.placeId);
      }
    }
  }
  return ids;
}

/** The first (earliest) day for a stop — days are already sorted ascending by dateIso. */
export function getDefaultDayForStop(itinerary: Record<string, ItineraryDay[]>, stopId: string): ItineraryDay | null {
  return itinerary[stopId]?.[0] ?? null;
}

/** Pure builder — the caller supplies `id` so this stays side-effect-free and testable. */
export function buildAddToItineraryItem(place: Place, existingItemsInDay: ItineraryItem[], id: string): ItineraryItem {
  const order = existingItemsInDay.length > 0
    ? Math.max(...existingItemsInDay.map(i => i.order)) + 1
    : 0;
  return {
    id,
    type: 'place',
    placeId: place.id,
    label: place.name + (place.curatorNote ? ` — ${place.curatorNote}` : ''),
    category: place.category,
    order,
  };
}
