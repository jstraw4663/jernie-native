const mockArchive = jest.fn();
jest.mock('@react-native-firebase/database');
jest.mock('@/src/lib/firebase', () => ({
  getAuthedUser: () => Promise.resolve({ uid: 'test-uid' }),
  database: require('@react-native-firebase/database').default,
}));
jest.mock('@/src/lib/tripWrites', () => ({ archiveTrip: (...a: unknown[]) => mockArchive(...a) }));

import { mockRef, mockRemove } from '@react-native-firebase/database';
import { deleteAccountData } from '@/src/lib/deleteAccount';

beforeEach(() => { jest.clearAllMocks(); mockArchive.mockResolvedValue(undefined); });

describe('deleteAccountData', () => {
  it('archives every owned trip before removing the user record', async () => {
    const order: string[] = [];
    mockArchive.mockImplementation(async (id: string) => { order.push(`archive:${id}`); });
    (mockRemove as jest.Mock).mockImplementation(async () => { order.push('remove-user'); });

    await deleteAccountData('uid-1', ['trip-a', 'trip-b']);

    expect(order).toEqual(['archive:trip-a', 'archive:trip-b', 'remove-user']);
    expect(mockRef).toHaveBeenCalledWith('users/uid-1');
  });

  it('removes the user record when no trips are owned', async () => {
    await deleteAccountData('uid-1', []);
    expect(mockArchive).not.toHaveBeenCalled();
    expect(mockRemove).toHaveBeenCalled();
  });

  // Nothing is removed if archiving fails — the user stays intact and can retry.
  it('propagates an archive failure without removing the user record', async () => {
    mockArchive.mockRejectedValueOnce(new Error('permission denied'));
    await expect(deleteAccountData('uid-1', ['trip-a'])).rejects.toThrow('permission denied');
    expect(mockRemove).not.toHaveBeenCalled();
  });
});
