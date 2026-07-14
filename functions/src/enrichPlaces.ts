// The deployed callable entrypoint. Wires together the Foursquare adapter (Task 2),
// merge logic (Task 3), and the secrets/repository pieces (Task 1) into a single
// `onCall` function the client invokes with a batch of places it has already determined
// are cache-misses (Task 7's hook filters to missing canonical keys before calling — see
// Global Constraint below re: why this function does not redundantly re-check Firestore
// existence before calling the provider).
//
// Per-place error isolation: one place failing to enrich (network error, timeout,
// non-2xx from Foursquare) must never take down the rest of the batch. Every place's
// provider call is routed through `Promise.allSettled`, and only `rejected` settlements
// are excluded from writes/response — see `providers/types.ts`'s ProviderAdapter
// contract for why a `null` match ("looked, found nothing") is handled completely
// differently from a rejection ("couldn't look at all").

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FOURSQUARE_API_KEY } from './secrets';
import { fetchFoursquareMatch } from './providers/foursquare';
import { getEnrichment, writeEnrichment } from './repository';
import { mergeEnrichment } from './merge';
import type { PlaceEnrichment } from './types';

// Global Constraint #10 (chunk-size alignment): the client (Task 7) chunks a trip's
// cache-miss list into batches no larger than this before ever calling `enrichPlaces` —
// this cap is the server-side half of that agreement, a backstop against a misbehaving
// or future client, not the primary size control. An oversized batch is rejected
// outright (HttpsError) rather than silently truncated: truncating would silently drop
// places the caller believes it just asked us to enrich, with no signal that anything
// was skipped, whereas rejecting surfaces a client-side bug immediately.
const MAX_BATCH_SIZE = 30;

// Small fixed concurrency cap on outbound Foursquare calls per invocation. No
// configurability, no backoff/retry — both explicitly out of scope for v1 (roadmap).
const CONCURRENCY = 4;

interface EnrichPlaceRequest {
  canonicalKey: string;
  name: string;
  lat: number;
  lon: number;
  fsq_id?: string;
}

interface EnrichPlacesResponse {
  results: Record<string, PlaceEnrichment>;
}

type LogOutcome = 'matched' | 'not_found' | 'error';

function logOutcome(canonicalKey: string, outcome: LogOutcome, durationMs: number): void {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ canonicalKey, outcome, durationMs }));
}

function validatePlaces(data: unknown): EnrichPlaceRequest[] {
  if (!Array.isArray(data)) {
    throw new HttpsError('invalid-argument', 'request.data must be an array of places.');
  }
  if (data.length > MAX_BATCH_SIZE) {
    throw new HttpsError(
      'invalid-argument',
      `Batch of ${data.length} places exceeds the ${MAX_BATCH_SIZE}-entry cap.`
    );
  }
  return data as EnrichPlaceRequest[];
}

export const enrichPlaces = onCall(
  { secrets: [FOURSQUARE_API_KEY], timeoutSeconds: 60 },
  async (request): Promise<EnrichPlacesResponse> => {
    const places = validatePlaces(request.data);
    const results: Record<string, PlaceEnrichment> = {};

    // Manual concurrency-limited batching loop (no new dependency): slice the input
    // into fixed-size chunks of at most CONCURRENCY places and run each chunk's
    // provider calls through a real `Promise.allSettled` before moving to the next
    // chunk. This is deliberately simple — a worker-pool/queue would keep all
    // CONCURRENCY slots saturated more tightly, but that complexity isn't warranted
    // for a batch capped at 30 places.
    for (let batchStart = 0; batchStart < places.length; batchStart += CONCURRENCY) {
      const batch = places.slice(batchStart, batchStart + CONCURRENCY);
      const startedAt = batch.map(() => Date.now());

      const settlements = await Promise.allSettled(batch.map((place) => fetchFoursquareMatch(place)));

      // Firestore read/merge/write per settled place also runs concurrently within the
      // batch (bounded by the same CONCURRENCY-sized slice) so one place's Firestore
      // round-trip doesn't inflate another's logged durationMs.
      await Promise.all(
        settlements.map(async (settlement, i) => {
          const place = batch[i];
          const durationMs = () => Date.now() - startedAt[i];

          if (settlement.status === 'rejected') {
            // Per Global Constraint #3/#5: a rejection means the provider couldn't be
            // consulted at all (network/timeout/non-2xx) — never call mergeEnrichment
            // or writeEnrichment for it, and never include it in the response, so the
            // client's next-session read finds it still missing and retries.
            logOutcome(place.canonicalKey, 'error', durationMs());
            return;
          }

          const match = settlement.value;
          const existing = await getEnrichment(place.canonicalKey);
          const merged = mergeEnrichment(existing, match, place);
          await writeEnrichment(place.canonicalKey, merged);

          logOutcome(place.canonicalKey, match ? 'matched' : 'not_found', durationMs());
          results[place.canonicalKey] = merged;
        })
      );
    }

    return { results };
  }
);
