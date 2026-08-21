const mockListeners: Array<(u: unknown) => void> = [];
const mockUserChangedListeners: Array<(u: unknown) => void> = [];
let mockCurrentUser: Record<string, unknown> | null = null;
const mockLink = jest.fn();
const mockSignInWithCredential = jest.fn();
const mockSignInAnonymously = jest.fn();
const mockRequestApple = jest.fn();
const mockEnsureAnon = jest.fn().mockResolvedValue(undefined);
const mockWriteLinked = jest.fn();
const mockDeleteAccountData = jest.fn();
const mockMigrateStaged = jest.fn().mockResolvedValue({ created: [], failed: 0 });
const mockOnceTripSnap = jest.fn();
const mockDatabaseRef = jest.fn(() => ({ once: mockOnceTripSnap }));
const mockDatabaseFn = jest.fn(() => ({ ref: mockDatabaseRef }));

jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  default: () => ({
    get currentUser() { return mockCurrentUser; },
    onAuthStateChanged: (cb: (u: unknown) => void) => { mockListeners.push(cb); return jest.fn(); },
    onUserChanged: (cb: (u: unknown) => void) => { mockUserChangedListeners.push(cb); return jest.fn(); },
    signInAnonymously: (...a: unknown[]) => mockSignInAnonymously(...a),
    signInWithCredential: (...a: unknown[]) => mockSignInWithCredential(...a),
    signOut: jest.fn().mockResolvedValue(undefined),
  }),
}));
jest.mock('@/src/lib/firebase', () => ({
  initAuth: jest.fn().mockResolvedValue({ uid: 'anon-uid', isAnonymous: true }),
  getAuthedUser: () => Promise.resolve(mockCurrentUser),
  auth: require('@react-native-firebase/auth').default,
  database: () => mockDatabaseFn(),
}));
jest.mock('@/src/lib/appleAuth', () => ({
  requestAppleCredential: (...a: unknown[]) => mockRequestApple(...a),
  isAppleCancellation: (e: { code?: string }) => e?.code === 'ERR_REQUEST_CANCELED',
}));
jest.mock('@/src/lib/userProfile', () => ({
  ensureAnonProfile: (...a: unknown[]) => mockEnsureAnon(...a),
  writeLinkedProfile: (...a: unknown[]) => mockWriteLinked(...a),
  readAnonCreatedAt: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/src/lib/deleteAccount', () => ({
  deleteAccountData: (...a: unknown[]) => mockDeleteAccountData(...a),
}));
jest.mock('@/src/lib/tripMigration', () => ({
  migrateStagedTrips: (...a: unknown[]) => mockMigrateStaged(...a),
}));

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import { AuthProvider, useAuth } from '@/src/contexts/AuthContext';

let captured: ReturnType<typeof useAuth>;
function Probe() {
  captured = useAuth();
  return <Text>{captured.status}</Text>;
}

function render() {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<AuthProvider><Probe /></AuthProvider>); });
  return tree;
}

function emit(u: Record<string, unknown> | null) {
  mockCurrentUser = u;
  act(() => { mockListeners.forEach(cb => cb(u)); });
}

// Simulates linkWithCredential (and unlink/profile-update): RNFB reports these only through
// onUserChanged, never onAuthStateChanged, because the uid itself does not change.
function emitUserChanged(u: Record<string, unknown> | null) {
  mockCurrentUser = u;
  act(() => { mockUserChangedListeners.forEach(cb => cb(u)); });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockListeners.length = 0;
  mockUserChangedListeners.length = 0;
  mockCurrentUser = null;
  mockLink.mockReset();
});

