import type { FlightBooking, HotelBooking } from '@/src/types';

export type EntitySheetPayload =
  | { kind: 'flight';     booking: FlightBooking; stopColor: string; stopLabel: string }
  | { kind: 'hotel';      booking: HotelBooking;  stopColor: string; stopLabel: string }
  | { kind: 'restaurant'; name: string; stopLabel: string; stopColor: string }
  | { kind: 'hike';       name: string; stopLabel: string; stopColor: string };
