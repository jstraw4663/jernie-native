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
