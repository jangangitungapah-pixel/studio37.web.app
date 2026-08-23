import { doc, onSnapshot } from 'firebase/firestore';

import { decodePermissionSetDocument } from '../features/auth/permissionSet.js';
import { firestoreDb } from '../lib/firebase/client.js';

export const PERMISSION_SET_REPOSITORY_UNAVAILABLE_CODE =
  'studio37/permission-set-repository-unavailable';

const defaultFirestoreAdapter = Object.freeze({ doc, onSnapshot });

function requireDocumentId(value) {
  if (typeof value !== 'string' || !value.trim() || value.includes('/')) {
    throw new TypeError('Permission set id must be a non-empty document id.');
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

  const error = new Error('Firestore is unavailable for the permission set repository.');
  error.code = PERMISSION_SET_REPOSITORY_UNAVAILABLE_CODE;
  throw error;
}

export function createPermissionSetRepository({
  adapter = defaultFirestoreAdapter,
  db = firestoreDb,
} = {}) {
  return Object.freeze({
    collectionName: 'permissionSets',

    observeById(permissionSetId, onPermissionSetChanged, onError) {
      const resolvedId = requireDocumentId(permissionSetId);
      const nextPermissionSet = requireCallback(onPermissionSetChanged, 'onPermissionSetChanged');
      const handleError = requireCallback(onError, 'onError');
      const reference = adapter.doc(requireFirestore(db), 'permissionSets', resolvedId);

      return adapter.onSnapshot(
        reference,
        (snapshot) => {
          try {
            if (!snapshot.exists()) {
              nextPermissionSet(null);
              return;
            }

            nextPermissionSet(
              decodePermissionSetDocument({
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

export const permissionSetRepository = createPermissionSetRepository();
