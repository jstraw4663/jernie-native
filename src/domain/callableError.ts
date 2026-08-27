/**
 * Classifying why a callable rejected — the client half of functions/src/quota.ts.
 *
 * Pure and Firebase-free on purpose: it reads a `code` off whatever it is handed, which
 * is all `HttpsError` guarantees, so it is testable without a native module and works
 * equally on an error that never reached the callable at all.
 */

/**
 * The gRPC status a Cloud Function uses to say a request was refused for exceeding a
 * quota. React Native Firebase surfaces callable codes bare (`'resource-exhausted'`),
 * not namespaced like the Auth/Firestore modules' `'auth/…'` codes — see
 * HttpsErrorCode in @react-native-firebase/functions.
 */
const RESOURCE_EXHAUSTED = 'resource-exhausted';

function codeOf(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const { code } = err as { code?: unknown };
  return typeof code === 'string' ? code : undefined;
}

/**
 * True when a callable refused because the caller is over its API quota.
 *
 * This is the one callable failure worth treating differently, because it is the one we
 * already know the answer to. The window has to roll before it can succeed, so a retry
 * spends a Cloud Function invocation and a Firestore transaction purely to be refused
 * again — and a caller that retries on every render turns one refusal into a bill of its
 * own, which is precisely what the quota exists to prevent.
 *
 * Deliberately narrow. `unavailable` — what chargeQuota throws when it cannot read the
 * ledger at all — means "we do not know", not "you are over", and clears by itself; so
 * do timeouts, cold starts and dropped connections. All of those must stay retryable, or
 * a transient blip would strand a place for the rest of the session.
 */
export function isOverQuota(err: unknown): boolean {
  return codeOf(err) === RESOURCE_EXHAUSTED;
}

/**
 * The scope a `resource-exhausted` refusal carries in its `details`, set by chargeQuota in
 * functions/src/quota.ts. Absent on anything deployed before that field existed.
 */
type QuotaScope = 'user' | 'global';

function quotaScopeOf(err: unknown): QuotaScope | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const { details } = err as { details?: unknown };
  if (typeof details !== 'object' || details === null) return undefined;
  const { scope } = details as { scope?: unknown };
  return scope === 'user' || scope === 'global' ? scope : undefined;
}

/**
 * Human words for a failed callable.
 *
 * This exists because an undeployed function reached a user's screen as the words "NOT
 * FOUND". A gRPC status is not a sentence, and none of them tell a traveller what to do
 * next — which is the only thing an error on a form is for.
 *
 * Deliberately does NOT pass the server's own message through. Some are written for people
 * and some are raw status text, and there is no reliable way to tell which from the client;
 * pattern-matching English to decide would be worse than owning the wording here. The one
 * thing the server does send as data is the quota scope, because "you have hit your limit"
 * and "we are at capacity" call for different actions and the code cannot distinguish them.
 *
 * `fallback` is the caller's own domain wording for "this didn't work" — it knows whether
 * it was looking up a city or saving a stop, and this does not.
 */
export function describeCallableError(err: unknown, fallback: string): string {
  switch (codeOf(err)) {
    case RESOURCE_EXHAUSTED:
      // No scope means an older deployment. Still better than the fallback: whatever else
      // is true, the caller was refused for volume and retrying immediately will not help.
      return quotaScopeOf(err) === 'global'
        ? 'Lookups are busy right now — this should clear shortly.'
        : "You've reached today's lookup limit. It resets at midnight UTC.";

    case 'unavailable':
      return "Couldn't reach the lookup service — try again in a moment.";

    // The function is not deployed, or was deleted. Nothing the user can do, and nothing
    // they did; say so plainly rather than showing them a status code.
    case 'not-found':
    case 'unimplemented':
      return 'That lookup is unavailable right now.';

    case 'unauthenticated':
    case 'permission-denied':
      return 'You need to be signed in to look that up.';

    case 'deadline-exceeded':
      return 'That lookup took too long — try again.';

    default:
      // internal, unknown, cancelled, a bare network failure, anything new: the caller's
      // own wording is more specific than anything generic this could invent.
      return fallback;
  }
}