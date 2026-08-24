// The Jernie tab's render model: one chronological trip, not the stop-keyed shape RTDB
// stores. Pure and view-free so scroll/layout code never has to rediscover chronology,
// transition days, booking truth, or loose-time semantics while rendering.
import type { ItemCategory } from '@/src/design/icons';
import type {
  Booking, HotelBooking, ItineraryDay, ItineraryItem, Place, PlaceEnrichment, Stop,
} from '@/src/types';
import { formatClock, minutesOf, UNTIMED } from './agenda';
import { getBookingDisplay, getFlightEndpoints } from './bookings';
import { daysBetween, deriveCoverage, type Gap, type TripCoverage } from './gaps';
import { getPlaceEnrichment, resolvePlacePhoto } from './placeEnrichment';
import { bookingCategory, normalizeCategory } from './taxonomy';

export type TimelineBandKey = 'early' | 'morning' | 'afternoon' | 'evening' | 'late';
export type TimelineTimePrecision = 'hard' | 'loose' | 'unscheduled';

export interface TimelineBandDefinition {
  key: TimelineBandKey;
  label: string;
  span: string;
}

/** Exact, decided in the completed itinerary canvas. Every day renders all five. */
export const TIMELINE_BANDS: readonly TimelineBandDefinition[] = [
  { key: 'early',     label: 'Early',     span: '5–9 AM' },
  { key: 'morning',   label: 'Morning',   span: '9 – 12' },
  { key: 'afternoon', label: 'Afternoon', span: '12 – 5' },
  { key: 'evening',   label: 'Evening',   span: '5 – 9 PM' },
  { key: 'late',      label: 'Late',      span: '9 PM +' },
] as const;

const BAND_INDEX = new Map(TIMELINE_BANDS.map((band, index) => [band.key, index]));
const BAND_MIDPOINT: Record<TimelineBandKey, number> = {
  early: 7 * 60,
  morning: 10 * 60 + 30,
  afternoon: 14 * 60 + 30,
  evening: 19 * 60,
  late: 23 * 60,
};

const LOOSE_BAND: Record<string, TimelineBandKey> = {
  early: 'early',
  sunrise: 'early',
  morning: 'morning',
  'mid-morning': 'morning',
  midmorning: 'morning',
  noon: 'afternoon',
  midday: 'afternoon',
  afternoon: 'afternoon',
  evening: 'evening',
  sunset: 'evening',
  late: 'late',
  night: 'late',
  'late night': 'late',
  'late-night': 'late',
};

export interface TimelineTime {
  raw?: string;
  clock?: string;
  label: string;
  precision: TimelineTimePrecision;
  band?: TimelineBandKey;
  /** Sort key within a band. Unscheduled remains UNTIMED. */
  sortMinutes: number;
}

/**
 * Maps the app's real free-text time field onto the design's five bands without inventing a
 * time. Exact clocks are hard; a small explicit vocabulary is loose; everything else is
 * visibly unscheduled.
 */
export function timelineTime(raw?: string | null): TimelineTime {
  const trimmed = raw?.trim();
  const clock = formatClock(trimmed);
  if (clock) {
    const minutes = minutesOf(clock);
    const band: TimelineBandKey = minutes >= 5 * 60 && minutes < 9 * 60
      ? 'early'
      : minutes >= 9 * 60 && minutes < 12 * 60
        ? 'morning'
        : minutes >= 12 * 60 && minutes < 17 * 60
          ? 'afternoon'
          : minutes >= 17 * 60 && minutes < 21 * 60
            ? 'evening'
            : 'late';
    return { raw: trimmed, clock, label: trimmed!, precision: 'hard', band, sortMinutes: minutes };
  }

  if (trimmed) {
    const band = LOOSE_BAND[trimmed.toLowerCase().replace(/\s+/g, ' ')];
    if (band) {
      return { raw: trimmed, label: trimmed, precision: 'loose', band, sortMinutes: BAND_MIDPOINT[band] };
    }
  }

  return { raw: trimmed || undefined, label: trimmed || 'Unscheduled', precision: 'unscheduled', sortMinutes: UNTIMED };
}

export type TimelineSource =
  | { kind: 'booking'; bookingId: string; itemId?: string; event: BookingEventKind | 'placed' }
  | { kind: 'place'; placeId: string; itemId: string }
  | { kind: 'custom'; itemId: string };

export type BookingEventKind =
  | 'departure' | 'checkin' | 'checkout' | 'pickup' | 'dropoff' | 'reservation';

