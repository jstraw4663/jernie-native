// Agenda's derived copy, in one place so the screen renders strings rather than computes them.
//
// Every line here is *derived*. Where the canvas sets an editorial line no field can produce
// — "2 dinners open", "3 need tickets" — the derivable half ships and the rest is omitted
// rather than invented, the same call Session 4 made on the day-group title.
//
// Voice: second person, present tense, sentence case; numbers do the arguing. Section
// headers are phrases, not nouns — *Where you're eating*, never *Dining*.
import type { Icon } from 'phosphor-react-native';
import { AirplaneTiltIcon } from 'phosphor-react-native/src/icons/AirplaneTilt';
import { BuildingsIcon } from 'phosphor-react-native/src/icons/Buildings';
import { ForkKnifeIcon } from 'phosphor-react-native/src/icons/ForkKnife';
import { PersonSimpleHikeIcon } from 'phosphor-react-native/src/icons/PersonSimpleHike';
import type { AgendaEntry } from '@/src/domain/agenda';
import type { TripCoverage } from '@/src/domain/gaps';
import type { ItemRole } from '@/src/domain/taxonomy';
import { formatDateRange } from '@/src/utils/dates';

export const GROUP_TITLE: Record<ItemRole, string> = {
  move:  'Getting around',
  sleep: "Where you're staying",
  eat:   "Where you're eating",
  do:    "What you're doing",
};

// The group's glyph, not the category's. A section of stays is `Buildings`; one hotel in it
// is `Bed`. Both come from the canvas.
export const GROUP_GLYPH: Record<ItemRole, Icon> = {
  move:  AirplaneTiltIcon,
  sleep: BuildingsIcon,
  eat:   ForkKnifeIcon,
  do:    PersonSimpleHikeIcon,
};

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function counts(entries: AgendaEntry[]): string {
  const booked = entries.filter(e => e.booked).length;
  const planned = entries.length - booked;
  if (booked && planned) return `${booked} booked · ${planned} planned`;
  if (booked) return plural(booked, 'booking', 'bookings');
  if (planned) return `${planned} planned`;
  return 'Nothing planned yet';
}

/**
 * A group's subline. The two gap-generating roles report coverage; the two preference roles
 * report counts, because a preference cannot be short of anything.
 */
export function groupSub(role: ItemRole, entries: AgendaEntry[], coverage: TripCoverage): string {
  const stops = coverage.stops.length;
  if (stops === 0) return counts(entries);

  if (role === 'sleep') {
    // The canvas's line exactly, and the one the settled date semantics made computable.
    return `${coverage.stopsWithStay} of ${stops} stops covered · ${coverage.nightsCovered} of ${coverage.nights} nights`;
  }

  if (role === 'move') {
    const gaps = coverage.gaps.filter(g => g.kind === 'transport').length;
    const covered = `${coverage.stopsWithTransport} of ${stops} stops covered`;
    return gaps > 0 ? `${plural(gaps, 'gap', 'gaps')} · ${covered}` : covered;
  }

  return counts(entries);
}

export interface AgendaSubInput {
  tripName: string;
  stops: { dates: { start: string; end: string } }[];
  todayIso: string;
  gapCount: number;
}

function daysBetween(from: string, to: string): number {
  const [ay, am, ad] = from.split('-').map(Number);
  const [by, bm, bd] = to.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/**
 * The line under "Agenda". Says where the trip is in time, and — while you are on it — how
 * much is still unbooked, which is the question this screen exists to answer.
 */
export function agendaSub({ tripName, stops, todayIso, gapCount }: AgendaSubInput): string {
  if (stops.length === 0) return 'Nothing planned yet';

  const start = stops[0].dates.start;
  const end = stops[stops.length - 1].dates.end;
  const range = formatDateRange(start, end);
  const count = plural(stops.length, 'stop', 'stops');

  if (todayIso < start) return `${tripName} · ${range} · ${count}`;
  if (todayIso > end) return `Trip complete · ${range}`;

  const day = daysBetween(start, todayIso) + 1;
  const total = daysBetween(start, end) + 1;
  const outstanding = gapCount === 0
    ? 'everything booked'
    : gapCount === 1 ? '1 thing needs booking' : `${gapCount} things need booking`;
  return `Day ${day} of ${total} · ${outstanding}`;
}

/** The coverage grid's own caption. It only renders when this is non-zero. */
export function gapCaption(gapCount: number): string {
  return plural(gapCount, 'gap', 'gaps');
}
