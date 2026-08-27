const mockConfigure = jest.fn();
const mockInitializeAppCheck = jest.fn();

jest.mock('@react-native-firebase/app-check', () => ({
  __esModule: true,
  default: () => ({
    newReactNativeFirebaseAppCheckProvider: () => ({
      configure: (options: unknown) => mockConfigure(options),
    }),
    initializeAppCheck: (...args: unknown[]) => mockInitializeAppCheck(...args),
  }),
}));

const ORIGINAL_DEV = (global as { __DEV__?: boolean }).__DEV__;
const ORIGINAL_TOKEN = process.env.EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN;

// A DELIBERATELY FAKE token. These tests only assert that whatever is configured gets
// passed through (and, in the release case, that it does not), so the value is arbitrary —
// and a real one does not belong in a file that gets committed. Anyone holding a registered
// App Check debug token can mint valid attestations for this Firebase project, which is the
// exact thing App Check exists to stop. Real values live in .env, which is gitignored.
const DEBUG_TOKEN = '00000000-0000-4000-8000-000000000000';

function loadFresh() {
  let mod: typeof import('@/src/lib/appCheck');
  jest.isolateModules(() => { mod = require('@/src/lib/appCheck'); });
  return mod!;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockInitializeAppCheck.mockResolvedValue({});
  delete process.env.EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN;
});

afterEach(() => {
  (global as { __DEV__?: boolean }).__DEV__ = ORIGINAL_DEV;
  if (ORIGINAL_TOKEN === undefined) delete process.env.EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN;
  else process.env.EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN = ORIGINAL_TOKEN;
});

describe('initAppCheck', () => {
  test('uses real attestation in a release build', async () => {
    (global as { __DEV__?: boolean }).__DEV__ = false;

    await loadFresh().initAppCheck();

    expect(mockConfigure).toHaveBeenCalledWith(
      expect.objectContaining({
        android: { provider: 'playIntegrity' },
        apple: { provider: 'appAttestWithDeviceCheckFallback' },
      }),
    );
  });

  // Play Integrity and App Attest can't attest a simulator or a debug build, so a dev
  // build must use the debug provider or every request would be unverified.
  test('uses the debug provider in a development build', async () => {
    (global as { __DEV__?: boolean }).__DEV__ = true;

    await loadFresh().initAppCheck();

    expect(mockConfigure).toHaveBeenCalledWith(
      expect.objectContaining({
        android: { provider: 'debug' },
        apple: { provider: 'debug' },
      }),
    );
  });

  test('keeps tokens refreshed so long sessions do not start failing', async () => {
    await loadFresh().initAppCheck();

    expect(mockInitializeAppCheck).toHaveBeenCalledWith(
      expect.objectContaining({ isTokenAutoRefreshEnabled: true }),
    );
  });

  test('initialises once however many times it is called', async () => {
    const mod = loadFresh();
    await mod.initAppCheck();
    await mod.initAppCheck();

    expect(mockInitializeAppCheck).toHaveBeenCalledTimes(1);
  });

  // Attestation can fail for reasons that are nobody's fault — no Play Services, a
  // rooted device, an offline first launch. While enforcement is off those requests
  // still succeed, so a failure here must never take the app down with it.
  test('a failure to attest never crashes the app', async () => {
    mockInitializeAppCheck.mockRejectedValue(new Error('Play Integrity unavailable'));

    await expect(loadFresh().initAppCheck()).resolves.toBeUndefined();
  });

  test('a failed attempt can be retried rather than being latched off', async () => {
    const mod = loadFresh();
    mockInitializeAppCheck.mockRejectedValueOnce(new Error('offline'));
    await mod.initAppCheck();

    mockInitializeAppCheck.mockResolvedValue({});
    await mod.initAppCheck();

    expect(mockInitializeAppCheck).toHaveBeenCalledTimes(2);
  });
});

// Without a token supplied here, the SDK generates one and prints it to the NATIVE log —
// Xcode's console on iOS. That is unreachable on a Linux dev machine, so supplying it is
// the only practical route to a registered token on this setup.
describe('initAppCheck — the debug token', () => {
  test('passes a configured token through on both platforms', async () => {
    (global as { __DEV__?: boolean }).__DEV__ = true;
    process.env.EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN = DEBUG_TOKEN;

    await loadFresh().initAppCheck();

    expect(mockConfigure).toHaveBeenCalledWith({
      android: { provider: 'debug', debugToken: DEBUG_TOKEN },
      apple: { provider: 'debug', debugToken: DEBUG_TOKEN },
    });
  });

  // Omitted rather than sent as undefined, so the SDK falls back to generating one and
  // nothing changes for a developer who has not configured a token at all.
  test('omits the key entirely when no token is configured', async () => {
    (global as { __DEV__?: boolean }).__DEV__ = true;

    await loadFresh().initAppCheck();

    expect(mockConfigure).toHaveBeenCalledWith({
      android: { provider: 'debug' },
      apple: { provider: 'debug' },
    });
  });

  // EXPO_PUBLIC_* values are inlined into the bundle at build time, so this one would
  // travel into a release build if the shell that ran the build happened to export it.
  // A debug token in a release build mints valid attestations for anyone holding it and
  // silently defeats the whole mechanism, so the release path must never carry one.
  test('never sends a token in a release build', async () => {
    (global as { __DEV__?: boolean }).__DEV__ = false;
    process.env.EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN = DEBUG_TOKEN;

    await loadFresh().initAppCheck();

    expect(JSON.stringify(mockConfigure.mock.calls[0][0])).not.toContain(DEBUG_TOKEN);
  });
});
