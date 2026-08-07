import type { Booking, ItineraryDay } from '@/src/types';

export function parseBookingsFromSnapshot(raw: unknown): Booking[] {
  const rec = (raw ?? {}) as Record<string, Omit<Booking, 'id'> & { id?: string }>;
  return Object.entries(rec).map(([key, b]) => ({ ...b, id: b.id ?? key } as Booking));
}

export function parseItineraryFromSnapshot(raw: unknown): Record<string, ItineraryDay[]> {
  const rec = (raw ?? {}) as Record<string, Record<string, Omit<ItineraryDay, 'id'> & { id?: string }>>;
  const out: Record<string, ItineraryDay[]> = {};
  for (const [stopId, days] of Object.entries(rec)) {
    out[stopId] = Object.entries(days).map(([key, d]) => ({ ...d, id: d.id ?? key } as ItineraryDay));
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
