const _mmkvStore: Record<string, boolean | string> = {};

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getBoolean: (key: string) => _mmkvStore[key],
    getString: (key: string) => _mmkvStore[key],
    set: (key: string, value: boolean | string) => { _mmkvStore[key] = value; },
  }),
}));

jest.mock('@react-native-firebase/database');
jest.mock('@/src/lib/firebase', () => ({
  getAuthedUser: () => Promise.resolve({ uid: 'owner-uid' }),
  database: require('@react-native-firebase/database').default,
}));

import { mockSet, mockUpdate, mockOnce } from '@react-native-firebase/database';
import { maybeSeedDevData, getSeedOwnerUid } from '@/src/lib/devSeed';

describe('maybeSeedDevData', () => {
  beforeEach(() => {
    Object.keys(_mmkvStore).forEach(k => delete _mmkvStore[k]);
    (mockSet as jest.Mock).mockReset().mockResolvedValue(undefined);
    (mockUpdate as jest.Mock).mockReset().mockResolvedValue(undefined);
    // Call 1 is the users-index early-out; call 2 is the ownerUid check between the two
    // write steps. The default is a device where this uid has no index entry yet but does
    // own the trip once step 1 has run — i.e. the ordinary seeding path.
    (mockOnce as jest.Mock).mockReset()
      .mockResolvedValueOnce({ exists: () => false })
      .mockResolvedValue({ exists: () => true, val: () => 'owner-uid' });
  });

  test('a uid that already has the dev trip indexed stamps the flags without rewriting anything', async () => {
    (mockOnce as jest.Mock).mockReset().mockResolvedValue({ exists: () => true });

    await maybeSeedDevData();

    expect(mockSet).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(_mmkvStore['seeded_v3_dev_trip_001']).toBe(true);
    expect(getSeedOwnerUid()).toBe('owner-uid');
  });

  test('fresh device: step 1 set() succeeds, step 2 update() runs, seed flag gets set', async () => {
    await maybeSeedDevData();

    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(_mmkvStore['seeded_v3_dev_trip_001']).toBe(true);
  });

  test('partial prior run (trip already exists): permission-denied on set() is swallowed, step 2 still runs', async () => {
    (mockSet as jest.Mock).mockRejectedValue(
      Object.assign(new Error('Client doesn\'t have permission to access the desired data.'), {
        code: 'database/permission-denied',
      }),
    );

    await maybeSeedDevData();

    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(_mmkvStore['seeded_v3_dev_trip_001']).toBe(true);
  });

  // app/index.tsx's __DEV__ zero-trip fallback points at dev-trip-001, which only the
  // seeding uid can read. Without this record it kept redirecting there after a sign-out,
  // stranding the fresh anonymous uid on an unreadable trip.
  test('records the seeding uid so the dev redirect can tell whether it still applies', async () => {
    expect(getSeedOwnerUid()).toBeNull();
    await maybeSeedDevData();
    expect(getSeedOwnerUid()).toBe('owner-uid');
  });

  test('does not record an owner when seeding fails partway', async () => {
    (mockSet as jest.Mock).mockRejectedValue(
      Object.assign(new Error('network unavailable'), { code: 'database/network-error' }),
    );
    await expect(maybeSeedDevData()).rejects.toThrow('network unavailable');
    expect(getSeedOwnerUid()).toBeNull();
  });

  // After a sign-out the fresh anonymous uid re-enters here, finds dev-trip-001 already
  // present, and cannot write members/ — which is create-only and scoped to the trip's owner.
  // That surfaced as a permission-denied thrown on every single launch.
  test('a uid that does not own the existing dev trip returns quietly instead of throwing', async () => {
    (mockSet as jest.Mock).mockRejectedValue(
      Object.assign(new Error('permission denied'), { code: 'database/permission-denied' }),
    );
    (mockOnce as jest.Mock).mockReset()
      .mockResolvedValueOnce({ exists: () => false })
      .mockResolvedValue({ exists: () => true, val: () => 'somebody-else' });

    await expect(maybeSeedDevData()).resolves.toBeUndefined();

    expect(mockUpdate).not.toHaveBeenCalled();
    // Claiming ownership here would send this uid straight back to a trip it cannot read.
    expect(getSeedOwnerUid()).toBeNull();
    expect(_mmkvStore['seeded_v3_dev_trip_001']).toBeUndefined();
  });

  test('a denied ownerUid read is treated as not-the-owner, not as a failure', async () => {
    (mockSet as jest.Mock).mockRejectedValue(
      Object.assign(new Error('permission denied'), { code: 'database/permission-denied' }),
    );
    (mockOnce as jest.Mock).mockReset()
      .mockResolvedValueOnce({ exists: () => false })
      .mockRejectedValue(
        Object.assign(new Error('permission denied'), { code: 'database/permission-denied' }),
      );

    await expect(maybeSeedDevData()).resolves.toBeUndefined();

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(getSeedOwnerUid()).toBeNull();
  });

  test('a genuinely different set() error is not swallowed and step 2 never runs', async () => {
    (mockSet as jest.Mock).mockRejectedValue(
      Object.assign(new Error('network unavailable'), { code: 'database/network-error' }),
    );

    await expect(maybeSeedDevData()).rejects.toThrow('network unavailable');

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(_mmkvStore['seeded_v3_dev_trip_001']).toBeUndefined();
  });
});
