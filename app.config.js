module.exports = {
  expo: {
    name: "Jernie",
    slug: "jernie-native",
    version: "0.1.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#0D2B3E",
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.jernie.app",
      newArchEnabled: true,
      googleServicesFile:
        process.env.GOOGLE_SERVICES_IOS ?? "./GoogleService-Info.plist",
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "Jernie uses your location to show nearby places.",
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#0D2B3E",
      },
      package: "com.jernie.app",
      newArchEnabled: true,
      googleServicesFile:
        process.env.GOOGLE_SERVICES_ANDROID ?? "./google-services.json",
    },
    plugins: [
      "expo-router",
      "expo-font",
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
    },
    owner: "jstraw4663",
  },
};
