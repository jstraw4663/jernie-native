import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';
import firestore from '@react-native-firebase/firestore';

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

// Sign in anonymously on first load. Idempotent — does nothing if already signed in.
export async function initAuth(): Promise<FirebaseAuthTypes.User> {
  const current = auth().currentUser;
  if (current) return current;
  const { user } = await auth().signInAnonymously();
  return user;
}

export { auth, database, firestore };
