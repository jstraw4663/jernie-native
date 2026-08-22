// Domain logic for booking data transformations.

import type { Booking, FlightBooking, FlightLeg } from '@/src/types';
import type { ItemCategory } from '@/src/design/icons';

export interface BookingDisplay {
  /** Resolve to a glyph with `iconFor(category)`. The domain names the thing; the view
   *  layer decides how to draw it. */
  category: ItemCategory;
  label: string;
  meta: string;
}

// Real bookings should always have >= 1 leg (see the comment on `FlightBooking.legs`),
// but that isn't enforced at the type level, so any code indexing into `legs[0]` /
// `legs[legs.length - 1]` needs a fallback rather than risking `undefined.origin` at runtime.
const FALLBACK_LEG: FlightLeg = {
  flightNumber: '—',
  airline: '—',
  origin: '—',
  destination: '—',
  departureDate: '',
  departureTime: '—',
  arrivalTime: '—',
};

/**
 * Get the first and last leg of a flight booking, safely falling back to a
 * placeholder leg if `legs` is empty OR missing entirely (e.g. stale/legacy data
 * from before `legs` existed on this booking type — `b.legs` itself can be
 * `undefined` at runtime even though the type says it's required).
 */
export function getFlightEndpoints(b: FlightBooking): { firstLeg: FlightLeg; lastLeg: FlightLeg } {
  const legs = getFlightLegs(b);
  const firstLeg = legs[0] ?? FALLBACK_LEG;
  const lastLeg = legs[legs.length - 1] ?? FALLBACK_LEG;
  return { firstLeg, lastLeg };
}

/**
 * The full leg list, safe against `legs` being missing entirely (see
 * `getFlightEndpoints`) — use this instead of reading `booking.legs` directly
 * anywhere legs are iterated/counted (e.g. rendering a per-leg breakdown).
 */
export function getFlightLegs(b: FlightBooking): FlightLeg[] {
  return b.legs ?? [];
}

/**
 * Whether a booking should appear under a given stop — either it originates there
 * (`stopId`), or, for a rental with a cross-stop dropoff, it ends there (`dropoffStopId`).
 */
export function bookingBelongsToStop(b: Booking, stopId: string): boolean {
  if (b.stopId === stopId) return true;
  return b.type === 'rental' && b.dropoffStopId === stopId;
}

/**
 * Check if a booking is relevant to a specific date.
 *
 * - FlightBooking: any leg departs on that date
 * - HotelBooking: the date falls within check-in to check-out (inclusive)
 * - RentalBooking: the date falls within pickup to dropoff (inclusive)
 * - RestaurantBooking: the reservation date matches
 */
export function isTodayBooking(b: Booking, todayIso: string): boolean {
  switch (b.type) {
    case 'flight':
      // Check if any leg departs on this date
      return getFlightLegs(b).some(leg => leg.departureDate === todayIso);

    case 'hotel':
      // Check if today falls within check-in and check-out (inclusive)
      return b.checkIn <= todayIso && todayIso <= b.checkOut;

    case 'rental':
      // Check if today falls within pickup and dropoff (inclusive)
      return b.pickupDate <= todayIso && todayIso <= b.dropoffDate;

    case 'restaurant':
      // Check if the reservation date matches
      return b.date === todayIso;
  }
}

/**
 * Get display information for a booking.
 *
 * Returns category, label, and meta string suitable for UI rendering.
 * For multi-leg flights, uses first leg's origin/departure and last leg's destination/arrival.
 */
export function getBookingDisplay(b: Booking, todayIso: string): BookingDisplay {
  switch (b.type) {
    case 'flight': {
      const { firstLeg, lastLeg } = getFlightEndpoints(b);
      return {
        category: 'flight',
        label: `${firstLeg.airline} · ${firstLeg.flightNumber}`,
        meta: `${firstLeg.origin} → ${lastLeg.destination} · ${firstLeg.departureTime} → ${lastLeg.arrivalTime}`,
      };
    }

    case 'hotel':
      return {
        category: 'stay',
        label: b.hotelName,
        meta: `${b.checkIn} – ${b.checkOut}`,
      };

    case 'rental':
      return {
        category: 'car',
        label: b.carType ? `${b.company} · ${b.carType}` : b.company,
        meta: `${b.pickupDate} – ${b.dropoffDate}`,
      };

    case 'restaurant':
      return {
        category: 'food',
        label: b.restaurantName,
        meta: `${b.date}${b.time ? ` · ${b.time}` : ''}`,
      };
  }
}
