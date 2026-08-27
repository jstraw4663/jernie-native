jest.mock('@react-native-firebase/database');
jest.mock('@/src/lib/firebase', () => ({
  getAuthedUser: () => Promise.resolve({ uid: 'test-uid' }),
  database: require('@react-native-firebase/database').default,
}));

import { renderHook, waitFor } from '@testing-library/react-native';
import { mockRef, mockOnce } from '@react-native-firebase/database';
import { useUserProfile } from '@/src/hooks/useUserProfile';

beforeEach(() => { jest.clearAllMocks(); });

describe('useUserProfile', () => {
  it('reads the caller own record and exposes displayName, email and plan', async () => {
    mockOnce.mockResolvedValueOnce({ val: () => ({
      displayName: 'Ada', email: 'a@b.c', plan: 'free', preferredMapsApp: 'google',
    }) });
    const { result } = renderHook(() => useUserProfile('uid-1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(mockRef).toHaveBeenCalledWith('users/uid-1');
    expect(result.current).toMatchObject({
      displayName: 'Ada', email: 'a@b.c', plan: 'free', preferredMapsApp: 'google',
    });
  });

  it('resolves to empty for a null uid without touching the database', async () => {
    const { result } = renderHook(() => useUserProfile(null));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(mockRef).not.toHaveBeenCalled();
    expect(result.current.displayName).toBeNull();
  });

  it('treats a record with no fields yet as ready, not as an error', async () => {
    // ensureAnonProfile stamps plan on first launch, but a uid can be read in the window
    // before that write lands. Empty is a real state, not a failure.
    mockOnce.mockResolvedValueOnce({ val: () => null });
    const { result } = renderHook(() => useUserProfile('uid-1'));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.plan).toBeUndefined();
  });

  it('reports error without throwing when the read fails', async () => {
    // The You card falls back to the member handle and a Guest badge — a failed profile read
    // must never take the whole Profile tab down.
    mockOnce.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useUserProfile('uid-1'));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.displayName).toBeNull();
  });
});
