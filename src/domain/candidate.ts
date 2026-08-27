// The add-flow candidate envelope — what `resolveQuery` returns and what the add sheet
// renders. Pure: no network, no Firebase, no React. See
// docs/superpowers/specs (add-flow data layer) for the design this implements.
//
// The organising idea is that confidence is a property of each FIELD, not of the result.
// The design's rule — "every parsed field needs a confidence flag: it decides mono versus
// grey, and which single question the sheet asks" — is why `ResolvedField` carries its own
// `confidence` rather than the candidate carrying one score for the whole card.
//
// `NewBooking` is imported as a TYPE ONLY. src/lib/bookingWrites.ts pulls in
// src/lib/firebase, and this module must stay free of runtime dependencies so it can be
// tested (and reasoned about) without a Firebase environment. `import type` is erased at
// compile time, so no runtime edge is created.

import type { NewBooking } from '@/src/lib/bookingWrites';
import type { NewPlace } from '@/src/lib/placeWrites';
import type { ItineraryItemCategory } from '@/src/types';
import { addDaysISO } from '@/src/utils/dates';

// ── Fields ───────────────────────────────────────────────────────────────────

/**
 * How a field's value came to be, which is exactly what decides its treatment on the card:
 *  - `pulled`   a provider said so                → mono
 *  - `inferred` we computed or assumed it         → grey
 *  - `wanted`   belongs here, we don't have it    → amber, and NEVER blocks Add
 *  - `absent`   the provider says it isn't there  → "Not in the schedule"
 *
 * `absent` is deliberately distinct from `wanted`: "this flight has no seat assignment" is
 * an answer, whereas "we'd like a confirmation code and don't have one" is an invitation.
 * Rendering them the same way would turn every answered question back into a prompt.
 */
export type FieldConfidence = 'pulled' | 'inferred' | 'wanted' | 'absent';

export type FieldSource = 'foursquare' | 'enrichment' | 'mapbox' | 'local' | 'user';

export interface ResolvedField {
  key: string;
  /** Display label — "Departs", "Party", "Permit". */
  label: string;
  /** Null whenever confidence is `wanted` or `absent`; the card renders the state, not a value. */
  value: string | null;
  confidence: FieldConfidence;
  source?: FieldSource;
  /**
   * What the card shows in place of a value: the amber CTA for a `wanted` field
   * ("Add code"), or the grey statement for an `absent` one ("Optional", "Not in the
   * schedule", "None yet"). Unset whenever `value` is present.
   */
  placeholder?: string;
}

// ── Commit payload ───────────────────────────────────────────────────────────

/**
 * An itinerary item before it has an id or an order — both are assigned at write time,
 * where the day's existing items are known. `stopId` + `dateIso` together address the day
 * the item lands on (`trips/{tripId}/itinerary/{stopId}/{dayId}`), resolved against the
 * trip's real day rows by the writer.
 */
export interface NewItineraryItem {
  stopId: string;
  /** YYYY-MM-DD. */
  dateIso: string;
  label?: string;
  time?: string;
  category?: ItineraryItemCategory;
  notes?: string;
}

/**
 * What actually gets written when this candidate is committed. Carrying the write
 * alongside the rendering is what lets ONE card component serve all five types and one
 * batch commit write a mixed tray — the sheet never translates a card back into schema.
 *
 * `custom` is the "Nothing found" path: no booking, no place, just the user's own words on
 * a day. It is a first-class outcome, not an error state.
 */
export type CommitPayload =
  | { target: 'booking'; booking: NewBooking; item: NewItineraryItem }
  | { target: 'place'; place: NewPlace; item: NewItineraryItem }
  | { target: 'custom'; item: NewItineraryItem };

// ── Candidate ────────────────────────────────────────────────────────────────

export type CandidateType = 'flight' | 'stay' | 'eat' | 'do' | 'drive';

/**
 * How the type was arrived at:
 *  - `explicit` the user tapped a type in the row
 *  - `guessed`  we inferred it — renders "Looks like an activity, so we picked Do"
 *  - `fallback` nothing matched; the type is a best guess over the raw query
 */
