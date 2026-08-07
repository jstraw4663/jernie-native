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
