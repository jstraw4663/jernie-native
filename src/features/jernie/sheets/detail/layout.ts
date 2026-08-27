// Which blocks a type shows, and in what order. **This table is the session's whole claim:
// adding a fifth type is a list entry, not a new screen.**
//
// Keyed by `ItemRole`, not by a fifth vocabulary. The design names its four types
// Restaurant / Stay / Activity / Travel; `src/domain/taxonomy.ts` already sorts every
// category in the app into `eat` / `sleep` / `do` / `move`, and the two sets are the same
// four things. Reusing the role means a bar and a restaurant land on the same list without
// anyone maintaining a second mapping, and it is why Agenda's group and the sheet's layout
// can never disagree.
//
// Orders are verbatim from docs/design/Jernie Spec.dc.html, "Block order by type".
import type { ItemRole } from '@/src/domain/taxonomy';
import type { BlockKey, DetailSubject } from './types';

/** The design's own name for each role's layout, for anyone diffing against the spec. */
export const TYPE_NAME: Record<ItemRole, string> = {
  eat:   'Restaurant',
  sleep: 'Stay',
  do:    'Activity',
  move:  'Travel',
};

export const BLOCK_ORDER: Record<ItemRole, readonly BlockKey[]> = {
  // Restaurant — Stats · Description · Tags · Hours · Location · Reviews · Nearby
  eat:   ['stats', 'description', 'tags', 'hours', 'location', 'reviews', 'nearby'],
  // Stay — Booking · Stats · Amenities · Description · Location · Check-in
  sleep: ['booking', 'stats', 'amenities', 'description', 'location', 'checkin'],
  // Activity — Difficulty · Stats · Description · Conditions · Location · Nearby
  do:    ['difficulty', 'stats', 'description', 'conditions', 'location', 'nearby'],
  // Travel — Booking · Timeline · Confirmation · Location · Documents
  move:  ['booking', 'timeline', 'confirmation', 'location', 'documents'],
};

/**
 * The list for a subject.
 *
 * One adjustment to the table above: a **booking** always gets a `booking` block, wherever
 * its role's list does not already open with one. A restaurant *reservation* is not a
 * restaurant — it carries a date, a party size and a code, and none of the place blocks have
 * anything to say about it. Prepending rather than editing the `eat` list keeps the canvas's
 * order intact for the case the canvas actually drew.
 */
export function blocksFor(role: ItemRole, subject: DetailSubject): readonly BlockKey[] {
  const order = BLOCK_ORDER[role];
  if (subject.kind !== 'booking' || order.includes('booking')) return order;
  return ['booking', ...order];
}
