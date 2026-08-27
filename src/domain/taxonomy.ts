// The role layer — the top of the three-level taxonomy, derived and never stored.
//
//   Subtype   open string        icon and default label     src/design/icons.ts
//   Category  closed set of 10   colour                     TypeColors
//   Role      closed set of 4    Agenda group, gap rule     here
//
// The four roles are not invented. `components/travel/GapRow.prompt.md` says "only stays and
// transport generate gaps; eating and doing are preferences and only ever count" — that
// sentence *is* sleep / move / eat / do, written as a rule about behaviour. This file only
// names it.
//
// **Nothing here changes what is stored.** No migration, no schema edit, no rules change:
// the five category sets that grew up in this codebase (`PlaceCategory`,
// `ItineraryItemCategory`, `TypeColors`, Explore's `FilterId`, `CustomItemSheet`'s picker)
// stop competing by becoming *inputs* to `normalizeCategory`. `food` and `restaurant` are
// both absorbed rather than one winning.
//
// `ItemCategory` is imported as a type only, so this module pulls none of `icons.ts`'s ~45
// Phosphor modules into the domain layer or its tests. The closed set is enforced at compile
// time instead, by `ROLE_OF_CATEGORY` being a total `Record` over it.
import type { ItemCategory } from '@/src/design/icons';
import type { Booking } from '@/src/types';

export type ItemRole = 'move' | 'sleep' | 'eat' | 'do';

/** Total over the closed set — adding a category without giving it a role will not compile. */
export const ROLE_OF_CATEGORY: Record<ItemCategory, ItemRole> = {
  flight:   'move',
  transit:  'move',
  car:      'move',

  stay:     'sleep',

  food:     'eat',
  bars:     'eat',

  hike:     'do',
  activity: 'do',
  sight:    'do',
  shopping: 'do',
};

/**
 * The two roles that can be *missing*. You can lack a bed and you can lack a way to get
 * around; you cannot lack a dinner reservation — that is a preference, and `src/domain/gaps.ts`
 * only ever counts it.
 */
export const GAP_ROLES: readonly ItemRole[] = ['sleep', 'move'];

export function generatesGaps(role: ItemRole): boolean {
  return GAP_ROLES.includes(role);
}

/**
 * A category's role. An unknown or absent category is `do` — the role that generates no
 * gaps, so hand-entered and pre-taxonomy data degrades into "something you are doing"
 * rather than into a false alarm.
 */
export function roleOf(category?: ItemCategory | null): ItemRole {
  if (!category) return 'do';
  return ROLE_OF_CATEGORY[category] ?? 'do';
}

// Legacy spellings → the canonical ten. `null` means "no category", which is a real answer:
// `other` and `custom` carry no information and must not be coerced into one.
//
// Keys are normalised the same way `iconFor` normalises, so "Restaurant" and "restaurant"
// both hit.
const CATEGORY_ALIASES: Record<string, ItemCategory | null> = {
  // PlaceCategory / ItineraryItemCategory
  restaurant: 'food',
  bar:        'bars',
  transport:  'car',
  other:      null,
  custom:     null,
  // Explore's FilterId
  sights:     'sight',
  all:        null,
};

const normalise = (v: string) => v.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Any of the app's category spellings → the canonical ten, or `null` when the value carries
 * no category at all. Never throws: an unrecognised string is `null`, not an error.
 */
export function normalizeCategory(value?: string | null): ItemCategory | null {
  if (!value) return null;
  const key = normalise(value);
  if (key in ROLE_OF_CATEGORY) return key as ItemCategory;
  if (key in CATEGORY_ALIASES) return CATEGORY_ALIASES[key];
  return null;
}

/**
 * The one adapter between `BookingType` and the taxonomy.
 *
 * `BookingType` stays `flight | hotel | rental | restaurant` until Session 6 renames it, so
 * everything downstream — Agenda's grouping, `gaps.ts`, colour — reads a category from here
 * and never reads `booking.type` itself. When the rename lands it touches this function and
 * nothing else. See docs/redesign-plan.md §8.
 */
export function bookingCategory(b: Pick<Booking, 'type'>): ItemCategory {
  switch (b.type) {
    case 'flight':     return 'flight';
    case 'hotel':      return 'stay';
    case 'rental':     return 'car';
    case 'restaurant': return 'food';
  }
}

/** Shorthand for the common pair — used by Agenda and `gaps.ts` on every item. */
export function roleOfBooking(b: Pick<Booking, 'type'>): ItemRole {
  return roleOf(bookingCategory(b));
}
