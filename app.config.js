const { execSync } = require("child_process");

function git(cmd, fallback) {
  try {
    return execSync(cmd, { cwd: __dirname }).toString().trim();
  } catch {
    return fallback;
  }
}

// Captured once when Metro/the Expo CLI boots (not live-updated on every hot
// reload) — lets the app display which branch/commit is actually running, so
// it's easy to confirm you're not looking at a stale build from another
// checkout/worktree.
const gitBranch = git("git branch --show-current", "unknown");
const gitSha = git("git rev-parse --short HEAD", "unknown");
const gitDirty = git("git status --porcelain", "").length > 0;
const builtAt = new Date().toISOString();

module.exports = {
  expo: {
    name: "Jernie",
    slug: "jernie-native",
    version: "0.7.0",
    // Where a built app looks for OTA updates. EAS cannot write these two keys itself
    // because this config is dynamic (it shells out to git above), which is what
    // "Cannot automatically write to dynamic config" means — the values are not a
    // computation, just the ones EAS would have inserted.
    updates: {
      url: "https://u.expo.dev/a85eae0d-8910-4bf2-9822-3fafe8cc9ebb",
    },
    // An update only reaches a build whose runtime version matches it, and under the
    // appVersion policy the runtime version IS `version` above. Two consequences worth
    // knowing before relying on this:
    //   - Bumping `version` orphans every already-installed build from future updates
    //     until it is rebuilt. That is the intended safety property, not a bug.
    //   - It does NOT notice native changes. Adding a native module (app-check did;
    //     @rnmapbox/maps will) without bumping `version` lets an update ship JS that
    //     calls into a module the installed binary does not contain, which crashes on
    //     launch. Switch to `{ policy: "fingerprint" }` if that trips us up — it hashes
    //     the native dependency set and invalidates on its own.
    runtimeVersion: {
      policy: "appVersion",
    },
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#0D2B3E",
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.jernie.app",
      usesAppleSignIn: true,
      newArchEnabled: true,
      googleServicesFile:
        process.env.GOOGLE_SERVICES_IOS ?? "./GoogleService-Info.plist",
      infoPlist: {
        LSApplicationQueriesSchemes: ["comgooglemaps", "waze"],
        NSLocationWhenInUseUsageDescription:
          "Jernie uses your location to show nearby places.",
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundColor: "#0D2B3E",
      },
      package: "com.jernie.app",
      newArchEnabled: true,
      googleServicesFile:
        process.env.GOOGLE_SERVICES_ANDROID ?? "./google-services.json",
    },
    plugins: [
      "./plugins/withMapsAppQueries",
      "expo-apple-authentication",
      "expo-router",
      "expo-font",
      "expo-image",
      "@react-native-firebase/app",
      "@react-native-firebase/auth",
      [
        "expo-build-properties",
        {
          ios: {
            useFrameworks: "static",
          },
        },
      ],
    ],
    scheme: "jernie",
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: "a85eae0d-8910-4bf2-9822-3fafe8cc9ebb",
      },
      build: { gitBranch, gitSha, gitDirty, builtAt },
    },
    owner: "jstraw4663",
  },
};
