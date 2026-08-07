import { addBooking, updateBooking, removeBooking } from '@/src/lib/bookingWrites';
import type { NewBooking, BookingPatch } from '@/src/lib/bookingWrites';

export interface BookingState {
  addBooking: (tripId: string, input: NewBooking) => Promise<string>;
  updateBooking: (tripId: string, bookingId: string, patch: BookingPatch) => Promise<void>;
  removeBooking: (tripId: string, bookingId: string) => Promise<void>;
}

export function useBooking(): BookingState {
  return { addBooking, updateBooking, removeBooking };
}
