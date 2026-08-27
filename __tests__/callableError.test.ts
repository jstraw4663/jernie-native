import { isOverQuota, describeCallableError } from '@/src/domain/callableError';

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

// The reason this exists: an undeployed callable reached a user's screen as the words
// "NOT FOUND". A gRPC status is not a sentence, and a traveller cannot act on one.
describe('describeCallableError', () => {
  const FALLBACK = "Couldn't look up that city — try again.";

  function err(code: string, message = '', details?: unknown) {
    return Object.assign(new Error(message), { code, details });
  }

  // The two quota refusals differ in what the person should DO — wait a day, or wait a
  // few minutes for someone else's traffic to clear — so they must not share wording.
  test('a personal quota refusal says the limit is theirs', () => {
    const text = describeCallableError(err('resource-exhausted', '', { scope: 'user' }), FALLBACK);

    expect(text).toMatch(/limit/i);
    expect(text).not.toMatch(/capacity/i);
  });

  test('a global quota refusal says the service is busy, not that they did something', () => {
    const text = describeCallableError(err('resource-exhausted', '', { scope: 'global' }), FALLBACK);

    expect(text).toMatch(/capacity|busy/i);
    expect(text).not.toMatch(/your|you've/i);
  });

  // Older deployments predate the details field, so the scope can be missing.
  test('a quota refusal with no scope still reads as a limit, not as the fallback', () => {
    const text = describeCallableError(err('resource-exhausted'), FALLBACK);

    expect(text).not.toBe(FALLBACK);
    expect(text).toMatch(/limit|capacity|busy/i);
  });

  test('never lets a raw gRPC status through', () => {
    ['not-found', 'internal', 'unauthenticated', 'permission-denied', 'deadline-exceeded', 'unavailable']
      .forEach(code => {
        const text = describeCallableError(err(code, code.toUpperCase().replace('-', ' ')), FALLBACK);
        expect(text).not.toMatch(/NOT FOUND|INTERNAL|UNAUTHENTICATED|DEADLINE/);
        expect(text.length).toBeGreaterThan(10);
      });
  });

  test('an unrecognised code falls back to the caller’s own wording', () => {
    expect(describeCallableError(err('teapot'), FALLBACK)).toBe(FALLBACK);
  });

  test('a plain network error with no code falls back too', () => {
    expect(describeCallableError(new Error('Network request failed'), FALLBACK)).toBe(FALLBACK);
  });

  test.each([null, undefined, 42, 'resource-exhausted'])('%p falls back', value => {
    expect(describeCallableError(value, FALLBACK)).toBe(FALLBACK);
  });
});
