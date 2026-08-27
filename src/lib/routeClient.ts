import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';
import { routeCacheKey, isRouteFresh, type LatLon } from '@/src/domain/routeCache';

const ROUTE_COLLECTION = 'route_cache';

export interface RouteResult {
  minutes: number;
  miles: number;
}

/** The shape stored in Firestore by the `routeBetween` callable. */
interface CachedRoute {
  found: boolean;
  minutes?: number;
  miles?: number;
  cachedAt?: number;
}

interface RouteBetweenRequest {
  cacheKey: string;
  from: LatLon;
  to: LatLon;
}

function toResult(record: CachedRoute): RouteResult | null {
  if (!record.found || typeof record.minutes !== 'number' || typeof record.miles !== 'number') {
    return null;
  }
  return { minutes: record.minutes, miles: record.miles };
}

/**
 * The drive from one point to another, in the two numbers the cards show.
 *
 * CACHE-FIRST, deliberately. Firestore is read directly before the callable is considered,
 * so a hit costs one Firestore read instead of a Cloud Function invocation plus a billed
 * Mapbox call — the same pattern useFirestoreEnrichment already uses for place_enrichment.
 * Since a static drive between two fixed points never changes, hit rates should be high:
 * re-opening a planned trip should cost nothing at all.
 *
 * CALL THIS LAZILY. Resolve a drive time for the ONE candidate the user has tapped, never
 * for every row of a result list — the design puts a drive time in nearly every card
 * footer, so eager resolution turns one search into N billed routing calls.
 *
 * Returns null when there is genuinely no drivable route. Throws only when the callable
 * itself fails, matching enrichmentClient and stopSearchClient: the caller decides whether a
 * missing drive time is worth surfacing or quietly omitting from the footer row.
 */
export async function fetchRoute(from: LatLon, to: LatLon): Promise<RouteResult | null> {
  const cacheKey = routeCacheKey(from, to);

  // A Firestore failure here is not worth failing the whole lookup over — the callable is
  // a slower, costlier path to the same answer, and having no drive time at all is worse
  // than paying for one.
  try {
    const snapshot = await firestore().collection(ROUTE_COLLECTION).doc(cacheKey).get();
    if (snapshot.exists()) {
      const cached = snapshot.data() as CachedRoute;
      if (isRouteFresh(cached.cachedAt)) return toResult(cached);
    }
  } catch {
    // Fall through to the callable.
  }

  const callable = functions().httpsCallable<RouteBetweenRequest, CachedRoute>('routeBetween');
  const response = await callable({ cacheKey, from, to });
  return toResult(response.data);
}
