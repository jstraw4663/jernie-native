import { database } from '@/src/lib/firebase';

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