export interface TimelineEntry {
  id: string;
  dateIso: string;
  stopId: string;
  title: string;
  meta?: string;
  category: ItemCategory | null;
  subtype?: string;
  photo?: string;
  time: TimelineTime;
  source: TimelineSource;
  order: number;
  secured: boolean;
  confirmed: boolean;
  requiresMoveConfirmation: boolean;
  past: boolean;
  next: boolean;
}

export interface TimelineBand extends TimelineBandDefinition {
  entries: TimelineEntry[];
  /** Empty-state actions exist only near now; older/far-future blanks stay quiet. */
  showEmptyPrompt: boolean;
}

export interface TimelineStopSegment {
  stopId: string;
  city: string;
  order: number;
  entryCount: number;
}

export interface TimelineTransition {
  fromStopId: string;
  fromCity: string;
  toStopId: string;
  toCity: string;
}

export interface TimelineStayContext {
  bookingId: string;
  stopId: string;
  name: string;
  detail: string;
  confirmed: boolean;
}

export interface TimelineDay {
  dateIso: string;
  weekday: string;
  dayOfMonth: number;
  segments: TimelineStopSegment[];
  transition?: TimelineTransition;
  stay?: TimelineStayContext;
  bands: TimelineBand[];
  unscheduled: TimelineEntry[];
  count: number;
  isToday: boolean;
  isPast: boolean;
  warning: boolean;
}

export interface ItineraryTimelineInput {
  stops: Pick<Stop, 'id' | 'city' | 'dates' | 'order'>[];
  bookings: Booking[];
  itinerary: Record<string, ItineraryDay[]>;
  places: Place[];
  enrichment: Record<string, PlaceEnrichment>;
  /** Omit for a timeless model: no today/past/next/near-now empty prompt states. */
  now?: { todayIso: string; minutes: number };
}

export interface ItineraryTimelineModel {
  days: TimelineDay[];
  coverage: TripCoverage;
  todayIndex: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const next = new Date(year, month - 1, day + days);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

function datesInRange(start: string, end: string): string[] {
  if (!start || !end || start > end) return [];
  const dates: string[] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) dates.push(cursor);
  return dates;
}

function confirmationCodeOf(booking: Booking): string | undefined {
  return 'confirmationCode' in booking ? booking.confirmationCode : undefined;
}

function bookingTimeOn(booking: Booking, dateIso: string): string | undefined {
  switch (booking.type) {
    case 'flight':
      return booking.legs?.find(leg => leg.departureDate === dateIso)?.departureTime;
    case 'hotel':
      return undefined;
    case 'rental':
      if (booking.pickupDate === dateIso) return booking.pickupTime;
      if (booking.dropoffDate === dateIso) return booking.dropoffTime;
      return undefined;
    case 'restaurant':
      return booking.date === dateIso ? booking.time : undefined;
  }
}

function placedEntry(
  item: ItineraryItem,
  day: ItineraryDay,
  stopId: string,
  bookings: Map<string, Booking>,
  places: Map<string, Place>,
  enrichment: Record<string, PlaceEnrichment>,
): TimelineEntry {
  const booking = item.bookingId ? bookings.get(item.bookingId) : undefined;
  const place = item.placeId ? places.get(item.placeId) : undefined;
  const rawTime = item.time ?? (booking ? bookingTimeOn(booking, day.dateIso) : undefined);
  const secured = Boolean(booking || item.locked);
  const confirmed = Boolean(booking && confirmationCodeOf(booking));

  if (booking) {
    const display = getBookingDisplay(booking, day.dateIso);
    return {
      id: `item:${item.id}`,
      dateIso: day.dateIso,
      stopId,
      title: item.label ?? display.label,
      meta: display.meta,
      category: bookingCategory(booking),
      time: timelineTime(rawTime),
      source: { kind: 'booking', bookingId: booking.id, itemId: item.id, event: 'placed' },
      order: item.order,
      secured,
      confirmed,
      requiresMoveConfirmation: secured,
      past: false,
      next: false,
    };
  }

  if (place) {
    const cached = getPlaceEnrichment(enrichment, place);
    return {
      id: `item:${item.id}`,
      dateIso: day.dateIso,
      stopId,
      title: place.name,
      meta: cached?.address ?? place.addr ?? place.subcategory ?? place.curatorNote,
      category: normalizeCategory(place.category),
      subtype: place.subcategory,
      photo: resolvePlacePhoto(place, enrichment),
      time: timelineTime(rawTime),
      source: { kind: 'place', placeId: place.id, itemId: item.id },
      order: item.order,
      secured,
      confirmed: false,
      requiresMoveConfirmation: secured,
      past: false,
      next: false,
    };
  }

  return {
    id: `item:${item.id}`,
    dateIso: day.dateIso,
    stopId,
    title: item.label ?? 'Untitled plan',
    meta: item.notes,
    category: normalizeCategory(item.category),
    time: timelineTime(rawTime),
    source: { kind: 'custom', itemId: item.id },
    order: item.order,
    secured,
    confirmed: false,
    requiresMoveConfirmation: secured,
    past: false,
    next: false,
  };
}

