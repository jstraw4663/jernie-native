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
import { ENFORCE_APP_CHECK } from './appCheck';
import { fetchFoursquareMatch } from './providers/foursquare';
import { getEnrichment, writeEnrichment } from './repository';
import { mergeEnrichment } from './merge';
import { chargeQuota } from './quota';
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

// Which step an 'error' outcome failed at — the provider call (network/timeout/non-2xx
// from Foursquare) and the Firestore get/merge/write step fail for entirely different
// reasons and need different remediation, so the log line must say which one it was.
type ErrorStage = 'provider' | 'write';

function logOutcome(
  canonicalKey: string,
  outcome: LogOutcome,
  durationMs: number,
  errorDetail?: { stage: ErrorStage; error: string }
): void {
  const line = JSON.stringify({ canonicalKey, outcome, durationMs, ...errorDetail });
  // 'error' outcomes go to console.error (so they surface at the correct severity in
  // Cloud Logging) — everything else is routine, expected activity and goes to
  // console.log.
  // eslint-disable-next-line no-console
  if (outcome === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
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
  // CONCURRENCY (4) chunks over up to MAX_BATCH_SIZE (30) places, each provider call
  // capped at REQUEST_TIMEOUT_MS (8s): worst case ceil(30/4) * 8s = 64s, which left
  // zero margin against the previous 60s timeout. 120s gives real headroom.
  {
    secrets: [FOURSQUARE_API_KEY],
    enforceAppCheck: ENFORCE_APP_CHECK,
    timeoutSeconds: 120,
  },
  async (request): Promise<EnrichPlacesResponse> => {
    // This triggers real, paid Foursquare API calls and writes client-supplied data
    // verbatim into a globally-shared, globally-readable Firestore collection — must
    // match the firestore.rules read requirement of `request.auth != null`.
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required.');
    }

    const places = validatePlaces(request.data);

    // ONE UNIT PER PLACE, not one per invocation. This callable makes a separate billed
    // Foursquare call for every entry in the batch, so metering invocations would
    // under-count by up to MAX_BATCH_SIZE and leave the most expensive path here
    // effectively unmetered. Charged once, up front, for the whole batch — after
    // validatePlaces, so a caller's oversized batch is rejected rather than billed.
    await chargeQuota(request.auth.uid, 'enrichPlaces', places.length);

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
            logOutcome(place.canonicalKey, 'error', durationMs(), {
              stage: 'provider',
              error: errorMessage(settlement.reason),
            });
            return;
          }

          const match = settlement.value;

          // Isolated per-place: a Firestore failure (get or write) for one place must
          // never take down the rest of the batch — this whole step lives inside its
          // own try/catch (rather than switching to Promise.allSettled, which was the
          // provider-call step's approach) so the OTHER places already mapped into this
          // same Promise.all still resolve and land in `results` normally.
          try {
            const existing = await getEnrichment(place.canonicalKey);
            const merged = mergeEnrichment(existing, match, place);
            await writeEnrichment(place.canonicalKey, merged);

            logOutcome(place.canonicalKey, match ? 'matched' : 'not_found', durationMs());
            results[place.canonicalKey] = merged;
          } catch (err) {
            logOutcome(place.canonicalKey, 'error', durationMs(), {
              stage: 'write',
              error: errorMessage(err),
            });
          }
        })
      );
    }

    return { results };
  }
);
