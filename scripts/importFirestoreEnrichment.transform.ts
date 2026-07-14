import { canonicalPlaceKey } from '@/src/domain/placeEnrichment';
import type { PlaceEnrichment } from '@/src/types';

// Real shape of a cached doc in the retired PWA's Firestore project (jernie-e36d8),
// confirmed by inspecting live documents — this differs from the migration spec's
// original aspirational schema (which assumed `address`/`ratingCount`/numeric `price`
// and a `name` field on every doc; the real data uses `addr`/`user_ratings_total`/
// string `price_level`, and mostly does NOT carry its own `name` at all — the old
// schema didn't need it, since docs were keyed by the RTDB place's own id).
export interface LegacyPlaceEnrichment {
  google_place_id?: string;
  lat: number;
  lon: number;
  phone?: string;
  website?: string;
  hours?: string[] | null;
  addr?: string;
  rating?: number | null;
  user_ratings_total?: number | null;
  price_level?: string | null;
  photos?: string[];
  reviews?: PlaceEnrichment['reviews'] | null;
  reviews_cached_at?: number;
  cached_at: number;
}

/**
 * A record is worth importing only if it has real coordinates AND a resolved Google
 * Place ID — per the decision to skip records with no stable provider ID for now
 * (they can't be meaningfully deduped across trips/providers anyway).
 */
export function isValidLegacyRecord(raw: unknown): raw is LegacyPlaceEnrichment {
  if (!raw || typeof raw !== 'object') return false;
  const r = raw as Record<string, unknown>;
  return typeof r.lat === 'number' && typeof r.lon === 'number' && typeof r.google_place_id === 'string';
}

/**
 * Maps one legacy (Google Places-sourced) cached record into the current PlaceEnrichment
 * shape. `name` is supplied by the caller (from the corresponding RTDB Place record) since
 * the legacy doc mostly doesn't carry its own. Fields the legacy doc doesn't have are
 * omitted entirely rather than set to `undefined` — unlike RTDB, the Firestore Admin SDK
 * rejects `undefined` as a document value outright.
 */
export function mapLegacyRecord(raw: LegacyPlaceEnrichment, name: string): PlaceEnrichment {
  const result: PlaceEnrichment = {
    name,
    lat: raw.lat,
    lon: raw.lon,
    address: raw.addr ?? '',
    photos: raw.photos ?? [],
    cached_at: raw.cached_at,
    place_id_locked: true,
    googlePlaceId: raw.google_place_id,
  };
  if (raw.phone != null) result.phone = raw.phone;
  if (raw.website != null) result.website = raw.website;
  if (raw.hours != null) result.hours = raw.hours;
  if (raw.rating != null) result.rating = raw.rating;
  if (raw.user_ratings_total != null) result.ratingCount = raw.user_ratings_total;
  if (raw.price_level != null) result.price = raw.price_level;
  if (raw.reviews != null) result.reviews = raw.reviews;
  if (raw.reviews_cached_at != null) result.reviews_cached_at = raw.reviews_cached_at;
  return result;
}

export interface MigrationResult {
  /** `rtdbPlaceId` is the ORIGINAL trip-scoped place id — used only to backfill lat/lon onto that RTDB record. */
  copied: Array<{ rtdbPlaceId: string; canonicalKey: string; enrichment: PlaceEnrichment }>;
  skipped: string[];
}

/**
 * Pure batch-mapping step. `rawDocsById` are the legacy Firestore docs keyed by the old
 * trip-scoped place id; `rtdbNamesById` are the corresponding current RTDB Place names,
 * keyed the same way (place ids are preserved 1:1 through the original RTDB import).
 * A legacy doc with no matching RTDB place (e.g. a hotel-booking enrichment doc, which
 * lives under a totally different id namespace) is skipped — there's no current Place to
 * attach it to or backfill coordinates onto.
 */
export function buildMigration(
  rawDocsById: Record<string, unknown>,
  rtdbNamesById: Record<string, string>,
): MigrationResult {
  const copied: MigrationResult['copied'] = [];
  const skipped: string[] = [];
  for (const [id, raw] of Object.entries(rawDocsById)) {
    const name = rtdbNamesById[id];
    if (!name || !isValidLegacyRecord(raw)) {
      skipped.push(id);
      continue;
    }
    const enrichment = mapLegacyRecord(raw, name);
    copied.push({ rtdbPlaceId: id, canonicalKey: canonicalPlaceKey(name, raw.lat, raw.lon), enrichment });
  }
  return { copied, skipped };
}
