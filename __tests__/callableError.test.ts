import { isOverQuota } from '@/src/domain/callableError';

// The client half of functions/src/quota.ts. `resource-exhausted` is the one callable
// failure that is knowably permanent for a while: the answer will be "no" until the
// window rolls, so retrying spends a Cloud Function invocation to be told so again.
// Every other failure — a dropped connection, a cold-start timeout, Firestore being
// briefly unavailable — is the opposite, and must stay retryable.

function httpsError(code: string): Error & { code: string } {
  return Object.assign(new Error(`callable failed: ${code}`), { code });
}

describe('isOverQuota', () => {
  test('recognises a quota refusal', () => {
    expect(isOverQuota(httpsError('resource-exhausted'))).toBe(true);
  });

  // The fail-closed path in chargeQuota throws this when the ledger itself cannot be
  // read. It means "we do not know", not "you are over" — and it clears on its own,
  // so latching a key out of enrichment on it would strand that place for the session
  // over a transient Firestore blip.
  test('does not treat a fail-closed unavailable as being over quota', () => {
    expect(isOverQuota(httpsError('unavailable'))).toBe(false);
  });

  test.each(['internal', 'deadline-exceeded', 'unauthenticated', 'invalid-argument', 'unknown'])(
    '%s stays retryable',
    code => {
      expect(isOverQuota(httpsError(code))).toBe(false);
    },
  );

  // A network failure never reaches the callable at all, so it arrives as a plain Error
  // with no code. Reading `.code` off it must not throw.
  test('survives an error with no code at all', () => {
    expect(isOverQuota(new Error('Network request failed'))).toBe(false);
  });

  test.each([null, undefined, 'resource-exhausted', 42, {}])('%p is not a quota refusal', value => {
    expect(isOverQuota(value)).toBe(false);
  });
});
