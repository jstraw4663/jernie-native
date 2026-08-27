import * as fs from 'fs';
import * as path from 'path';

// An architectural fitness test, not a behavioural one. Whether App Check actually
// rejects a bad token is Firebase's job and cannot be exercised through `.run()`, which
// calls the handler directly and skips the middleware entirely. What CAN silently
// regress — and what actually costs money when it does — is a new callable shipping
// without the option at all. So this walks the source and insists every onCall declares
// it, wired to the one shared param.

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

describe('App Check coverage', () => {
  test('finds every callable in the bundle', () => {
    // If this list changes, the two tests below are what stop the new one going
    // unprotected — update it deliberately, never just to make the suite pass.
    expect(callableSources().map(c => c.file).sort()).toEqual([
      'enrichPlaces.ts',
      'resolveQuery.ts',
      'routeBetween.ts',
      'searchStops.ts',
    ]);
  });

  test('no callable is missing enforceAppCheck', () => {
    const missing = callableSources()
      .filter(({ source }) => !source.includes('enforceAppCheck'))
      .map(({ file }) => file);

    expect(missing).toEqual([]);
  });

  // A hardcoded `true` would take the app down the moment it deployed, before any client
  // sends tokens. Routing every callable through one param makes enforcement a deploy-time
  // switch that flips all four together, and never by accident.
  test('every callable is wired to the shared param, not a literal', () => {
    const notShared = callableSources()
      .filter(({ source }) => !source.includes('enforceAppCheck: ENFORCE_APP_CHECK'))
      .map(({ file }) => file);

    expect(notShared).toEqual([]);
  });

  test('the shared param defaults to off, so deploying this cannot break the app', () => {
    const source = fs.readFileSync(path.join(SRC_DIR, 'appCheck.ts'), 'utf8');

    expect(source).toContain('default: false');
  });
});
