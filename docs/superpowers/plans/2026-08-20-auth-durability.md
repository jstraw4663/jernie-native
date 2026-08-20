# Phase 1 — Auth Durability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every Jernie account a durable identity — Apple Sign In linked to the existing anonymous UID — so a tester who switches phones keeps their trip.

**Architecture:** `authReady` (a fire-once module promise) becomes `getAuthedUser()`, a function that re-arms after sign-out. A new `AuthContext` owns reactive auth state and exposes `signInWithApple` / `signOut` / `deleteAccount`. Linking uses `linkWithCredential`, which upgrades the anonymous UID in place — no data migration. Skipping sign-in stays fully supported; an escalating, snoozing save nudge and an invite gate push toward linking without ever deleting data.

**Tech Stack:** Expo SDK 52/56, `@react-native-firebase/auth` v24, `expo-apple-authentication`, `expo-crypto`, `react-native-mmkv` v4, Expo Router v4, Jest + `jest-expo`, `react-test-renderer`.

**Spec:** `docs/superpowers/specs/2026-08-20-auth-durability-design.md`

## Global Constraints

- **MMKV v4 API:** `createMMKV({ id: 'name' })`, never `new MMKV()`. Removal is `storage.remove(key)`, never `.delete()`.
- **Nonce direction:** send the **SHA-256 hash** of the nonce to Apple; pass the **raw** nonce to Firebase. Reversing these fails only at runtime.
- **Apple returns `fullName` and `email` only on the first authorization** for a given Apple ID. Never overwrite a stored `displayName`/`email` with a null from a later sign-in.
- **`email` is nullable** — users may hide behind a `privaterelay.appleid.com` relay.
- **Nothing is ever auto-deleted.** No TTL, no expiry job, no scheduled cleanup.
- **Never commit `.env`.** Never commit to `master` directly — this work branches from `dev`.
- `npx jest` must be green before any task is considered complete. Baseline: **72 suites / 697 tests**.
- Existing `tsc` has **8 pre-existing errors** in bottom-sheet prop typing (`scrollEventThrottle`, `restDisplacementThreshold`). Do not fix them here; do not add new ones.

---

### Task 1: Native prerequisites and config

Start this first and let the EAS build bake — **nothing else in this plan is device-testable until it lands.**

**Files:**
- Modify: `app.config.js:33-68`
- Modify: `package.json` (via `expo install`)

**Interfaces:**
- Consumes: nothing.
- Produces: `expo-apple-authentication` and `expo-crypto` importable; `usesAppleSignIn` enabled in the iOS build.

- [ ] **Step 1: Install the native dependencies**

```bash
npx expo install expo-apple-authentication expo-crypto
```

- [ ] **Step 2: Enable Apple Sign In in `app.config.js`**

In the `ios` block (starts line 33), add alongside `bundleIdentifier`:

```js
    ios: {
      bundleIdentifier: "com.jernie.app",
      usesAppleSignIn: true,
      // ...existing keys unchanged
    },
```

Add to the `plugins` array (starts line 55):

```js
    plugins: [
      "expo-apple-authentication",
      // ...existing plugin entries unchanged
    ],
```

- [ ] **Step 3: Verify the config resolves**

Run: `npx expo config --type public | grep -i -A2 "usesAppleSignIn\|apple-authentication"`
Expected: both the plugin entry and `usesAppleSignIn: true` appear.

- [ ] **Step 4: Commit**

```bash
git add app.config.js package.json package-lock.json
git commit -m "chore(auth): add expo-apple-authentication and expo-crypto"
```

- [ ] **Step 5: Hand off the manual prerequisites**

These need Jeremy's accounts and **block device testing**, not implementation. Report them and continue:
1. Enable **Sign In with Apple** on the `com.jernie.app` identifier in the Apple Developer account.
2. Enable the **Apple provider** in the Firebase console for `jernie-native-dev`.
3. Run `eas build --profile development --platform ios`.

---

### Task 2: Replace `authReady` with a re-armable `getAuthedUser()`

**Files:**
- Modify: `src/lib/firebase.ts`
- Modify (call sites): `src/lib/itineraryWrites.ts`, `src/lib/bookingWrites.ts`, `src/lib/tripWrites.ts`, `src/lib/stopWrites.ts`, `src/lib/createTrip.ts`, `src/lib/devSeed.ts`, `src/hooks/useTripData.ts`, `src/hooks/useJoinTrip.ts`, `src/hooks/useAddStop.ts`, `src/hooks/useUserTrips.ts`
- Modify (mocks): the 18 test files that mock `authReady`
- Create: `__tests__/getAuthedUser.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `getAuthedUser(): Promise<FirebaseAuthTypes.User>` exported from `src/lib/firebase.ts`. `authReady` is **removed** — no compatibility alias.

- [ ] **Step 1: Write the failing test**

Create `__tests__/getAuthedUser.test.ts`:

```ts
const listeners: Array<(u: unknown) => void> = [];
let currentUser: { uid: string } | null = null;
const mockUnsub = jest.fn();

jest.mock('@react-native-firebase/auth', () => {
  const authFn = () => ({
    get currentUser() { return currentUser; },
    onAuthStateChanged: (cb: (u: unknown) => void) => { listeners.push(cb); return mockUnsub; },
    signInAnonymously: jest.fn(),
  });
  return { __esModule: true, default: authFn };
});
jest.mock('@react-native-firebase/database');
jest.mock('@react-native-firebase/firestore');

import { getAuthedUser } from '@/src/lib/firebase';

function emit(u: { uid: string } | null) {
  currentUser = u;
  listeners.forEach(cb => cb(u));
}

beforeEach(() => {
  listeners.length = 0;
  currentUser = null;
  mockUnsub.mockClear();
});

