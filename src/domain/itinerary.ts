import { stripUndefined } from '@/src/utils/stripUndefined';
import type { ItineraryDay, ItineraryItem, ItineraryItemCategory } from '@/src/types';
import { addDaysISO } from '@/src/utils/dates';
import { TIMELINE_BANDS, timelineTime } from './itineraryTimeline';

export interface CustomItineraryItemInput {
  label: string;
  time?: string;
  category?: ItineraryItemCategory;
  notes?: string;
}

// Pure builder, mirrors buildAddToItineraryItem (domain/explore.ts) but for free-text
// custom items. Caller supplies `id` to keep this side-effect-free/testable.
export function buildCustomItineraryItem(
  input: CustomItineraryItemInput,
  existingItemsInDay: ItineraryItem[],
  id: string,
): ItineraryItem {
  const order = existingItemsInDay.length > 0
    ? Math.max(...existingItemsInDay.map(i => i.order)) + 1
    : 0;
  return stripUndefined({
    id,
    type: 'custom',
    label: input.label,
    time: input.time,
    category: input.category,
    notes: input.notes,
    order,
  }) as ItineraryItem;
}

export interface ItineraryItemMove {
  itemId: string;
  /** Final zero-based position after the moved item has been removed from the list. */
  toIndex: number;
  /** Omit to retain time, pass null to make the item unscheduled, or pass a new time/band. */
  time?: string | null;
}

export interface ItineraryItemDrop {
  itemId: string;
  targetItemId?: string;
  afterTarget: boolean;
  time?: string | null;
}

const ITINERARY_BAND_INDEX = new Map(
  TIMELINE_BANDS.map((band, index) => [band.key, index]),
);

/**
 * Resolves a visual drop anchor to the final array index expected by the atomic writer.
 * Anchors are preferred because they remain meaningful when stored order differs from the
 * clock-sorted timeline. Empty bands fall back to the same band/time ordering as the view.
 */
export function itineraryMoveForDrop(
  items: readonly ItineraryItem[],
  drop: ItineraryItemDrop,
): ItineraryItemMove {
  const ordered = items
    .map((item, sourceIndex) => ({ item, sourceIndex }))
    .sort((a, b) => a.item.order - b.item.order || a.sourceIndex - b.sourceIndex)
    .map(candidate => candidate.item);
  const source = ordered.find(item => item.id === drop.itemId);
  if (!source) throw new Error('Itinerary item no longer exists');
  const remaining = ordered.filter(item => item.id !== drop.itemId);

  if (drop.targetItemId && drop.targetItemId !== drop.itemId) {
    const targetIndex = remaining.findIndex(item => item.id === drop.targetItemId);
    if (targetIndex >= 0) {
      return {
        itemId: drop.itemId,
        toIndex: targetIndex + (drop.afterTarget ? 1 : 0),
        time: drop.time,
      };
    }
  }

  const movedTime = drop.time === undefined ? source.time : drop.time ?? undefined;
  const movedTimelineTime = timelineTime(movedTime);
  const movedBand = movedTimelineTime.band
    ? ITINERARY_BAND_INDEX.get(movedTimelineTime.band)!
    : TIMELINE_BANDS.length;
  let toIndex = remaining.length;
  for (let index = 0; index < remaining.length; index += 1) {
    const candidateTime = timelineTime(remaining[index].time);
    const candidateBand = candidateTime.band
      ? ITINERARY_BAND_INDEX.get(candidateTime.band)!
      : TIMELINE_BANDS.length;
    if (
      candidateBand > movedBand
      || (candidateBand === movedBand && candidateTime.sortMinutes > movedTimelineTime.sortMinutes)
    ) {
      toIndex = index;
      break;
    }
  }
  return { itemId: drop.itemId, toIndex, time: drop.time };
}

/**
 * Produces the canonical persisted item array for a same-day drop. Input is first sorted by
 * its stored order, the moved item is inserted at the requested final slot, and every order
 * is normalized to a contiguous sequence. The source array and its item objects are untouched.
 */
