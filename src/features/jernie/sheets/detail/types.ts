// What the detail sheet is asked to show, and what it works out from that.
//
// The shell owns detents, hero, title and the footer action; everything between title and
// footer is a block from the library. This file names both halves: `DetailPayload` is what a
// screen hands in, `DetailModel` is what the blocks read. Nothing here draws.
// Reference: docs/design/Jernie Spec.dc.html, "Detail sheet".
import type { Booking, Place, PlaceEnrichment, Review, Stop } from '@/src/types';

// ── What a screen hands in ───────────────────────────────────────────────────

/** The thing the sheet is about. Two shapes, because the app stores two. */
export type DetailSubject =
  | { kind: 'place';   place: Place }
  | { kind: 'booking'; booking: Booking };

export interface DetailPayload {
  subject: DetailSubject;
  /** The stop this sits in — the Location block's second line, and the hero's context. */
  stop?: Pick<Stop, 'id' | 'city' | 'dates'>;
  /** Every place on the trip. Nearby filters to this stop and drops the subject itself. */
  places?: Place[];
  /** The Firestore enrichment map, keyed canonically. Resolves the subject's own record
   *  and Nearby's thumbnails — see `getPlaceEnrichment`. */
  enrichment?: Record<string, PlaceEnrichment>;
  /** Places only: whether it is already on a day. Decides which footer action shows. */
  isAdded?: boolean;
  onAdd?: () => void;
  onEdit?: () => void;
  /** Where "View in itinerary" goes. The sheet dismisses itself first. */
  onViewItinerary?: () => void;
}

// ── The block library ────────────────────────────────────────────────────────

/**
 * Every block that can appear between the title and the footer.
 *
 * Fifteen keys over twelve components: `tags`/`amenities` are one chip row with two
 * sources, `description`/`conditions` are one prose block, and the three row-list keys
 * share one label-value component. The keys are the exact union of the four spec layouts.
 */
export type BlockKey =
  | 'stats' | 'description' | 'tags' | 'hours' | 'location' | 'reviews'
  | 'nearby' | 'booking' | 'amenities' | 'checkin' | 'difficulty' | 'conditions'
  | 'timeline' | 'confirmation' | 'documents';

// ── What the blocks read ─────────────────────────────────────────────────────

export interface InfoRow {
  label: string;
  value: string;
  /** `mono` for anything that lines up — codes, times. `accent` for secured. */
  tone?: 'default' | 'mono' | 'accent' | 'warning';
}

export interface StatFigure {
  value: string;
  label: string;
  /** The one figure that carries status — an open restaurant, an on-time flight. */
  accent?: boolean;
}

export interface TimelineStep {
  /** Left column: a time, an airport code, a date. Mono, so the column lines up. */
  lead: string;
  title: string;
  sub?: string;
}

export interface LocationInfo {
  title: string;
  sub?: string;
  /** Passed to the Map handoff when Session 8 lands. Unused today. */
  address?: string;
}

export interface NearbyPlace {
  id: string;
  name: string;
  sub?: string;
  photo?: string;
  category?: string;
}

/** A photo hero, or a typographic one. Stay and Travel take the second — there is no
 *  booking subject on the photo seam, and a town photo says less than the route does. */
export type HeroModel =
  | { kind: 'photo'; source?: string; glyphCategory?: string }
  | { kind: 'type';  badge?: string; badgeTone?: 'accent' | 'warning' | 'neutral';
      lead: string; sub?: string };

/** The spec: "always primary and always the same shape". There is no variant, deliberately
 *  — only the label and the glyph change, so the sheet has exactly one obvious exit. */
export interface FooterAction {
  label: string;
  icon?: 'plus' | 'check' | 'pencil';
  onPress: () => void;
}

/**
 * Everything the shell and the blocks render, derived once. A block whose field is absent
 * does not render — that is how a declared-but-unsourced block stays dormant instead of
 * inventing filler.
 */
export interface DetailModel {
  blocks: readonly BlockKey[];
  hero: HeroModel;
  title: string;
  sub?: string;
  /** Plain text for the share sheet. */
  shareText: string;

  stats?: StatFigure[];
  description?: string;
  tags?: string[];
  hours?: string[];
  location?: LocationInfo;
  reviews?: Review[];
  nearby?: NearbyPlace[];
  booking?: InfoRow[];
  amenities?: string[];
  checkin?: InfoRow[];
  difficulty?: string;
  conditions?: string;
  timeline?: TimelineStep[];
  confirmation?: InfoRow[];
  documents?: InfoRow[];

  footer?: FooterAction;
}
