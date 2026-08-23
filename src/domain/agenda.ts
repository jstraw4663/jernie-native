// Agenda's row model: everything in the trip, flattened into one sortable list.
//
// Home is day-by-day and shows one stop; Agenda is the whole trip and — crucially — the only
// place a booking that is *not* on the itinerary can be seen. `StopSection`'s old
// "Flights / Stays / Rental cars / Restaurants" listing is gone, and this is where that
// content went.
//
// Pure and view-free: no React, no icons, no photo components. An entry names its category
// and subtype and the screen resolves those to a Phosphor glyph with `iconFor()`, which is
// what keeps `phosphor-react-native` out of the domain layer and out of these tests.
//
// The one thing an entry does resolve is its photograph, because `resolvePlacePhoto` is
// already domain and the alternative is the screen re-deriving what the row model already
// knows. Screens still never see a URL they did not ask the seam for.
import type { ItemCategory } from '@/src/design/icons';
import type {
  Booking, ItineraryDay, ItineraryItem, Place, PlaceEnrichment, Stop,
} from '@/src/types';
import { resolvePlacePhoto } from './placeEnrichment';
import { bookingCategory, normalizeCategory, roleOf, type ItemRole } from './taxonomy';

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

/** Sorts last within its day, which is where an untimed plan belongs. */
export const UNTIMED = Number.MAX_SAFE_INTEGER;

export type AgendaSource =
  | { kind: 'booking'; bookingId: string }
  | { kind: 'place';   placeId: string; itemId: string }
  | { kind: 'custom';  itemId: string };

export interface AgendaEntry {
  id: string;
  role: ItemRole;
  category: ItemCategory | null;
  subtype?: string;
  stopId: string;
  /** The day this sorts on. A stay sorts on its check-in. */
  dateIso: string;
  /** Minutes past midnight, or `UNTIMED`. */
  minutes: number;
  /** Mono lead, top line: "FRI 22", or "22–24" for a stay. */
  dayLabel: string;
  /** Mono lead, second line: "07:15", or "2 nts" for a stay. */
  timeLabel?: string;
  title: string;
  sub: string;
  /** Secured, not merely planned. Drives the Booked badge. */
  booked: boolean;
  photo?: string;
  /** The next thing happening today. At most one entry in the list carries it. */
  next: boolean;
  source: AgendaSource;
}

export interface AgendaInput {
  stops: Pick<Stop, 'id' | 'city'>[];
  bookings: Booking[];
  /** Keyed by stopId, exactly as `TripContext` supplies it. */
  itinerary: Record<string, ItineraryDay[]>;
  places: Place[];
  enrichment: Record<string, PlaceEnrichment>;
  /** Omit and nothing is marked as next. */
  now?: { todayIso: string; minutes: number };
}

// ── Clock ────────────────────────────────────────────────────────────────────

/**
 * Any of the app's time spellings → "HH:MM", or undefined when there is no time.
 *
 * 24-hour, deliberately, and only here. The lead is a 44px DM Mono column — that is the
 * whole point of the row, per `ItineraryRow`'s comment — and "8:22 AM" is seven characters
 * where five fit. A mono timetable wants a fixed width more than it wants a meridiem.
 */
export function formatClock(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})\s*([AaPp])[Mm]?$|^(\d{1,2}):(\d{2})$/);
  if (!m) return undefined;
  const hasMeridiem = m[1] !== undefined;
  let h = Number(hasMeridiem ? m[1] : m[4]);
  const min = hasMeridiem ? m[2] : m[5];
  if (hasMeridiem) {
    const pm = m[3].toLowerCase() === 'p';
    if (pm && h !== 12) h += 12;
    if (!pm && h === 12) h = 0;
  }
  if (h > 23 || Number(min) > 59) return undefined;
  return `${String(h).padStart(2, '0')}:${min}`;
}

/** The same parse as `formatClock`, as a sort key. */
export function minutesOf(raw?: string | null): number {
  const clock = formatClock(raw);
  if (!clock) return UNTIMED;
  const [h, m] = clock.split(':').map(Number);
  return h * 60 + m;
}

