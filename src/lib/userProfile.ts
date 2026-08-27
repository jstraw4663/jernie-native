import { database } from '@/src/lib/firebase';
import type { MapsAppId } from '@/src/types';

/**
 * Stamps the anonymous lifecycle marker exactly once per uid. initAuth() runs on every
 * launch, so this checks before writing — anonCreatedAt anchors the save nudge schedule
 * and must never be pushed forward.
 */
export async function ensureAnonProfile(uid: string, now: number): Promise<void> {
  // Direct path rather than .child() — the jest database mock's ref() returns only
  // { once, on, off, set, update }, so chaining .child() would be untestable.
  const snap = await database().ref(`users/${uid}/anonCreatedAt`).once('value');
  if (snap.exists()) return;
  await database().ref(`users/${uid}`).update({ anonCreatedAt: now, plan: 'anonymous' });
}

/**
 * Records identity after a successful link. displayName and email are written only when
 * Apple actually supplied them — it returns both ONLY on the first authorization for an
 * Apple ID, and a later null must not erase what the first one gave us.
 */
export async function writeLinkedProfile(
  uid: string,
  input: { displayName: string | null; email: string | null; now: number },
): Promise<void> {
  const patch: Record<string, unknown> = { plan: 'free', linkedAt: input.now };
  if (input.displayName) patch.displayName = input.displayName;
  if (input.email) patch.email = input.email;
  await database().ref(`users/${uid}`).update(patch);
}

export async function readAnonCreatedAt(uid: string): Promise<number | null> {
  const snap = await database().ref(`users/${uid}/anonCreatedAt`).once('value');
  return snap.exists() ? (snap.val() as number) : null;
}

/**
 * Renames the signed-in user. Patches only `displayName` — the same node carries
 * `anonCreatedAt`, which anchors the save-nudge schedule, so a set() here would silently
 * reset it.
 *
 * `users/{uid}` is already self-writable in database.rules.json, so no rule change backs this.
 */
export async function updateDisplayName(uid: string, displayName: string): Promise<void> {
  const trimmed = displayName.trim();
  // Rejected rather than written: a blank name renders an empty avatar and an empty row,
  // and the edit field it would have to be fixed from is empty too.
  if (!trimmed) throw new Error('Display name cannot be empty');
  await database().ref(`users/${uid}`).update({ displayName: trimmed });
}

/** Saves the self-owned navigation preference. Null removes it and restores the chooser. */
export async function updatePreferredMapsApp(
  uid: string,
  preferredMapsApp: MapsAppId | null,
): Promise<void> {
  await database().ref(`users/${uid}`).update({ preferredMapsApp });
}
