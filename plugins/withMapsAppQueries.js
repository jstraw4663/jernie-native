const { withAndroidManifest } = require('@expo/config-plugins');

const MAP_PACKAGES = [
  'com.google.android.apps.maps',
  'com.waze',
];

/** Allow Linking.canOpenURL to detect the supported map apps on Android 11+. */
module.exports = function withMapsAppQueries(config) {
  return withAndroidManifest(config, nextConfig => {
    const manifest = nextConfig.modResults.manifest;
    const queries = manifest.queries ?? [];
    const declaredPackages = new Set(
      queries.flatMap(query => query.package ?? [])
        .map(entry => entry.$['android:name']),
    );

    const missingPackages = MAP_PACKAGES
      .filter(packageName => !declaredPackages.has(packageName))
      .map(packageName => ({ $: { 'android:name': packageName } }));

    if (missingPackages.length > 0) {
      const packageQuery = queries.find(query => Array.isArray(query.package));
      if (packageQuery) {
        packageQuery.package.push(...missingPackages);
      } else {
        queries.push({ package: missingPackages });
      }
    }

    manifest.queries = queries;
    return nextConfig;
  });
};
