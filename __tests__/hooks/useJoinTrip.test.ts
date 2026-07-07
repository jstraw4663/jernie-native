jest.mock('@react-native-firebase/database');
jest.mock('@/src/lib/firebase', () => ({
  authReady: Promise.resolve({ uid: 'test-uid' }),
  auth: jest.fn(() => ({ currentUser: { uid: 'test-uid', displayName: 'Test User' } })),
  database: require('@react-native-firebase/database').default,
}));

import { renderHook, act } from '@testing-library/react-native';
import { useJoinTrip } from '@/src/hooks/useJoinTrip';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { mockRef, mockOnce, mockSet, mockUpdate } = jest.requireMock('@react-native-firebase/database');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { auth: mockAuth } = jest.requireMock('@/src/lib/firebase');

beforeEach(() => {
  jest.clearAllMocks();
  (mockAuth as jest.Mock).mockReturnValue({ currentUser: { uid: 'test-uid', displayName: 'Test User' } });
});

describe('useJoinTrip', () => {
  test('idle status initially, no error', () => {
    const { result } = renderHook(() => useJoinTrip());
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBeNull();
  });

  test('successful join resolves invite token, then writes joinProofs BEFORE the bundled members/user-index update', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({ val: () => 'trip-xyz' });
    (mockUpdate as jest.Mock).mockResolvedValue(undefined);

    // Hold step 1's set() pending so we can prove step 2's update() only fires after
    // step 1 actually RESOLVES — not merely after it's been called. invocationCallOrder alone
    // can't distinguish "awaited to completion" from "fired without awaiting" (a regression
    // back to the exact bundled-write bug this two-step protocol exists to prevent), since an
    // unawaited set() followed synchronously by update() would still record set() first.
    let resolveSet!: () => void;
    (mockSet as jest.Mock).mockReturnValue(new Promise<void>(res => { resolveSet = res; }));

    const { result } = renderHook(() => useJoinTrip());

    let joinPromise!: Promise<{ tripId: string }>;
    act(() => { joinPromise = result.current.joinTrip('tok-123'); });

    // Let the invite-token lookup and step 1's set() call happen, but keep set() unresolved.
    // A macrotask flush (rather than counting a fixed number of microtask ticks) fully drains
    // the microtask queue regardless of how many `await`s precede this point, so this reliably
    // proves the assertion below — even against a regressed implementation that fires update()
    // as an unawaited microtask right after calling set().
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });

    expect(mockSet).toHaveBeenCalledWith('tok-123');
    // LOAD-BEARING: while step 1's write is still pending, step 2 must not have started.
    expect(mockUpdate).not.toHaveBeenCalled();

    // Now resolve step 1 — only then should step 2 fire.
    await act(async () => {
      resolveSet();
      await joinPromise;
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('success');
    expect(result.current.error).toBeNull();
    await expect(joinPromise).resolves.toEqual({ tripId: 'trip-xyz' });

    // Invite token lookup
    expect(mockRef).toHaveBeenCalledWith('inviteTokens/tok-123');

    // Step 1: standalone .set() on joinProofs
    expect(mockRef).toHaveBeenCalledWith('trips/trip-xyz/joinProofs/test-uid');

    // Step 2: bundled .update() with exactly the two prescribed paths
    const updateArg = (mockUpdate as jest.Mock).mock.calls[0][0];
    expect(Object.keys(updateArg).sort()).toEqual([
      'trips/trip-xyz/members/test-uid',
      'users/test-uid/trips/trip-xyz',
    ]);
    expect(updateArg['trips/trip-xyz/members/test-uid']).toEqual(
      expect.objectContaining({ uid: 'test-uid', role: 'traveler' }),
    );
    expect(updateArg['users/test-uid/trips/trip-xyz']).toEqual(
      expect.objectContaining({ role: 'traveler' }),
    );
    // Both paths must carry the identical joinedAt value
    expect(updateArg['trips/trip-xyz/members/test-uid'].joinedAt).toBe(
      updateArg['users/test-uid/trips/trip-xyz'].joinedAt,
    );
  });

  test('handle uses auth displayName when present', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({ val: () => 'trip-xyz' });
    (mockSet as jest.Mock).mockResolvedValue(undefined);
    (mockUpdate as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useJoinTrip());
    await act(async () => { await result.current.joinTrip('tok-123'); });

    const updateArg = (mockUpdate as jest.Mock).mock.calls[0][0];
    expect(updateArg['trips/trip-xyz/members/test-uid'].handle).toBe('Test User');
  });

  test("handle falls back to 'Traveler' when displayName is unavailable", async () => {
    (mockAuth as jest.Mock).mockReturnValue({ currentUser: { uid: 'test-uid', displayName: null } });
    (mockOnce as jest.Mock).mockResolvedValue({ val: () => 'trip-xyz' });
    (mockSet as jest.Mock).mockResolvedValue(undefined);
    (mockUpdate as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useJoinTrip());
    await act(async () => { await result.current.joinTrip('tok-123'); });

    const updateArg = (mockUpdate as jest.Mock).mock.calls[0][0];
    expect(updateArg['trips/trip-xyz/members/test-uid'].handle).toBe('Traveler');
  });

  test('token-not-found rejects before attempting any write', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({ val: () => null });
    const { result } = renderHook(() => useJoinTrip());

    await act(async () => {
      await expect(result.current.joinTrip('bad-token')).rejects.toThrow();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBeInstanceOf(Error);
    expect(mockSet).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test('a step-2 rejection surfaces as status: error without the hook silently retrying', async () => {
    (mockOnce as jest.Mock).mockResolvedValue({ val: () => 'trip-xyz' });
    (mockSet as jest.Mock).mockResolvedValue(undefined);
    (mockUpdate as jest.Mock).mockRejectedValue(new Error('wrong token'));

    const { result } = renderHook(() => useJoinTrip());
    await act(async () => {
      await expect(result.current.joinTrip('tok-123')).rejects.toThrow('wrong token');
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error?.message).toBe('wrong token');
    expect(mockSet).toHaveBeenCalledTimes(1);     // step 1 attempted exactly once
    expect(mockUpdate).toHaveBeenCalledTimes(1);  // step 2 attempted exactly once — no auto-retry
  });

  test('status is "joining" while the invite-token lookup is in flight', async () => {
    let resolveOnce!: (v: { val: () => unknown }) => void;
    (mockOnce as jest.Mock).mockReturnValue(new Promise(res => { resolveOnce = res; }));
    const { result } = renderHook(() => useJoinTrip());

    let joinPromise!: Promise<{ tripId: string }>;
    act(() => { joinPromise = result.current.joinTrip('tok-123'); });
    expect(result.current.status).toBe('joining');

    (mockSet as jest.Mock).mockResolvedValue(undefined);
    (mockUpdate as jest.Mock).mockResolvedValue(undefined);
    await act(async () => {
      resolveOnce({ val: () => 'trip-xyz' });
      await joinPromise;
    });
    expect(result.current.status).toBe('success');
  });
});