describe('AuthContext status', () => {
  it('starts loading before any auth state arrives', () => {
    render();
    expect(captured.status).toBe('loading');
  });

  it('reports anonymous for an anonymous user', () => {
    render();
    emit({ uid: 'anon-uid', isAnonymous: true, linkWithCredential: mockLink });
    expect(captured.status).toBe('anonymous');
  });

  it('reports authenticated once linked', () => {
    render();
    emit({ uid: 'anon-uid', isAnonymous: false, linkWithCredential: mockLink });
    expect(captured.status).toBe('authenticated');
  });

  it('stamps the anonymous profile when an anonymous user appears', async () => {
    render();
    emit({ uid: 'anon-uid', isAnonymous: true, linkWithCredential: mockLink });
    await act(async () => {});
    expect(mockEnsureAnon).toHaveBeenCalledWith('anon-uid', expect.any(Number));
  });

  // linkWithCredential preserves the uid, so RNFB reports it only via onUserChanged —
  // onAuthStateChanged stays silent. Without a subscription to onUserChanged, status would
  // be stuck on 'anonymous' for the rest of the session after a successful link.
  it('flips to authenticated on a user-changed emission, even though onAuthStateChanged never fires', () => {
    render();
    emit({ uid: 'anon-uid', isAnonymous: true, linkWithCredential: mockLink });
    expect(captured.status).toBe('anonymous');

    emitUserChanged({ uid: 'anon-uid', isAnonymous: false, linkWithCredential: mockLink });
    expect(captured.status).toBe('authenticated');
  });
});

describe('signInWithApple', () => {
  beforeEach(() => {
    mockRequestApple.mockResolvedValue({
      credential: { providerId: 'apple.com' }, displayName: 'Ada', email: 'ada@example.com',
    });
    mockWriteLinked.mockReset().mockResolvedValue(undefined);
  });

  it('links the credential onto the anonymous uid, preserving it', async () => {
    render();
    const user = { uid: 'anon-uid', isAnonymous: true, linkWithCredential: mockLink };
    emit(user);
    mockLink.mockResolvedValue({ user: { uid: 'anon-uid', isAnonymous: false } });

    let outcome!: Awaited<ReturnType<typeof captured.signInWithApple>>;
    await act(async () => { outcome = await captured.signInWithApple(); });

    expect(mockLink).toHaveBeenCalledWith({ providerId: 'apple.com' });
    expect(outcome).toEqual({ ok: true, user: { uid: 'anon-uid', isAnonymous: false } });
    expect(mockWriteLinked).toHaveBeenCalledWith('anon-uid', {
      displayName: 'Ada', email: 'ada@example.com', now: expect.any(Number),
    });
  });

  it('still reports success when the profile write fails after the credential link resolves', async () => {
    render();
    emit({ uid: 'anon-uid', isAnonymous: true, linkWithCredential: mockLink });
    mockLink.mockResolvedValue({ user: { uid: 'anon-uid', isAnonymous: false } });
    mockWriteLinked.mockRejectedValue(new Error('profile write failed'));

    let outcome!: Awaited<ReturnType<typeof captured.signInWithApple>>;
    await act(async () => { outcome = await captured.signInWithApple(); });

    expect(outcome).toEqual({ ok: true, user: { uid: 'anon-uid', isAnonymous: false } });
  });

  it('returns a collision outcome carrying a signIn escape hatch', async () => {
    render();
    emit({ uid: 'anon-uid', isAnonymous: true, linkWithCredential: mockLink });
    mockLink.mockRejectedValue({ code: 'auth/credential-already-in-use' });

    let outcome!: Awaited<ReturnType<typeof captured.signInWithApple>>;
    await act(async () => { outcome = await captured.signInWithApple(); });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).toBe('credential-already-in-use');
      if (outcome.reason === 'credential-already-in-use') {
        await act(async () => { await outcome.signIn(); });
        expect(mockSignInWithCredential).toHaveBeenCalledWith({ providerId: 'apple.com' });
      }
    }
  });

  // An Apple identity token is single-use: linkWithCredential consumes it, so replaying the
  // same credential fails auth/invalid-credential. Firebase attaches a usable replacement to
  // the error for exactly this recovery — RNFB's iOS module reads
  // FIRAuthErrorUserInfoUpdatedCredentialKey and surfaces it as userInfo.authCredential
  // (RNFBAuthModule.m), and signInWithCredential resolves the token hash back to the live
  // native credential.
  it('signs in with the replacement credential Firebase attaches to the collision error', async () => {
    render();
    emit({ uid: 'anon-uid', isAnonymous: true, linkWithCredential: mockLink });
    mockLink.mockRejectedValue({
      code: 'auth/credential-already-in-use',
      userInfo: { authCredential: { providerId: 'apple.com', token: 'replacement' } },
    });

    let outcome!: Awaited<ReturnType<typeof captured.signInWithApple>>;
    await act(async () => { outcome = await captured.signInWithApple(); });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok && outcome.reason === 'credential-already-in-use') {
      mockRequestApple.mockClear();
      await act(async () => { await outcome.signIn(); });
      expect(mockSignInWithCredential).toHaveBeenCalledWith({
        providerId: 'apple.com', token: 'replacement',
      });
      // The replacement is usable as-is; a second trip to the Apple sheet would be a
      // gratuitous second Face ID prompt.
      expect(mockRequestApple).not.toHaveBeenCalled();
    }
  });

  // Android does not always populate the updated-credential key. Without a replacement the
  // only way through is a fresh authorization — the spent one cannot be retried.
  it('requests a fresh Apple credential when the collision error carries no replacement', async () => {
    render();
    emit({ uid: 'anon-uid', isAnonymous: true, linkWithCredential: mockLink });
    mockLink.mockRejectedValue({
      code: 'auth/credential-already-in-use',
      userInfo: { authCredential: null },
    });

    let outcome!: Awaited<ReturnType<typeof captured.signInWithApple>>;
    await act(async () => { outcome = await captured.signInWithApple(); });

    expect(outcome.ok).toBe(false);
    if (!outcome.ok && outcome.reason === 'credential-already-in-use') {
      mockRequestApple.mockClear();
      mockRequestApple.mockResolvedValue({
        credential: { providerId: 'apple.com', token: 'fresh' }, displayName: null, email: null,
      });
      await act(async () => { await outcome.signIn(); });
      expect(mockRequestApple).toHaveBeenCalled();
      expect(mockSignInWithCredential).toHaveBeenCalledWith({
        providerId: 'apple.com', token: 'fresh',
      });
    }
  });

  it('reports cancellation without treating it as an error', async () => {
    render();
    emit({ uid: 'anon-uid', isAnonymous: true, linkWithCredential: mockLink });
    mockRequestApple.mockRejectedValueOnce({ code: 'ERR_REQUEST_CANCELED' });

    let outcome!: Awaited<ReturnType<typeof captured.signInWithApple>>;
    await act(async () => { outcome = await captured.signInWithApple(); });
    expect(outcome).toEqual({ ok: false, reason: 'cancelled' });
    expect(mockWriteLinked).not.toHaveBeenCalled();
  });

  it('reports an unexpected failure with its message', async () => {
    render();
    emit({ uid: 'anon-uid', isAnonymous: true, linkWithCredential: mockLink });
    mockLink.mockRejectedValue(new Error('network down'));

    let outcome!: Awaited<ReturnType<typeof captured.signInWithApple>>;
    await act(async () => { outcome = await captured.signInWithApple(); });
    expect(outcome).toEqual({ ok: false, reason: 'error', message: 'network down' });
  });
});