export type TypeConfidence = 'explicit' | 'guessed' | 'fallback';

/** The single thing the sheet cannot infer, asked as taps rather than a form. */
export interface OpenQuestion {
  /** "It flies daily. Which day are you on it?" */
  prompt: string;
  /** Which `ResolvedField.key` the answer fills. */
  fillsKey: string;
  options: { label: string; sublabel?: string; value: string }[];
  /** The "Another date" escape hatch — never a bare calendar as the primary affordance. */
  picker: 'date' | 'time' | null;
}

export interface Candidate {
  /**
   * Client-generated (see src/utils/id.ts) and tray-local: it identifies the candidate
   * while it sits in the tray and is never written to RTDB — the records a commit creates
   * get their own ids.
   *
   * It IS persisted, to MMKV, because the tray is (src/lib/addTray.ts). That is what lets
   * "remove this one" still mean something after the app has been killed and reopened.
   * It is not stable across rebuilds of the same place: src/lib/resolveCache.ts caches the
   * provider response rather than built candidates for exactly that reason.
   */
  id: string;
  type: CandidateType;
  typeConfidence: TypeConfidence;
  identity: { name: string; subtitle: string; icon: string };
  /** The field table: four rows, declared per type. */
  fields: ResolvedField[];
  /** The one consequence of adding this — stop match, base change, drive time, daylight. */
  footer?: { text: string; tone: 'neutral' | 'warn' };
  question?: OpenQuestion;
  commit: CommitPayload;
  lat?: number;
  lon?: number;
  fsq_id?: string;
}

// ── The commit gate ──────────────────────────────────────────────────────────

/**
 * The design's rule: "Add turns on when title, type, day and stop are all true. Amber
 * fields never gate it."
 *
 * Reads `commit` and never `fields` — that separation is the whole point of the split. An
 * amber `wanted` field (a missing confirmation code) and an `absent` one (a flight with no
 * seat assignment) are both, by construction, incapable of blocking the button.
 *
 * `type` is not checked at runtime: `CandidateType` is a closed union, so a candidate that
 * type-checks always has one. Checking it here would be dead code.
 */
export function canCommit(candidate: Candidate): boolean {
  const { item } = candidate.commit;
  return (
    item.stopId.trim().length > 0 &&
    item.dateIso.trim().length > 0 &&
    (item.label ?? '').trim().length > 0
  );
}

// ── Field tables ─────────────────────────────────────────────────────────────

/**
 * How a row behaves when nothing supplied a value:
 *  - `wanted` amber CTA — we want this and the user can give it ("Add code")
 *  - `absent` grey statement — there is nothing to give, or it is genuinely optional
 *  - `omit`   the row disappears entirely
 *
 * `omit` exists for one case: Foursquare bills `hours` at Premium tier, so the search
 * path never requests it and the Eat card only shows Hours when `place_enrichment`
 * already happens to hold them. An empty Hours row would read as a prompt for something
 * the user cannot supply, so the row is dropped instead.
 */
export interface FieldSpec {
  key: string;
  label: string;
  missing: 'wanted' | 'absent' | 'omit';
  placeholder?: string;
}

/** A value the resolver managed to find, before it becomes a `ResolvedField`. */
export interface FieldInput {
  value: string;
  source: FieldSource;
  /** True when we worked it out rather than being told it — renders grey, not mono. */
  inferred?: boolean;
}

/**
 * The design's §02 anatomy table: "Four rows, declared per type." Exactly one contextual
 * row per type is `wanted` — the confirmation/reservation code — which is what keeps the
 * card to "one amber ask" no matter which type it is showing.
 */
