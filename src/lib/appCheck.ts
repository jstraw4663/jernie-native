import appCheck from '@react-native-firebase/app-check';

// App Check attests that a request came from a genuine build of this app, rather than
// from a script holding a stolen auth token. It is the spend ceiling on the four billed
// callables — `resolveQuery` and `routeBetween` cost money per call, and until now any
// valid token could invoke them in a loop.
//
// ROLLOUT ORDER MATTERS. Enforcement lives server-side behind the ENFORCE_APP_CHECK param
// (functions/src/appCheck.ts) and defaults to OFF, because turning it on before shipped
// clients send tokens would 401 every request. Ship this, watch Firebase console →
// App Check until verified traffic dominates, then flip the param. Nothing here needs to
// change for that.
//
// This is a NATIVE module: a fresh `eas build --profile development` is required before
// it does anything on device.

// Latched only on success, so a transient failure — offline first launch, Play Services
// missing — can be retried rather than permanently disabling attestation for the session.
let initialized = false;

/**
 * Starts App Check. Safe to call more than once.
 *
 * Never throws. Attestation fails for reasons that are nobody's fault — a rooted device,
 * no Play Services, an offline first launch — and while enforcement is off those requests
 * still succeed. Taking the app down over it would be strictly worse than proceeding
 * unverified. Once enforcement is on, a failure here surfaces as 401s on the callables,
 * which is the correct and visible outcome.
 */
export async function initAppCheck(): Promise<void> {
  if (initialized) return;

  try {
    // The namespaced factory, not `new ReactNativeFirebaseAppCheckProvider()`: the
    // package's root entry re-exports that name as a TYPE (from ./types/appcheck) as well
    // as a value (from ./modular), and the type export wins — so constructing it directly
    // fails to compile. The factory is the documented route and sidesteps the collision.
    const provider = appCheck().newReactNativeFirebaseAppCheckProvider();

    // Play Integrity and App Attest cannot attest a simulator or a debuggable build, so a
    // dev build has to use the debug provider — otherwise every development request would
    // show as unverified and the console metrics that gate enforcement would be useless.
    const useDebug = __DEV__;

    // SUPPLIED, not discovered. Left unset, the SDK generates a debug token and prints it
    // to the NATIVE log — Xcode's console on iOS, logcat on Android — which is out of reach
    // on a Linux dev machine, and which changes on every reinstall. Setting it makes the
    // token stable, shareable across devices, and registerable before the app has ever run.
    //
    // Register the same value in Firebase console → App Check → Manage debug tokens.
    //
    // Guarded by useDebug, and that guard is load-bearing: EXPO_PUBLIC_* values are inlined
    // into the bundle at build time, so a shell that happened to export this while building
    // a release would otherwise ship a token that mints valid attestations for anyone who
    // extracts it — silently defeating App Check on exactly the build that needs it.
    const debugToken = useDebug ? process.env.EXPO_PUBLIC_APPCHECK_DEBUG_TOKEN : undefined;

    // Spread rather than `debugToken: undefined`, so an unconfigured setup sends no key at
    // all and the SDK's own generate-and-print behaviour is left completely untouched.
    const token = debugToken ? { debugToken } : {};

    provider.configure({
      android: { provider: useDebug ? 'debug' : 'playIntegrity', ...token },
      apple: { provider: useDebug ? 'debug' : 'appAttestWithDeviceCheckFallback', ...token },
    });

    await appCheck().initializeAppCheck({
      provider,
      // Tokens are short-lived; without refresh a long session starts failing partway
      // through once enforcement is on.
      isTokenAutoRefreshEnabled: true,
    });

    initialized = true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('App Check initialization failed; requests will be unverified.', error);
  }
}