// A collision sign-in stages the anonymous uid's trips before abandoning it, and that
// payload is the only remaining copy. Retrying the moment a real account appears means an
// interrupted copy lands without the user having to do anything.
describe('staged trip migration', () => {
  it('resumes a staged copy as soon as a non-anonymous user appears', () => {
    render();
    emit({ uid: 'account-uid', isAnonymous: false, linkWithCredential: mockLink });
    expect(mockMigrateStaged).toHaveBeenCalled();
  });

  it('does not attempt a resume for an anonymous user', () => {
    render();
    emit({ uid: 'anon-uid', isAnonymous: true, linkWithCredential: mockLink });
    expect(mockMigrateStaged).not.toHaveBeenCalled();
  });

  // Both listeners fire for the same uid, and onUserChanged fires again on every profile
  // write — running the copy twice would duplicate the trip.
  it('runs at most once per uid across repeated emissions from both listeners', () => {
    render();
    const user = { uid: 'account-uid', isAnonymous: false, linkWithCredential: mockLink };
    emit(user);
    emitUserChanged(user);
    emit(user);
    expect(mockMigrateStaged).toHaveBeenCalledTimes(1);
  });

  it('runs again for a different account', () => {
    render();
    emit({ uid: 'account-a', isAnonymous: false, linkWithCredential: mockLink });
    emit({ uid: 'account-b', isAnonymous: false, linkWithCredential: mockLink });
    expect(mockMigrateStaged).toHaveBeenCalledTimes(2);
  });

  it('swallows a resume failure rather than breaking auth state', () => {
    mockMigrateStaged.mockRejectedValueOnce(new Error('offline'));
    render();
    emit({ uid: 'account-uid', isAnonymous: false, linkWithCredential: mockLink });
    expect(captured.status).toBe('authenticated');
  });
});

