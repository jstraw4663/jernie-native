import { addDaysISO } from '@/src/utils/dates';
import type { Booking, ItineraryDay, Place } from '@/src/types';

export function parseBookingsFromSnapshot(raw: unknown): Booking[] {
  const rec = (raw ?? {}) as Record<string, Omit<Booking, 'id'> & { id?: string }>;
  return Object.entries(rec).map(([key, b]) => ({ ...b, id: b.id ?? key } as Booking));
}

export function parseItineraryFromSnapshot(raw: unknown): Record<string, ItineraryDay[]> {
  const rec = (raw ?? {}) as Record<string, Record<string, Omit<ItineraryDay, 'id'> & { id?: string }>>;
  const out: Record<string, ItineraryDay[]> = {};
  for (const [stopId, days] of Object.entries(rec)) {
    // RTDB omits empty containers — a day whose `items` array was written as `[]` has no
    // `items` key on read at all, so default it back to `[]` here rather than leaving it undefined.
    out[stopId] = Object.entries(days).map(([key, d]) => ({ ...d, id: d.id ?? key, items: d.items ?? [] } as ItineraryDay));
  }
  return out;
}

// Pure: booking deletion + orphan-cleanup of any itinerary item (in ANY stop's ANY day)
// that references it via `bookingId`.
export function buildBookingRemovalUpdates(
  tripId: string,
  bookingId: string,
  itinerary: Record<string, ItineraryDay[]>,
): Record<string, unknown> {
  const updates: Record<string, unknown> = { [`trips/${tripId}/bookings/${bookingId}`]: null };
  for (const [stopId, days] of Object.entries(itinerary)) {
    for (const day of days) {
      if (day.items.some(i => i.bookingId === bookingId)) {
        updates[`trips/${tripId}/itinerary/${stopId}/${day.id}/items`] =
          day.items.filter(i => i.bookingId !== bookingId);
      }
    }
  }
  return updates;
}

// Pure: place deletion + orphan-cleanup of any itinerary item (in ANY stop's ANY day)
// that references it via `placeId`. The mirror of buildBookingRemovalUpdates — a saved
// place that vanishes must not leave itinerary rows pointing at an id that no longer
// resolves, which would render as a blank item nobody can remove.
export function buildPlaceRemovalUpdates(
  tripId: string,
  placeId: string,
  itinerary: Record<string, ItineraryDay[]>,
): Record<string, unknown> {
  const updates: Record<string, unknown> = { [`trips/${tripId}/places/${placeId}`]: null };
  for (const [stopId, days] of Object.entries(itinerary)) {
    for (const day of days) {
      if (day.items.some(i => i.placeId === placeId)) {
        updates[`trips/${tripId}/itinerary/${stopId}/${day.id}/items`] =
          day.items.filter(i => i.placeId !== placeId);
      }
    }
  }
  return updates;
}

export function parsePlacesFromSnapshot(raw: unknown): Place[] {
  const rec = (raw ?? {}) as Record<string, Omit<Place, 'id'> & { id?: string }>;
  return Object.entries(rec).map(([key, p]) => ({ ...p, id: p.id ?? key } as Place));
}

export interface CascadeCollections {
  bookings: Booking[];
  itinerary: Record<string, ItineraryDay[]>;
  places: Place[];
}

// Pure: computes the multi-path RTDB update that atomically removes a stop and:
//  - every booking whose `stopId` (pickup stop, for rentals) equals the removed stop
//  - every place whose `stopId` equals the removed stop
//  - the stop's entire itinerary subtree (`itinerary/{stopId}`, all days at once)
//  - any itinerary item in a SURVIVING stop's day that references a booking/place
//    deleted above via `bookingId`/`placeId` (e.g. a cross-stop rental's dropoff item
//    logged on the neighboring, surviving stop's day)
// A rental's `dropoffStopId` alone (stopId pointing elsewhere) does NOT trigger deletion
// of that booking — only `booking.stopId === stopId` does, per spec.
export function buildStopRemovalUpdates(
  tripId: string,
  stopId: string,
  data: CascadeCollections,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {
    [`trips/${tripId}/stops/${stopId}`]: null,
    [`trips/${tripId}/itinerary/${stopId}`]: null,
  };

  const removedBookingIds = new Set(data.bookings.filter(b => b.stopId === stopId).map(b => b.id));
  for (const id of removedBookingIds) updates[`trips/${tripId}/bookings/${id}`] = null;

  const removedPlaceIds = new Set(data.places.filter(p => p.stopId === stopId).map(p => p.id));
  for (const id of removedPlaceIds) updates[`trips/${tripId}/places/${id}`] = null;

  // A surviving rental (pickup stop elsewhere) whose dropoff was at the removed stop keeps
  // existing, but its dropoffStopId now dangles — null just that field, not the whole booking.
  for (const b of data.bookings) {
    if (b.type === 'rental' && b.stopId !== stopId && b.dropoffStopId === stopId) {
      updates[`trips/${tripId}/bookings/${b.id}/dropoffStopId`] = null;
    }
  }

  for (const [otherStopId, days] of Object.entries(data.itinerary)) {
    if (otherStopId === stopId) continue; // already wiped wholesale above
    for (const day of days) {
      const filtered = day.items.filter(i =>
        !(i.bookingId && removedBookingIds.has(i.bookingId)) &&
        !(i.placeId && removedPlaceIds.has(i.placeId)),
      );
      if (filtered.length !== day.items.length) {
        updates[`trips/${tripId}/itinerary/${otherStopId}/${day.id}/items`] = filtered;
      }
    }
  }

  return updates;
}

