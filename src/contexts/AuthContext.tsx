import React, { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { initAuth, database } from '@/src/lib/firebase';
import { requestAppleCredential, isAppleCancellation } from '@/src/lib/appleAuth';
import { ensureAnonProfile, writeLinkedProfile, readAnonCreatedAt } from '@/src/lib/userProfile';
import { deleteAccountData } from '@/src/lib/deleteAccount';

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
    const handleUser = (u: FirebaseAuthTypes.User | null) => {
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
    };
    // onAuthStateChanged only fires when the uid itself changes (sign-in, sign-out) — it is
    // silent on linkWithCredential, which deliberately preserves the anonymous uid.
    // linkWithCredential (and unlink, and a profile update) instead emit onUserChanged, so
    // both must be observed or the app never learns a link succeeded.
    const unsubscribeAuthState = auth().onAuthStateChanged(handleUser);
    const unsubscribeUserChanged = auth().onUserChanged(handleUser);
    return () => {
      unsubscribeAuthState();
      unsubscribeUserChanged();
    };
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
      try {
        // Auth state is the unrecoverable half of this operation; the profile record is
        // re-derivable. Once linkWithCredential resolves, the link succeeded — a failure
        // here must not be reported as sign-in failure, or a retry hits
        // auth/provider-already-linked with no way forward.
        await writeLinkedProfile(result.user.uid, {
          displayName: apple.displayName,
          email: apple.email,
          now: Date.now(),
        });
      } catch {
        // Non-fatal: the link already succeeded.
      }
      return { ok: true, user: result.user };
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/credential-already-in-use') {
        // `apple.credential` is spent — an Apple identity token is single-use, and the failed
        // link consumed it. Replaying it here fails auth/invalid-credential ("already expired
        // when calling link, or used invalid token(s)"), which is what made "Sign in anyway"
        // dead on device while every test passed. Firebase attaches a usable replacement to
        // the error for exactly this recovery; RNFB's iOS module reads
        // FIRAuthErrorUserInfoUpdatedCredentialKey and surfaces it as userInfo.authCredential.
        const replacement =
          (err as { userInfo?: { authCredential?: FirebaseAuthTypes.AuthCredential | null } })
            ?.userInfo?.authCredential ?? null;
        return {
          ok: false,
          reason: 'credential-already-in-use',
          // Abandons the anonymous uid. Callers warn first when it owns trips.
          signIn: async () => {
            // Android does not reliably populate the updated-credential key. With nothing to
            // replay, a fresh authorization is the only way through — a second Face ID prompt
            // beats an unrecoverable dead end.
            const credential = replacement ?? (await requestAppleCredential()).credential;
            await auth().signInWithCredential(credential);
          },
        };
      }
      // Firebase errors from linkWithCredential carry auth/* codes, never
      // ERR_REQUEST_CANCELED — that code only comes from the Apple sheet itself, handled in
      // the requestAppleCredential() catch above.
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
    const current = auth().currentUser;
    if (!current) throw new Error('Not signed in');

    const snap = await database().ref(`users/${current.uid}/trips`).once('value');
    const index = (snap.exists() ? snap.val() : {}) as Record<string, { role: string; joinedAt: number }>;
    // Only the trips this user OWNS get archived here. A joined (traveler) trip's
    // `deletedAt` is owner-only per database.rules.json, so passing a joined trip's id to
    // deleteAccountData would throw PERMISSION_DENIED and abort deletion entirely — leaving
    // users/{uid} unremoved and the auth user never deleted, unrecoverably on retry.
    const ownedTripIds = Object.entries(index)
      .filter(([, entry]) => entry.role === 'organizer')
      .map(([tripId]) => tripId);

    await deleteAccountData(current.uid, ownedTripIds);

    try {
      await current.delete();
    } catch (err) {
      if ((err as { code?: string })?.code === 'auth/requires-recent-login') {
        let apple: Awaited<ReturnType<typeof requestAppleCredential>>;
        try {
          apple = await requestAppleCredential();
        } catch (e) {
          if (isAppleCancellation(e)) throw new Error('Re-authentication required but was cancelled');
          throw new Error('Re-authentication required but failed');
        }
        try {
          await current.reauthenticateWithCredential(apple.credential);
        } catch {
          // e.g. auth/user-mismatch when the user picks a different Apple ID at the
          // re-auth prompt — surface a clean message, not the raw Firebase code, mid-deletion.
          throw new Error('Re-authentication failed');
        }
        await auth().currentUser?.delete();
      } else {
        throw err;
      }
    }
    await auth().signInAnonymously();
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, anonCreatedAt, signInWithApple, signOut, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}
