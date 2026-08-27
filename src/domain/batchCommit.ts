// Turning a tray of candidates into a single write.
//
// "Add 3 items writes once and offers one undo, not three toasts." That is the whole
// design of this module: every candidate in the tray becomes one root-level multi-path
// RTDB update, paired with an inverse update that undoes it exactly.
//
// Pure: computes the writes rather than performing them (see src/lib/addFlowWrites.ts).

import { stripUndefined } from '@/src/utils/stripUndefined';
import type { Candidate, NewItineraryItem } from '@/src/domain/candidate';
import type { Booking, ItineraryDay, ItineraryItem, Place } from '@/src/types';

export interface BatchCommitInput {
  tripId: string;
  candidates: readonly Candidate[];
  /** The trip's current itinerary, needed to resolve a date to its day row. */
  itinerary: Record<string, ItineraryDay[]>;
  generateId: () => string;
}

export interface BatchCommitResult {
  /** One root-level `update()` payload. */
  updates: Record<string, unknown>;
  /** Applying this as a second root-level `update()` undoes the batch exactly. */
  inverse: Record<string, unknown>;
}

/** A day the batch is writing into, accumulated across every candidate targeting it. */
interface DayTarget {
  dayId: string;
  stopId: string;
  dateIso: string;
  /** True when no day row existed for this date and the batch has to create one. */
  isNew: boolean;
  originalItems: ItineraryItem[];
  items: ItineraryItem[];
}

/** The optional fields an itinerary item carries over from its candidate. */
function itemFields(item: NewItineraryItem): Partial<ItineraryItem> {
  return stripUndefined({
    label: item.label,
    time: item.time,
    category: item.category,
    notes: item.notes,
  });
}

function nextOrder(items: readonly ItineraryItem[]): number {
  return items.length > 0 ? Math.max(...items.map(i => i.order)) + 1 : 0;
}

export function buildBatchCommit({
  tripId, candidates, itinerary, generateId,
}: BatchCommitInput): BatchCommitResult {
  const updates: Record<string, unknown> = {};
  const inverse: Record<string, unknown> = {};

  // Keyed by stop+date so several candidates landing on the same day accumulate into ONE
  // items array. Writing them separately would mean each overwriting the last, and the
  // tray would silently commit only its final item.
  const days = new Map<string, DayTarget>();

  function resolveDay(stopId: string, dateIso: string): DayTarget {
    const key = `${stopId}/${dateIso}`;
    const already = days.get(key);
    if (already) return already;

    const existing = (itinerary[stopId] ?? []).find(day => day.dateIso === dateIso);

    const target: DayTarget = existing
      ? {
          dayId: existing.id,
          stopId,
          dateIso,
          isNew: false,
          originalItems: existing.items,
          items: [...existing.items],
        }
      : {
          // Days are normally seeded with their stop, but a date can fall outside that
          // range — so the batch creates the row rather than dropping the item.
          dayId: generateId(),
          stopId,
          dateIso,
          isNew: true,
          originalItems: [],
          items: [],
        };

    days.set(key, target);
    return target;
  }

  for (const candidate of candidates) {
    const { commit } = candidate;
    const day = resolveDay(commit.item.stopId, commit.item.dateIso);
    const order = nextOrder(day.items);
    const itemId = generateId();

    let item: ItineraryItem;

    if (commit.target === 'booking') {
      const bookingId = generateId();
      const path = `trips/${tripId}/bookings/${bookingId}`;
      updates[path] = stripUndefined({ ...commit.booking, id: bookingId, tripId } as Booking);
      inverse[path] = null;
      item = { id: itemId, type: 'booking', bookingId, order, ...itemFields(commit.item) };
    } else if (commit.target === 'place') {
      const placeId = generateId();
      const path = `trips/${tripId}/places/${placeId}`;
      updates[path] = stripUndefined({ ...commit.place, id: placeId, tripId } as Place);
      inverse[path] = null;
      item = { id: itemId, type: 'place', placeId, order, ...itemFields(commit.item) };
    } else {
      item = { id: itemId, type: 'custom', order, ...itemFields(commit.item) };
    }

    day.items.push(item);
  }

  for (const day of days.values()) {
    if (day.isNew) {
      const path = `trips/${tripId}/itinerary/${day.stopId}/${day.dayId}`;
      updates[path] = { id: day.dayId, stopId: day.stopId, dateIso: day.dateIso, items: day.items };
      inverse[path] = null;
    } else {
      // Whole-array writes, matching how itineraryWrites.ts already updates a day. The
      // inverse is simply the array as it was — which is what makes undo a single write
      // rather than a per-item reconstruction.
      const path = `trips/${tripId}/itinerary/${day.stopId}/${day.dayId}/items`;
      updates[path] = day.items;
      inverse[path] = day.originalItems;
    }
  }

  return { updates, inverse };
}
