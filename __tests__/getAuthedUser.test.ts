const mockListeners: Array<(u: unknown) => void> = [];
let mockCurrentUser: { uid: string } | null = null;
const mockUnsub = jest.fn();

jest.mock('@react-native-firebase/auth', () => {
  const authFn = () => ({
    get currentUser() { return mockCurrentUser; },
    onAuthStateChanged: (cb: (u: unknown) => void) => { mockListeners.push(cb); return mockUnsub; },
    signInAnonymously: jest.fn(),
  });
  return { __esModule: true, default: authFn };
});
jest.mock('@react-native-firebase/database');
jest.mock('@react-native-firebase/firestore');

import { getAuthedUser } from '@/src/lib/firebase';

function emit(u: { uid: string } | null) {
  mockCurrentUser = u;
  mockListeners.forEach(cb => cb(u));
}

beforeEach(() => {
  mockListeners.length = 0;
  mockCurrentUser = null;
  mockUnsub.mockClear();
});

describe('getAuthedUser', () => {
  it('resolves immediately when a user is already signed in', async () => {
    mockCurrentUser = { uid: 'already-here' };
    await expect(getAuthedUser()).resolves.toEqual({ uid: 'already-here' });
    expect(mockListeners).toHaveLength(0);
  });

  it('waits for the next authenticated user when there is none', async () => {
    const p = getAuthedUser();
    expect(mockListeners).toHaveLength(1);
    emit({ uid: 'arrived' });
    await expect(p).resolves.toEqual({ uid: 'arrived' });
    expect(mockUnsub).toHaveBeenCalled();
  });

  it('shares one listener between concurrent callers', async () => {
    const a = getAuthedUser();
    const b = getAuthedUser();
    expect(mockListeners).toHaveLength(1);
    emit({ uid: 'shared' });
    await expect(Promise.all([a, b])).resolves.toEqual([{ uid: 'shared' }, { uid: 'shared' }]);
  });

  // The bug this whole change exists to fix: the old fire-once promise held the
  // pre-sign-out user forever.
  it('re-arms after sign-out and resolves the new user', async () => {
    const first = getAuthedUser();
    emit({ uid: 'user-one' });
    await first;

    emit(null); // sign-out

    const second = getAuthedUser();
    expect(mockListeners).toHaveLength(2);
    emit({ uid: 'user-two' });
    await expect(second).resolves.toEqual({ uid: 'user-two' });
  });

  it('ignores null emissions while waiting', async () => {
    const p = getAuthedUser();
    emit(null);
    expect(mockUnsub).not.toHaveBeenCalled();
    emit({ uid: 'eventually' });
    await expect(p).resolves.toEqual({ uid: 'eventually' });
  });
});
