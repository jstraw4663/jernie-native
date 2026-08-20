const _mmkvStore: Record<string, boolean> = {};

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getBoolean: (key: string) => _mmkvStore[key],
    set: (key: string, value: boolean) => { _mmkvStore[key] = value; },
  }),
}));

jest.mock('@react-native-firebase/database');
jest.mock('@/src/lib/firebase', () => ({
  getAuthedUser: () => Promise.resolve({ uid: 'owner-uid' }),
  database: require('@react-native-firebase/database').default,
}));

import { mockSet, mockUpdate } from '@react-native-firebase/database';
import { maybeSeedDevData } from '@/src/lib/devSeed';

describe('maybeSeedDevData', () => {
  beforeEach(() => {
    Object.keys(_mmkvStore).forEach(k => delete _mmkvStore[k]);
    (mockSet as jest.Mock).mockReset().mockResolvedValue(undefined);
    (mockUpdate as jest.Mock).mockReset().mockResolvedValue(undefined);
  });

  test('fresh device: step 1 set() succeeds, step 2 update() runs, seed flag gets set', async () => {
    await maybeSeedDevData();

    expect(mockSet).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(_mmkvStore['seeded_v2_dev_trip_001']).toBe(true);
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
    expect(_mmkvStore['seeded_v2_dev_trip_001']).toBe(true);
  });

  test('a genuinely different set() error is not swallowed and step 2 never runs', async () => {
    (mockSet as jest.Mock).mockRejectedValue(
      Object.assign(new Error('network unavailable'), { code: 'database/network-error' }),
    );

    await expect(maybeSeedDevData()).rejects.toThrow('network unavailable');

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(_mmkvStore['seeded_v2_dev_trip_001']).toBeUndefined();
  });
});
