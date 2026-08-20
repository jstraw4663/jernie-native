jest.mock('@react-native-firebase/database');
jest.mock('@/src/lib/firebase', () => ({
  getAuthedUser: () => Promise.resolve({ uid: 'test-uid' }),
  database: require('@react-native-firebase/database').default,
}));

import { mockRef, mockUpdate } from '@react-native-firebase/database';
import { updateTrip, archiveTrip, restoreTrip } from '@/src/lib/tripWrites';

beforeEach(() => { jest.clearAllMocks(); });

describe('updateTrip', () => {
  it('updates only the patched fields on the trip node', async () => {
    await updateTrip('trip-1', { name: 'Maine 2026' });
    expect(mockRef).toHaveBeenCalledWith('trips/trip-1');
    expect(mockUpdate).toHaveBeenCalledWith({ name: 'Maine 2026' });
  });

  it('strips undefined so a blank field never clobbers stored data', async () => {
    await updateTrip('trip-1', { name: 'X', pills: undefined });
    const patch = mockUpdate.mock.calls[0][0];
    expect('pills' in patch).toBe(false);
  });

  it('propagates a write rejection', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('permission denied'));
    await expect(updateTrip('trip-1', { name: 'X' })).rejects.toThrow('permission denied');
  });
});

describe('archiveTrip', () => {
  it('stamps deletedAt with the current time', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    await archiveTrip('trip-1');
    expect(mockRef).toHaveBeenCalledWith('trips/trip-1');
    expect(mockUpdate).toHaveBeenCalledWith({ deletedAt: 1_700_000_000_000 });
  });
});

describe('restoreTrip', () => {
  it('clears deletedAt with null, not undefined', async () => {
    await restoreTrip('trip-1');
    const patch = mockUpdate.mock.calls[0][0];
    expect(patch).toEqual({ deletedAt: null });
    // null is RTDB's delete-a-key signal; undefined would be rejected outright
    expect('deletedAt' in patch).toBe(true);
  });
});
