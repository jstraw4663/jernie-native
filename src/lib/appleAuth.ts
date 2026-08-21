import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';

export interface AppleCredentialResult {
  credential: FirebaseAuthTypes.AuthCredential;
  displayName: string | null;
  email: string | null;
}

const NONCE_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._';

function randomNonce(length = 32): string {
  const bytes = Crypto.getRandomBytes(length);
  return Array.from(bytes).map(b => NONCE_CHARSET[b % NONCE_CHARSET.length]).join('');
}

/**
 * Apple gets the SHA-256 *hash* of the nonce; Firebase gets the *raw* one and hashes it
 * itself to compare against the token's claim. Swapping them fails only at runtime, with
 * an opaque credential error — hence the dedicated test.
 */
export async function requestAppleCredential(): Promise<AppleCredentialResult> {
  // Guards a simulator or an unsupported OS version with a clear message — without this,
  // signInAsync() below fails with an opaque, unhelpful generic error string.
  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) {
    throw new Error('Sign in with Apple is not available on this device.');
  }

  const rawNonce = randomNonce();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  const result = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
    nonce: hashedNonce,
  });

  if (!result.identityToken) {
    throw new Error('Apple returned no identity token');
  }

  // Populated only on the very first authorization for this Apple ID; null forever after.
  const name = result.fullName;
  const displayName = name
    ? [name.givenName, name.familyName].filter(Boolean).join(' ') || null
    : null;

  return {
    credential: auth.AppleAuthProvider.credential(result.identityToken, rawNonce),
    displayName,
    email: result.email ?? null,
  };
}

export function isAppleCancellation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'ERR_REQUEST_CANCELED';
}
