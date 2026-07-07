// Pure transform logic for the one-time PWA → jernie-native data import (Task 9).
//
// Zero Firebase imports on purpose: every function here is a plain function of its
// inputs, so it can be exercised in `__tests__/importPwaTrip.test.ts` against the real
// snapshot of `~/jernie/public/trip.json` (see `./pwaTripSnapshot.json`) with no native
// module mocking required. The Firebase I/O half (auth + the two-step RTDB write) lives
// in `./importPwaTrip.ts`, which imports this module.
//
// Source shape reference: `scripts/pwaTripSnapshot.json` is a point-in-time copy of
// `~/jernie/public/trip.json` taken 2026-07-07 while writing this script. If the real
// file has changed since, re-copy it before running the import for real.

import type {
  Trip,
  TripColorPackRef,
  SetupIntent,
  Stop,
  Booking,
  FlightBooking,
  FlightLeg,
  HotelBooking,
  RentalBooking,
  Place,
  PlaceCategory,
  ItineraryDay,
  ItineraryItem,
  ItineraryItemCategory,
  Group,
} from '@/src/types';
import { getPackById } from '@/src/design/tripPacks';

// ── Source (PWA) shapes ──────────────────────────────────────────────────────
// Loosely typed — only the fields this script actually reads.

export interface PwaFlightLeg {
  num: string;
  airline: string;
  route: string;
  dep: string;
  arr: string;
  date: string;
}

export interface PwaBooking {
  id: string;
  stop_id: string;
  type: string;
  group_ids: string[] | null;
  label: string;
  addr: string | null;
  confirmation: string | null;
  flights: PwaFlightLeg[] | null;
  lines?: string[] | null;
  car_type?: string;
  pickup_date?: string;
  pickup_time?: string | null;
  return_date?: string;
  return_time?: string | null;
  linked_booking_id?: string;
}

export interface PwaStop {
  id: string;
  city: string;
  emoji: string;
  lat: number;
  lon: number;
  weather_start: string;
  weather_end: string;
}

export interface PwaPlace {
  id: string;
  stop_id: string;
  category: string;
  subcategory?: string | null;
  name: string;
  emoji?: string | null;
  note?: string | null;
  must: boolean;
  rating: number | null;
  source: string;
  price?: string | null;
  difficulty?: string | null;
  duration?: string | null;
  distance?: string | null;
  photo_url?: string | null;
  photos?: string[] | null;
  addr?: string | null;
}

export interface PwaItineraryDay {
  id: string;
  stop_id: string;
  date_iso: string;
}

export interface PwaItineraryItem {
  id: string;
  day_id: string;
  time?: string | null;
  text: string;
  locked?: boolean;
  category?: string | null;
  booking_id?: string | null;
  place_id?: string | null;
}

export interface PwaGroup {
  id: string;
  name: string;
  members: string[];
}

export interface PwaTrip {
  id: string;
  name: string;
  pills: [string, string][];
}

export interface PwaData {
  trip: PwaTrip;
  groups: PwaGroup[];
  stops: PwaStop[];
  bookings: PwaBooking[];
  itinerary_days: PwaItineraryDay[];
  itinerary_items: PwaItineraryItem[];
  places: PwaPlace[];
  // alerts / packing_lists intentionally unread — explicitly skipped per the brief.
}

export const NEW_TRIP_ID = 'maine-2026';
const JEREMY_HANDLE = 'Jeremy';

export interface ImportOptions {
  uid: string;
  now: number;
  inviteToken: string;
}

export interface ImportPayload {
  tripId: string;
  /** Full object for step 1's standalone `set()` at `trips/{tripId}`. */
  tripWrite: Record<string, unknown>;
  /** Bundle for step 2's `update()` — members/{uid}, users/{uid}/trips/{tripId}, inviteTokens/{token}. */
  step2Update: Record<string, unknown>;
}

// ── Small parsing helpers ────────────────────────────────────────────────────

const MONTH_ABBR: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

/** "May 22 2026" → "2026-05-22" */
export function parsePwaFlightDate(raw: string): string {
  const m = raw.match(/^([A-Za-z]{3})[a-z]*\s+(\d{1,2})\s+(\d{4})$/);
  if (!m) throw new Error(`Unrecognized flight date format: "${raw}"`);
  const [, monAbbr, day, year] = m;
  const mm = MONTH_ABBR[monAbbr];
  if (!mm) throw new Error(`Unknown month abbreviation "${monAbbr}" in flight date "${raw}"`);
  return `${year}-${mm}-${day.padStart(2, '0')}`;
}

