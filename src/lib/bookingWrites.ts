import { database, authReady } from '@/src/lib/firebase';
import { generateId } from '@/src/utils/id';
import { stripUndefined } from '@/src/utils/stripUndefined';
import { buildBookingRemovalUpdates, parseItineraryFromSnapshot } from '@/src/domain/cascade';
import type { Booking, FlightBooking, HotelBooking, RentalBooking, RestaurantBooking } from '@/src/types';

export type NewBooking =
  | Omit<FlightBooking, 'id' | 'tripId'>
  | Omit<HotelBooking, 'id' | 'tripId'>
  | Omit<RentalBooking, 'id' | 'tripId'>
  | Omit<RestaurantBooking, 'id' | 'tripId'>;

export type BookingPatch =
  | Partial<Omit<FlightBooking, 'id' | 'tripId' | 'type'>>
  | Partial<Omit<HotelBooking, 'id' | 'tripId' | 'type'>>
  | Partial<Omit<RentalBooking, 'id' | 'tripId' | 'type'>>
  | Partial<Omit<RestaurantBooking, 'id' | 'tripId' | 'type'>>;

export async function addBooking(tripId: string, input: NewBooking): Promise<string> {
  await authReady;
  const bookingId = generateId();
  const booking = { ...input, id: bookingId, tripId } as Booking;
  // Shallow strip is sufficient here — no booking type has nested optional objects
  // (FlightLeg's fields are all required), so a top-level filter covers every case.
  await database().ref(`trips/${tripId}/bookings/${bookingId}`).set(stripUndefined(booking));
  return bookingId;
}

export async function updateBooking(tripId: string, bookingId: string, patch: BookingPatch): Promise<void> {
  await authReady;
  await database().ref(`trips/${tripId}/bookings/${bookingId}`).update(stripUndefined(patch));
}

export async function removeBooking(tripId: string, bookingId: string): Promise<void> {
  await authReady;
  const snap = await database().ref(`trips/${tripId}/itinerary`).once('value');
  const itinerary = parseItineraryFromSnapshot(snap.val());
  const updates = buildBookingRemovalUpdates(tripId, bookingId, itinerary);
  await database().ref().update(updates);
}
