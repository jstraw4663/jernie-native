// Duplicated from the root app's src/types.ts (PlaceEnrichment, ~line 249) plus the
// fsq_not_found flag added for this backend. `functions/` is a separate TypeScript
// project/deployment unit from the Expo app (own tsconfig, own build, deployed
// independently to Cloud Functions) — it cannot import across that boundary, so the
// minimal shape needed here is duplicated rather than reaching into `src/`. If the two
// ever drift, the root app's src/types.ts is the source of truth; keep this file in sync
// by hand. A shared package is deliberately out of scope for v1 (see task-1 report).

export interface Review {
  author: string;
  rating: number;
  text: string;
  time: number;
}

export interface PlaceEnrichment {
  // Stored at `place_enrichment/{canonicalKey}` — a flat, global collection keyed by
  // an app-owned canonical key (normalized name + rounded lat/lon), NOT by any
  // provider's proprietary ID or by trip. See the root app's
  // src/domain/placeEnrichment.ts for canonical key derivation.
  fsq_id?: string;
  googlePlaceId?: string;
  name: string;
  lat: number;
  lon: number;
  phone?: string;
  website?: string;
  hours?: string[];
  address: string;
  rating?: number;
  ratingCount?: number;
  price?: string; // dollar-sign string ("$$$"), matching Place.price's convention
  photos: string[];
  reviews?: Review[];
  reviews_cached_at?: number;
  cached_at: number;
  place_id_locked: true;
  // Set when a live Foursquare lookup ran and found no match for the place, so callers
  // can distinguish "looked and found nothing" from "never looked" without re-querying
  // the API every time.
  fsq_not_found?: boolean;
}
