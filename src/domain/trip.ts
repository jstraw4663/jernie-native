import type { ItineraryDay, Stop, Trip } from '@/src/types';
import { getDevNow } from '@/src/utils/devTime';
import { resolveStopColor } from '@/src/design/tripPacks';

// ── Stop color derivation ────────────────────────────────────────────────────

/**
 * Resolves a stop's display color live from the trip's colorPack + the stop's order.
 * Never persisted — Stop.color does not exist; this is the only place a stop-shaped
 * object should acquire a `.color`.
 */
export function getStopColor(stop: Pick<Stop, 'order'>, trip: Pick<Trip, 'colorPack'>): string {
  return resolveStopColor(trip.colorPack, stop.order);
}

/**
 * Display order for stops: chronological by date, NOT by `order`.
 *
 * `order` is assigned as `max(order)+1` at creation (see useAddStop), so sorting by it
 * shows stops in the sequence they were typed in — wrong the moment someone adds a stop
 * that falls between two existing ones. Dates are YYYY-MM-DD, so string comparison is
 * chronological.
 *
 * `order` survives only as the final tiebreak, and remains the stop's color-palette index
 * (see getStopColor) — sorting never renumbers it, so a stop keeps its color for life.
 */
export function compareStopsChronologically(
  a: Pick<Stop, 'dates' | 'order'>,
  b: Pick<Stop, 'dates' | 'order'>,
): number {
  return (
    a.dates.start.localeCompare(b.dates.start) ||
    a.dates.end.localeCompare(b.dates.end) ||
    a.order - b.order
  );
}

// ── Date helpers ─────────────────────────────────────────────────────────────

/**
 * Parses a flight date/time string in a Safari-safe way.
 * "2026-05-26 6:00 AM" → avoids Date.parse("YYYY-MM-DD H:MM AM") which returns NaN in WebKit.
 */
export function parseFlightDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  // Try ISO format first
  const iso = new Date(dateStr);
  if (!isNaN(iso.getTime())) return iso;
  // Try "YYYY-MM-DD H:MM AM/PM"
  const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  const [, datePart, hoursStr, minsStr, meridiem] = match;
  let hours = parseInt(hoursStr, 10);
  const mins = parseInt(minsStr, 10);
  if (meridiem.toUpperCase() === 'PM' && hours !== 12) hours += 12;
  if (meridiem.toUpperCase() === 'AM' && hours === 12) hours = 0;
  return new Date(`${datePart}T${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:00`);
}

/** Formats a Date as "h:mm AM/PM" */
export function formatTime(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** Formats a countdown: "2h 15m", "45m", "< 1m" */
export function formatCountdown(diffMs: number): string {
  if (diffMs <= 0) return '< 1m';
  const totalMin = Math.floor(diffMs / 60_000);
  if (totalMin < 60) return `${totalMin}m`;
  const hr = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  return min > 0 ? `${hr}h ${min}m` : `${hr}h`;
}

// ── Itinerary day helpers ────────────────────────────────────────────────────

/**
 * Returns the index of the day to auto-expand in the itinerary accordion.
 * - During trip: today's day index
 * - Pre-trip: 0 (Day 1)
 * - Post-trip: -1 (collapse all)
 */
export function getAutoExpandDayIndex(days: ItineraryDay[], today?: Date): number {
  const now = today ?? getDevNow();
  const todayIso = now.toISOString().split('T')[0];

  if (days.length === 0) return 0;

  const firstDay = days[0].dateIso;
  const lastDay = days[days.length - 1].dateIso;

  if (todayIso < firstDay) return 0;           // pre-trip: open Day 1
  if (todayIso > lastDay) return -1;            // post-trip: collapse all

  const idx = days.findIndex((d) => d.dateIso === todayIso);
  return idx >= 0 ? idx : 0;
}

// ── Flight phase ─────────────────────────────────────────────────────────────

export type FlightPhase = 'pre' | 'window' | 'completed';

/**
 * Determines the display phase for a flight.
 * window: within 24h of departure until 2h after scheduled arrival.
 */
export function getFlightPhase(
  departureTimeStr: string,
  arrivalTimeStr: string,
  now?: Date,
): FlightPhase {
  const current = now ?? getDevNow();
  const dep = parseFlightDate(departureTimeStr);
  const arr = parseFlightDate(arrivalTimeStr);
  if (!dep || !arr) return 'pre';
  const windowStart = new Date(dep.getTime() - 24 * 60 * 60 * 1000);
  const windowEnd = new Date(arr.getTime() + 2 * 60 * 60 * 1000);
  if (current < windowStart) return 'pre';
  if (current > windowEnd) return 'completed';
  return 'window';
}

// ── Rental car phase ─────────────────────────────────────────────────────────

export type RentalPhase = 'pre' | 'active' | 'return-day' | 'returned';

export function getRentalPhase(
  pickupDateStr: string,
  dropoffDateStr: string,
  now?: Date,
): RentalPhase {
  const current = now ?? getDevNow();
  const todayIso = current.toISOString().split('T')[0];
  if (todayIso < pickupDateStr) return 'pre';
  if (todayIso > dropoffDateStr) return 'returned';
  if (todayIso === dropoffDateStr) return 'return-day';
  return 'active';
}

// ── Flight refresh interval ───────────────────────────────────────────────────

/**
 * Returns the polling interval in ms based on proximity to the flight window.
 * > 4h to departure: 60 min | 1-4h: 20 min | < 1h or in flight: 5 min
 * Returns null if > 4h after latest arrival (stop polling).
 */
export function getFlightRefreshIntervalMs(
  earliestDeparture: Date,
  latestArrival: Date,
  now?: Date,
): number | null {
  const current = now ?? getDevNow();
  if (current > new Date(latestArrival.getTime() + 4 * 60 * 60 * 1000)) return null;
  const msToDepart = earliestDeparture.getTime() - current.getTime();
  if (msToDepart > 4 * 60 * 60 * 1000) return 60 * 60 * 1000;
  if (msToDepart > 60 * 60 * 1000) return 20 * 60 * 1000;
  return 5 * 60 * 1000;
}

// ── Active stop detection ─────────────────────────────────────────────────────

/**
 * Returns the id of the active stop based on today's date.
 * Pre-trip → first stop. During trip → matching stop. Post-trip → last stop.
 */
export function getActiveStopId(stops: Stop[], now: Date): string | null {
  if (stops.length === 0) return null;
  const todayIso = now.toISOString().split('T')[0];
  const current = stops.find(s => todayIso >= s.dates.start && todayIso < s.dates.end);
  if (current) return current.id;
  if (todayIso < stops[0].dates.start) return stops[0].id;
  return stops[stops.length - 1].id;
}
