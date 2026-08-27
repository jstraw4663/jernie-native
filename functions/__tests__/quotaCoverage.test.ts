import * as fs from 'fs';
import * as path from 'path';

// An architectural fitness test, the twin of appCheckCoverage. App Check keeps out
// callers that aren't the app; the quota keeps out the app itself looping. Neither is
// exercisable through `.run()` at the point that matters, and both fail the same silent
// way: a new callable ships, nobody notices it is unmetered, and the first runaway loop
// arrives as a bill rather than a `resource-exhausted`.
//
// What this can check statically is that every callable charges, and that what it
// charges is a name the quota module actually knows about — a typo'd endpoint string
// would otherwise meter into a bucket with no configured limit.

const SRC_DIR = path.join(__dirname, '..', 'src');

interface CallableSource {
  file: string;
  source: string;
}

function callableSources(): CallableSource[] {
  return fs
    .readdirSync(SRC_DIR)
    .filter(file => file.endsWith('.ts'))
    .map(file => ({ file, source: fs.readFileSync(path.join(SRC_DIR, file), 'utf8') }))
    .filter(({ source }) => source.includes('onCall('));
}

function quotaSource(): string {
  return fs.readFileSync(path.join(SRC_DIR, 'quota.ts'), 'utf8');
}

describe('quota coverage', () => {
  test('finds every callable in the bundle', () => {
    // Deliberately duplicated from appCheckCoverage rather than shared: the two lists
    // answer different questions, and a callable that is genuinely exempt from one is
    // not thereby exempt from the other.
    expect(callableSources().map(c => c.file).sort()).toEqual([
      'enrichPlaces.ts',
      'resolveQuery.ts',
      'routeBetween.ts',
      'searchStops.ts',
    ]);
  });

  test('every callable charges the quota', () => {
    const unmetered = callableSources()
      .filter(({ source }) => !source.includes('await chargeQuota('))
      .map(({ file }) => file);

    expect(unmetered).toEqual([]);
  });

  // Awaited, not fired and forgotten. `chargeQuota` denies by throwing, so an un-awaited
  // call would let the provider request go out and reject a promise nobody is holding —
  // spending the money it exists to refuse.
  test('no callable charges without awaiting the refusal', () => {
    const unawaited = callableSources()
      .filter(({ source }) => /(?<!await )chargeQuota\(/.test(source.replace(/^import .*$/gm, '')))
      .map(({ file }) => file);

    expect(unawaited).toEqual([]);
  });

  // A typo'd endpoint name is silently a different bucket: it type-checks only because
  // BilledEndpoint is a union of literals, so this catches the case where someone widens
  // the union in quota.ts and forgets, or passes a name that was never in it.
  test('every endpoint a callable charges is one the quota module knows', () => {
    const declared = quotaSource()
      .match(/export type BilledEndpoint =([^;]+);/)![1]
      .match(/'([^']+)'/g)!
      .map(s => s.replace(/'/g, ''));

    const charged = callableSources().flatMap(({ file, source }) =>
      [...source.matchAll(/chargeQuota\([^,]+,\s*'([^']+)'/g)].map(m => ({ file, endpoint: m[1] }))
    );

    expect(charged.length).toBe(callableSources().length);
    expect(charged.filter(c => !declared.includes(c.endpoint))).toEqual([]);
  });

  // Fail-closed is the whole design: if the ledger cannot be read or written we do not
  // know what has been spent, and guessing wrong costs real money. `unavailable` is the
  // retryable code, so a client that backs off recovers on its own once Firestore does.
  test('a quota failure denies rather than waves the call through', () => {
    expect(quotaSource()).toContain("'unavailable'");
    expect(quotaSource()).toContain("'resource-exhausted'");
  });
});