describe('getAuthedUser', () => {
  it('resolves immediately when a user is already signed in', async () => {
    currentUser = { uid: 'already-here' };
    await expect(getAuthedUser()).resolves.toEqual({ uid: 'already-here' });
    expect(listeners).toHaveLength(0);
  });

  it('waits for the next authenticated user when there is none', async () => {
    const p = getAuthedUser();
    expect(listeners).toHaveLength(1);
    emit({ uid: 'arrived' });
    await expect(p).resolves.toEqual({ uid: 'arrived' });
    expect(mockUnsub).toHaveBeenCalled();
  });

  it('shares one listener between concurrent callers', async () => {
    const a = getAuthedUser();
    const b = getAuthedUser();
    expect(listeners).toHaveLength(1);
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
    expect(listeners).toHaveLength(2);
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
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx jest __tests__/getAuthedUser.test.ts`
Expected: FAIL — `getAuthedUser is not a function`.

- [ ] **Step 3: Implement `getAuthedUser` and delete `authReady`**

Replace lines 5–14 of `src/lib/firebase.ts`:

```ts
// Resolves the current authenticated user, or waits for the next one. Unlike the
// fire-once promise this replaced, it re-arms after sign-out — `pending` is cleared on
// resolve, so the next call installs a fresh listener rather than handing back a stale user.
let pending: Promise<FirebaseAuthTypes.User> | null = null;

export function getAuthedUser(): Promise<FirebaseAuthTypes.User> {
  const current = auth().currentUser;
  if (current) return Promise.resolve(current);
  if (!pending) {
    pending = new Promise<FirebaseAuthTypes.User>((resolve) => {
      const unsubscribe = auth().onAuthStateChanged((user) => {
        if (user) {
          unsubscribe();
          pending = null;
          resolve(user);
        }
      });
    });
  }
  return pending;
}
```

`initAuth()` and the `auth`/`database`/`firestore` re-exports stay as they are.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest __tests__/getAuthedUser.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Update the 18 call sites**

```bash
grep -rl "authReady" src/ | xargs sed -i \
  -e 's/import { database, authReady }/import { database, getAuthedUser }/' \
  -e 's/import { auth, authReady, database }/import { auth, getAuthedUser, database }/' \
  -e 's/import { database, authReady } from/import { database, getAuthedUser } from/' \
  -e 's/await authReady;/await getAuthedUser();/' \
  -e 's/await authReady\b/await getAuthedUser()/'
grep -rn "authReady" src/ || echo "clean"
```

Expected: `clean`. If any line remains, fix it by hand — `devSeed.ts:16` and `createTrip.ts:35` use the `const user = await ...` form.

- [ ] **Step 6: Update the test mocks**

Every mock of the shape `authReady: Promise.resolve({ uid: 'test-uid' })` becomes a function:

```bash
grep -rl "authReady" __tests__/ | xargs sed -i \
  -e "s/authReady: Promise\.resolve(\(.*\)),/getAuthedUser: () => Promise.resolve(\1),/"
grep -rn "authReady" __tests__/ || echo "clean"
```

Expected: `clean`. Fix any survivor by hand to `getAuthedUser: () => Promise.resolve({ uid: 'test-uid' })`.

- [ ] **Step 7: Run the full suite**

Run: `npx jest`
Expected: PASS — 73 suites / 702 tests (baseline plus this task's new file).

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -c "error"`
Expected: `8` — the pre-existing bottom-sheet errors, no more.

- [ ] **Step 9: Commit**

```bash
git add src/ __tests__/
git commit -m "refactor(auth): replace fire-once authReady with re-armable getAuthedUser

The old module promise resolved once and unsubscribed, so sign-out followed
by sign-in as a different user left every write path holding a stale user.
Sign-out is required by account deletion, so this could not be deferred."
```

---

### Task 3: `users/{uid}` identity record

**Files:**
- Create: `src/lib/userProfile.ts`
- Create: `__tests__/userProfile.test.ts`

**Interfaces:**
- Consumes: `database`, `getAuthedUser` from `src/lib/firebase.ts`.
- Produces:
  - `ensureAnonProfile(uid: string, now: number): Promise<void>`
  - `writeLinkedProfile(uid: string, input: { displayName: string | null; email: string | null; now: number }): Promise<void>`
  - `readAnonCreatedAt(uid: string): Promise<number | null>`

- [ ] **Step 1: Write the failing test**

Create `__tests__/userProfile.test.ts`:

```ts
jest.mock('@react-native-firebase/database');
jest.mock('@/src/lib/firebase', () => ({
  getAuthedUser: () => Promise.resolve({ uid: 'test-uid' }),
  database: require('@react-native-firebase/database').default,
}));

import { mockRef, mockUpdate, mockOnce } from '@react-native-firebase/database';
import { ensureAnonProfile, writeLinkedProfile, readAnonCreatedAt } from '@/src/lib/userProfile';

beforeEach(() => { jest.clearAllMocks(); });

describe('ensureAnonProfile', () => {
  it('stamps anonCreatedAt and plan on a brand new anonymous uid', async () => {
    mockOnce.mockResolvedValueOnce({ exists: () => false, val: () => null });
    await ensureAnonProfile('uid-1', 1_700_000_000_000);
    expect(mockRef).toHaveBeenCalledWith('users/uid-1/anonCreatedAt');
    expect(mockRef).toHaveBeenCalledWith('users/uid-1');
    expect(mockUpdate).toHaveBeenCalledWith({ anonCreatedAt: 1_700_000_000_000, plan: 'anonymous' });
  });

  // Write-once: initAuth runs on every launch, but only the first one should stamp.
  it('does not rewrite anonCreatedAt when it already exists', async () => {
    mockOnce.mockResolvedValueOnce({ exists: () => true, val: () => 1_600_000_000_000 });
    await ensureAnonProfile('uid-1', 1_700_000_000_000);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('writeLinkedProfile', () => {
  it('flips plan to free and stamps linkedAt', async () => {
    await writeLinkedProfile('uid-1', { displayName: 'Ada', email: 'ada@example.com', now: 42 });
    expect(mockRef).toHaveBeenCalledWith('users/uid-1');
    expect(mockUpdate).toHaveBeenCalledWith({
      plan: 'free', linkedAt: 42, displayName: 'Ada', email: 'ada@example.com',
    });
  });

  // Apple returns fullName/email ONLY on first authorization. A later sign-in returns
  // null for both, and must not erase what we stored the first time.
  it('omits displayName and email when Apple withholds them', async () => {
    await writeLinkedProfile('uid-1', { displayName: null, email: null, now: 42 });
    const patch = mockUpdate.mock.calls[0][0];
    expect(patch).toEqual({ plan: 'free', linkedAt: 42 });
    expect('displayName' in patch).toBe(false);
    expect('email' in patch).toBe(false);
  });

  it('writes displayName without email when the user hides their address', async () => {
    await writeLinkedProfile('uid-1', { displayName: 'Ada', email: null, now: 42 });
    expect(mockUpdate).toHaveBeenCalledWith({ plan: 'free', linkedAt: 42, displayName: 'Ada' });
  });
});

describe('readAnonCreatedAt', () => {
  it('returns the stored timestamp', async () => {
    mockOnce.mockResolvedValueOnce({ exists: () => true, val: () => 1_600_000_000_000 });
    await expect(readAnonCreatedAt('uid-1')).resolves.toBe(1_600_000_000_000);
  });

  it('returns null when absent', async () => {
    mockOnce.mockResolvedValueOnce({ exists: () => false, val: () => null });
    await expect(readAnonCreatedAt('uid-1')).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx jest __tests__/userProfile.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/userProfile.ts`:

```ts
import { database } from '@/src/lib/firebase';

/**
 * Stamps the anonymous lifecycle marker exactly once per uid. initAuth() runs on every
 * launch, so this checks before writing — anonCreatedAt anchors the save nudge schedule
 * and must never be pushed forward.
 */
export async function ensureAnonProfile(uid: string, now: number): Promise<void> {
  // Direct path rather than .child() — the jest database mock's ref() returns only
  // { once, on, off, set, update }, so chaining .child() would be untestable.
  const snap = await database().ref(`users/${uid}/anonCreatedAt`).once('value');
  if (snap.exists()) return;
  await database().ref(`users/${uid}`).update({ anonCreatedAt: now, plan: 'anonymous' });
}

/**
 * Records identity after a successful link. displayName and email are written only when
 * Apple actually supplied them — it returns both ONLY on the first authorization for an
 * Apple ID, and a later null must not erase what the first one gave us.
 */
export async function writeLinkedProfile(
  uid: string,
  input: { displayName: string | null; email: string | null; now: number },
): Promise<void> {
  const patch: Record<string, unknown> = { plan: 'free', linkedAt: input.now };
  if (input.displayName) patch.displayName = input.displayName;
  if (input.email) patch.email = input.email;
  await database().ref(`users/${uid}`).update(patch);
}

export async function readAnonCreatedAt(uid: string): Promise<number | null> {
  const snap = await database().ref(`users/${uid}/anonCreatedAt`).once('value');
  return snap.exists() ? (snap.val() as number) : null;
}
```

- [ ] **Step 4: Run tests**

Run: `npx jest __tests__/userProfile.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/userProfile.ts __tests__/userProfile.test.ts
git commit -m "feat(auth): add users/{uid} identity record writes"
```

---

### Task 4: Apple credential acquisition

**Files:**
- Create: `src/lib/appleAuth.ts`
- Create: `__tests__/appleAuth.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `requestAppleCredential(): Promise<AppleCredentialResult>`
  - `interface AppleCredentialResult { credential: FirebaseAuthTypes.AuthCredential; displayName: string | null; email: string | null }`
  - `isAppleCancellation(err: unknown): boolean`

- [ ] **Step 1: Write the failing test**

Create `__tests__/appleAuth.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx jest __tests__/appleAuth.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/appleAuth.ts`:

```ts
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
```

- [ ] **Step 4: Run tests**

Run: `npx jest __tests__/appleAuth.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/appleAuth.ts __tests__/appleAuth.test.ts
git commit -m "feat(auth): add Apple credential acquisition with nonce hashing"
```

---

### Task 5: `AuthContext` — state, sign-in, sign-out

**Files:**
- Create: `src/contexts/AuthContext.tsx`
- Create: `__tests__/contexts/AuthContext.test.tsx`
- Modify: `app/_layout.tsx:25,41-45`

**Interfaces:**
- Consumes: `requestAppleCredential`, `isAppleCancellation` (Task 4); `ensureAnonProfile`, `writeLinkedProfile` (Task 3); `initAuth` from `src/lib/firebase.ts`.
- Produces:
  - `<AuthProvider>` component
  - `useAuth(): AuthContextValue`
  - `type LinkOutcome` (exact shape below)
  - `AuthContextValue = { user, status, anonCreatedAt, signInWithApple, signOut, deleteAccount }`

`deleteAccount` is stubbed here and implemented in Task 6.

- [ ] **Step 1: Write the failing test**

Create `__tests__/contexts/AuthContext.test.tsx`:

```tsx
const listeners: Array<(u: unknown) => void> = [];
let currentUser: Record<string, unknown> | null = null;
const mockLink = jest.fn();
const mockSignInWithCredential = jest.fn();
const mockSignInAnonymously = jest.fn();
const mockRequestApple = jest.fn();
const mockEnsureAnon = jest.fn();
const mockWriteLinked = jest.fn();

jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  default: () => ({
    get currentUser() { return currentUser; },
    onAuthStateChanged: (cb: (u: unknown) => void) => { listeners.push(cb); return jest.fn(); },
    signInAnonymously: (...a: unknown[]) => mockSignInAnonymously(...a),
    signInWithCredential: (...a: unknown[]) => mockSignInWithCredential(...a),
    signOut: jest.fn().mockResolvedValue(undefined),
  }),
}));
jest.mock('@/src/lib/firebase', () => ({
  initAuth: jest.fn().mockResolvedValue({ uid: 'anon-uid', isAnonymous: true }),
  getAuthedUser: () => Promise.resolve(currentUser),
  auth: require('@react-native-firebase/auth').default,
  database: jest.fn(),
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
  currentUser = u;
  act(() => { listeners.forEach(cb => cb(u)); });
}

beforeEach(() => {
  jest.clearAllMocks();
  listeners.length = 0;
  currentUser = null;
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
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx jest __tests__/contexts/AuthContext.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/contexts/AuthContext.tsx`:

```tsx
import React, { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { initAuth } from '@/src/lib/firebase';
import { requestAppleCredential, isAppleCancellation } from '@/src/lib/appleAuth';
import { ensureAnonProfile, writeLinkedProfile, readAnonCreatedAt } from '@/src/lib/userProfile';

export type LinkOutcome =
  | { ok: true; user: FirebaseAuthTypes.User }
  | { ok: false; reason: 'credential-already-in-use'; signIn: () => Promise<void> }
  | { ok: false; reason: 'cancelled' }
  | { ok: false; reason: 'error'; message: string };

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated';

export interface AuthContextValue {
  user: FirebaseAuthTypes.User | null;
  status: AuthStatus;
  anonCreatedAt: number | null;
  signInWithApple: () => Promise<LinkOutcome>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [anonCreatedAt, setAnonCreatedAt] = useState<number | null>(null);

  useEffect(() => {
    initAuth().catch(() => { /* the listener below reports whatever state we end up in */ });
    const unsubscribe = auth().onAuthStateChanged((u) => {
      setUser(u);
      if (!u) { setStatus('loading'); setAnonCreatedAt(null); return; }
      setStatus(u.isAnonymous ? 'anonymous' : 'authenticated');
      if (u.isAnonymous) {
        // Write-once inside; safe to call on every launch.
        ensureAnonProfile(u.uid, Date.now()).catch(() => {});
        readAnonCreatedAt(u.uid).then(setAnonCreatedAt).catch(() => {});
      } else {
        setAnonCreatedAt(null);
      }
    });
    return unsubscribe;
  }, []);

  const signInWithApple = useCallback(async (): Promise<LinkOutcome> => {
    let apple: Awaited<ReturnType<typeof requestAppleCredential>>;
    try {
      apple = await requestAppleCredential();
    } catch (err) {
      if (isAppleCancellation(err)) return { ok: false, reason: 'cancelled' };
      return { ok: false, reason: 'error', message: err instanceof Error ? err.message : 'Sign in failed' };
    }

    const current = auth().currentUser;
    if (!current) return { ok: false, reason: 'error', message: 'Not signed in' };

    try {
      // linkWithCredential preserves the uid — every trip, member record and index entry
      // keeps pointing at it, which is why there is no data migration in this phase.
      const result = await current.linkWithCredential(apple.credential);
      await writeLinkedProfile(result.user.uid, {
        displayName: apple.displayName,
        email: apple.email,
        now: Date.now(),
      });
      return { ok: true, user: result.user };
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/credential-already-in-use') {
        return {
          ok: false,
          reason: 'credential-already-in-use',
          // Abandons the anonymous uid. Callers warn first when it owns trips.
          signIn: async () => { await auth().signInWithCredential(apple.credential); },
        };
      }
      if (isAppleCancellation(err)) return { ok: false, reason: 'cancelled' };
      return { ok: false, reason: 'error', message: err instanceof Error ? err.message : 'Sign in failed' };
    }
  }, []);

  const signOut = useCallback(async () => {
    await auth().signOut();
    // Every RTDB rule requires auth != null, so there is no usable unauthenticated state.
    // Signing back in anonymously lands the user on a fresh empty uid.
    await auth().signInAnonymously();
  }, []);

  const deleteAccount = useCallback(async () => {
    throw new Error('deleteAccount is implemented in Task 6');
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, anonCreatedAt, signInWithApple, signOut, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npx jest __tests__/contexts/AuthContext.test.tsx`
Expected: PASS, 10 tests.

- [ ] **Step 5: Mount the provider**

In `app/_layout.tsx`, remove the standalone `initAuth()` effect (line 25 — `AuthProvider` owns it now), drop the now-unused `initAuth` import, and wrap the tree:

```tsx
import { AuthProvider } from '@/src/contexts/AuthContext';

// ...
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <AuthProvider>
          <ConnectivityProvider>
            <SheetProvider>
              <Stack screenOptions={{ headerShown: false }} />
            </SheetProvider>
          </ConnectivityProvider>
        </AuthProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
```

- [ ] **Step 6: Run the full suite**

Run: `npx jest`
Expected: PASS. Any screen test that renders through `_layout` and now hits `useAuth` needs `AuthProvider` in its wrapper — add it rather than mocking `useAuth`, so the real provider stays exercised.

- [ ] **Step 7: Commit**

```bash
git add src/contexts/AuthContext.tsx __tests__/contexts/AuthContext.test.tsx app/_layout.tsx
git commit -m "feat(auth): add AuthContext with Apple linking and sign-out"
```

---

### Task 6: Account deletion

**Files:**
- Modify: `src/contexts/AuthContext.tsx` (replace the `deleteAccount` stub)
- Create: `src/lib/deleteAccount.ts`
- Create: `__tests__/deleteAccount.test.ts`

**Interfaces:**
- Consumes: `archiveTrip` from `src/lib/tripWrites.ts`; `database` from `src/lib/firebase.ts`.
- Produces: `deleteAccountData(uid: string, ownedTripIds: string[]): Promise<void>` — everything except the auth-user deletion, which `AuthContext` does last.

- [ ] **Step 1: Write the failing test**

Create `__tests__/deleteAccount.test.ts`:

```ts
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
```

- [ ] **Step 2: Add `remove` to the database mock**

`__mocks__/@react-native-firebase/database.ts` currently exposes only `once/on/off/set/update`.
Add `remove` alongside them:

```ts
const mockRemove = jest.fn().mockResolvedValue(undefined);
const mockRef = jest.fn(() => ({ once: mockOnce, on: mockOn, off: mockOff, set: mockSet, update: mockUpdate, remove: mockRemove }));

export { mockRef, mockOnce, mockOn, mockOff, mockSet, mockUpdate, mockRemove };
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `npx jest __tests__/deleteAccount.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the data half**

Create `src/lib/deleteAccount.ts`:

```ts
import { database } from '@/src/lib/firebase';
import { archiveTrip } from '@/src/lib/tripWrites';

/**
 * Removes the user's own data. The auth user itself is deleted by the caller, AFTER this
 * resolves — so a partial failure leaves the user signed in and able to retry rather than
 * stranded with an orphaned auth record and no way back in.
 *
 * Deliberately not a full cascade: members, group references and other travellers' views
 * of a deleted organizer need a Cloud Function. See docs/superpowers/known-issues.md.
 */
export async function deleteAccountData(uid: string, ownedTripIds: string[]): Promise<void> {
  for (const tripId of ownedTripIds) {
    await archiveTrip(tripId);
  }
  await database().ref(`users/${uid}`).remove();
}
```

- [ ] **Step 5: Run tests**

Run: `npx jest __tests__/deleteAccount.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Wire it into `AuthContext`**

Replace the `deleteAccount` stub in `src/contexts/AuthContext.tsx`, and add the import `import { deleteAccountData } from '@/src/lib/deleteAccount';`:

```tsx
  const deleteAccount = useCallback(async () => {
    const current = auth().currentUser;
    if (!current) throw new Error('Not signed in');

    const snap = await database().ref(`users/${current.uid}/trips`).once('value');
    const tripIds = snap.exists() ? Object.keys(snap.val() as Record<string, true>) : [];

    await deleteAccountData(current.uid, tripIds);

    try {
      await current.delete();
    } catch (err) {
      if ((err as { code?: string })?.code === 'auth/requires-recent-login') {
        const outcome = await signInWithApple();
        if (!outcome.ok) throw new Error('Please sign in again to confirm deletion');
        await auth().currentUser?.delete();
      } else {
        throw err;
      }
    }
    await auth().signInAnonymously();
  }, [signInWithApple]);
```

Add `database` to the `src/lib/firebase` import at the top of the file.

- [ ] **Step 7: Run the full suite**

Run: `npx jest`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/deleteAccount.ts __tests__/deleteAccount.test.ts src/contexts/AuthContext.tsx __mocks__/@react-native-firebase/database.ts
git commit -m "feat(auth): add account deletion, auth user removed last"
```

---

### Task 7: Move colour-pack selection into the onboarding draft

Step 3 previews the trip's colour, but `createTrip` currently picks the pack randomly inside itself, so there is nothing to preview. This also removes `Math.random()` from a function the tests otherwise pin down.

**Files:**
- Modify: `src/contexts/OnboardingDraftContext.tsx`
- Modify: `src/lib/createTrip.ts:35-48`
- Modify: `__tests__/createTrip.test.ts`
- Modify: `__tests__/app/onboarding-step-4.test.tsx` (if it asserts on `createTrip` input)

**Interfaces:**
- Consumes: `TRIP_COLOR_PACKS` from `src/design/tripPacks`.
- Produces: `OnboardingDraft` gains `colorPack: TripColorPackRef`; `CreateTripInput` gains a required `colorPack: TripColorPackRef`.

- [ ] **Step 1: Write the failing test**

Add to `__tests__/createTrip.test.ts`:

```ts
it('uses the colour pack supplied by the caller rather than picking one', async () => {
  const pack = { id: 'chosen-pack', stopColors: ['#111111'], heroGradient: ['#000000', '#222222'] };
  await createTrip({
    name: 'Maine', organizerHandle: 'ada', pills: [],
    firstStop: { city: 'Portland', region: 'ME', lat: 43.6, lon: -70.2, dates: { start: '2026-08-10', end: '2026-08-14' } },
    setupIntent: { flights: true, stays: true, car: true, restaurants: true },
    colorPack: pack,
  });
  const written = mockSet.mock.calls[0][0];
  expect(written.colorPack).toEqual(pack);
});
```

Match the mock names already used in that file — if it asserts writes via `mockUpdate` rather than `mockSet`, use that instead.

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx jest __tests__/createTrip.test.ts`
Expected: FAIL — the written pack is a random one, not `chosen-pack`.

The file already imports `TRIP_COLOR_PACKS`, so it likely has an existing assertion that the
written pack is *one of* them. That test stays valid — the draft still picks from the same
list — but update it to pass a `colorPack` through like every other call in the file.

- [ ] **Step 3: Accept the pack in `createTrip`**

In `src/lib/createTrip.ts`, add to `CreateTripInput`:

```ts
  colorPack: TripColorPackRef;
```

Delete the random-pick block (lines ~41-48) and use the input directly:

```ts
  // Chosen in OnboardingDraftContext at wizard start so step 3 can preview it.
  const colorPack: TripColorPackRef = input.colorPack;
```

- [ ] **Step 4: Choose the pack in the draft**

In `src/contexts/OnboardingDraftContext.tsx`, add the import:

```ts
import { TRIP_COLOR_PACKS } from '@/src/design/tripPacks';
import type { TripColorPackRef } from '@/src/types';
```

Add to `OnboardingDraft`:

```ts
  colorPack: TripColorPackRef;
```

Inside the provider, pick once on mount so it stays stable across re-renders and steps:

```ts
  const [colorPack] = useState<TripColorPackRef>(() => {
    const pack = TRIP_COLOR_PACKS[Math.floor(Math.random() * TRIP_COLOR_PACKS.length)];
    return { id: pack.id, stopColors: pack.stopColors, heroGradient: pack.heroGradient };
  });
```

Add `colorPack` to the `draft` object in `value`.

- [ ] **Step 5: Pass it through step 4**

In `app/onboarding/step-4.tsx`'s `createTrip({ ... })` call, add:

```ts
        colorPack: draft.colorPack,
```

- [ ] **Step 6: Run the full suite**

Run: `npx jest`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/contexts/OnboardingDraftContext.tsx src/lib/createTrip.ts app/onboarding/step-4.tsx __tests__/
git commit -m "refactor(onboarding): choose colour pack in the draft so step 3 can preview it"
```

---

### Task 8: Onboarding step 3 — Save your trip

**Files:**
- Create: `app/onboarding/step-3.tsx`
- Create: `__tests__/app/onboarding-step-3.test.tsx`
- Modify: `app/onboarding/step-2.tsx:17`

**Interfaces:**
- Consumes: `useAuth` (Task 5), `useOnboardingDraft` with `colorPack` (Task 7).
- Produces: a route at `/onboarding/step-3` that continues to `/onboarding/step-4`.

- [ ] **Step 1: Write the failing test**

Create `__tests__/app/onboarding-step-3.test.tsx`:

```tsx
const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockSignInWithApple = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: mockReplace }) }));
jest.mock('@/src/contexts/AuthContext', () => ({
  useAuth: () => ({ status: 'anonymous', signInWithApple: mockSignInWithApple }),
}));
jest.mock('@/src/contexts/OnboardingDraftContext', () => ({
  useOnboardingDraft: () => ({
    draft: {
      name: 'Maine Summer 2026',
      colorPack: { id: 'p', stopColors: ['#2C5880'], heroGradient: ['#111111', '#222222'] },
    },
  }),
}));

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';
import Step3 from '@/app/onboarding/step-3';

function render() {
  let tree!: renderer.ReactTestRenderer;
  act(() => { tree = renderer.create(<Step3 />); });
  return tree;
}
function texts(tree: renderer.ReactTestRenderer): string {
  return tree.root.findAllByType(Text).map(t => {
    const c = t.props.children;
    return Array.isArray(c) ? c.join('') : String(c);
  }).join(' | ');
}

beforeEach(() => { jest.clearAllMocks(); });

describe('Onboarding step 3', () => {
  it('previews the trip name from the draft', () => {
    expect(texts(render())).toContain('Maine Summer 2026');
  });

  it('advances to step 4 after a successful link', async () => {
    mockSignInWithApple.mockResolvedValue({ ok: true, user: { uid: 'u' } });
    const tree = render();
    await act(async () => { await tree.root.findByProps({ testID: 'step3-apple-button' }).props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith('/onboarding/step-4');
  });

  // Skipping is supported — the save nudge and invite gate carry the user from here.
  it('advances to step 4 when the user skips', () => {
    const tree = render();
    act(() => { tree.root.findByProps({ testID: 'step3-skip' }).props.onPress(); });
    expect(mockPush).toHaveBeenCalledWith('/onboarding/step-4');
  });

  it('stays put and says nothing when the user cancels the Apple sheet', async () => {
    mockSignInWithApple.mockResolvedValue({ ok: false, reason: 'cancelled' });
    const tree = render();
    await act(async () => { await tree.root.findByProps({ testID: 'step3-apple-button' }).props.onPress(); });
    expect(mockPush).not.toHaveBeenCalled();
    expect(texts(tree)).not.toContain('again');
  });

  it('surfaces an error without leaving the screen', async () => {
    mockSignInWithApple.mockResolvedValue({ ok: false, reason: 'error', message: 'network down' });
    const tree = render();
    await act(async () => { await tree.root.findByProps({ testID: 'step3-apple-button' }).props.onPress(); });
    expect(mockPush).not.toHaveBeenCalled();
    expect(texts(tree)).toContain('network down');
  });

  // No trip exists yet at step 3, so a collision costs nothing — sign in and carry on.
  it('signs into the existing account on collision and continues', async () => {
    const signIn = jest.fn().mockResolvedValue(undefined);
    mockSignInWithApple.mockResolvedValue({ ok: false, reason: 'credential-already-in-use', signIn });
    const tree = render();
    await act(async () => { await tree.root.findByProps({ testID: 'step3-apple-button' }).props.onPress(); });
    expect(signIn).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/onboarding/step-4');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx jest __tests__/app/onboarding-step-3.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the screen**

Create `app/onboarding/step-3.tsx`. Follow `step-4.tsx`'s visual structure — navy background, gold eyebrow, `Typography.roles` — so the wizard stays consistent:

```tsx
import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Brand, Core, Typography, Radius, Spacing } from '@/src/design/tokens';
import { useOnboardingDraft } from '@/src/contexts/OnboardingDraftContext';
import { useAuth } from '@/src/contexts/AuthContext';

export default function OnboardingStep3() {
  const router = useRouter();
  const { draft } = useOnboardingDraft();
  const { signInWithApple } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const advance = () => router.push('/onboarding/step-4');

  const handleApple = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const outcome = await signInWithApple();
    if (outcome.ok) { setBusy(false); advance(); return; }

    if (outcome.reason === 'cancelled') { setBusy(false); return; }
    if (outcome.reason === 'credential-already-in-use') {
      // No trip exists yet — nothing is at risk, so adopt the existing account silently.
      try { await outcome.signIn(); setBusy(false); advance(); }
      catch (e) { setBusy(false); setError(e instanceof Error ? e.message : 'Sign in failed'); }
      return;
    }
    setBusy(false);
    setError(outcome.message);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>Keep it safe</Text>
      <Text style={styles.title}>Save your trip</Text>
      <Text style={styles.sub}>
        Sign in and your trip follows you to any phone. Skip and it lives only on this one.
      </Text>

      <View style={[styles.previewCard, { borderColor: draft.colorPack.stopColors[0] }]}>
        <View style={[styles.swatch, { backgroundColor: draft.colorPack.stopColors[0] }]} />
        <Text style={styles.previewName}>{draft.name}</Text>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      <TouchableOpacity
        testID="step3-apple-button"
        style={[styles.appleButton, busy && styles.buttonDisabled]}
        onPress={handleApple}
        disabled={busy}
      >
        {busy ? <ActivityIndicator color={Core.white} /> : <Text style={styles.appleButtonText}>Sign in with Apple</Text>}
      </TouchableOpacity>

      <TouchableOpacity testID="step3-skip" style={styles.skip} onPress={advance} disabled={busy}>
        <Text style={styles.skipText}>Save later</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Brand.navy, justifyContent: 'center', paddingHorizontal: Spacing.xl },
  eyebrow: { ...Typography.roles.labelCaps, color: Brand.gold, marginBottom: Spacing.sm },
  title: { ...Typography.roles.h1, color: Core.white, marginBottom: Spacing.sm },
  sub: { ...Typography.roles.body, color: 'rgba(255,255,255,0.65)', marginBottom: Spacing.xl },
  previewCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg, marginBottom: Spacing.xl,
  },
  swatch: { width: 32, height: 32, borderRadius: Radius.sm },
  previewName: { ...Typography.roles.h2, color: Core.white, flexShrink: 1 },
  appleButton: {
    backgroundColor: '#000000', borderRadius: Radius.md,
    paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center',
  },
  appleButtonText: { ...Typography.roles.button, color: Core.white },
  buttonDisabled: { opacity: 0.5 },
  skip: { alignItems: 'center', paddingVertical: Spacing.md, marginTop: Spacing.sm },
  skipText: { ...Typography.roles.body, color: 'rgba(255,255,255,0.55)', textDecorationLine: 'underline' },
  errorText: { ...Typography.roles.meta, color: '#F5A9B8', marginBottom: Spacing.base },
});
```

`src/design/tokens.ts` has `Core.white` but no `Core.black`, hence the literal — Apple's guidelines require the button be black, white, or white-with-outline.

- [ ] **Step 4: Run the test**

Run: `npx jest __tests__/app/onboarding-step-3.test.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 5: Reroute step 2**

In `app/onboarding/step-2.tsx:17`, change `'/onboarding/step-4'` to `'/onboarding/step-3'`. Update `__tests__/app/onboarding-step-2.test.tsx` if it asserts the destination.

- [ ] **Step 6: Run the full suite**

Run: `npx jest`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/onboarding/ __tests__/app/
git commit -m "feat(onboarding): add step 3 save-your-trip with Apple sign-in and skip"
```

---

### Task 9: Save-nudge scheduling

**Files:**
- Create: `src/domain/saveNudge.ts`
- Create: `src/lib/nudgeSnooze.ts`
- Create: `__tests__/domain-saveNudge.test.ts`
- Create: `__tests__/nudgeSnooze.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type NudgeLevel = 'none' | 'gentle' | 'firm'`
  - `nudgeLevel(anonCreatedAt: number, now: number): NudgeLevel`
  - `snoozeMsFor(level: NudgeLevel): number`
  - `shouldShowNudge(p: { status: string; anonCreatedAt: number | null; snoozedUntil: number | null; now: number }): NudgeLevel | null`
  - `readSnooze(uid: string): number | null` / `writeSnooze(uid: string, until: number): void`

- [ ] **Step 1: Write the failing scheduling test**

Create `__tests__/domain-saveNudge.test.ts`:

```ts
import { nudgeLevel, snoozeMsFor, shouldShowNudge } from '@/src/domain/saveNudge';

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_700_000_000_000;

describe('nudgeLevel', () => {
  it('stays silent for the first six days', () => {
    expect(nudgeLevel(T0, T0)).toBe('none');
    expect(nudgeLevel(T0, T0 + 6 * DAY)).toBe('none');
  });
  it('goes gentle at seven days', () => {
    expect(nudgeLevel(T0, T0 + 7 * DAY)).toBe('gentle');
    expect(nudgeLevel(T0, T0 + 20 * DAY)).toBe('gentle');
  });
  it('goes firm at twenty-one days and stays there', () => {
    expect(nudgeLevel(T0, T0 + 21 * DAY)).toBe('firm');
    expect(nudgeLevel(T0, T0 + 400 * DAY)).toBe('firm');
  });
});

describe('snoozeMsFor', () => {
  it('snoozes a gentle nudge for a week and a firm one for three days', () => {
    expect(snoozeMsFor('gentle')).toBe(7 * DAY);
    expect(snoozeMsFor('firm')).toBe(3 * DAY);
  });
});

describe('shouldShowNudge', () => {
  const base = { status: 'anonymous', anonCreatedAt: T0, snoozedUntil: null, now: T0 + 10 * DAY };

  it('shows a gentle nudge to a due anonymous user', () => {
    expect(shouldShowNudge(base)).toBe('gentle');
  });
  it('never shows to an authenticated user', () => {
    expect(shouldShowNudge({ ...base, status: 'authenticated' })).toBeNull();
  });
  it('never shows while auth state is still loading', () => {
    expect(shouldShowNudge({ ...base, status: 'loading' })).toBeNull();
  });
  it('stays hidden before the seven-day mark', () => {
    expect(shouldShowNudge({ ...base, now: T0 + 3 * DAY })).toBeNull();
  });
  it('stays hidden while snoozed', () => {
    expect(shouldShowNudge({ ...base, snoozedUntil: T0 + 12 * DAY })).toBeNull();
  });
  // Snooze expires — dismissing hides the card, it does not kill it.
  it('returns once the snooze lapses', () => {
    expect(shouldShowNudge({ ...base, snoozedUntil: T0 + 9 * DAY })).toBe('gentle');
  });
  it('handles a missing anonCreatedAt by staying silent', () => {
    expect(shouldShowNudge({ ...base, anonCreatedAt: null })).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx jest __tests__/domain-saveNudge.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the scheduling**

Create `src/domain/saveNudge.ts`:

```ts
// Pure scheduling for the "save your trip" nudge. `now` is always injected so the 21-day
// branch is testable without waiting 21 days.

export type NudgeLevel = 'none' | 'gentle' | 'firm';

const DAY = 24 * 60 * 60 * 1000;
const GENTLE_AFTER = 7 * DAY;
const FIRM_AFTER = 21 * DAY;

export function nudgeLevel(anonCreatedAt: number, now: number): NudgeLevel {
  const age = now - anonCreatedAt;
  if (age >= FIRM_AFTER) return 'firm';
  if (age >= GENTLE_AFTER) return 'gentle';
  return 'none';
}

// Dismiss snoozes rather than kills — a permanently dismissible nudge converts nobody.
export function snoozeMsFor(level: NudgeLevel): number {
  return level === 'firm' ? 3 * DAY : 7 * DAY;
}

export function shouldShowNudge(p: {
  status: string;
  anonCreatedAt: number | null;
  snoozedUntil: number | null;
  now: number;
}): NudgeLevel | null {
  if (p.status !== 'anonymous') return null;
  if (p.anonCreatedAt === null) return null;
  if (p.snoozedUntil !== null && p.now < p.snoozedUntil) return null;
  const level = nudgeLevel(p.anonCreatedAt, p.now);
  return level === 'none' ? null : level;
}
```

- [ ] **Step 4: Run the test**

Run: `npx jest __tests__/domain-saveNudge.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Write the snooze-storage test**

Create `__tests__/nudgeSnooze.test.ts`:

```ts
const store = new Map<string, string>();
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (k: string) => store.get(k),
    set: (k: string, v: string) => { store.set(k, v); },
    remove: (k: string) => { store.delete(k); },
  }),
}));

import { readSnooze, writeSnooze } from '@/src/lib/nudgeSnooze';

beforeEach(() => { store.clear(); });

describe('nudge snooze storage', () => {
  it('returns null when nothing is stored', () => {
    expect(readSnooze('uid-1')).toBeNull();
  });
  it('round-trips a timestamp', () => {
    writeSnooze('uid-1', 1_700_000_000_000);
    expect(readSnooze('uid-1')).toBe(1_700_000_000_000);
  });
  // Snooze is device-scoped, matching the anonymous session it describes.
  it('keys snooze state per uid', () => {
    writeSnooze('uid-1', 111);
    expect(readSnooze('uid-2')).toBeNull();
  });
  it('returns null on unparseable stored data', () => {
    store.set('jernie_save_nudge_uid-1', 'garbage');
    expect(readSnooze('uid-1')).toBeNull();
  });
});
```

- [ ] **Step 6: Implement the storage**

Create `src/lib/nudgeSnooze.ts`, following the `refreshScheduler.ts` pattern:

```ts
import { createMMKV } from 'react-native-mmkv';

// Device-scoped, matching the anonymous session it describes. MMKV v4: createMMKV({ id }).
const storage = createMMKV({ id: 'jernie-save-nudge' });

function key(uid: string): string {
  return `jernie_save_nudge_${uid}`;
}

export function readSnooze(uid: string): number | null {
  const raw = storage.getString(key(uid));
  if (!raw) return null;
  const parsed = parseInt(raw, 10);
  return isNaN(parsed) ? null : parsed;
}

export function writeSnooze(uid: string, until: number): void {
  storage.set(key(uid), String(until));
}
```

- [ ] **Step 7: Run both tests**

Run: `npx jest __tests__/domain-saveNudge.test.ts __tests__/nudgeSnooze.test.ts`
Expected: PASS, 15 tests total.

- [ ] **Step 8: Commit**

```bash
git add src/domain/saveNudge.ts src/lib/nudgeSnooze.ts __tests__/domain-saveNudge.test.ts __tests__/nudgeSnooze.test.ts
git commit -m "feat(auth): add save-nudge scheduling and per-uid snooze storage"
```

---

### Task 10: Save nudge in `CTACardZone`

**Files:**
- Modify: `src/features/jernie/CTACardZone.tsx:204-226`
- Modify: `app/(trips)/[tripId]/(tabs)/jernie.tsx:271`
- Modify: `__tests__/components/CTACardZone.test.tsx`

**Interfaces:**
- Consumes: `NudgeLevel` (Task 9), `useAuth` (Task 5).
- Produces: `CTACardZone` gains an optional prop `saveNudge?: { level: NudgeLevel; onSave: () => void; onSnooze: () => void } | null`.

- [ ] **Step 1: Write the failing test**

Add to `__tests__/components/CTACardZone.test.tsx` (reuse the existing render helper and base props in that file):

```tsx
import { Text } from 'react-native';

function textsOf(tree: renderer.ReactTestRenderer): string {
  return tree.root.findAllByType(Text).map(t => {
    const c = t.props.children;
    return Array.isArray(c) ? c.join('') : String(c);
  }).join(' | ');
}

// The zone takes `now` as a prop, so every phase is reachable by moving the clock past
// the stop's dates (makeStop ends 2026-08-14).
function renderPostTrip(props: Partial<React.ComponentProps<typeof CTACardZone>> = {}) {
  return renderZone(
    <CTACardZone
      trip={makeTrip()}
      activeStop={makeStop()}
      bookings={[] as Booking[]}
      days={[] as ItineraryDay[]}
      now={new Date('2026-09-15T12:00:00Z')}
      isDismissed={false}
      onDismiss={() => {}}
      {...props}
    />,
  );
}

describe('CTACardZone save nudge', () => {
  let nudge: { level: 'gentle' | 'firm'; onSave: jest.Mock; onSnooze: jest.Mock };
  beforeEach(() => {
    nudge = { level: 'gentle', onSave: jest.fn(), onSnooze: jest.fn() };
  });

  test('renders the save card when a nudge is due', () => {
    const tree = renderPreTrip({ saveNudge: nudge });
    expect(tree.root.findAllByProps({ testID: 'save-nudge-card' }).length).toBeGreaterThan(0);
  });

  // The nudge outranks the phase router: an unsaved trip needs nudging in every phase,
  // and the router returns null for 'post' and for a dismissed 'pre'.
  test('shows in the post-trip phase, where the phase router renders nothing', () => {
    const tree = renderPostTrip({ saveNudge: nudge });
    expect(tree.root.findAllByProps({ testID: 'save-nudge-card' }).length).toBeGreaterThan(0);
  });

  test('shows even when the setup card has been dismissed', () => {
    const tree = renderPreTrip({ isDismissed: true, saveNudge: nudge });
    expect(tree.root.findAllByProps({ testID: 'save-nudge-card' }).length).toBeGreaterThan(0);
  });

  test('leaves the normal setup card alone when no nudge is due', () => {
    const tree = renderPreTrip({ saveNudge: null });
    expect(tree.root.findAllByProps({ testID: 'save-nudge-card' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: 'setup-row-flights' }).length).toBeGreaterThan(0);
  });

  test('suppresses the in-trip quick actions while a nudge is showing', () => {
    const tree = renderInTrip({ saveNudge: nudge });
    expect(tree.root.findAllByProps({ testID: 'save-nudge-card' }).length).toBeGreaterThan(0);
  });

  test('fires onSnooze when dismissed', () => {
    const tree = renderPreTrip({ saveNudge: nudge });
    act(() => { tree.root.findByProps({ testID: 'save-nudge-dismiss' }).props.onPress(); });
    expect(nudge.onSnooze).toHaveBeenCalled();
  });

  test('fires onSave when the sign-in button is pressed', () => {
    const tree = renderPreTrip({ saveNudge: nudge });
    act(() => { tree.root.findByProps({ testID: 'save-nudge-save' }).props.onPress(); });
    expect(nudge.onSave).toHaveBeenCalled();
  });

  test('uses firmer copy at the firm level', () => {
    const gentle = textsOf(renderPreTrip({ saveNudge: nudge }));
    const firm = textsOf(renderPreTrip({ saveNudge: { ...nudge, level: 'firm' } }));
    expect(firm).not.toBe(gentle);
  });
});
```

`renderPreTrip` and `renderInTrip` already exist at the top of this file and take a props
partial — reuse them rather than adding new render helpers. `renderPostTrip` is new because
no post-phase helper exists yet.

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx jest __tests__/components/CTACardZone.test.tsx`
Expected: FAIL — no `save-nudge-card`.

- [ ] **Step 3: Add the card and the precedence check**

In `src/features/jernie/CTACardZone.tsx`, add to the props interface (near `isDismissed`, line 14):

```ts
  saveNudge?: { level: NudgeLevel; onSave: () => void; onSnooze: () => void } | null;
```

Import the type: `import type { NudgeLevel } from '@/src/domain/saveNudge';`

Add the card component beside `PreTripCard` / `InTripCard`:

```tsx
function SaveTripCard({ level, onSave, onSnooze }: { level: NudgeLevel; onSave: () => void; onSnooze: () => void }) {
  const firm = level === 'firm';
  return (
    <View testID="save-nudge-card" style={styles.card}>
      <Text style={styles.cardTitle}>
        {firm ? 'This trip only exists on this phone' : 'Save your trip'}
      </Text>
      <Text style={styles.cardSub}>
        {firm
          ? "If you lose this phone, this trip goes with it. There's no way to recover it."
          : 'Sign in and your trip follows you to any phone.'}
      </Text>
      <TouchableOpacity testID="save-nudge-save" style={styles.primaryButton} onPress={onSave}>
        <Text style={styles.primaryButtonText}>Sign in with Apple</Text>
      </TouchableOpacity>
      <TouchableOpacity testID="save-nudge-dismiss" onPress={onSnooze}>
        <Text style={styles.dismissText}>Not now</Text>
      </TouchableOpacity>
    </View>
  );
}
```

Reuse the existing style names in the file; add any that are missing alongside them.

In the phase router (line ~218), put the nudge **above** the phase logic:

```tsx
  // Outranks the phase router deliberately: an unsaved trip needs nudging in every phase,
  // and the router below returns null for 'post' and for a dismissed 'pre'.
  if (saveNudge) {
    return <SaveTripCard level={saveNudge.level} onSave={saveNudge.onSave} onSnooze={saveNudge.onSnooze} />;
  }

  const phase: 'pre' | 'in' | 'post' = /* unchanged */;
```

- [ ] **Step 4: Run the test**

Run: `npx jest __tests__/components/CTACardZone.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire it up in the Jernie tab**

In `app/(trips)/[tripId]/(tabs)/jernie.tsx`, above the render:

```tsx
import { useAuth } from '@/src/contexts/AuthContext';
import { shouldShowNudge, snoozeMsFor } from '@/src/domain/saveNudge';
import { readSnooze, writeSnooze } from '@/src/lib/nudgeSnooze';

// ...inside the component:
  const { status, user, anonCreatedAt, signInWithApple } = useAuth();
  const [snoozeTick, setSnoozeTick] = useState(0);

  const nudgeLevelDue = useMemo(() => {
    if (!user) return null;
    return shouldShowNudge({
      status,
      anonCreatedAt,
      snoozedUntil: readSnooze(user.uid),
      now: Date.now(),
    });
  }, [status, user, anonCreatedAt, snoozeTick]);

  const saveNudge = nudgeLevelDue && user
    ? {
        level: nudgeLevelDue,
        onSave: () => { void signInWithApple(); },
        onSnooze: () => {
          writeSnooze(user.uid, Date.now() + snoozeMsFor(nudgeLevelDue));
          setSnoozeTick(t => t + 1);
        },
      }
    : null;
```

Pass `saveNudge={saveNudge}` to `<CTACardZone ...>` at line 271.

- [ ] **Step 6: Run the full suite**

Run: `npx jest`
Expected: PASS. `__tests__/app/jernie.test.tsx` will need `useAuth` mocked — add it to that file's mock block returning `{ status: 'authenticated', user: { uid: 'u' }, anonCreatedAt: null, signInWithApple: jest.fn() }` so existing assertions are unaffected.

- [ ] **Step 7: Commit**

```bash
git add src/features/jernie/CTACardZone.tsx app/\(trips\)/ __tests__/
git commit -m "feat(jernie): add save nudge above the CTA phase router"
```

---

### Task 11: Profile account section and invite gate

**Files:**
- Create: `src/lib/collisionPrompt.ts`
- Create: `__tests__/collisionPrompt.test.ts`
- Modify: `app/(trips)/[tripId]/(tabs)/profile.tsx:14-25,61-63`
- Modify: `__tests__/app/profile.test.tsx`

**Interfaces:**
- Consumes: `useAuth` (Tasks 5–6), `useUserTrips` from `src/hooks/useUserTrips.ts`.
- Produces: `confirmAdoptExistingAccount(ownedTripCount: number): Promise<boolean>`.

Unlike step 3 — where no trip exists yet and collision is free — a Profile collision may
abandon real trips. The spec requires warning **only** when the anonymous uid actually owns
something, which is what `ownedTripCount` decides.

- [ ] **Step 1: Write the failing test**

Add to `__tests__/app/profile.test.tsx`, following the mock style already in that file:

```tsx
describe('Profile account section', () => {
  it('offers sign-in to an anonymous user', () => {
    mockAuth = { status: 'anonymous', user: { uid: 'u' }, signInWithApple: jest.fn(), signOut: jest.fn(), deleteAccount: jest.fn() };
    const tree = renderProfile();
    expect(tree.root.findAllByProps({ testID: 'profile-signin' }).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: 'profile-signout' })).toHaveLength(0);
  });

  it('shows identity and sign-out once linked', () => {
    mockAuth = { status: 'authenticated', user: { uid: 'u', email: 'ada@example.com' }, signInWithApple: jest.fn(), signOut: jest.fn(), deleteAccount: jest.fn() };
    const tree = renderProfile();
    expect(texts(tree)).toContain('ada@example.com');
    expect(tree.root.findAllByProps({ testID: 'profile-signout' }).length).toBeGreaterThan(0);
  });

  // The gate protects everyone in the trip, not just the organizer: if an unlinked
  // organizer loses their device, the shared trip is orphaned for all travellers.
  it('blocks the share invite for an anonymous organizer', () => {
    const signIn = jest.fn().mockResolvedValue({ ok: false, reason: 'cancelled' });
    mockAuth = { status: 'anonymous', user: { uid: 'u' }, signInWithApple: signIn, signOut: jest.fn(), deleteAccount: jest.fn() };
    const tree = renderProfile();
    act(() => { tree.root.findByProps({ testID: 'share-invite-button' }).props.onPress(); });
    expect(mockShare).not.toHaveBeenCalled();
    expect(signIn).toHaveBeenCalled();
  });

  it('warns before abandoning trips on a Profile collision', async () => {
    const signIn = jest.fn().mockResolvedValue(undefined);
    const signInWithApple = jest.fn().mockResolvedValue({
      ok: false, reason: 'credential-already-in-use', signIn,
    });
    mockAuth = { status: 'anonymous', user: { uid: 'u' }, signInWithApple, signOut: jest.fn(), deleteAccount: jest.fn() };
    mockConfirmAdopt.mockResolvedValue(false);
    const tree = renderProfile();
    await act(async () => { await tree.root.findByProps({ testID: 'share-invite-button' }).props.onPress(); });
    expect(mockConfirmAdopt).toHaveBeenCalled();
    expect(signIn).not.toHaveBeenCalled();
    expect(mockShare).not.toHaveBeenCalled();
  });

  it('shares normally once linked', () => {
    mockAuth = { status: 'authenticated', user: { uid: 'u' }, signInWithApple: jest.fn(), signOut: jest.fn(), deleteAccount: jest.fn() };
    const tree = renderProfile();
    act(() => { tree.root.findByProps({ testID: 'share-invite-button' }).props.onPress(); });
    expect(mockShare).toHaveBeenCalled();
  });
});
```

Add to the file's mock block:

```ts
let mockAuth: any;
const mockConfirmAdopt = jest.fn();
jest.mock('@/src/contexts/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('@/src/lib/collisionPrompt', () => ({
  confirmAdoptExistingAccount: (...a: unknown[]) => mockConfirmAdopt(...a),
}));
jest.mock('@/src/hooks/useUserTrips', () => ({ useUserTrips: () => ({ trips: [], status: 'ready' }) }));
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx jest __tests__/app/profile.test.tsx`
Expected: FAIL — no `profile-signin`.

- [ ] **Step 3: Add the collision prompt**

Create `src/lib/collisionPrompt.ts`:

```ts
import { Alert } from 'react-native';

/**
 * Asked when an Apple ID already belongs to another Jernie account. Signing into it
 * abandons the current anonymous uid — which only matters if that uid owns trips, so a
 * user with nothing to lose is never warned.
 */
export function confirmAdoptExistingAccount(ownedTripCount: number): Promise<boolean> {
  if (ownedTripCount === 0) return Promise.resolve(true);
  const noun = ownedTripCount === 1 ? 'trip' : 'trips';
  return new Promise(resolve => {
    Alert.alert(
      'That Apple ID already has an account',
      `Signing into it leaves ${ownedTripCount} ${noun} behind on this phone. They can't be moved, and you won't be able to reach them again.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Sign in anyway', style: 'destructive', onPress: () => resolve(true) },
      ],
    );
  });
}
```

Create `__tests__/collisionPrompt.test.ts`:

```ts
const mockAlert = jest.fn();
jest.mock('react-native', () => ({ Alert: { alert: (...a: unknown[]) => mockAlert(...a) } }));

import { confirmAdoptExistingAccount } from '@/src/lib/collisionPrompt';

beforeEach(() => { jest.clearAllMocks(); });

describe('confirmAdoptExistingAccount', () => {
  // Nothing to lose — never interrupt.
  it('resolves true without prompting when no trips are owned', async () => {
    await expect(confirmAdoptExistingAccount(0)).resolves.toBe(true);
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('resolves true when the user confirms', async () => {
    mockAlert.mockImplementation((_t, _m, btns) => btns[1].onPress());
    await expect(confirmAdoptExistingAccount(2)).resolves.toBe(true);
  });

  it('resolves false when the user cancels', async () => {
    mockAlert.mockImplementation((_t, _m, btns) => btns[0].onPress());
    await expect(confirmAdoptExistingAccount(2)).resolves.toBe(false);
  });

  it('counts trips correctly in the message', async () => {
    mockAlert.mockImplementation((_t, _m, btns) => btns[0].onPress());
    await confirmAdoptExistingAccount(1);
    expect(mockAlert.mock.calls[0][1]).toContain('1 trip behind');
  });
});
```

Run: `npx jest __tests__/collisionPrompt.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 4: Gate the invite**

In `app/(trips)/[tripId]/(tabs)/profile.tsx`, add `const { status, user, signInWithApple, signOut, deleteAccount } = useAuth();` and change `handleShareInvite`:

```tsx
  const { trips } = useUserTrips();

  const handleShareInvite = async () => {
    // An unlinked organizer who loses their device orphans the trip for every traveller
    // in it, not just themselves. That is what this gate protects.
    if (status !== 'authenticated') {
      const outcome = await signInWithApple();
      if (!outcome.ok) {
        if (outcome.reason === 'credential-already-in-use') {
          const adopt = await confirmAdoptExistingAccount(trips.length);
          if (!adopt) return;
          await outcome.signIn();
        } else {
          return;
        }
      }
    }
    await Share.share({ message: `Join "${trip.name}" on Jernie: ${inviteLink}`, url: inviteLink });
  };
```

- [ ] **Step 5: Add the account section**

Render below the invite block (after line ~63):

```tsx
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        {status === 'authenticated' ? (
          <>
            <Text style={styles.accountIdentity}>{user?.email ?? user?.displayName ?? 'Signed in'}</Text>
            <TouchableOpacity testID="profile-signout" onPress={() => { void signOut(); }}>
              <Text style={styles.accountAction}>Sign out</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="profile-delete-account" onPress={() => { void deleteAccount(); }}>
              <Text style={styles.accountDanger}>Delete account</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.accountIdentity}>This trip lives only on this phone.</Text>
            <TouchableOpacity testID="profile-signin" onPress={() => { void signInWithApple(); }}>
              <Text style={styles.accountAction}>Sign in with Apple</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
```

Add `section`, `sectionTitle`, `accountIdentity`, `accountAction` and `accountDanger` styles matching the file's existing conventions. Wrap `profile-delete-account` in the existing `confirmDelete` helper from `src/utils/confirmDelete.ts` so it prompts before destroying anything.

- [ ] **Step 6: Run the full suite**

Run: `npx jest`
Expected: PASS.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -c "error"`
Expected: `8`.

- [ ] **Step 8: Commit**

```bash
git add app/\(trips\)/ src/lib/collisionPrompt.ts __tests__/
git commit -m "feat(profile): add account section and gate invites behind sign-in"
```

---

## Device verification

Requires the Task 1 EAS build, **two devices and two Apple IDs**. These failures are invisible to single-device, single-account testing, which is the entire reason this phase exists.

- [ ] Anonymous user with existing trips links via Profile → trips survive on the same UID.
- [ ] Fresh install on a second device, sign in → the same trips appear.
- [ ] Wizard step 3 end-to-end: Apple path, and the skip path.
- [ ] Wizard step 3 collision (second Apple ID already used) → signs in and continues to step 4.
- [ ] Profile collision **with trips present** → warning shown, trips genuinely left behind.
- [ ] Anonymous organizer taps share invite → sign-in prompt, not the share sheet.
- [ ] Sign out → fresh anonymous UID, empty trip list, and a subsequent write succeeds. **This is `getAuthedUser`'s re-arm proving itself on device** — the bug that motivated Task 2.
- [ ] Delete account → trips archived, user record gone, re-registration possible.

**Jeremy's own trips: link, do not sign out first.** His existing dev trips are owned by an anonymous UID. Linking preserves it; signing out first would strand them under a UID nobody can ever authenticate as again.
