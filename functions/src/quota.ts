// Per-uid and global spend ceilings on the callables that cost real money.
//
// WHY THIS EXISTS ALONGSIDE APP CHECK. App Check (see appCheck.ts) proves a request came
// from a genuine build of this app. It does nothing about a genuine build calling in a
// loop — a runaway retry, a stuck useEffect, or simply someone curious. This is the piece
// that bounds the bill.
//
// WHAT IS METERED IS PROVIDER CALLS, NOT INVOCATIONS. A routeBetween served from
// route_cache spends nothing and must not consume quota; a resolveQuery that short-circuits
// on a flight number never reaches Foursquare; an enrichPlaces batch of 30 makes THIRTY
// billed calls in one invocation. So callers charge at the moment they are about to spend,
// for the number of provider calls they are about to make.
//
// WHY A GLOBAL LEDGER TOO. The app signs users in anonymously (src/lib/firebase.ts), so a
// fresh uid costs an attacker nothing and a per-uid limit alone is a fairness control
// rather than a ceiling. The global counter is the actual circuit breaker. It is a single
// hot document, and Firestore sustains roughly one write per second to one document —
// far above this app's traffic, but a real limit, and the fix if it is ever approached is
// a sharded counter rather than a bigger number.

import { HttpsError } from 'firebase-functions/v2/https';
import { defineInt } from 'firebase-functions/params';
import { firestore } from './repository';

export const QUOTA_COLLECTION = 'api_quota';

/** The global ledger pools every endpoint: the ceiling is on total billed calls. */
export const GLOBAL_USAGE_KEY = 'all';

/** Every callable that spends money with a third party. */
export type BilledEndpoint = 'resolveQuery' | 'routeBetween' | 'enrichPlaces' | 'searchStops';

export interface EndpointUsage {
  /** Billed calls charged so far today. */
  day: number;
  /** Which minute `minute` counts, so a stale burst count is discarded rather than trusted. */
  minuteBucket: string;
  minute: number;
}

export interface Limits {
  day: number;
  minute: number;
}

export type ChargePlan =
  | { ok: true; usage: EndpointUsage }
  | { ok: false; window: 'day' | 'minute'; limit: number; used: number };

/**
 * Daily budgets, and the burst brake under each.
 *
 * The daily number is the budget. The per-minute number exists because a daily cap alone
 * only stops a runaway loop AFTER it has spent the whole day's allowance, which a loop does
 * in well under a minute — the burst limit turns that from a few dollars into a few cents.
 *
 * enrichPlaces charges one unit per place and its batch cap is 30 (see enrichPlaces.ts), so
 * its per-minute limit MUST stay above 30 or every full batch would be rejected outright
 * rather than merely throttled.
 */
const DEFAULT_LIMITS: Record<BilledEndpoint, Limits> = {
  resolveQuery: { day: 300, minute: 30 },
  enrichPlaces: { day: 200, minute: 60 },
  routeBetween: { day: 200, minute: 30 },
  searchStops: { day: 60, minute: 15 },
};

/**
 * Total billed provider calls per day across every user.
 *
 * 3000 is roughly $50 of provider spend at the worst-case blended rate (Foursquare Premium
 * at $18.75 CPM being the priciest thing we call). It is a circuit breaker, not a budget:
 * ordinary traffic should never come near it, and hitting it means something is wrong.
 */
const DEFAULT_GLOBAL_LIMITS: Limits = { day: 3000, minute: 300 };

const PARAMS: Record<BilledEndpoint, { day: ReturnType<typeof defineInt>; minute: ReturnType<typeof defineInt> }> = {
  resolveQuery: {
    day: defineInt('QUOTA_RESOLVE_QUERY_DAY', { default: DEFAULT_LIMITS.resolveQuery.day }),
    minute: defineInt('QUOTA_RESOLVE_QUERY_MINUTE', { default: DEFAULT_LIMITS.resolveQuery.minute }),
  },
  enrichPlaces: {
    day: defineInt('QUOTA_ENRICH_PLACES_DAY', { default: DEFAULT_LIMITS.enrichPlaces.day }),
    minute: defineInt('QUOTA_ENRICH_PLACES_MINUTE', { default: DEFAULT_LIMITS.enrichPlaces.minute }),
  },
  routeBetween: {
    day: defineInt('QUOTA_ROUTE_BETWEEN_DAY', { default: DEFAULT_LIMITS.routeBetween.day }),
    minute: defineInt('QUOTA_ROUTE_BETWEEN_MINUTE', { default: DEFAULT_LIMITS.routeBetween.minute }),
  },
  searchStops: {
    day: defineInt('QUOTA_SEARCH_STOPS_DAY', { default: DEFAULT_LIMITS.searchStops.day }),
    minute: defineInt('QUOTA_SEARCH_STOPS_MINUTE', { default: DEFAULT_LIMITS.searchStops.minute }),
  },
};

