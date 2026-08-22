import { doc, onSnapshot } from 'firebase/firestore';

import { decodeUserProfileDocument } from '../features/auth/userProfile.js';
import { firestoreDb } from '../lib/firebase/client.js';

export const USER_PROFILE_REPOSITORY_UNAVAILABLE_CODE =
  'studio37/user-profile-repository-unavailable';

const defaultFirestoreAdapter = Object.freeze({ doc, onSnapshot });

function requireUid(value) {
  if (typeof value !== 'string' || !value.trim() || value.includes('/')) {
    throw new TypeError('Firebase uid must be a non-empty document id.');
  }

  return value.trim();
}

function requireCallback(value, label) {
  if (typeof value !== 'function') {
    throw new TypeError(`${label} must be a function.`);
  }

  return value;
}

function requireFirestore(db) {
  if (db) return db;

  const error = new Error('Firestore is unavailable for the user profile repository.');
  error.code = USER_PROFILE_REPOSITORY_UNAVAILABLE_CODE;
  throw error;
}

export function createUserProfileRepository({
  adapter = defaultFirestoreAdapter,
  db = firestoreDb,
} = {}) {
  return Object.freeze({
    collectionName: 'users',

    observeByUid(uid, onProfileChanged, onError) {
      const resolvedUid = requireUid(uid);
      const nextProfile = requireCallback(onProfileChanged, 'onProfileChanged');
      const handleError = requireCallback(onError, 'onError');
      const reference = adapter.doc(requireFirestore(db), 'users', resolvedUid);

      return adapter.onSnapshot(
        reference,
        (snapshot) => {
          try {
            if (!snapshot.exists()) {
              nextProfile(null);
              return;
            }

            nextProfile(
              decodeUserProfileDocument({
                ...snapshot.data(),
                id: snapshot.id,
              }),
            );
          } catch (error) {
            handleError(error);
          }
        },
        handleError,
      );
    },
  });
}

export const userProfileRepository = createUserProfileRepository();
