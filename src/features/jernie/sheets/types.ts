import type { FlightBooking, HotelBooking, Place, PlaceEnrichment } from '@/src/types';

interface PlaceSheetPayloadBase {
  name: string;
  stopLabel: string;
  stopColor: string;
  place?: Place;
  enrichment?: PlaceEnrichment;
  isAdded?: boolean;
  onAdd?: () => void;
}

export type EntitySheetPayload =
  | { kind: 'flight'; booking: FlightBooking; stopColor: string; stopLabel: string }
  | { kind: 'hotel';  booking: HotelBooking;  stopColor: string; stopLabel: string }
  | ({ kind: 'place' } & PlaceSheetPayloadBase)
  | ({ kind: 'hike' } & PlaceSheetPayloadBase);
