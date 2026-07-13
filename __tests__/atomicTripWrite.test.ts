jest.mock('@react-native-firebase/database');
jest.mock('@/src/lib/firebase', () => ({
  database: require('@react-native-firebase/database').default,
}));

import { mockSet } from '@react-native-firebase/database';
import { writeTripOnce } from '@/src/lib/atomicTripWrite';

describe('writeTripOnce', () => {
  beforeEach(() => {
    (mockSet as jest.Mock).mockReset().mockResolvedValue(undefined);
  });

  test('succeeds silently when the trip does not exist yet', async () => {
    await expect(writeTripOnce('trip-a', { id: 'trip-a' }, 'continue')).resolves.toBeUndefined();
    expect(mockSet).toHaveBeenCalledTimes(1);
  });

  test('onAlreadyExists "continue": a permission-denied rejection resolves without throwing', async () => {
    (mockSet as jest.Mock).mockRejectedValue(
      Object.assign(new Error('permission denied'), { code: 'database/permission-denied' }),
    );
    await expect(writeTripOnce('trip-a', {}, 'continue')).resolves.toBeUndefined();
  });

  test('onAlreadyExists "throw": a permission-denied rejection throws an "already exists" error', async () => {
    (mockSet as jest.Mock).mockRejectedValue(
      Object.assign(new Error('permission denied'), { code: 'database/permission-denied' }),
    );
    await expect(writeTripOnce('trip-a', {}, 'throw')).rejects.toThrow(/already exists/);
  });

  test('a genuinely different error is never swallowed, regardless of onAlreadyExists', async () => {
    (mockSet as jest.Mock).mockRejectedValue(
      Object.assign(new Error('network hiccup'), { code: 'database/network-error' }),
    );
    await expect(writeTripOnce('trip-a', {}, 'continue')).rejects.toThrow('network hiccup');
    await expect(writeTripOnce('trip-a', {}, 'throw')).rejects.toThrow('network hiccup');
  });
});