export const FIELD_TABLES: Record<CandidateType, readonly FieldSpec[]> = {
  flight: [
    { key: 'departs',      label: 'Departs',      missing: 'absent', placeholder: 'Not in the schedule' },
    { key: 'arrives',      label: 'Arrives',      missing: 'absent', placeholder: 'Not in the schedule' },
    { key: 'seat',         label: 'Seat',         missing: 'absent', placeholder: 'Not in the schedule' },
    { key: 'confirmation', label: 'Confirmation', missing: 'wanted', placeholder: 'Add code' },
  ],
  stay: [
    { key: 'checkIn',      label: 'Check in',     missing: 'absent', placeholder: 'Optional' },
    { key: 'checkOut',     label: 'Check out',    missing: 'absent', placeholder: 'Optional' },
    { key: 'nights',       label: 'Nights',       missing: 'absent', placeholder: 'Optional' },
    { key: 'confirmation', label: 'Confirmation', missing: 'wanted', placeholder: 'Add code' },
  ],
  eat: [
    { key: 'time',        label: 'Time',        missing: 'absent', placeholder: 'Optional' },
    { key: 'party',       label: 'Party',       missing: 'absent', placeholder: 'Optional' },
    { key: 'hours',       label: 'Hours',       missing: 'omit' },
    { key: 'reservation', label: 'Reservation', missing: 'wanted', placeholder: 'Add code' },
  ],
  do: [
    { key: 'starts',   label: 'Starts',   missing: 'absent', placeholder: 'Optional' },
    { key: 'duration', label: 'Duration', missing: 'absent', placeholder: 'Optional' },
    { key: 'permit',   label: 'Permit',   missing: 'absent', placeholder: 'Optional' },
    { key: 'meetAt',   label: 'Meet at',  missing: 'absent', placeholder: 'Optional' },
  ],
  drive: [
    { key: 'leaves',        label: 'Leaves',           missing: 'absent', placeholder: 'Optional' },
    { key: 'arrives',       label: 'Arrives',          missing: 'absent', placeholder: 'Optional' },
    { key: 'stopsOnTheWay', label: 'Stops on the way', missing: 'absent', placeholder: 'None yet' },
    { key: 'driver',        label: 'Driver',           missing: 'absent', placeholder: 'Optional' },
  ],
};

/**
 * Builds one type's field table from whatever the resolver managed to find. Every row is
 * declared up front, so a card's shape is a property of its type rather than of how much
 * the lookup happened to return — which is what stops a sparse result from collapsing into
 * a different-looking card.
 */
export function buildFieldTable(
  type: CandidateType,
  values: Partial<Record<string, FieldInput>>,
): ResolvedField[] {
  const table: ResolvedField[] = [];

  for (const spec of FIELD_TABLES[type]) {
    const supplied = values[spec.key];

    if (supplied) {
      table.push({
        key: spec.key,
        label: spec.label,
        value: supplied.value,
        confidence: supplied.inferred ? 'inferred' : 'pulled',
        source: supplied.source,
      });
      continue;
    }

    if (spec.missing === 'omit') continue;

    table.push({
      key: spec.key,
      label: spec.label,
      value: null,
      confidence: spec.missing,
      placeholder: spec.placeholder,
    });
  }

  return table;
}

// ── Building candidates ──────────────────────────────────────────────────────
//
// The one translation from provider facts into our own schema. It lives here, not in the
// `resolveQuery` callable, because `NewBooking` and `NewPlace` live in this project
// beside the writes they describe — `functions/` is a separate TypeScript project and
// cannot import across that boundary. Doing it here keeps the schema in one place and
// still hands the sheet a finished Candidate, so no per-type translation ever leaks into
// the UI.

/** What `resolveQuery` returns per result — provider facts, nothing of ours. */
export interface ProviderResult {
  name: string;
  lat: number;
  lon: number;
  address?: string;
  category?: string;
  fsq_id?: string;
}

/** Where the add is happening, carried in from whichever entry point opened the sheet. */
export interface CandidateContext {
  stopId: string;
  /** YYYY-MM-DD — the day the sheet is adding to. */
  dayIso: string;
  /** uid of whoever is adding, for `Place.addedBy`. */
  addedBy: string;
}

// PlaceCategory has no lodging member, so a stay's itinerary item is 'other'. It is the
// booking that carries the real meaning; the item is only how the day renders it.
const ITEM_CATEGORY: Record<CandidateType, ItineraryItemCategory> = {
  eat: 'restaurant',
  stay: 'other',
  do: 'activity',
  flight: 'flight',
  drive: 'transport',
};

