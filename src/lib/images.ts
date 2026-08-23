// The photo seam.
//
// **Screens never hard-code an image URL, and never reach into a provider.** They name the
// *subject* — this place, this stop, this trip — and get back a URL or nothing. Session 11
// picks the provider and fills in the cases that return undefined today; no screen changes
// when it does, which is the whole reason this exists before the screens do.
//
// **Resolved URLs are derived, never stored.** Nothing here writes to RTDB. That follows
// what `src/domain/placeEnrichment.ts` already does for places — the Foursquare cache lives
// in Firestore, keyed canonically, and the RTDB record stays clean. Denormalising a resolved
// URL onto the record would buy one hop and cost a write path, a staleness problem when the
// provider rotates its URLs, and — for trips — a rule violation, since `trips/{tripId}` is
// create-once and immutable at the top level.

import { resolvePlacePhoto } from '@/src/domain/placeEnrichment';
import type { Place, PlaceEnrichment, Stop, Trip } from '@/src/types';

/** What a screen has on hand when it asks. `enrichment` is the map from
 *  `useFirestoreEnrichment`, keyed by canonical place key. */
export interface PhotoContext {
  enrichment: Record<string, PlaceEnrichment>;
}

/** The thing a photo is *of*. Adding a kind here is how a new surface joins the seam. */
export type PhotoSubject =
  | { kind: 'place'; place: Pick<Place, 'name' | 'lat' | 'lon' | 'photoUrl'> }
  | { kind: 'stop';  stop:  Pick<Stop, 'id'>; places: Place[] }
  | { kind: 'trip';  trip:  Pick<Trip, 'id' | 'name'> };

/**
 * A subject's display photo, or undefined when there is none — in which case the caller
 * renders `ImagePlaceholder` rather than an empty box. Never throws, never fetches: this is
 * a pure lookup over what the caller already has.
 *
 * Coverage today:
 * - `place` — real. Curated `photoUrl` first, then the first Foursquare photo from the
 *   Firestore enrichment cache.
 * - `stop` — **a stop looks like the places in it.** The first place at that stop which
 *   resolves a photo wins, in the order the caller supplies. Not a placeholder for a real
 *   implementation: this is probably the right permanent answer, since a destination photo
 *   that is actually somewhere the traveller is going beats a stock city shot. Coverage is
 *   whatever Foursquare matched — a stop whose places are all unenriched still resolves to
 *   undefined and renders `ImagePlaceholder`, which is a designed state, not a defect.
 * - `trip` — always undefined. A trip has no photo field and no provider. Session 11
 *   decides where a photo comes from when a *user* creates a trip (`docs/imagery.md`).
 */
export function resolvePhoto(subject: PhotoSubject, ctx: PhotoContext): string | undefined {
  switch (subject.kind) {
    case 'place':
      return resolvePlacePhoto(subject.place, ctx.enrichment);
    case 'stop': {
      for (const place of subject.places) {
        if (place.stopId !== subject.stop.id) continue;
        const hit = resolvePlacePhoto(place, ctx.enrichment);
        if (hit) return hit;
      }
      return undefined;
    }
    case 'trip':
      return undefined;
  }
}
