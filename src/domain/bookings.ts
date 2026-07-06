// Domain logic for booking data transformations.

import type { Booking } from '@/src/types';

export interface BookingDisplay {
  emoji: string;
  label: string;
  meta: string;
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
      return b.legs.some(leg => leg.departureDate === todayIso);

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
 * Returns emoji, label, and meta string suitable for UI rendering.
 * For multi-leg flights, uses first leg's origin/departure and last leg's destination/arrival.
 */
export function getBookingDisplay(b: Booking, todayIso: string): BookingDisplay {
  switch (b.type) {
    case 'flight': {
      const firstLeg = b.legs[0];
      const lastLeg = b.legs[b.legs.length - 1];
      return {
        emoji: '✈️',
        label: `${firstLeg.airline} · ${firstLeg.flightNumber}`,
        meta: `${firstLeg.origin} → ${lastLeg.destination} · ${firstLeg.departureTime} → ${lastLeg.arrivalTime}`,
      };
    }

    case 'hotel':
      return {
        emoji: '🏨',
        label: b.hotelName,
        meta: `${b.checkIn} – ${b.checkOut}`,
      };

    case 'rental':
      return {
        emoji: '🚗',
        label: b.carType ? `${b.company} · ${b.carType}` : b.company,
        meta: `${b.pickupDate} – ${b.dropoffDate}`,
      };

    case 'restaurant':
      return {
        emoji: '🍽️',
        label: b.restaurantName,
        meta: `${b.date}${b.time ? ` · ${b.time}` : ''}`,
      };
  }
}
