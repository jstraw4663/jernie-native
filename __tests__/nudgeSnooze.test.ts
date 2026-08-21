const mockStore = new Map<string, string>();
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (k: string) => mockStore.get(k),
    set: (k: string, v: string) => { mockStore.set(k, v); },
    remove: (k: string) => { mockStore.delete(k); },
  }),
}));

import { readSnooze, writeSnooze } from '@/src/lib/nudgeSnooze';

beforeEach(() => { mockStore.clear(); });

describe('nudge snooze storage', () => {
  it('returns null when nothing is stored', () => {
    expect(readSnooze('uid-1')).toBeNull();
  });
  it('round-trips a timestamp', () => {
    writeSnooze('uid-1', 1_700_000_000_000);
    expect(readSnooze('uid-1')).toBe(1_700_000_000_000);
  });
  // Snooze is device-scoped, matching the anonymous session it describes.
  it('keys snooze state per uid', () => {
    writeSnooze('uid-1', 111);
    expect(readSnooze('uid-2')).toBeNull();
  });
  it('returns null on unparseable stored data', () => {
    mockStore.set('jernie_save_nudge_uid-1', 'garbage');
    expect(readSnooze('uid-1')).toBeNull();
  });
});
