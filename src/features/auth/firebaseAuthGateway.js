import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';

import { firebaseAuth } from '../../lib/firebase/client.js';

export const AUTH_NOT_CONFIGURED_CODE = 'studio37/auth-not-configured';

function requireConfiguredAuth(auth) {
  if (auth) return auth;

  const error = new Error('Firebase Authentication is not configured.');
  error.code = AUTH_NOT_CONFIGURED_CODE;
  throw error;
}

export function createFirebaseAuthGateway(auth = firebaseAuth) {
  return Object.freeze({
    async configurePersistence() {
      await setPersistence(requireConfiguredAuth(auth), browserLocalPersistence);
    },

    observeSession(onUserChanged, onError) {
      return onAuthStateChanged(requireConfiguredAuth(auth), onUserChanged, onError);
    },

    async signIn({ email, password }) {
      const credential = await signInWithEmailAndPassword(
        requireConfiguredAuth(auth),
        email,
        password,
      );

      return credential.user;
    },

    signOut() {
      return firebaseSignOut(requireConfiguredAuth(auth));
    },
  });
}

export const firebaseAuthGateway = createFirebaseAuthGateway();
