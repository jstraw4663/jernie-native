// Deciding which of the five types a query is about.
//
// The client lights the type row instantly from its own local guess — that cannot wait on
// a cold start. The SERVER owns the override, which is what produces the design's
// "No match. Looks like an activity, so we picked Do — kept your words as the title."
//
// Pure: no network, no secrets, no Firebase.

import type { CandidateType, TypeConfidence } from './types';

// Checked BEFORE the eat list, because "Bed & Breakfast" contains a food word and is
// unambiguously lodging. Nothing on the eat list is plausibly a hotel, so the asymmetry
// only ever resolves in the right direction.
const STAY_WORDS = [
  'hotel', 'motel', 'resort', 'hostel', 'inn', 'lodge', 'lodging',
  'bed', 'guesthouse', 'campground', 'campsite', 'cabin',
];

const EAT_WORDS = [
  'restaurant', 'cafe', 'coffee', 'bar', 'pub', 'brewery', 'diner', 'pizzeria',
  'bakery', 'bistro', 'eatery', 'food', 'grill', 'seafood', 'lobster',
  'dinner', 'lunch', 'breakfast', 'brunch', 'steakhouse', 'taqueria', 'deli',
];

const COMBINING_DIACRITICS = /[̀-ͯ]/g;

// Lower-cased and stripped of accents so "Café" matches the plain-ascii word list, and so
// `\b` (which only treats [A-Za-z0-9_] as word characters) behaves predictably.
function normalize(text: string): string {
  return text.toLowerCase().normalize('NFKD').replace(COMBINING_DIACRITICS, '');
}

// Whole-word matching, never substring. "inn" is lodging as a word and noise as a
// substring — "Dinner", "Inner Harbor", "Winning" — so a substring test would misfile a
// large slice of Eat as Stay.
function hasWord(haystack: string, word: string): boolean {
  return new RegExp(`\\b${word}\\b`).test(haystack);
}

function classifyText(text: string | undefined): CandidateType {
  if (!text) return 'do';

  const normalized = normalize(text);

  if (STAY_WORDS.some(word => hasWord(normalized, word))) return 'stay';
  if (EAT_WORDS.some(word => hasWord(normalized, word))) return 'eat';

  // "Do" is the residual bucket by design: a trail, a lookout, a museum and a tour have
  // no shared vocabulary, so anything that is demonstrably not a meal or a bed is far
  // more likely to be an activity than to be nothing.
  return 'do';
}

/** Classifies a provider's own category label, e.g. Foursquare's "Seafood Restaurant". */
export function classifyProviderCategory(category: string | undefined): CandidateType {
  return classifyText(category);
}

// IATA carrier codes, checked so a flight number is not confused with the many other
// things shaped like two letters and a number — "ME 3" is a Maine state route, "I 95" is
// an interstate. Deliberately not exhaustive: it covers the carriers a traveller planning
// through this app is realistically flying, and an unlisted airline simply falls through
// to the ordinary word classifier, where one tap on the type row corrects it.
const CARRIER_CODES = new Set([
  'AA', 'DL', 'UA', 'WN', 'AS', 'B6', 'NK', 'F9', 'HA', 'G4', 'SY', 'MX',
  'AC', 'WS', 'TS', 'PD',
  'BA', 'VS', 'AF', 'KL', 'LH', 'LX', 'IB', 'EI', 'TP', 'SK', 'AY', 'TK', 'FR', 'U2',
  'EK', 'QR', 'EY', 'SQ', 'CX', 'JL', 'NH', 'QF', 'NZ',
  'LA', 'AM', 'CM', 'AV',
]);

const FLIGHT_NUMBER = /^([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{1,4})$/;

function looksLikeFlightNumber(query: string): boolean {
  const match = FLIGHT_NUMBER.exec(query.trim().toUpperCase());
  return match !== null && CARRIER_CODES.has(match[1]);
}

/**
 * Classifies the user's raw words, for when no provider matched anything.
 *
 * v1 has no flight schedule provider, so a flight number cannot resolve to a real card —
 * but recognising one still matters: it decides that the manual card the user lands on
 * shows the flight field table (Departs · Arrives · Seat · Confirmation) rather than a
 * generic one.
 */
export function classifyQueryText(query: string): CandidateType {
  if (looksLikeFlightNumber(query)) return 'flight';
  return classifyText(query);
}

/**
 * Settles the type and how confident the card should sound about it:
 *  - `explicit` the user tapped a type in the row; nothing overrides that
 *  - `guessed`  we read it off the top result's category
 *  - `fallback` nothing matched, so we read the user's own words
 */
export function resolveType(
  typeHint: CandidateType | null,
  topCategory: string | undefined,
  query: string,
): { resolvedType: CandidateType; typeConfidence: TypeConfidence } {
  if (typeHint) {
    return { resolvedType: typeHint, typeConfidence: 'explicit' };
  }

  if (topCategory !== undefined) {
    return { resolvedType: classifyProviderCategory(topCategory), typeConfidence: 'guessed' };
  }

  return { resolvedType: classifyQueryText(query), typeConfidence: 'fallback' };
}
