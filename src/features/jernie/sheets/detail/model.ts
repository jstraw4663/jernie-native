// The adapter: a subject in, everything the sheet renders out. Pure — no React, no icons,
// no colours. The blocks read fields; they never reach back into a `Place` or a `Booking`.
//
// **A field the app cannot source is left undefined, and its block does not render.** That
// is the whole rule here. Session 6 deleted `mockEntityData.ts`, so a sheet now shows what
// the trip actually holds and nothing else — an empty Amenities block is a real signal that
// the schema has no amenities, where a plausible-looking one was a lie that hid it.
import { daysBetween } from '@/src/domain/gaps';
import { getFlightEndpoints, getFlightLegs } from '@/src/domain/bookings';
import { getPlaceEnrichment } from '@/src/domain/placeEnrichment';
import { normalizeCategory, roleOf, roleOfBooking, type ItemRole } from '@/src/domain/taxonomy';
import { resolvePhoto } from '@/src/lib/images';
import type { Booking, FlightBooking, HotelBooking, Place, RentalBooking, RestaurantBooking } from '@/src/types';
import { formatDateRange, formatDayLabel, formatShortDate } from '@/src/utils/dates';
import { blocksFor } from './layout';
import type {
  DetailModel, DetailPayload, InfoRow, NearbyPlace, StatFigure, TimelineStep,
} from './types';

/** How many places the Nearby block will list before it stops. */
const NEARBY_LIMIT = 6;

export function detailRole(payload: DetailPayload): ItemRole {
  const { subject } = payload;
  return subject.kind === 'booking'
    ? roleOfBooking(subject.booking)
    : roleOf(normalizeCategory(subject.place.category));
}

export function buildDetailModel(payload: DetailPayload): DetailModel {
  const role = detailRole(payload);
  const blocks = blocksFor(role, payload.subject);
  const base = payload.subject.kind === 'place'
    ? placeModel(payload, payload.subject.place)
    : bookingModel(payload, payload.subject.booking);

  return { ...base, blocks, footer: footerFor(payload) };
}

// ── Places ───────────────────────────────────────────────────────────────────

/** Everything a subject decides. The shell adds `blocks` and `footer` around it. */
type ModelBody = Omit<DetailModel, 'blocks' | 'footer'>;

function placeModel(payload: DetailPayload, place: Place): ModelBody {
  const map = payload.enrichment ?? {};
  const e = getPlaceEnrichment(map, place);
  const hero = resolvePhoto({ kind: 'place', place }, { enrichment: map });

  const rating = place.rating ?? e?.rating;
  const price = place.price ?? e?.price;

  const stats: StatFigure[] = [];
  if (rating != null) {
    stats.push({
      value: `${rating}`,
      label: e?.ratingCount != null ? `${compact(e.ratingCount)} reviews` : 'Rating',
    });
  }
  if (price) stats.push({ value: price, label: 'Price' });
  // A hike's figures are its own — the curated fields, not the enrichment's.
  if (place.distance) stats.push({ value: place.distance, label: 'Distance' });
  if (place.duration) stats.push({ value: place.duration, label: 'Duration' });


  return {
    hero: { kind: 'photo', source: hero, glyphCategory: normalizeCategory(place.category) ?? undefined },
    title: place.name,
    sub: join([place.subcategory, price, payload.stop?.city]),
    shareText: join([place.name, place.addr ?? e?.address]) ?? place.name,

    stats: stats.length ? stats : undefined,
    description: place.curatorNote,
    tags: place.must ? ['Must-visit'] : undefined,
    hours: e?.hours?.length ? e.hours : undefined,
    location: locationOf(payload, place.addr ?? e?.address),
    reviews: e?.reviews?.length ? e.reviews : undefined,
    nearby: nearbyOf(payload, place),
    difficulty: place.difficulty,
    // `conditions` has no source: nothing in the schema records trail or weather conditions.
    // The block stays declared in `BLOCK_ORDER.do` so it appears the day one exists.
    conditions: undefined,
  };
}

