// A gap is a hole in the plan: a night with nowhere to sleep, a stop the car does not reach.
// Derived, never stored and never hand-authored — `GapRow` renders what this returns.
//
// **Only two roles generate gaps.** `sleep` and `move`, per `GapRow.prompt.md`: eating and
// doing are preferences, and a preference cannot be missing. See `taxonomy.ts`.
//
// ## The date convention this rests on
//
// `Stop.dates.end` is the **departure date**. May 21 – 24 is three nights — the 21st, 22nd
// and 23rd — and the 24th is the morning you leave. So a stop's nights are `[start, end)`
// and `nights = end − start`, which is already what the home rail card prints.
//
// This is the same convention hotels use, which is why `HotelBooking.checkIn/checkOut` drops
// straight in: a booking covers the nights `[checkIn, checkOut)`.
//
// It also settles a long-standing apparent conflict. `getActiveStopId` treats `end` as
// exclusive ("am I at this stop today"); `syncItineraryDaysForRange` treats it as inclusive
// ("what days does this stop cover" — the 24th still gets an itinerary day, because you are
// there for part of it). Both are correct; they answer different questions and neither said
// which. Nothing in either is changed here.
//
// ## What counts as cover
//
// **Dates, not `stopId`.** A booking's stop link is not consulted: a hotel that spans a stop
// boundary (in on the 22nd, out on the 25th, with the stops changing over on the 24th) is
// tagged to the first stop but genuinely covers a night of the second. Asking the dates gets
// that right and cannot produce a false gap from a mis-tagged booking.
//
// **A plan counts, not just a booking.** An itinerary item whose role is `sleep` covers that
// night; one whose role is `move` covers that day. Without this, staying with friends is a
// permanent stay gap and driving your own car is a permanent transport gap on every stop —
// two false alarms common enough to make the feature read as broken. What the traveller has
// written down is their answer to the question, and the row already says whether it is
// booked.
//
// ## The one asymmetry
//
// Sleep is counted **per night** — you need a bed every night, so the gap names how many are
// missing. Transport is **per stop** — you need a way to get around, not one per night, so
// the gap is binary and the sub explains the cause instead of counting.
import type { Booking, ItineraryDay, ItineraryItem, Stop } from '@/src/types';
import { formatDateRange } from '@/src/utils/dates';
import { bookingCategory, normalizeCategory, roleOf } from './taxonomy';

export type GapKind = 'stay' | 'transport';

export interface Gap {
  /** Stable across renders — the kind, the stop, and where the run starts. */
  id: string;
  kind: GapKind;
  stopId: string;
  city: string;
  /** First uncovered night, ISO. */
  from: string;
  /** The morning after the last uncovered night — the same departure-date convention as `Stop.dates.end`. */
  to: string;
  /** `to − from`. Always ≥ 1. */
  nights: number;
  /** "Nowhere to sleep in Southwest Harbor" */
  title: string;
  /** "May 27 – 29 · 2 nights unbooked" */
  sub: string;
}

export type StayCoverage = 'covered' | 'partial' | 'none';
export type TransportCoverage = 'covered' | 'none';

export interface StopCoverage {
  stopId: string;
  city: string;
  /** `end − start`. Zero for a day trip, which generates no gaps of either kind. */
  nights: number;
  nightsCovered: number;
  stay: StayCoverage;
  transport: TransportCoverage;
}

export interface TripCoverage {
  stops: StopCoverage[];
  /** Chronological by stop, stays before transport within a stop. */
  gaps: Gap[];
  /** Trip totals, for "7 of 8 nights covered". */
  nights: number;
  nightsCovered: number;
  /** Stops whose every night has a bed. A partially covered stop does not count. */
  stopsWithStay: number;
  stopsWithTransport: number;
}

export interface CoverageInput {
  /** Chronological. `compareStopsChronologically` if the caller has not already sorted. */
  stops: Pick<Stop, 'id' | 'city' | 'dates'>[];
  bookings: Booking[];
  /** Keyed by stopId, exactly as `TripContext` supplies it. Optional: bookings alone are a
   *  valid, if noisier, answer. */
  itinerary?: Record<string, ItineraryDay[]>;
}

// ── Date arithmetic ──────────────────────────────────────────────────────────
// Local, never UTC. `new Date('2026-08-10')` is UTC midnight, which reads as the previous
// day west of Greenwich and would shift every date by one. Same guard as
// `syncItineraryDaysForRange`.

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const next = new Date(y, m - 1, d + days);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

