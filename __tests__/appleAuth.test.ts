const mockSignInAsync = jest.fn();
const mockDigest = jest.fn();
const mockAppleCredential = jest.fn();

jest.mock('expo-apple-authentication', () => ({
  signInAsync: (...a: unknown[]) => mockSignInAsync(...a),
  AppleAuthenticationScope: { FULL_NAME: 'FULL_NAME', EMAIL: 'EMAIL' },
}));
jest.mock('expo-crypto', () => ({
  digestStringAsync: (...a: unknown[]) => mockDigest(...a),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  getRandomBytes: (n: number) => new Uint8Array(n).fill(7),
}));
jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  default: Object.assign(() => ({}), {
    AppleAuthProvider: { credential: (...a: unknown[]) => mockAppleCredential(...a) },
  }),
}));

import { requestAppleCredential, isAppleCancellation } from '@/src/lib/appleAuth';

beforeEach(() => {
  jest.clearAllMocks();
  mockDigest.mockResolvedValue('HASHED_NONCE');
  mockAppleCredential.mockReturnValue({ providerId: 'apple.com' });
  mockSignInAsync.mockResolvedValue({
    identityToken: 'token-abc',
    email: 'ada@example.com',
    fullName: { givenName: 'Ada', familyName: 'Lovelace' },
  });
});

describe('requestAppleCredential', () => {
  // The single most common Apple/Firebase bug: these two must not be swapped.
  it('sends the HASHED nonce to Apple and the RAW nonce to Firebase', async () => {
    await requestAppleCredential();
    const rawNonce = mockDigest.mock.calls[0][1];
    expect(mockSignInAsync).toHaveBeenCalledWith(expect.objectContaining({ nonce: 'HASHED_NONCE' }));
    expect(mockAppleCredential).toHaveBeenCalledWith('token-abc', rawNonce);
    expect(rawNonce).not.toBe('HASHED_NONCE');
  });

  it('requests both name and email scopes', async () => {
    await requestAppleCredential();
    expect(mockSignInAsync).toHaveBeenCalledWith(
      expect.objectContaining({ requestedScopes: ['FULL_NAME', 'EMAIL'] }),
    );
  });

  it('joins the Apple name parts into a display name', async () => {
    const r = await requestAppleCredential();
    expect(r.displayName).toBe('Ada Lovelace');
    expect(r.email).toBe('ada@example.com');
  });

  it('returns nulls when Apple withholds identity on a repeat sign-in', async () => {
    mockSignInAsync.mockResolvedValueOnce({ identityToken: 'token-abc', email: null, fullName: null });
    const r = await requestAppleCredential();
    expect(r.displayName).toBeNull();
    expect(r.email).toBeNull();
  });

  it('handles a partial name', async () => {
    mockSignInAsync.mockResolvedValueOnce({
      identityToken: 'token-abc', email: null, fullName: { givenName: 'Ada', familyName: null },
    });
    await expect(requestAppleCredential()).resolves.toMatchObject({ displayName: 'Ada' });
  });

  it('throws when Apple returns no identity token', async () => {
    mockSignInAsync.mockResolvedValueOnce({ identityToken: null, email: null, fullName: null });
    await expect(requestAppleCredential()).rejects.toThrow('identity token');
  });
});

describe('isAppleCancellation', () => {
  it('recognises the cancellation code', () => {
    expect(isAppleCancellation({ code: 'ERR_REQUEST_CANCELED' })).toBe(true);
  });
  it('rejects other errors', () => {
    expect(isAppleCancellation({ code: 'ERR_OTHER' })).toBe(false);
    expect(isAppleCancellation(new Error('boom'))).toBe(false);
    expect(isAppleCancellation(null)).toBe(false);
  });
});