export function reorderItineraryItems(
  items: readonly ItineraryItem[],
  move: ItineraryItemMove,
): ItineraryItem[] {
  const ordered = items
    .map((item, sourceIndex) => ({ item, sourceIndex }))
    .sort((a, b) => a.item.order - b.item.order || a.sourceIndex - b.sourceIndex)
    .map(candidate => candidate.item);
  const fromIndex = ordered.findIndex(item => item.id === move.itemId);
  if (fromIndex < 0) throw new Error('Itinerary item no longer exists');

  const [source] = ordered.splice(fromIndex, 1);
  let moved: ItineraryItem;
  if (move.time === undefined) {
    moved = { ...source };
  } else if (move.time === null) {
    const { time: _removedTime, ...withoutTime } = source;
    moved = withoutTime;
  } else {
    moved = { ...source, time: move.time };
  }

  ordered.splice(Math.max(0, Math.min(move.toIndex, ordered.length)), 0, moved);
  return ordered.map((item, order) => ({ ...item, order }));
}

export interface ItineraryCrossDayMoveResult {
  sourceItems: ItineraryItem[];
  destinationItems: ItineraryItem[];
}

/**
 * Atomically-shaped pure transform for moving one stored item between itinerary days. The
 * destination index is resolved from its visual anchor against the latest destination array,
 * while both arrays leave with contiguous stored order values.
 */
export function moveItineraryItemBetweenDays(
  sourceItems: readonly ItineraryItem[],
  destinationItems: readonly ItineraryItem[],
  drop: ItineraryItemDrop,
): ItineraryCrossDayMoveResult {
  const source = sourceItems.find(item => item.id === drop.itemId);
  if (!source) throw new Error('Itinerary item no longer exists');
  if (destinationItems.some(item => item.id === drop.itemId)) {
    throw new Error('Itinerary destination already contains this item');
  }

  // Temporarily append the source so the same anchor/time resolver used by same-day drops can
  // calculate its destination index without introducing a second ordering implementation.
  const virtualDestination = [
    ...destinationItems,
    { ...source, order: destinationItems.length },
  ];
  const move = itineraryMoveForDrop(virtualDestination, drop);
  const nextDestination = reorderItineraryItems(virtualDestination, move);
  const nextSource = sourceItems
    .filter(item => item.id !== drop.itemId)
    .sort((a, b) => a.order - b.order)
    .map((item, order) => ({ ...item, order }));

  return { sourceItems: nextSource, destinationItems: nextDestination };
}

// ── Day generation ───────────────────────────────────────────────────────────

export interface SyncItineraryDaysInput {
  stopId: string;
  dates: { start: string; end: string };
  existingDays: ItineraryDay[];
  /** Injected so this stays pure and testable, mirroring buildCustomItineraryItem. */
  generateId: () => string;
}

export interface SyncItineraryDaysResult {
  toAdd: ItineraryDay[];
  toRemoveIds: string[];
}

/**
 * Reconciles a stop's itinerary days against its date range: one day per date, inclusive.
 *
 * Additive by default. Days that fall outside the new range are dropped ONLY when empty —
 * a day still holding items is kept even when out of range, so shortening a stop can never
 * silently destroy what the user entered. (Removing those is a deliberate, separate action.)
 *
 * Pure: returns the writes to perform rather than performing them.
 */
export function syncItineraryDaysForRange({
  stopId, dates, existingDays, generateId,
}: SyncItineraryDaysInput): SyncItineraryDaysResult {
  const wanted: string[] = [];
  // Guard against an inverted range — without it the cursor never reaches `end` and loops forever.
  if (dates.start <= dates.end) {
    for (let cursor = dates.start; cursor <= dates.end; cursor = addDaysISO(cursor, 1)) {
      wanted.push(cursor);
    }
  }

  const existingDates = new Set(existingDays.map(d => d.dateIso));
  const toAdd = wanted
    .filter(dateIso => !existingDates.has(dateIso))
    .map(dateIso => ({ id: generateId(), stopId, dateIso, items: [] as ItineraryItem[] }));

  const wantedSet = new Set(wanted);
  const toRemoveIds = existingDays
    .filter(d => !wantedSet.has(d.dateIso) && d.items.length === 0)
    .map(d => d.id);

  return { toAdd, toRemoveIds };
}