// ── Stop insertion ("Say what it costs") ─────────────────────────────────────
//
// Adding a stop mid-route takes nights from somewhere, and the design refuses to reflow
// silently: each option states its consequence in trip terms before anything is written.
// These are pure planners — they compute the options, they never apply them.

/**
 * The slice of a stop this planner needs — deliberately narrower than `Stop`, so the
 * planner stays testable without constructing whole trips.
 *
 * Dates are required, matching `Stop`. Every stop on a route has them: StopForm gates
 * submission on `!!startDate && !!endDate && startDate <= endDate`, and a traveller
 * unsure of their plans enters tentative dates rather than none. (An earlier draft of the
 * design offered a "leave it undated" option; it was dropped as more state than it was
 * worth.)
 */
export interface RouteStop {
  id: string;
  dates: { start: string; end: string };
}

export interface StopDateShift {
  stopId: string;
  from: { start: string; end: string };
  to: { start: string; end: string };
}

export interface StopInsertionPlan {
  /**
   * Dates derived from the neighbours, or null when the route is empty and there is
   * nothing to derive from — in which case the sheet has to ask for them outright rather
   * than prefill.
   */
  dates: { start: string; end: string } | null;
  /** "Push everything later" — later stops keep their nights, the trip gets longer. */
  pushLater: StopDateShift[];
  /** "Take them from the next stop" — the trip keeps its end date. Empty when impossible. */
  borrowFromNext: StopDateShift[];
}

const MS_PER_DAY = 86_400_000;

// Local-midnight both sides, then rounded: a DST boundary makes one "day" 23 or 25 hours,
// which would otherwise floor to the wrong night count.
function nightsBetween(start: string, end: string): number {
  const [ys, ms, ds] = start.split('-').map(Number);
  const [ye, me, de] = end.split('-').map(Number);
  const a = new Date(ys, ms - 1, ds).getTime();
  const b = new Date(ye, me - 1, de).getTime();
  return Math.round((b - a) / MS_PER_DAY);
}

/**
 * Works out what inserting a stop of `nights` nights at `position` would cost, as the two
 * date options the design offers: push everything later, or take the nights from the
 * stop that follows.
 *
 * Pure: returns the shifts to perform rather than performing them.
 */
export function planStopInsertion(
  stops: readonly RouteStop[],
  position: number,
  nights: number,
): StopInsertionPlan {
  const before = stops.slice(0, position);
  const after = stops.slice(position);

  const previous = before[before.length - 1];
  const next = after[0];

  // "Dates, from its neighbours" — arrive when the previous stop ends. With nothing
  // before it, fall back to leaving when the next stop starts, so an insertion at the
  // head of the route back-dates the arrival rather than overlapping.
  let dates: { start: string; end: string } | null = null;
  if (previous) {
    dates = { start: previous.dates.end, end: addDaysISO(previous.dates.end, nights) };
  } else if (next) {
    dates = { start: addDaysISO(next.dates.start, -nights), end: next.dates.start };
  }

  const pushLater: StopDateShift[] = after.map(stop => ({
    stopId: stop.id,
    from: { ...stop.dates },
    to: {
      start: addDaysISO(stop.dates.start, nights),
      end: addDaysISO(stop.dates.end, nights),
    },
  }));

  // Borrowing is only offered when it leaves the next stop at least one night — a stop
  // silently reduced to zero nights would be a worse surprise than the option not being
  // there at all.
  const borrowFromNext: StopDateShift[] =
    next && nightsBetween(next.dates.start, next.dates.end) > nights
      ? [{
          stopId: next.id,
          from: { ...next.dates },
          to: { start: addDaysISO(next.dates.start, nights), end: next.dates.end },
        }]
      : [];

  return { dates, pushLater, borrowFromNext };
}

/**
 * How many booked items a set of shifts would move to a different day — the design's
 * "— 2 booked items move day", which is what turns an abstract reflow into a stated cost.
 *
 * Two things make this less obvious than it looks:
 *
 *  1. The two shift kinds are different operations. Moving BOTH ends translates the stop,
 *     so every day in it changes date. Moving only the START truncates it, so only the
 *     days that fall off the front change; everything from the new start onward keeps the
 *     date it already had.
 *  2. `addBooking` writes only `trips/{tripId}/bookings/{id}` and never creates an
 *     itinerary item, so a booking can be anchored to a stop with nothing referencing it.
 *     Its dates move too, and it would go uncounted if we only walked the itinerary.
 */
export function countAffectedBookings(
  shifts: readonly StopDateShift[],
  bookings: readonly Booking[],
  itinerary: Record<string, ItineraryDay[]>,
): number {
  const shiftByStop = new Map(shifts.map(s => [s.stopId, s]));
  const countedBookingIds = new Set<string>();
  let count = 0;

  for (const [stopId, days] of Object.entries(itinerary)) {
    const shift = shiftByStop.get(stopId);
    if (!shift) continue;

    const translates = shift.from.end !== shift.to.end;

    for (const day of days) {
      if (!translates && day.dateIso >= shift.to.start) continue;

      for (const item of day.items) {
        if (item.bookingId == null) continue;
        countedBookingIds.add(item.bookingId);
        count += 1;
      }
    }
  }

  for (const booking of bookings) {
    if (!shiftByStop.has(booking.stopId)) continue;
    if (countedBookingIds.has(booking.id)) continue;
    count += 1;
  }

  return count;
}