interface SyntheticBookingEvent {
  kind: BookingEventKind;
  dateIso: string;
  stopId: string;
  time?: string;
  title: string;
  meta?: string;
}

function bookingEvents(booking: Booking): SyntheticBookingEvent[] {
  const confirmation = confirmationCodeOf(booking);
  const status = confirmation ? `confirmed · ${confirmation}` : 'booked';

  switch (booking.type) {
    case 'flight': {
      const { firstLeg, lastLeg } = getFlightEndpoints(booking);
      if (!firstLeg.departureDate) return [];
      return [{
        kind: 'departure',
        dateIso: firstLeg.departureDate,
        stopId: booking.stopId,
        time: firstLeg.departureTime,
        title: `${firstLeg.origin} → ${lastLeg.destination}`,
        meta: `${firstLeg.airline} ${firstLeg.flightNumber} · ${status}`,
      }];
    }
    case 'hotel':
      return [
        { kind: 'checkin', dateIso: booking.checkIn, stopId: booking.stopId, title: `Check in · ${booking.hotelName}`, meta: status },
        { kind: 'checkout', dateIso: booking.checkOut, stopId: booking.stopId, title: `Check out · ${booking.hotelName}`, meta: status },
      ];
    case 'rental':
      return [
        {
          kind: 'pickup', dateIso: booking.pickupDate, stopId: booking.stopId,
          time: booking.pickupTime, title: `Pick up rental · ${booking.company}`,
          meta: [booking.carType, booking.pickupLocation, status].filter(Boolean).join(' · '),
        },
        {
          kind: 'dropoff', dateIso: booking.dropoffDate,
          stopId: booking.dropoffStopId ?? booking.stopId,
          time: booking.dropoffTime, title: `Return rental · ${booking.company}`,
          meta: [booking.dropoffLocation, status].filter(Boolean).join(' · '),
        },
      ];
    case 'restaurant':
      return [{
        kind: 'reservation', dateIso: booking.date, stopId: booking.stopId,
        time: booking.time, title: booking.restaurantName,
        meta: [booking.partySize ? `${booking.partySize} guests` : undefined, status].filter(Boolean).join(' · '),
      }];
  }
}

function syntheticEntries(booking: Booking): TimelineEntry[] {
  const confirmed = Boolean(confirmationCodeOf(booking));
  return bookingEvents(booking).map((event, order) => ({
    id: `booking:${booking.id}:${event.kind}`,
    dateIso: event.dateIso,
    stopId: event.stopId,
    title: event.title,
    meta: event.meta,
    category: bookingCategory(booking),
    time: timelineTime(event.time),
    source: { kind: 'booking', bookingId: booking.id, event: event.kind },
    order,
    secured: true,
    confirmed,
    requiresMoveConfirmation: true,
    past: false,
    next: false,
  }));
}

function entrySort(a: TimelineEntry, b: TimelineEntry): number {
  const aBand = a.time.band ? BAND_INDEX.get(a.time.band)! : TIMELINE_BANDS.length;
  const bBand = b.time.band ? BAND_INDEX.get(b.time.band)! : TIMELINE_BANDS.length;
  return aBand - bBand
    || a.time.sortMinutes - b.time.sortMinutes
    || a.order - b.order
    || a.title.localeCompare(b.title);
}

function gapTouchesDate(gap: Gap, dateIso: string): boolean {
  return gap.kind === 'stay'
    ? gap.from <= dateIso && dateIso < gap.to
    : gap.from <= dateIso && dateIso <= gap.to;
}

function stayOn(dateIso: string, bookings: Booking[], stopOrder: Map<string, number>): TimelineStayContext | undefined {
  const candidates = bookings
    .filter((booking): booking is HotelBooking => booking.type === 'hotel')
    .filter(booking => booking.checkIn <= dateIso && dateIso < booking.checkOut)
    .sort((a, b) => (stopOrder.get(b.stopId) ?? 0) - (stopOrder.get(a.stopId) ?? 0));
  const booking = candidates[0];
  if (!booking) return undefined;

  const nights = daysBetween(booking.checkIn, booking.checkOut);
  const night = daysBetween(booking.checkIn, dateIso) + 1;
  const confirmed = Boolean(booking.confirmationCode);
  const detail = !confirmed
    ? 'not yet confirmed'
    : night === nights
      ? 'last night here'
      : night === 1
        ? `${nights} ${nights === 1 ? 'night' : 'nights'} · booked`
        : `night ${night} of ${nights}`;

  return { bookingId: booking.id, stopId: booking.stopId, name: booking.hotelName, detail, confirmed };
}

