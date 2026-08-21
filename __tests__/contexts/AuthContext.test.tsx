const mockListeners: Array<(u: unknown) => void> = [];
let mockCurrentUser: Record<string, unknown> | null = null;
const mockLink = jest.fn();
const mockSignInWithCredential = jest.fn();
const mockSignInAnonymously = jest.fn();
const mockRequestApple = jest.fn();
const mockEnsureAnon = jest.fn().mockResolvedValue(undefined);
const mockWriteLinked = jest.fn();
const mockDeleteAccountData = jest.fn();
const mockOnceTripSnap = jest.fn();
const mockDatabaseRef = jest.fn(() => ({ once: mockOnceTripSnap }));
const mockDatabaseFn = jest.fn(() => ({ ref: mockDatabaseRef }));

jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  default: () => ({
    get currentUser() { return mockCurrentUser; },
    onAuthStateChanged: (cb: (u: unknown) => void) => { mockListeners.push(cb); return jest.fn(); },
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

beforeEach(() => {
  jest.clearAllMocks();
  mockListeners.length = 0;
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
});