/** "FRI 22" */
function dayLabelOf(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()}`;
}

/**
 * "22–24". Unspaced, unlike `formatDateRange` — the mono lead has 44px to work with and the
 * spaced form is 46. The month is carried by the surrounding chronology, not by the label.
 */
function stayLabelOf(from: string, to: string): string {
  return `${Number(from.slice(8))}–${Number(to.slice(8))}`;
}

function nightsBetween(from: string, to: string): number {
  const [ay, am, ad] = from.split('-').map(Number);
  const [by, bm, bd] = to.split('-').map(Number);
  return Math.max(0, Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000));
}

// ── Entries ──────────────────────────────────────────────────────────────────

/** Uniform for anything the traveller has secured: "Portland · confirmed". */
function bookingSub(city: string | undefined, confirmationCode?: string): string {
  const status = confirmationCode ? 'confirmed' : 'booked';
  return city ? `${city} · ${status}` : status;
}

function fromBooking(b: Booking, cityOf: (stopId: string) => string | undefined): AgendaEntry {
  const category = bookingCategory(b);
  const base = {
    id: `booking:${b.id}`,
    role: roleOf(category),
    category,
    stopId: b.stopId,
    booked: true,
    next: false,
    source: { kind: 'booking' as const, bookingId: b.id },
  };

  switch (b.type) {
    case 'flight': {
      const legs = b.legs ?? [];
      const first = legs[0];
      const last = legs[legs.length - 1];
      const dateIso = first?.departureDate ?? '';
      return {
        ...base,
        subtype: 'flight',
        dateIso,
        minutes: minutesOf(first?.departureTime),
        dayLabel: dateIso ? dayLabelOf(dateIso) : '—',
        timeLabel: formatClock(first?.departureTime),
        title: first && last
          ? `${first.origin} → ${last.destination} · ${first.airline} ${first.flightNumber}`
          : 'Flight',
        sub: bookingSub(cityOf(b.stopId), b.confirmationCode),
      };
    }

    case 'hotel': {
      const nights = nightsBetween(b.checkIn, b.checkOut);
      return {
        ...base,
        subtype: b.roomType,
        dateIso: b.checkIn,
        // A stay has no clock. It heads its check-in day rather than being slotted at a
        // check-in time nobody recorded — in the by-day lens that reads as context for the
        // day, which is what a stay is.
        minutes: 0,
        dayLabel: stayLabelOf(b.checkIn, b.checkOut),
        timeLabel: `${nights} nt${nights === 1 ? '' : 's'}`,
        title: b.hotelName,
        sub: bookingSub(cityOf(b.stopId), b.confirmationCode),
      };
    }

    case 'rental':
      return {
        ...base,
        subtype: 'rental',
        dateIso: b.pickupDate,
        minutes: minutesOf(b.pickupTime),
        dayLabel: dayLabelOf(b.pickupDate),
        timeLabel: formatClock(b.pickupTime),
        title: b.carType ? `${b.company} · ${b.carType}` : b.company,
        // The route, not the city — where a car goes is the fact worth showing, and it is
        // what tells you whether it reaches the last stop.
        sub: `${b.pickupLocation} → ${b.dropoffLocation}`,
      };

    case 'restaurant':
      return {
        ...base,
        subtype: 'restaurant',
        dateIso: b.date,
        minutes: minutesOf(b.time),
        dayLabel: dayLabelOf(b.date),
        timeLabel: formatClock(b.time),
        title: b.restaurantName,
        sub: bookingSub(cityOf(b.stopId), b.confirmationCode),
      };
  }
}

function fromItem(
  item: ItineraryItem,
  day: ItineraryDay,
  stopId: string,
  places: Place[],
  enrichment: Record<string, PlaceEnrichment>,
): AgendaEntry {
  const place = item.placeId ? places.find(p => p.id === item.placeId) : undefined;
  const category = normalizeCategory(place?.category ?? item.category);

  return {
    id: `item:${item.id}`,
    role: roleOf(category),
    category,
    subtype: place?.subcategory,
    stopId,
    dateIso: day.dateIso,
    minutes: minutesOf(item.time),
    dayLabel: dayLabelOf(day.dateIso),
    timeLabel: formatClock(item.time),
    title: place?.name ?? item.label ?? 'Untitled',
    sub: place
      ? (place.curatorNote ?? place.subcategory ?? place.category)
      : (item.notes ?? ''),
    booked: false,
    photo: place ? resolvePlacePhoto(place, enrichment) : undefined,
    next: false,
    source: place
      ? { kind: 'place', placeId: place.id, itemId: item.id }
      : { kind: 'custom', itemId: item.id },
  };
}

/**
 * Every booking and every itinerary item in the trip, as one chronological list.
 *
 * A booking referenced by an itinerary item appears **once** — the booking's own entry wins,
 * because it carries the dates and the confirmation. An item pointing at a booking that is
 * not in `bookings` (filtered out by group visibility) falls through to the custom shape
 * rather than vanishing.
 */
export function buildAgenda(input: AgendaInput): AgendaEntry[] {
  const cityOf = (stopId: string) => input.stops.find(s => s.id === stopId)?.city;
  const bookingIds = new Set(input.bookings.map(b => b.id));

  const entries: AgendaEntry[] = input.bookings.map(b => fromBooking(b, cityOf));

  for (const [stopId, days] of Object.entries(input.itinerary)) {
    for (const day of days) {
      for (const item of day.items) {
        if (item.type === 'booking' && item.bookingId && bookingIds.has(item.bookingId)) continue;
        entries.push(fromItem(item, day, stopId, input.places, input.enrichment));
      }
    }
  }

  entries.sort((a, b) =>
    a.dateIso.localeCompare(b.dateIso) || a.minutes - b.minutes || a.title.localeCompare(b.title));

  // The next thing happening, highlighted in accent, and only ever one of them.
  if (input.now) {
    const { todayIso, minutes } = input.now;
    const next = entries.find(e => e.dateIso === todayIso && e.minutes >= minutes);
    if (next) next.next = true;
  }

  return entries;
}

// ── Lenses ───────────────────────────────────────────────────────────────────
// The same entries, grouped three ways. Each returns groups in display order and drops
// nothing — an empty group is the caller's decision to render or omit.

export const ROLE_ORDER: readonly ItemRole[] = ['move', 'sleep', 'eat', 'do'];

export function groupByRole(entries: AgendaEntry[]): { role: ItemRole; entries: AgendaEntry[] }[] {
  return ROLE_ORDER.map(role => ({ role, entries: entries.filter(e => e.role === role) }));
}

export function groupByDay(entries: AgendaEntry[]): { dateIso: string; entries: AgendaEntry[] }[] {
  const days: { dateIso: string; entries: AgendaEntry[] }[] = [];
  for (const entry of entries) {
    const last = days[days.length - 1];
    if (last && last.dateIso === entry.dateIso) last.entries.push(entry);
    else days.push({ dateIso: entry.dateIso, entries: [entry] });
  }
  return days;
}

/** Stop order comes from the caller — `stops` is already chronological in `TripContext`. */
export function groupByStop(
  entries: AgendaEntry[],
  stops: Pick<Stop, 'id'>[],
): { stopId: string; entries: AgendaEntry[] }[] {
  return stops.map(stop => ({
    stopId: stop.id,
    entries: entries.filter(e => e.stopId === stop.id),
  }));
}