function markClockState(entries: TimelineEntry[], now?: ItineraryTimelineInput['now']): void {
  if (!now) return;
  for (const entry of entries) {
    entry.past = entry.dateIso < now.todayIso
      || (entry.dateIso === now.todayIso
        && entry.time.precision === 'hard'
        && entry.time.sortMinutes < now.minutes);
  }

  const next = entries
    .filter(entry => !entry.past && entry.dateIso >= now.todayIso)
    .sort((a, b) => a.dateIso.localeCompare(b.dateIso) || entrySort(a, b))[0];
  if (next) next.next = true;
}

/** Builds the complete timeline in one deterministic pass. */
export function buildItineraryTimeline(input: ItineraryTimelineInput): ItineraryTimelineModel {
  const stops = [...input.stops].sort((a, b) => a.order - b.order);
  const stopOrder = new Map(stops.map(stop => [stop.id, stop.order]));
  const bookings = new Map(input.bookings.map(booking => [booking.id, booking]));
  const places = new Map(input.places.map(place => [place.id, place]));
  const referencedBookingIds = new Set<string>();
  const entries: TimelineEntry[] = [];

  for (const [stopId, days] of Object.entries(input.itinerary)) {
    for (const day of days) {
      for (const item of day.items) {
        if (item.bookingId && bookings.has(item.bookingId)) referencedBookingIds.add(item.bookingId);
        entries.push(placedEntry(item, day, stopId, bookings, places, input.enrichment));
      }
    }
  }

  for (const booking of input.bookings) {
    if (!referencedBookingIds.has(booking.id)) entries.push(...syntheticEntries(booking));
  }

  markClockState(entries, input.now);

  const dates = new Set<string>();
  for (const stop of stops) {
    for (const date of datesInRange(stop.dates.start, stop.dates.end)) dates.add(date);
  }
  for (const days of Object.values(input.itinerary)) {
    for (const day of days) dates.add(day.dateIso);
  }
  for (const entry of entries) if (entry.dateIso) dates.add(entry.dateIso);

  const coverage = deriveCoverage({ stops, bookings: input.bookings, itinerary: input.itinerary });
  const tomorrowIso = input.now ? addDays(input.now.todayIso, 1) : undefined;

  const days = [...dates].sort().map((dateIso): TimelineDay => {
    const date = new Date(`${dateIso}T12:00:00`);
    const dayEntries = entries.filter(entry => entry.dateIso === dateIso).sort(entrySort);
    const segmentStops = stops.filter(stop => stop.dates.start <= dateIso && dateIso <= stop.dates.end);
    const segments = segmentStops.map(stop => ({
      stopId: stop.id,
      city: stop.city,
      order: stop.order,
      entryCount: dayEntries.filter(entry => entry.stopId === stop.id).length,
    }));
    const transition = segments.length > 1 ? {
      fromStopId: segments[0].stopId,
      fromCity: segments[0].city,
      toStopId: segments[segments.length - 1].stopId,
      toCity: segments[segments.length - 1].city,
    } : undefined;
    const nearNow = Boolean(input.now && (dateIso === input.now.todayIso || dateIso === tomorrowIso));
    const bands = TIMELINE_BANDS.map(definition => ({
      ...definition,
      entries: dayEntries.filter(entry => entry.time.band === definition.key),
      showEmptyPrompt: nearNow && !dayEntries.some(entry => entry.time.band === definition.key),
    }));
    const stay = stayOn(dateIso, input.bookings, stopOrder);
    const stopIds = new Set(segments.map(segment => segment.stopId));
    const hasGap = coverage.gaps.some(gap => stopIds.has(gap.stopId) && gapTouchesDate(gap, dateIso));

    return {
      dateIso,
      weekday: WEEKDAYS[date.getDay()],
      dayOfMonth: date.getDate(),
      segments,
      transition,
      stay,
      bands,
      unscheduled: dayEntries.filter(entry => !entry.time.band),
      count: dayEntries.length,
      isToday: dateIso === input.now?.todayIso,
      isPast: Boolean(input.now && dateIso < input.now.todayIso),
      warning: hasGap || Boolean(stay && !stay.confirmed),
    };
  });

  return { days, coverage, todayIndex: input.now ? days.findIndex(day => day.isToday) : -1 };
}
