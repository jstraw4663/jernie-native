import { createMMKV } from 'react-native-mmkv';

// Device-scoped, matching the anonymous session it describes. MMKV v4: createMMKV({ id }).
const storage = createMMKV({ id: 'jernie-save-nudge' });

function key(uid: string): string {
  return `jernie_save_nudge_${uid}`;
}

export function readSnooze(uid: string): number | null {
  const raw = storage.getString(key(uid));
  if (!raw) return null;
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) ? null : parsed;
}

export function writeSnooze(uid: string, until: number): void {
  storage.set(key(uid), String(until));
}