const ICON: Record<CandidateType, string> = {
  eat: 'fork-knife',
  stay: 'bed',
  do: 'compass',
  flight: 'airplane-takeoff',
  drive: 'car',
};

/** "Seafood Restaurant · 9 Thurston Rd, Bernard, ME" — one line of source truth. */
function buildSubtitle(result: ProviderResult | null): string {
  if (!result) return 'No match';
  return [result.category, result.address].filter(Boolean).join(' · ');
}

function buildFields(
  type: CandidateType,
  context: CandidateContext,
  enrichmentHours: string | undefined,
): ResolvedField[] {
  const values: Partial<Record<string, FieldInput>> = {};

  // Hours are opportunistic by design: the Foursquare search path requests Pro fields
  // only, so these can come from an already-cached place_enrichment record or not at all.
  if (type === 'eat' && enrichmentHours) {
    values.hours = { value: enrichmentHours, source: 'enrichment' };
  }

  // A stay's dates are assumptions off the day being added to, not facts from a booking
  // link — so they read grey, and the user can overrule them without arguing with
  // something that looks authoritative.
  if (type === 'stay') {
    values.checkIn = { value: context.dayIso, source: 'local', inferred: true };
    values.checkOut = { value: addDaysISO(context.dayIso, 1), source: 'local', inferred: true };
    values.nights = { value: '1', source: 'local', inferred: true };
  }

  return buildFieldTable(type, values);
}

function buildCommit(
  type: CandidateType,
  result: ProviderResult | null,
  context: CandidateContext,
  query: string,
): CommitPayload {
  const label = result?.name ?? query;

  const item: NewItineraryItem = {
    stopId: context.stopId,
    dateIso: context.dayIso,
    label,
    category: ITEM_CATEGORY[type],
  };

  // No provider result means the "Nothing found" card: the user's own words on a day.
  // This is also the v1 path for flight and drive, which have no provider at all — they
  // still carry their own type, so the right field table shows for manual entry.
  if (!result) return { target: 'custom', item };

  if (type === 'eat') {
    return {
      target: 'booking',
      booking: {
        stopId: context.stopId,
        type: 'restaurant',
        restaurantName: label,
        date: context.dayIso,
      },
      item,
    };
  }

  if (type === 'stay') {
    return {
      target: 'booking',
      booking: {
        stopId: context.stopId,
        type: 'hotel',
        hotelName: label,
        checkIn: context.dayIso,
        checkOut: addDaysISO(context.dayIso, 1),
        address: result.address,
      },
      item,
    };
  }

  if (type === 'do') {
    return {
      target: 'place',
      place: {
        stopId: context.stopId,
        name: label,
        category: 'activity',
        must: false,
        source: 'community',
        addedBy: context.addedBy,
        lat: result.lat,
        lon: result.lon,
        fsq_id: result.fsq_id,
      },
      item,
    };
  }

  return { target: 'custom', item };
}

/**
 * Assembles one finished Candidate from a resolved result.
 *
 * `generateId` is injected rather than imported so this stays pure and its output is
 * predictable under test — the same reason `buildCustomItineraryItem` and
 * `syncItineraryDaysForRange` take one.
 */
export function buildCandidate(input: {
  result: ProviderResult | null;
  type: CandidateType;
  typeConfidence: TypeConfidence;
  context: CandidateContext;
  query: string;
  generateId: () => string;
  /** From an already-cached place_enrichment record, when there is one. */
  enrichmentHours?: string;
}): Candidate {
  const { result, type, typeConfidence, context, query, generateId, enrichmentHours } = input;

  return {
    id: generateId(),
    type,
    typeConfidence,
    identity: {
      name: result?.name ?? query,
      subtitle: buildSubtitle(result),
      icon: ICON[type],
    },
    fields: buildFields(type, context, enrichmentHours),
    commit: buildCommit(type, result, context, query),
    ...(result ? { lat: result.lat, lon: result.lon } : {}),
    ...(result?.fsq_id ? { fsq_id: result.fsq_id } : {}),
  };
}
