// DEV-only time override for testing phase-aware heroes.
// Uses React Native's __DEV__ global (true in development, false in production).
// Set override via MMKV: storage.set('jernie_debug_now', '2026-05-27T10:00:00')

declare const __DEV__: boolean;

export function getDevNow(): Date {
  if (!__DEV__) return new Date();
  try {
    // Lazy require to avoid loading MMKV in prod
    const { createMMKV } = require('react-native-mmkv');
    const storage = createMMKV({ id: 'jernie-dev' });
    const override = storage.getString('jernie_debug_now');
    if (override) return new Date(override);
  } catch {
    // ignore — fall through to real time
  }
  return new Date();
}