/** Whole days between two ISO dates. Negative if `to` precedes `from`. */
export function daysBetween(from: string, to: string): number {
  const [ay, am, ad] = from.split('-').map(Number);
  const [by, bm, bd] = to.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** The nights of a half-open `[start, end)` range, as ISO dates. Empty for a day trip. */
function nightsIn(start: string, end: string): string[] {
  const out: string[] = [];
  for (let cursor = start; cursor < end; cursor = addDays(cursor, 1)) out.push(cursor);
  return out;
}

// ── Cover, gathered once for the whole trip ──────────────────────────────────

interface Window { from: string; to: string }

/** The date span a `move` booking makes a vehicle or a seat available over, inclusive. */
function moveWindow(b: Booking): Window | null {
  if (b.type === 'rental') return { from: b.pickupDate, to: b.dropoffDate };
  if (b.type === 'flight') {
    const dates = (b.legs ?? []).map(l => l.departureDate).filter(Boolean).sort();
    if (dates.length === 0) return null;
    return { from: dates[0], to: dates[dates.length - 1] };
  }
  return null;
}

/** An item's role, resolved through the same normaliser every other surface uses. */
function itemRole(item: ItineraryItem) {
  return roleOf(normalizeCategory(item.category));
}

interface Cover {
  /** Nights with a bed. */
  sleep: Set<string>;
  /** Inclusive day windows during which some way of getting around exists. */
  move: Window[];
  /** Every rental in the trip, for explaining *why* a stop has no transport. */
  rentals: Window[];
}

function gatherCover({ bookings, itinerary }: CoverageInput): Cover {
  const sleep = new Set<string>();
  const move: Window[] = [];
  const rentals: Window[] = [];

  for (const b of bookings) {
    // The taxonomy decides which question the booking answers; the type only narrows the
    // shape that carries the dates. Nothing downstream reads `b.type` to make a decision.
    const role = roleOf(bookingCategory(b));

    if (role === 'sleep') {
      if (b.type !== 'hotel') continue;   // the only shape carrying nights today
      for (const night of nightsIn(b.checkIn, b.checkOut)) sleep.add(night);
      continue;
    }

    if (role !== 'move') continue;
    const w = moveWindow(b);
    if (!w) continue;
    move.push(w);
    if (b.type === 'rental') rentals.push(w);
  }

  for (const days of Object.values(itinerary ?? {})) {
    for (const day of days) {
      for (const item of day.items) {
        const role = itemRole(item);
        // A booking already counted above — the itinerary entry is a second reference to it,
        // not a second bed.
        if (item.type === 'booking') continue;
        if (role === 'sleep') sleep.add(day.dateIso);
        if (role === 'move') move.push({ from: day.dateIso, to: day.dateIso });
      }
    }
  }

  return { sleep, move, rentals };
}

// ── Copy ─────────────────────────────────────────────────────────────────────
// Voice: name the thing, then the consequence; numbers do the arguing. The title names the
// problem and the sub scopes it, which is why a partially covered stop can still say
// "Nowhere to sleep in Bar Harbor" — the sub says which nights.

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function transportReason(stop: { start: string; lastNight: string }, rentals: Window[]): string {
  if (rentals.some(r => r.to < stop.start)) return 'the car drops off before you arrive';
  if (rentals.some(r => r.from > stop.lastNight)) return 'the car is picked up after you leave';
  return 'nothing booked to get around';
}

// ── The derivation ───────────────────────────────────────────────────────────

/**
 * Every stop's coverage and every gap in the trip, in one pass. Pure: no clock, no I/O, no
 * writes. A stop with no nights (start === end) is a day trip and generates nothing.
 */
export function deriveCoverage(input: CoverageInput): TripCoverage {
  const cover = gatherCover(input);

  const stops: StopCoverage[] = [];
  const gaps: Gap[] = [];
  let nights = 0;
  let nightsCovered = 0;

  for (const stop of input.stops) {
    const stopNights = nightsIn(stop.dates.start, stop.dates.end);
    const covered = stopNights.filter(n => cover.sleep.has(n));

    nights += stopNights.length;
    nightsCovered += covered.length;

    const stay: StayCoverage = stopNights.length === 0 || covered.length === stopNights.length
      ? 'covered'
      : covered.length === 0 ? 'none' : 'partial';

    // Binary, and measured over the nights rather than the days: transport you only have on
    // the morning you leave is not transport *for* this stop.
    const lastNight = stopNights[stopNights.length - 1] ?? stop.dates.start;
    const hasMove = stopNights.length === 0
      || cover.move.some(w => w.from <= lastNight && w.to >= stop.dates.start);
    const transport: TransportCoverage = hasMove ? 'covered' : 'none';

    stops.push({
      stopId: stop.id,
      city: stop.city,
      nights: stopNights.length,
      nightsCovered: covered.length,
      stay,
      transport,
    });

    // One gap per contiguous run of uncovered nights, not one per stop — the sub prints a
    // range, so it can only be true if the range is unbroken.
    let runStart: string | null = null;
    for (let i = 0; i <= stopNights.length; i++) {
      const night = stopNights[i];
      const uncovered = night !== undefined && !cover.sleep.has(night);
      if (uncovered && runStart === null) runStart = night;
      if (!uncovered && runStart !== null) {
        // `runStart` is only non-null from index 1 onward, so `stopNights[i - 1]` — the last
        // uncovered night — always exists here.
        const to = addDays(stopNights[i - 1], 1);
        const n = daysBetween(runStart, to);
        gaps.push({
          id: `stay:${stop.id}:${runStart}`,
          kind: 'stay',
          stopId: stop.id,
          city: stop.city,
          from: runStart,
          to,
          nights: n,
          title: `Nowhere to sleep in ${stop.city}`,
          sub: `${formatDateRange(runStart, to)} · ${plural(n, 'night', 'nights')} unbooked`,
        });
        runStart = null;
      }
    }

    if (transport === 'none') {
      gaps.push({
        id: `transport:${stop.id}`,
        kind: 'transport',
        stopId: stop.id,
        city: stop.city,
        from: stop.dates.start,
        to: stop.dates.end,
        nights: stopNights.length,
        title: `No transport in ${stop.city}`,
        sub: `${formatDateRange(stop.dates.start, stop.dates.end)} · ${transportReason({ start: stop.dates.start, lastNight }, cover.rentals)}`,
      });
    }
  }

  return {
    stops,
    gaps,
    nights,
    nightsCovered,
    stopsWithStay: stops.filter(s => s.stay === 'covered').length,
    stopsWithTransport: stops.filter(s => s.transport === 'covered').length,
  };
}

/** The gaps for one stop, in the order they should render under it. */
export function gapsForStop(coverage: TripCoverage, stopId: string): Gap[] {
  return coverage.gaps.filter(g => g.stopId === stopId);
}

/** The gaps of one kind, for the Agenda group that owns them. */
export function gapsOfKind(coverage: TripCoverage, kind: GapKind): Gap[] {
  return coverage.gaps.filter(g => g.kind === kind);
}
