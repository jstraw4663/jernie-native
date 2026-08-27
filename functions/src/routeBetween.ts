// Drive time between two points, with a Firestore cache in front of it.
//
// WHEN THIS IS CALLED: lazily, for the one candidate the user actually taps — never for
// every row of a result list. The design puts a drive time in nearly every card footer
// ("34 min from Bluenose Inn", "1h 50m from Portland"), so resolving them eagerly would
// turn one search into N billed routing calls. This is the largest single cost lever in
// the whole add flow.
//
// WHY IT CACHES SO WELL: the drive between two fixed points is static data. Roads do not
// move, and the `driving` (non-traffic) profile returns the same answer next month. So a
// trip re-opened, or a second traveller planning the same route, costs nothing.

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { MAPBOX_ACCESS_TOKEN } from './secrets';
import { ENFORCE_APP_CHECK } from './appCheck';
import { fetchMapboxRoute } from './providers/mapbox';
import { getRoute, writeRoute, type CachedRoute } from './repository';
import { chargeQuota } from './quota';
import type { LatLon } from './providers/types';

/**
 * How long a cached route stays good.
 *
 * 30 days is a deliberately conservative placeholder. A static drive time never actually
 * expires, so the ONLY reason this is not indefinite is that Mapbox's terms on retaining
 * data derived from their APIs are unconfirmed. If retention of a derived scalar turns out
 * to be permitted, raise this to Infinity and the cache becomes permanent; nothing else
 * has to change.
 *
 * NOTE — this governs whether an entry is SERVED, not whether it is stored. Stale docs are
 * overwritten on next use but never deleted, so the collection grows without bound. Cap it
 * with a Firestore TTL policy on the field, which needs no application code:
 *
 *   gcloud firestore fields ttls update cachedAt \
 *     --collection-group=route_cache --enable-ttl
 *
 * Firestore expects a timestamp for TTL; `cachedAt` is written as epoch milliseconds, so
 * either switch it to a Timestamp or expire the collection on a schedule instead.
 */
const CACHE_RETENTION_DAYS = 30;

const RETENTION_MS = CACHE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

type RouteResponse = { found: true; minutes: number; miles: number } | { found: false };

interface ValidatedRequest {
  cacheKey: string;
  from: LatLon;
  to: LatLon;
}

function readLatLon(value: unknown, label: string): LatLon {
  const point = (value ?? {}) as { lat?: unknown; lon?: unknown };
  if (typeof point.lat !== 'number' || typeof point.lon !== 'number') {
    throw new HttpsError('invalid-argument', `request.data.${label} must carry numeric lat and lon.`);
  }
  return { lat: point.lat, lon: point.lon };
}

function validate(data: unknown): ValidatedRequest {
  const body = (data ?? {}) as { cacheKey?: unknown; from?: unknown; to?: unknown };

  if (typeof body.cacheKey !== 'string' || body.cacheKey.trim().length === 0) {
    throw new HttpsError('invalid-argument', 'request.data.cacheKey must be a non-empty string.');
  }

  return {
    cacheKey: body.cacheKey,
    from: readLatLon(body.from, 'from'),
    to: readLatLon(body.to, 'to'),
  };
}

function isFresh(cached: CachedRoute): boolean {
  return typeof cached.cachedAt === 'number' && Date.now() - cached.cachedAt < RETENTION_MS;
}

function toResponse(cached: CachedRoute): RouteResponse {
  if (cached.found && typeof cached.minutes === 'number' && typeof cached.miles === 'number') {
    return { found: true, minutes: cached.minutes, miles: cached.miles };
  }
  return { found: false };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export const routeBetween = onCall(
  { secrets: [MAPBOX_ACCESS_TOKEN], enforceAppCheck: ENFORCE_APP_CHECK },
  async (request): Promise<RouteResponse> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required.');
    }

    const { cacheKey, from, to } = validate(request.data);

    // A cache read failing is not a reason to fail the whole request — the provider is
    // still available, and a slow answer beats no answer. Worth logging, never worth
    // surfacing.
    let cached: CachedRoute | undefined;
    try {
      cached = await getRoute(cacheKey);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify({ cacheKey, outcome: 'cache_read_failed', error: errorMessage(err) }));
    }

    if (cached && isFresh(cached)) {
      return toResponse(cached);
    }

    // Metered HERE, below the cache check, and not at the top of the handler: a cached
    // route spends nothing, and billing a user for the cache hits that are the whole point
    // of having a cache would throttle them for work that cost nothing. Throws
    // `resource-exhausted` or `unavailable` — both of which must reach the client
    // untouched, so this sits outside the try/catch that maps provider failures.
    await chargeQuota(request.auth.uid, 'routeBetween', 1);

    let route: { minutes: number; miles: number } | null;
    try {
      route = await fetchMapboxRoute({ from, to });
    } catch (err) {
      // Never written to the cache and never reported as "no route": an outage would
      // otherwise be preserved as a permanent-looking fact about these two points.
      // eslint-disable-next-line no-console
      console.error(JSON.stringify({ cacheKey, outcome: 'error', error: errorMessage(err) }));
      throw new HttpsError('internal', 'Route lookup failed.');
    }

    const record: CachedRoute = route
      ? { found: true, minutes: route.minutes, miles: route.miles, cachedAt: Date.now() }
      : { found: false, cachedAt: Date.now() };

    // The lookup is already paid for by this point, so a failed write must not fail the
    // request — the client would retry and be billed for the same route twice.
    try {
      await writeRoute(cacheKey, record);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify({ cacheKey, outcome: 'cache_write_failed', error: errorMessage(err) }));
    }

    return toResponse(record);
  }
);