const GLOBAL_PARAMS = {
  day: defineInt('QUOTA_GLOBAL_DAY', { default: DEFAULT_GLOBAL_LIMITS.day }),
  minute: defineInt('QUOTA_GLOBAL_MINUTE', { default: DEFAULT_GLOBAL_LIMITS.minute }),
};

/**
 * A param's value, with the built-in default as a floor.
 *
 * This guard is not belt-and-braces. `IntParam.runtimeValue()` is
 * `parseInt(process.env[NAME] || '0', 10) || 0` — the `default` passed to `defineInt` is
 * baked into the deploy spec and is NOT consulted at runtime. An unmaterialised param
 * therefore resolves to 0, and a limit of 0 combined with this module's fail-closed
 * behaviour would refuse every billed call and take the app down. Falling back to the
 * built-in makes the failure mode "limits are the defaults" instead of "nothing works".
 */
export function resolveLimit(param: { value: () => number }, fallback: number): number {
  const configured = param.value();
  return configured > 0 ? configured : fallback;
}

function limitsFor(endpoint: BilledEndpoint): Limits {
  return {
    day: resolveLimit(PARAMS[endpoint].day, DEFAULT_LIMITS[endpoint].day),
    minute: resolveLimit(PARAMS[endpoint].minute, DEFAULT_LIMITS[endpoint].minute),
  };
}

function globalLimits(): Limits {
  return {
    day: resolveLimit(GLOBAL_PARAMS.day, DEFAULT_GLOBAL_LIMITS.day),
    minute: resolveLimit(GLOBAL_PARAMS.minute, DEFAULT_GLOBAL_LIMITS.minute),
  };
}

// ── Keys ─────────────────────────────────────────────────────────────────────
// UTC throughout. A local-timezone day boundary would move with the deployment region and
// hand every user a second daily budget the day that region changed.

export function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function minuteBucketKey(now: Date): string {
  return now.toISOString().slice(0, 16);
}

export function quotaDocId(uid: string, now: Date): string {
  return `u_${uid}_${dayKey(now)}`;
}

export function globalDocId(now: Date): string {
  return `g_${dayKey(now)}`;
}

/** Days a spent bucket is kept past the day it covers, before the TTL policy reaps it. */
const RETENTION_GRACE_DAYS = 2;

/**
 * When this document may be deleted.
 *
 * A `Date`, so the Admin SDK stores a real Firestore Timestamp — TTL policies act ONLY on
 * Timestamp fields, which is exactly why route_cache's epoch-millis `cachedAt` cannot be
 * expired by one. Enable it with:
 *
 *   gcloud firestore fields ttls update expiresAt \
 *     --collection-group=api_quota --enable-ttl
 */
export function quotaExpiresAt(now: Date): Date {
  const endOfDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return new Date(endOfDay + RETENTION_GRACE_DAYS * 24 * 60 * 60 * 1000);
}

// ── The planner ──────────────────────────────────────────────────────────────

/**
 * Whether `units` more billed calls fit, and what the counters become if they do.
 *
 * Pure, so the policy can be tested exhaustively without Firestore. A charge that does not
 * fit is denied WHOLE rather than trimmed: partial fulfilment would bill for calls the
 * caller is then told it cannot make.
 */
export function planCharge(
  current: EndpointUsage | undefined,
  units: number,
  bucket: string,
  limits: Limits,
): ChargePlan {
  const day = current?.day ?? 0;
  // A count from an earlier minute says nothing about this one, so it is discarded rather
  // than carried forward.
  const minute = current?.minuteBucket === bucket ? current.minute : 0;

  if (day + units > limits.day) {
    return { ok: false, window: 'day', limit: limits.day, used: day };
  }
  if (minute + units > limits.minute) {
    return { ok: false, window: 'minute', limit: limits.minute, used: minute };
  }

  return { ok: true, usage: { day: day + units, minuteBucket: bucket, minute: minute + units } };
}