/** "CLT → BWI" → { origin: "CLT", destination: "BWI" } */
export function splitRoute(route: string): { origin: string; destination: string } {
  const parts = route.split('→').map((s) => s.trim());
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Unrecognized route format: "${route}"`);
  }
  return { origin: parts[0], destination: parts[1] };
}

/** "Rental Car — Avis" → "Avis" (takes the segment after the last em dash). */
export function deriveCompanyFromLabel(label: string): string {
  const parts = label.split('—');
  return parts[parts.length - 1].trim();
}

/**
 * Derives a stop's region from its city string (e.g. "Portland, ME" → "ME").
 * Falls back to "ME" when no ", XX" suffix is present (e.g. "Southwest Harbor") —
 * a trip-specific default since this whole import is the Maine Coast trip.
 */
export function deriveRegion(city: string): string {
  const m = city.match(/,\s*([A-Za-z]{2})\s*$/);
  return m ? m[1].toUpperCase() : 'ME';
}

function transformFlightLeg(leg: PwaFlightLeg): FlightLeg {
  const { origin, destination } = splitRoute(leg.route);
  return {
    flightNumber: leg.num,
    airline: leg.airline,
    origin,
    destination,
    departureDate: parsePwaFlightDate(leg.date),
    departureTime: leg.dep,
    arrivalTime: leg.arr,
  };
}

// ── Category / source lookup tables ──────────────────────────────────────────
//
// The brief assumed source `category`/`source` values would carry over directly, but the
// real trip.json uses several values with no matching enum member in the Task 1 types:
//   - Place.category: source also has 'attraction', 'bar', 'shop' (beyond restaurant/
//     activity/sight/hike) — all mapped to 'other', the type's catch-all.
//   - ItineraryItemCategory: source also has 'leisure', 'lodging', 'travel' — 'travel'
//     maps cleanly onto the type's existing 'transport' member; 'leisure' and 'lodging'
//     have no equivalent and map to 'other'.
// See the task report for the full discrepancy writeup.

const PLACE_CATEGORY_MAP: Record<string, PlaceCategory> = {
  restaurant: 'restaurant',
  activity: 'activity',
  sight: 'sight',
  hike: 'hike',
  attraction: 'other',
  bar: 'other',
  shop: 'other',
};

const ITINERARY_CATEGORY_MAP: Record<string, ItineraryItemCategory> = {
  hike: 'hike',
  restaurant: 'restaurant',
  sight: 'sight',
  activity: 'activity',
  travel: 'transport',
  leisure: 'other',
  lodging: 'other',
};

const PLACE_SOURCE_MAP: Record<string, Place['source']> = {
  guide: 'curator',
  community: 'community',
};

const BOOKING_TYPE_MAP: Record<string, Booking['type']> = {
  transportation: 'rental',
  accommodation: 'hotel',
  flight: 'flight',
};

// ── Trip ──────────────────────────────────────────────────────────────────────

export function transformTrip(pwaTrip: PwaTrip, opts: ImportOptions): Trip {
  const pack = getPackById('coastal');
  const colorPack: TripColorPackRef = {
    id: pack.id,
    stopColors: pack.stopColors,
    heroGradient: pack.heroGradient,
  };
  const setupIntent: SetupIntent = { flights: true, stays: true, car: true, restaurants: true };

  return {
    id: NEW_TRIP_ID,
    name: pwaTrip.name,
    ownerUid: opts.uid,
    createdAt: opts.now,
    pills: pwaTrip.pills.map(([emoji, label]) => `${emoji} ${label}`),
    inviteToken: opts.inviteToken,
    colorPack,
    setupIntent,
  };
}

// ── Stops ─────────────────────────────────────────────────────────────────────

export function transformStops(pwaStops: PwaStop[]): Record<string, Stop> {
  const out: Record<string, Stop> = {};
  pwaStops.forEach((s, index) => {
    out[s.id] = {
      id: s.id,
      tripId: NEW_TRIP_ID,
      city: s.city,
      region: deriveRegion(s.city),
      emoji: s.emoji,
      lat: s.lat,
      lon: s.lon,
      // Source `dates` ("May 22–24") is a display string, not the ISO {start,end} the new
      // type needs. `weather_start`/`weather_end` are ISO and bound exactly the same range
      // (confirmed against every stop) — reused here as the authoritative source instead of
      // being dropped, even though the brief lists them as "no equivalent."
      dates: { start: s.weather_start, end: s.weather_end },
      order: index,
    };
  });
  return out;
}

// ── Bookings ──────────────────────────────────────────────────────────────────

export interface BookingTransformResult {
  bookings: Record<string, Booking>;
  /** Old (dropped) booking id → the canonical booking id it was merged into. */
  bookingIdRemap: Record<string, string>;
}

export function transformBookings(pwaBookings: PwaBooking[], stopsById: Record<string, Stop>): BookingTransformResult {
  const bookings: Record<string, Booking> = {};
  const bookingIdRemap: Record<string, string> = {};

  // The source models the rental's dropoff as a *second* booking object
  // (`linked_booking_id` pointing back at the pickup). The new RentalBooking type has a
  // single stopId/dropoffStopId pair, so these merge into one record keyed by the pickup's
  // id; the dropoff's own id is remapped so itinerary references still resolve.
  const dropoffByLinkedId = new Map<string, PwaBooking>();
  for (const b of pwaBookings) {
    if (b.linked_booking_id) dropoffByLinkedId.set(b.linked_booking_id, b);
  }

  for (const b of pwaBookings) {
    if (b.linked_booking_id) {
      bookingIdRemap[b.id] = b.linked_booking_id;
      continue;
    }

    const type = BOOKING_TYPE_MAP[b.type];
    if (!type) throw new Error(`Unmapped booking type: "${b.type}" (booking ${b.id})`);
    const groupIds = b.group_ids ?? null;

    if (type === 'flight') {
      if (!b.flights || b.flights.length === 0) {
        throw new Error(`Flight booking ${b.id} has no flights[] to build legs from`);
      }
      const booking: FlightBooking = {
        id: b.id,
        tripId: NEW_TRIP_ID,
        stopId: b.stop_id,
        type: 'flight',
        legs: b.flights.map(transformFlightLeg),
        groupIds,
      };
      if (b.confirmation) booking.confirmationCode = b.confirmation;
      bookings[b.id] = booking;
    } else if (type === 'hotel') {
      // Source accommodation bookings carry no explicit check-in/out dates of their own —
      // each one covers its whole stop's date range, so derive checkIn/checkOut from the
      // already-transformed parent stop rather than leaving the type's required fields empty.
      const stop = stopsById[b.stop_id];
      if (!stop) throw new Error(`Hotel booking ${b.id} references unknown stop ${b.stop_id}`);
      const booking: HotelBooking = {
        id: b.id,
        tripId: NEW_TRIP_ID,
        stopId: b.stop_id,
        type: 'hotel',
        hotelName: b.label,
        checkIn: stop.dates.start,
        checkOut: stop.dates.end,
        groupIds,
      };
      if (b.addr) booking.address = b.addr;
      if (b.confirmation) booking.confirmationCode = b.confirmation;
      bookings[b.id] = booking;
    } else if (type === 'rental') {
      const dropoff = dropoffByLinkedId.get(b.id);
      if (!b.pickup_date || !b.return_date) {
        throw new Error(`Rental booking ${b.id} is missing pickup_date/return_date`);
      }
      if (!b.addr) throw new Error(`Rental booking ${b.id} is missing a pickup addr`);
      const dropoffLocation = dropoff?.addr;
      if (!dropoffLocation) throw new Error(`Rental booking ${b.id} has no linked dropoff addr`);

      const booking: RentalBooking = {
        id: b.id,
        tripId: NEW_TRIP_ID,
        stopId: b.stop_id,
        type: 'rental',
        company: deriveCompanyFromLabel(b.label),
        pickupDate: b.pickup_date,
        dropoffDate: b.return_date,
        pickupLocation: b.addr,
        dropoffLocation,
        groupIds,
      };
      const carType = b.lines?.[0] ?? b.car_type;
      if (carType) booking.carType = carType;
      if (b.pickup_time) booking.pickupTime = b.pickup_time;
      if (b.return_time) booking.dropoffTime = b.return_time;
      if (b.confirmation) booking.confirmationCode = b.confirmation;
      if (dropoff) booking.dropoffStopId = dropoff.stop_id;
      bookings[b.id] = booking;
    } else {
      throw new Error(`Unhandled booking type "${type}" for booking ${b.id}`);
    }
  }

  return { bookings, bookingIdRemap };
}

// ── Places ────────────────────────────────────────────────────────────────────

export function transformPlaces(pwaPlaces: PwaPlace[], opts: ImportOptions): Record<string, Place> {
  const out: Record<string, Place> = {};
  for (const p of pwaPlaces) {
    const category = PLACE_CATEGORY_MAP[p.category];
    if (!category) throw new Error(`Unmapped place category: "${p.category}" (place ${p.id})`);
    const source = PLACE_SOURCE_MAP[p.source];
    if (!source) throw new Error(`Unmapped place source: "${p.source}" (place ${p.id})`);

    const place: Place = {
      id: p.id,
      tripId: NEW_TRIP_ID,
      stopId: p.stop_id,
      name: p.name,
      category,
      must: p.must,
      source,
      addedBy: opts.uid,
    };
    if (p.note) place.curatorNote = p.note;
    if (p.addr) place.addr = p.addr;
    if (p.rating != null) place.rating = p.rating;
    if (p.price) place.price = p.price;
    if (p.difficulty) place.difficulty = p.difficulty;
    if (p.duration) place.duration = p.duration;
    if (p.distance) place.distance = p.distance;
    // Six hike entries have `photo_url: null` but a non-empty `photos[]` array — the new
    // Place type only has a single `photoUrl`, so we fall back to the first photo rather
    // than silently dropping every image for those places.
    const photoUrl = p.photo_url ?? p.photos?.[0];
    if (photoUrl) place.photoUrl = photoUrl;
    if (p.subcategory) place.subcategory = p.subcategory;
    if (p.emoji) place.emoji = p.emoji;
    out[p.id] = place;
  }
  return out;
}

// ── Itinerary ─────────────────────────────────────────────────────────────────

export function transformItinerary(
  pwaDays: PwaItineraryDay[],
  pwaItems: PwaItineraryItem[],
  bookingIdRemap: Record<string, string>,
): Record<string, Record<string, ItineraryDay>> {
  const itemsByDay = new Map<string, PwaItineraryItem[]>();
  for (const item of pwaItems) {
    const list = itemsByDay.get(item.day_id) ?? [];
    list.push(item);
    itemsByDay.set(item.day_id, list);
  }

  const out: Record<string, Record<string, ItineraryDay>> = {};
  for (const day of pwaDays) {
    const items = itemsByDay.get(day.id) ?? [];
    const transformedItems: ItineraryItem[] = items.map((item, index) => {
      let category: ItineraryItemCategory | undefined;
      if (item.category) {
        category = ITINERARY_CATEGORY_MAP[item.category];
        if (!category) throw new Error(`Unmapped itinerary category: "${item.category}" (item ${item.id})`);
      }

      const rawBookingId = item.booking_id ?? undefined;
      const bookingId = rawBookingId ? (bookingIdRemap[rawBookingId] ?? rawBookingId) : undefined;
      const placeId = item.place_id ?? undefined;
      const type: ItineraryItem['type'] = bookingId ? 'booking' : placeId ? 'place' : 'custom';

      const transformed: ItineraryItem = {
        id: item.id,
        type,
        label: item.text,
        order: index,
      };
      if (placeId) transformed.placeId = placeId;
      if (bookingId) transformed.bookingId = bookingId;
      if (item.time) transformed.time = item.time;
      if (category) transformed.category = category;
      if (item.locked) transformed.locked = true;
      return transformed;
    });

    if (!out[day.stop_id]) out[day.stop_id] = {};
    out[day.stop_id][day.id] = {
      id: day.id,
      stopId: day.stop_id,
      dateIso: day.date_iso,
      items: transformedItems,
    };
  }
  return out;
}

// ── Groups ────────────────────────────────────────────────────────────────────

export function transformGroups(pwaGroups: PwaGroup[], opts: ImportOptions): Record<string, Group> {
  const out: Record<string, Group> = {};
  for (const g of pwaGroups) {
    const memberUids = g.members.includes(JEREMY_HANDLE) ? [opts.uid] : [];
    out[g.id] = {
      id: g.id,
      tripId: NEW_TRIP_ID,
      name: g.name,
      memberUids,
      createdBy: opts.uid,
      createdAt: opts.now,
    };
  }
  return out;
}

// ── Top-level assembly ───────────────────────────────────────────────────────

export function buildImportPayload(pwaData: PwaData, opts: ImportOptions): ImportPayload {
  const stops = transformStops(pwaData.stops);
  const { bookings, bookingIdRemap } = transformBookings(pwaData.bookings, stops);
  const places = transformPlaces(pwaData.places, opts);
  const itinerary = transformItinerary(pwaData.itinerary_days, pwaData.itinerary_items, bookingIdRemap);
  const groups = transformGroups(pwaData.groups, opts);
  const trip = transformTrip(pwaData.trip, opts);

  const tripWrite: Record<string, unknown> = {
    ...trip,
    stops,
    bookings,
    itinerary,
    places,
    groups,
    confirms: {},
  };

  const joinedAt = opts.now;
  const step2Update: Record<string, unknown> = {
    [`trips/${trip.id}/members/${opts.uid}`]: {
      uid: opts.uid,
      handle: JEREMY_HANDLE,
      role: 'organizer',
      joinedAt,
    },
    [`users/${opts.uid}/trips/${trip.id}`]: { role: 'organizer', joinedAt },
    [`inviteTokens/${opts.inviteToken}`]: trip.id,
  };

  return { tripId: trip.id, tripWrite, step2Update };
}
