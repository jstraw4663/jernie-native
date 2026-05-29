import { createMMKV } from 'react-native-mmkv';

// Prevents redundant Firestore getDocs() within a 90-minute session window.
// Call shouldReadFirestore() before fetching; markRead() after success.

const DEBOUNCE_MS = 90 * 60 * 1000;  // 90 minutes
const storage = createMMKV({ id: 'jernie-refresh-scheduler' });

function storageKey(sessionKey: string): string {
  return `jernie_refresh_${sessionKey}`;
}

export function shouldReadFirestore(sessionKey: string): boolean {
  const raw = storage.getString(storageKey(sessionKey));
  if (!raw) return true;
  const lastRead = parseInt(raw, 10);
  return isNaN(lastRead) || Date.now() - lastRead > DEBOUNCE_MS;
}

export function markRead(sessionKey: string): void {
  storage.set(storageKey(sessionKey), String(Date.now()));
}

export function invalidate(sessionKey: string): void {
  storage.delete(storageKey(sessionKey));
}