describe('signOut', () => {
  // The app cannot run unauthenticated — every RTDB rule requires auth != null.
  it('signs back in anonymously so the app stays usable', async () => {
    render();
    emit({ uid: 'linked-uid', isAnonymous: false, linkWithCredential: mockLink });
    await act(async () => { await captured.signOut(); });
    expect(mockSignInAnonymously).toHaveBeenCalled();
  });
});

describe('deleteAccount', () => {
  beforeEach(() => {
    mockDeleteAccountData.mockResolvedValue(undefined);
    mockDatabaseRef.mockClear();
    mockOnceTripSnap.mockClear();
    mockRequestApple.mockClear();
    mockSignInAnonymously.mockClear();
  });

  it('re-authenticates an already-linked user when delete() requires recent login', async () => {
    render();
    const mockReauth = jest.fn().mockResolvedValue(undefined);
    const mockDelete = jest.fn()
      .mockRejectedValueOnce({ code: 'auth/requires-recent-login' })
      .mockResolvedValueOnce(undefined);
    const user = { uid: 'linked-uid', isAnonymous: false, linkWithCredential: mockLink, delete: mockDelete, reauthenticateWithCredential: mockReauth };
    emit(user);
    mockOnceTripSnap.mockResolvedValue({ exists: () => false });
    mockRequestApple.mockResolvedValue({ credential: { providerId: 'apple.com' }, displayName: 'Ada', email: 'ada@example.com' });

    await act(async () => { await captured.deleteAccount(); });

    expect(mockDeleteAccountData).toHaveBeenCalledWith('linked-uid', []);
    expect(mockDelete).toHaveBeenCalledTimes(2);
    expect(mockReauth).toHaveBeenCalledWith({ providerId: 'apple.com' });
    expect(mockLink).not.toHaveBeenCalled(); // linkWithCredential should NOT be called
    expect(mockSignInAnonymously).toHaveBeenCalled();
  });

  // users/{uid}/trips holds BOTH owned (organizer) and joined (traveler) entries. A joined
  // trip's deletedAt is owner-only per database.rules.json, so passing it to
  // deleteAccountData would throw PERMISSION_DENIED and abort deletion for anyone who ever
  // accepted an invite.
  it('passes only owned (organizer) trip ids to deleteAccountData, filtering out joined (traveler) trips', async () => {
    render();
    const mockDelete = jest.fn().mockResolvedValue(undefined);
    const user = { uid: 'linked-uid', isAnonymous: false, linkWithCredential: mockLink, delete: mockDelete };
    emit(user);
    mockOnceTripSnap.mockResolvedValue({
      exists: () => true,
      val: () => ({
        'trip-owned': { role: 'organizer', joinedAt: 1000 },
        'trip-joined': { role: 'traveler', joinedAt: 2000 },
      }),
    });

    await act(async () => { await captured.deleteAccount(); });

    expect(mockDeleteAccountData).toHaveBeenCalledWith('linked-uid', ['trip-owned']);
  });

  it('wraps a reauthenticateWithCredential failure instead of surfacing the raw Firebase code', async () => {
    render();
    const mockReauth = jest.fn().mockRejectedValue({ code: 'auth/user-mismatch' });
    const mockDelete = jest.fn().mockRejectedValueOnce({ code: 'auth/requires-recent-login' });
    const user = { uid: 'linked-uid', isAnonymous: false, linkWithCredential: mockLink, delete: mockDelete, reauthenticateWithCredential: mockReauth };
    emit(user);
    mockOnceTripSnap.mockResolvedValue({ exists: () => false });
    mockRequestApple.mockResolvedValue({ credential: { providerId: 'apple.com' }, displayName: 'Ada', email: 'ada@example.com' });

    let error: unknown;
    await act(async () => {
      try { await captured.deleteAccount(); } catch (e) { error = e; }
    });

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toContain('auth/user-mismatch');
    expect(mockSignInAnonymously).not.toHaveBeenCalled();
  });
});
