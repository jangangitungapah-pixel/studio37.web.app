import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import {
  comparePermissionSets,
  decodePermissionSetDocument,
  normalizePermissionSetDetails,
  normalizePermissionSetId,
  normalizePermissionSetStatus,
  PERMISSION_SETS_COLLECTION_NAME,
  PERMISSION_SET_LIST_LIMIT,
  PERMISSION_SET_STATUSES,
} from '../features/auth/permissionSet.js';
import {
  decodeUserProfileDocument,
  USER_PROFILE_ROLES,
  USER_PROFILE_STATUSES,
} from '../features/auth/userProfile.js';
import {
  decodeOperatorDocument,
  normalizeOperatorId,
  OPERATOR_STATUSES,
  OPERATOR_TYPES,
} from '../features/settings/operators.js';
import { firestoreDb } from '../lib/firebase/client.js';

export const PERMISSION_ADMINISTRATION_ERROR_CODES = Object.freeze({
  OPERATOR_INELIGIBLE: 'studio37/permission-assignment-operator-ineligible',
  OPERATOR_NOT_FOUND: 'studio37/permission-assignment-operator-not-found',
  PERMISSION_SET_DISABLED: 'studio37/permission-assignment-set-disabled',
  PERMISSION_SET_NOT_FOUND: 'studio37/permission-assignment-set-not-found',
  REPOSITORY_UNAVAILABLE: 'studio37/permission-administration-repository-unavailable',
  USER_INELIGIBLE: 'studio37/permission-assignment-user-ineligible',
  USER_NOT_FOUND: 'studio37/permission-assignment-user-not-found',
});

const defaultFirestoreAdapter = Object.freeze({
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
});

function createRepositoryError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function requireFirestore(value) {
  if (value) return value;

  throw createRepositoryError(
    PERMISSION_ADMINISTRATION_ERROR_CODES.REPOSITORY_UNAVAILABLE,
    'Firestore is unavailable for the permission administration repository.',
  );
}

function requireTimestampFactory(value) {
  if (typeof value !== 'function') {
    throw new TypeError('timestampFactory must be a function.');
  }

  return value;
}

function normalizeUserUid(value) {
  if (typeof value !== 'string') {
    throw new TypeError('userUid must be a non-empty Firebase document id.');
  }

  const userUid = value.trim();

  if (!userUid || userUid.length > 128 || userUid.includes('/')) {
    throw new TypeError('userUid must be a non-empty Firebase document id.');
  }

  return userUid;
}

function normalizeAssignedPermissionSetId(value) {
  if (value === null || value === undefined) return null;
  return normalizePermissionSetId(value);
}

function decodeUserSnapshot(snapshot, userUid) {
  if (!snapshot.exists()) {
    throw createRepositoryError(
      PERMISSION_ADMINISTRATION_ERROR_CODES.USER_NOT_FOUND,
      `User profile ${userUid} does not exist.`,
    );
  }

  return decodeUserProfileDocument({ ...snapshot.data(), id: snapshot.id });
}

function decodeOperatorSnapshot(snapshot, operatorId) {
  if (!snapshot.exists()) {
    throw createRepositoryError(
      PERMISSION_ADMINISTRATION_ERROR_CODES.OPERATOR_NOT_FOUND,
      `Operator ${operatorId} does not exist.`,
    );
  }

  return decodeOperatorDocument({ ...snapshot.data(), id: snapshot.id });
}

function decodePermissionSetSnapshot(snapshot, permissionSetId) {
  if (!snapshot.exists()) {
    throw createRepositoryError(
      PERMISSION_ADMINISTRATION_ERROR_CODES.PERMISSION_SET_NOT_FOUND,
      `Permission set ${permissionSetId} does not exist.`,
    );
  }

  return decodePermissionSetDocument({ ...snapshot.data(), id: snapshot.id });
}

function assertAssignableUser(user) {
  if (
    user.role !== USER_PROFILE_ROLES.STUDIO_OPERATOR ||
    user.status !== USER_PROFILE_STATUSES.ACTIVE ||
    user.operatorId === null
  ) {
    throw createRepositoryError(
      PERMISSION_ADMINISTRATION_ERROR_CODES.USER_INELIGIBLE,
      'Only an active linked Studio Operator user can receive a permission set.',
    );
  }
}

function assertReciprocalStudioOperator(operator, user) {
  if (
    operator.status !== OPERATOR_STATUSES.ACTIVE ||
    operator.linkedUserUid !== user.uid ||
    !operator.operatorTypes.includes(OPERATOR_TYPES.STUDIO_OPERATOR)
  ) {
    throw createRepositoryError(
      PERMISSION_ADMINISTRATION_ERROR_CODES.OPERATOR_INELIGIBLE,
      'The linked operator is inactive, is not a Studio Operator, or has a broken account link.',
    );
  }
}

