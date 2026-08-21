import { createMMKV } from 'react-native-mmkv';

// Holds a captured anonymous trip across the sign-in that abandons its uid.
//
// The window this exists for is small but unrecoverable: once signInWithCredential resolves,
// the anonymous credential is gone from this device forever and its trips can never be read
// again. Capturing into memory alone would lose them if the app died mid-flight, so the
// payload is persisted before the sign-in and cleared only once the copy has landed.
// MMKV v4: createMMKV({ id }).
const storage = createMMKV({ id: 'jernie-trip-migration' });
const KEY = 'pending_migration';

export interface StagedTrip {
  tripId: string;
  // The whole trips/{tripId} subtree exactly as it was read. Deliberately untyped: this is a
  // verbatim carbon copy, and narrowing it here would silently drop fields added later.
  data: unknown;
}

export interface StagedMigration {
  fromUid: string;
  trips: StagedTrip[];
}

export function stageMigration(migration: StagedMigration): void {
  storage.set(KEY, JSON.stringify(migration));
}

export function readStagedMigration(): StagedMigration | null {
  const raw = storage.getString(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StagedMigration;
    // A payload with no uid or no trips can't be acted on, and leaving it would make every
    // launch retry it forever.
    if (!parsed?.fromUid || !Array.isArray(parsed.trips) || parsed.trips.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearStagedMigration(): void {
  // MMKV v4: remove(), not delete().
  storage.remove(KEY);
}
