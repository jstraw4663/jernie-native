import type { FlightBooking, HotelBooking, RentalBooking, RestaurantBooking, Place, PlaceEnrichment } from '@/src/types';

interface PlaceSheetPayloadBase {
  name: string;
  stopLabel: string;
  stopColor: string;
  place?: Place;
  enrichment?: PlaceEnrichment;
  isAdded?: boolean;
  onAdd?: () => void;
}

interface BookingSheetPayloadBase {
  stopColor: string;
  stopLabel: string;
  /** Opens the booking form for this booking — rendered as the sheet's Edit control. */
  onEdit?: () => void;
}

export type EntitySheetPayload =
  | ({ kind: 'flight';     booking: FlightBooking     } & BookingSheetPayloadBase)
  | ({ kind: 'hotel';      booking: HotelBooking      } & BookingSheetPayloadBase)
  | ({ kind: 'rental';     booking: RentalBooking     } & BookingSheetPayloadBase)
  | ({ kind: 'restaurant'; booking: RestaurantBooking } & BookingSheetPayloadBase)
  | ({ kind: 'place' } & PlaceSheetPayloadBase)
  | ({ kind: 'hike' } & PlaceSheetPayloadBase);