export function createPermissionAdministrationRepository({
  adapter = defaultFirestoreAdapter,
  db = firestoreDb,
  timestampFactory = serverTimestamp,
} = {}) {
  const resolvedDb = requireFirestore(db);
  const createWriteTimestamp = requireTimestampFactory(timestampFactory);
  const permissionSetCollection = adapter.collection(resolvedDb, PERMISSION_SETS_COLLECTION_NAME);
  const getPermissionSetReference = (permissionSetId) =>
    adapter.doc(permissionSetCollection, normalizePermissionSetId(permissionSetId));
  const getUserReference = (userUid) => adapter.doc(resolvedDb, 'users', normalizeUserUid(userUid));
  const getOperatorReference = (operatorId) =>
    adapter.doc(resolvedDb, 'operators', normalizeOperatorId(operatorId));

  return Object.freeze({
    collectionName: PERMISSION_SETS_COLLECTION_NAME,
    listLimit: PERMISSION_SET_LIST_LIMIT,

    async listPermissionSets() {
      const permissionSetQuery = adapter.query(
        permissionSetCollection,
        adapter.orderBy('name', 'asc'),
        adapter.limit(PERMISSION_SET_LIST_LIMIT),
      );
      const snapshot = await adapter.getDocs(permissionSetQuery);

      return Object.freeze(
        snapshot.docs
          .map((permissionSetSnapshot) =>
            decodePermissionSetDocument({
              ...permissionSetSnapshot.data(),
              id: permissionSetSnapshot.id,
            }),
          )
          .sort(comparePermissionSets),
      );
    },

    async getUserByUid(userUid) {
      const resolvedUserUid = normalizeUserUid(userUid);
      const snapshot = await adapter.getDoc(getUserReference(resolvedUserUid));

      if (!snapshot.exists()) return null;
      return decodeUserProfileDocument({ ...snapshot.data(), id: snapshot.id });
    },

    async createPermissionSet(value) {
      const details = normalizePermissionSetDetails(value);
      const reference = adapter.doc(permissionSetCollection);
      const permissionSetId = normalizePermissionSetId(reference.id);
      const writeTimestamp = createWriteTimestamp();

      await adapter.setDoc(reference, {
        ...details,
        createdAt: writeTimestamp,
        status: PERMISSION_SET_STATUSES.ACTIVE,
        updatedAt: writeTimestamp,
      });

      return permissionSetId;
    },

    async updatePermissionSet(permissionSetId, value) {
      const resolvedPermissionSetId = normalizePermissionSetId(permissionSetId);
      const details = normalizePermissionSetDetails(value);

      await adapter.updateDoc(getPermissionSetReference(resolvedPermissionSetId), {
        ...details,
        updatedAt: createWriteTimestamp(),
      });

      return resolvedPermissionSetId;
    },

    async setPermissionSetStatus(permissionSetId, status) {
      const resolvedPermissionSetId = normalizePermissionSetId(permissionSetId);
      const resolvedStatus = normalizePermissionSetStatus(status);

      await adapter.updateDoc(getPermissionSetReference(resolvedPermissionSetId), {
        status: resolvedStatus,
        updatedAt: createWriteTimestamp(),
      });

      return resolvedPermissionSetId;
    },

    async assignPermissionSetToUser(userUid, permissionSetId) {
      const resolvedUserUid = normalizeUserUid(userUid);
      const resolvedPermissionSetId = normalizeAssignedPermissionSetId(permissionSetId);
      const userReference = getUserReference(resolvedUserUid);

      return adapter.runTransaction(resolvedDb, async (transaction) => {
        const userSnapshot = await transaction.get(userReference);
        const user = decodeUserSnapshot(userSnapshot, resolvedUserUid);

        if (user.role !== USER_PROFILE_ROLES.STUDIO_OPERATOR) {
          throw createRepositoryError(
            PERMISSION_ADMINISTRATION_ERROR_CODES.USER_INELIGIBLE,
            'Owner profiles cannot receive delegated permission sets.',
          );
        }

        if (user.permissionSetId === resolvedPermissionSetId) {
          return Object.freeze({
            changed: false,
            permissionSetId: resolvedPermissionSetId,
            userUid: resolvedUserUid,
          });
        }

        if (resolvedPermissionSetId !== null) {
          assertAssignableUser(user);
          const operatorReference = getOperatorReference(user.operatorId);
          const permissionSetReference = getPermissionSetReference(resolvedPermissionSetId);
          const operatorSnapshot = await transaction.get(operatorReference);
          const permissionSetSnapshot = await transaction.get(permissionSetReference);
          const operator = decodeOperatorSnapshot(operatorSnapshot, user.operatorId);
          const permissionSet = decodePermissionSetSnapshot(
            permissionSetSnapshot,
            resolvedPermissionSetId,
          );

          assertReciprocalStudioOperator(operator, user);

          if (permissionSet.status !== PERMISSION_SET_STATUSES.ACTIVE) {
            throw createRepositoryError(
              PERMISSION_ADMINISTRATION_ERROR_CODES.PERMISSION_SET_DISABLED,
              `${permissionSet.name} is disabled and cannot be assigned.`,
            );
          }
        }

        transaction.update(userReference, {
          permissionSetId: resolvedPermissionSetId,
          updatedAt: createWriteTimestamp(),
        });

        return Object.freeze({
          changed: true,
          permissionSetId: resolvedPermissionSetId,
          userUid: resolvedUserUid,
        });
      });
    },
  });
}

export const permissionAdministrationRepository = createPermissionAdministrationRepository();