// ── The charge ───────────────────────────────────────────────────────────────

interface QuotaDoc {
  usage?: Record<string, EndpointUsage>;
  expiresAt?: unknown;
}

/** Signals a refusal from inside the transaction, so nothing is written. */
class QuotaExceeded extends Error {
  constructor(
    readonly scope: 'user' | 'global',
    readonly endpoint: string,
    readonly denial: Extract<ChargePlan, { ok: false }>,
  ) {
    super(`${scope} quota exhausted for ${endpoint} (${denial.window})`);
  }
}

function readUsage(snapshot: { data(): unknown }, key: string): EndpointUsage | undefined {
  return (snapshot.data() as QuotaDoc | undefined)?.usage?.[key];
}

function log(uid: string, endpoint: string, outcome: string, detail?: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.error(JSON.stringify({ uid, endpoint, outcome, ...detail }));
}

/**
 * Charges `units` billed provider calls against this user and against the global ledger.
 *
 * CALL THIS IMMEDIATELY BEFORE SPENDING, never at the top of a handler — a cache hit or an
 * early return costs nothing and must not consume anyone's budget.
 *
 * Charged BEFORE the provider call and never refunded. If the provider then fails, the unit
 * is still spent: over-counting on a rare failure is far safer than a compensating decrement
 * on every single call, and it denies anyone a supply of free calls obtained by deliberately
 * inducing errors.
 *
 * Both counters move in ONE transaction, so they cannot drift — a global refusal leaves no
 * per-user charge behind, and vice versa.
 *
 * Throws `resource-exhausted` when a budget is gone (the client should stop, not retry) and
 * `unavailable` when the ledger itself could not be read or written. That second case FAILS
 * CLOSED, deliberately: a quota that can be stepped around by inducing an error is not a
 * spend ceiling, and the likeliest failure — write contention on the global document —
 * arrives exactly when traffic is heaviest.
 */
export async function chargeQuota(
  uid: string,
  endpoint: BilledEndpoint,
  units = 1,
  now: Date = new Date(),
): Promise<void> {
  const db = firestore();
  const collection = db.collection(QUOTA_COLLECTION);
  const userRef = collection.doc(quotaDocId(uid, now));
  const globalRef = collection.doc(globalDocId(now));
  const bucket = minuteBucketKey(now);
  const expiresAt = quotaExpiresAt(now);

  try {
    await db.runTransaction(async (tx) => {
      // One round trip for both documents.
      const [userSnap, globalSnap] = await tx.getAll(userRef, globalRef);

      const userPlan = planCharge(readUsage(userSnap, endpoint), units, bucket, limitsFor(endpoint));
      if (!userPlan.ok) throw new QuotaExceeded('user', endpoint, userPlan);

      const globalPlan = planCharge(readUsage(globalSnap, GLOBAL_USAGE_KEY), units, bucket, globalLimits());
      if (!globalPlan.ok) throw new QuotaExceeded('global', endpoint, globalPlan);

      // merge, so charging one endpoint never clears another's counters — and so the write
      // needs no read-modify-write of the whole usage map.
      tx.set(userRef, { usage: { [endpoint]: userPlan.usage }, expiresAt }, { merge: true });
      tx.set(globalRef, { usage: { [GLOBAL_USAGE_KEY]: globalPlan.usage }, expiresAt }, { merge: true });
    });
  } catch (err) {
    if (err instanceof QuotaExceeded) {
      log(uid, endpoint, 'quota_exceeded', { scope: err.scope, ...err.denial });
      throw new HttpsError(
        'resource-exhausted',
        err.scope === 'global'
          ? 'This service is temporarily at capacity. Please try again later.'
          : "You've reached today's lookup limit. It resets at midnight UTC.",
      );
    }

    log(uid, endpoint, 'quota_ledger_failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw new HttpsError('unavailable', 'Usage limits are temporarily unavailable. Please try again.');
  }
}
