import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import database from '@react-native-firebase/database';
import firestore from '@react-native-firebase/firestore';

// authReady resolves once anonymous auth has a valid token.
// All Firestore operations must await this before making calls.
export const authReady: Promise<FirebaseAuthTypes.User> = new Promise((resolve) => {
  const unsubscribe = auth().onAuthStateChanged((user) => {
    if (user) {
      unsubscribe();
      resolve(user);
    }
  });
});

// Sign in anonymously on first load. Idempotent — does nothing if already signed in.
export async function initAuth(): Promise<FirebaseAuthTypes.User> {
  const current = auth().currentUser;
  if (current) return current;
  const { user } = await auth().signInAnonymously();
  return user;
}

export { auth, database, firestore };