/** Same stop, not this place, closest first where both ends know where they are. */
function nearbyOf(payload: DetailPayload, place: Place): NearbyPlace[] | undefined {
  const pool = (payload.places ?? []).filter(p => p.id !== place.id && p.stopId === place.stopId);
  if (pool.length === 0) return undefined;

  const map = payload.enrichment ?? {};
  const sorted = [...pool].sort((a, b) => {
    const da = distanceKm(place, a);
    const db = distanceKm(place, b);
    // Coordinates are optional and mostly unset today, so this degrades to "curated first,
    // then alphabetical" rather than to an arbitrary order. It sharpens on its own as
    // enrichment backfills lat/lon; nothing here needs to change when it does.
    if (da != null && db != null) return da - db;
    if (da != null) return -1;
    if (db != null) return 1;
    if (a.must !== b.must) return a.must ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return sorted.slice(0, NEARBY_LIMIT).map(p => ({
    id: p.id,
    name: p.name,
    sub: p.subcategory,
    photo: resolvePhoto({ kind: 'place', place: p }, { enrichment: map }),
    category: normalizeCategory(p.category) ?? undefined,
  }));
}

const EARTH_KM = 6371;

/** Haversine, or undefined when either end has no coordinates. */
function distanceKm(a: Pick<Place, 'lat' | 'lon'>, b: Pick<Place, 'lat' | 'lon'>): number | undefined {
  if (a.lat == null || a.lon == null || b.lat == null || b.lon == null) return undefined;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

// ── Bookings ─────────────────────────────────────────────────────────────────

function bookingModel(payload: DetailPayload, booking: Booking): ModelBody {
  switch (booking.type) {
    case 'hotel':      return hotelModel(payload, booking);
    case 'flight':     return flightModel(payload, booking);
    case 'rental':     return rentalModel(payload, booking);
    case 'restaurant': return reservationModel(payload, booking);
  }
}

/**
 * A booking's status pill. There is no live status feed — the old sheets showed "On time"
 * from a mock — so the honest signal is the one the trip actually records: whether a
 * confirmation code came back.
 */
function statusBadge(code?: string): Pick<Extract<DetailModel['hero'], { kind: 'type' }>, 'badge' | 'badgeTone'> {
  return code
    ? { badge: 'Confirmed', badgeTone: 'accent' }
    : { badge: 'Booked', badgeTone: 'neutral' };
}

/** Travel is the only type with a Confirmation block; everywhere else the code rides in
 *  the Booking block rather than getting a section of its own for one row. */
function confirmationRow(code?: string): InfoRow[] | undefined {
  return code ? [{ label: 'Confirmation', value: code, tone: 'mono' }] : undefined;
}

function hotelModel(payload: DetailPayload, b: HotelBooking): ModelBody {
  const nights = Math.max(0, daysBetween(b.checkIn, b.checkOut));

  return {
    hero: {
      kind: 'type',
      ...statusBadge(b.confirmationCode),
      lead: formatDateRange(b.checkIn, b.checkOut),
      sub: join([plural(nights, 'night'), b.roomType]),
    },
    title: b.hotelName,
    sub: payload.stop?.city,
    shareText: join([b.hotelName, formatDateRange(b.checkIn, b.checkOut), b.address]) ?? b.hotelName,

    stats: [
      { value: `${nights}`, label: nights === 1 ? 'Night' : 'Nights' },
      { value: formatShortDate(b.checkIn), label: 'Check in' },
      { value: formatShortDate(b.checkOut), label: 'Check out' },
    ],
    booking: rows([
      ['Room', b.roomType],
      ['Confirmation', b.confirmationCode, 'mono'],
    ]),
    // No amenity, description or check-in-time field exists on `HotelBooking`. All three
    // stay declared in `BLOCK_ORDER.sleep` and dormant. The old sheet filled them from
    // `MOCK_HOTEL` — a pool, a gym and a 3:00 PM check-in that were true of nowhere.
    location: locationOf(payload, b.address),
  };
}

function flightModel(payload: DetailPayload, b: FlightBooking): ModelBody {
  const { firstLeg, lastLeg } = getFlightEndpoints(b);
  const legs = getFlightLegs(b);

  const timeline: TimelineStep[] = legs.map(leg => ({
    lead: leg.departureTime,
    title: `${leg.origin} → ${leg.destination}`,
    sub: join([`${leg.airline} ${leg.flightNumber}`, `arrives ${leg.arrivalTime}`]),
  }));

  return {
    hero: {
      kind: 'type',
      ...statusBadge(b.confirmationCode),
      lead: `${firstLeg.origin} → ${lastLeg.destination}`,
      sub: join([firstLeg.departureTime, lastLeg.arrivalTime], ' → '),
    },
    title: `${firstLeg.airline} ${firstLeg.flightNumber}`,
    sub: join([firstLeg.departureDate ? formatDayLabel(firstLeg.departureDate) : undefined, payload.stop?.city]),
    shareText: join([
      `${firstLeg.origin} → ${lastLeg.destination}`,
      `${firstLeg.airline} ${firstLeg.flightNumber}`,
      firstLeg.departureDate ? formatDayLabel(firstLeg.departureDate) : undefined,
    ]) ?? firstLeg.flightNumber,

    booking: rows([
      ['Airline', firstLeg.airline],
      ['Flight', firstLeg.flightNumber, 'mono'],
      ['Date', firstLeg.departureDate ? formatDayLabel(firstLeg.departureDate) : undefined],
      // One row for the connection count, because the timeline below is the only other
      // place a two-leg flight announces itself and it is easy to scroll past.
      ['Stops', legs.length > 1 ? plural(legs.length - 1, 'stop') : 'Non-stop'],
    ]),
    timeline: timeline.length ? timeline : undefined,
    confirmation: confirmationRow(b.confirmationCode),
    location: locationOf(payload),
    // `documents` has no source: nothing stores a boarding pass or an attachment.
    documents: undefined,
  };
}

function rentalModel(payload: DetailPayload, b: RentalBooking): ModelBody {
  return {
    hero: {
      kind: 'type',
      ...statusBadge(b.confirmationCode),
      lead: formatDateRange(b.pickupDate, b.dropoffDate),
      sub: b.carType ?? b.company,
    },
    title: b.company,
    sub: join([b.carType, payload.stop?.city]),
    shareText: join([b.company, formatDateRange(b.pickupDate, b.dropoffDate), b.pickupLocation]) ?? b.company,

    booking: rows([
      ['Company', b.company],
      ['Car', b.carType],
    ]),
    timeline: [
      { lead: formatShortDate(b.pickupDate),  title: 'Pick up',  sub: join([b.pickupTime, b.pickupLocation]) },
      { lead: formatShortDate(b.dropoffDate), title: 'Drop off', sub: join([b.dropoffTime, b.dropoffLocation]) },
    ],
    confirmation: confirmationRow(b.confirmationCode),
    location: locationOf(payload, b.pickupLocation),
    documents: undefined,
  };
}

/** A restaurant *reservation*, which is not a restaurant: it carries a time and a party
 *  size and knows nothing about the food. The place blocks on `eat`'s list stay dormant. */
function reservationModel(payload: DetailPayload, b: RestaurantBooking): ModelBody {
  return {
    hero: {
      kind: 'type',
      ...statusBadge(b.confirmationCode),
      lead: formatShortDate(b.date),
      sub: join([b.time, b.partySize != null ? `party of ${b.partySize}` : undefined]),
    },
    title: b.restaurantName,
    sub: payload.stop?.city,
    shareText: join([b.restaurantName, formatDayLabel(b.date), b.time]) ?? b.restaurantName,

    booking: rows([
      ['Date', formatDayLabel(b.date)],
      ['Time', b.time, 'mono'],
      ['Party', b.partySize != null ? `${b.partySize}` : undefined],
      // `eat` has no Confirmation block of its own, so the code rides here rather than
      // getting a whole section for one row. See `confirmationRow`.
      ['Confirmation', b.confirmationCode, 'mono'],
    ]),
    location: locationOf(payload),
  };
}

// ── Shared ───────────────────────────────────────────────────────────────────

function locationOf(payload: DetailPayload, address?: string) {
  const { stop } = payload;
  if (!stop) return address ? { title: address, address } : undefined;
  return {
    title: `Inside ${stop.city}`,
    sub: `Your stop, ${formatDateRange(stop.dates.start, stop.dates.end)}`,
    address,
  };
}

function footerFor(payload: DetailPayload): DetailModel['footer'] {
  const { subject, isAdded, onAdd, onEdit, onViewItinerary } = payload;

  if (subject.kind === 'booking') {
    return onEdit ? { label: 'Edit booking', icon: 'pencil', onPress: onEdit } : undefined;
  }
  if (isAdded) {
    // The spec calls the footer "one obvious exit into the itinerary" — for something
    // already on a day, the exit is going to look at it, not adding it twice.
    return onViewItinerary
      ? { label: 'View in itinerary', icon: 'check', onPress: onViewItinerary }
      : undefined;
  }
  return onAdd ? { label: 'Add to itinerary', icon: 'plus', onPress: onAdd } : undefined;
}

/** Drops rows whose value is absent, so a block is undefined rather than half-empty. */
function rows(defs: [string, string | undefined, InfoRow['tone']?][]): InfoRow[] | undefined {
  const kept = defs
    .filter((d): d is [string, string, InfoRow['tone']?] => !!d[1])
    .map(([label, value, tone]) => ({ label, value, tone }));
  return kept.length ? kept : undefined;
}

function join(parts: (string | undefined | null)[], sep = ' · '): string | undefined {
  const kept = parts.filter((p): p is string => !!p);
  return kept.length ? kept.join(sep) : undefined;
}


function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** 1240 → "1.2k". Review counts run to five figures and the label is 10px wide. */
function compact(n: number): string {
  if (n < 1000) return `${n}`;
  return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
}
