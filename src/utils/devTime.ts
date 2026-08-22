// DEV-only time override for testing phase-aware heroes and CTA cards.
// Uses React Native's __DEV__ global (true in development, false in production).
// Driven from the Profile tab's admin panel; before that existed, the only way in was to
// set 'jernie_debug_now' in MMKV by hand.

declare const __DEV__: boolean;

const STORAGE_ID = 'jernie-dev';
const OVERRIDE_KEY = 'jernie_debug_now';

// Lazy require throughout — MMKV must never load in a production bundle just because this
// module was imported.
function devStorage(): { getString(k: string): string | undefined; set(k: string, v: string): void; remove(k: string): void } | null {
  if (!__DEV__) return null;
  try {
    const { createMMKV } = require('react-native-mmkv');
    return createMMKV({ id: STORAGE_ID });
  } catch {
    return null;
  }
}

export function getDevNow(): Date {
  const override = getDevNowOverride();
  return override ? new Date(override) : new Date();
}

/** The raw override string, or null when unset. Null in production, always. */
export function getDevNowOverride(): string | null {
  return devStorage()?.getString(OVERRIDE_KEY) ?? null;
}

/**
 * Sets the override. An unparseable value is rejected rather than stored — a bad string
 * would otherwise make every getDevNow() return Invalid Date, which surfaces as a blank or
 * NaN date all over the app with nothing pointing back to here.
 */
export function setDevNowOverride(iso: string): void {
  const storage = devStorage();
  if (!storage) return;
  if (!iso || Number.isNaN(new Date(iso).getTime())) {
    throw new Error('Not a date this app can parse — try 2026-07-11T10:00:00');
  }
  storage.set(OVERRIDE_KEY, iso);
}

export function clearDevNowOverride(): void {
  devStorage()?.remove(OVERRIDE_KEY);
}
