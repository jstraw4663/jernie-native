const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/**
 * Formats a date range as "Jul 10 – 12" (same month) or "Jun 29 – Jul 2" (cross-month).
 * Uses T12:00:00 to avoid timezone-induced date shifts.
 *
 * The same-month form gained its spaces in Session 5: the design writes the range spaced in
 * both places it appears in prose ("May 27 – 29 · 2 nights unbooked", in `GapRow.d.ts` and
 * in `reference/voice.md`), and one formatter for the whole app beats a second one that
 * differs by two characters.
 */
export function formatDateRange(start: string, end: string): string {
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  if (s.getMonth() === e.getMonth()) {
    return `${MONTHS[s.getMonth()]} ${s.getDate()} – ${e.getDate()}`;
  }
  return `${MONTHS[s.getMonth()]} ${s.getDate()} – ${MONTHS[e.getMonth()]} ${e.getDate()}`;
}

const WEEKDAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

/**
 * Formats a single ISO date as "Fri, Jul 10". Same T12:00:00 guard as formatDateRange —
 * parsing a bare YYYY-MM-DD yields UTC midnight, which reads as the previous day west of it.
 */
export function formatDayLabel(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}
