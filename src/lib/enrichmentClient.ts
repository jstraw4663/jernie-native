import functions from '@react-native-firebase/functions';
import type { PlaceEnrichment } from '@/src/types';

/**
 * A cache-miss place the caller wants live-enriched, matching the deployed
 * `enrichPlaces` callable's request shape (functions/src/enrichPlaces.ts). `fsq_id`
 * is optional — most places have never been matched to a Foursquare venue yet.
 */
export interface MissingPlace {
  canonicalKey: string;
  name: string;
  lat: number;
  lon: number;
  fsq_id?: string;
}

interface EnrichPlacesResponse {
  results: Record<string, PlaceEnrichment>;
}

/**
 * Invokes the deployed `enrichPlaces` Cloud Functions v2 callable with a batch of
 * cache-miss places (already filtered and chunked by the caller — see Task 7's hook
 * and the callable's own MAX_BATCH_SIZE backstop) and returns the resulting map of
 * canonical key -> merged enrichment. Does not catch errors: a rejected callable
 * (network failure, HttpsError from the backend) propagates to the caller, which
 * decides how to handle a failed enrichment attempt (e.g. leaving those places
 * missing for a later retry).
 */
export async function enrichPlaces(missingPlaces: MissingPlace[]): Promise<Record<string, PlaceEnrichment>> {
  const callable = functions().httpsCallable<MissingPlace[], EnrichPlacesResponse>('enrichPlaces');
  const response = await callable(missingPlaces);
  return response.data.results;
}
