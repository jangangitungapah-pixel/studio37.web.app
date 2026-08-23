import { doc, getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';

import { decodeUserProfileDocument } from '../features/auth/userProfile.js';
import {
  decodeOperatorDocument,
  normalizeOperatorActorUid,
  normalizeOperatorId,
} from '../features/settings/operators.js';
import { firestoreDb } from '../lib/firebase/client.js';

export const OPERATOR_ACCOUNT_LINK_ERROR_CODES = Object.freeze({
  INVARIANT_BROKEN: 'studio37/operator-account-link-invariant-broken',
  OPERATOR_ALREADY_LINKED: 'studio37/operator-already-linked',
  OPERATOR_NOT_FOUND: 'studio37/operator-not-found',
  OPERATOR_NOT_LINKED: 'studio37/operator-not-linked',
  REPOSITORY_UNAVAILABLE: 'studio37/operator-account-link-repository-unavailable',
  USER_ALREADY_LINKED: 'studio37/user-already-linked',
  USER_NOT_FOUND: 'studio37/user-profile-not-found',
});

const defaultFirestoreAdapter = Object.freeze({ doc, getDoc, runTransaction });

function createRepositoryError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function requireFirestore(value) {
  if (value) return value;

  throw createRepositoryError(
    OPERATOR_ACCOUNT_LINK_ERROR_CODES.REPOSITORY_UNAVAILABLE,
    'Firestore is unavailable for the operator account-link repository.',
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

function decodeOperatorSnapshot(snapshot, operatorId) {
  if (!snapshot.exists()) {
    throw createRepositoryError(
      OPERATOR_ACCOUNT_LINK_ERROR_CODES.OPERATOR_NOT_FOUND,
      `Operator ${operatorId} does not exist.`,
    );
  }

  return decodeOperatorDocument({ ...snapshot.data(), id: snapshot.id });
}

function decodeUserSnapshot(snapshot, userUid) {
  if (!snapshot.exists()) {
    throw createRepositoryError(
      OPERATOR_ACCOUNT_LINK_ERROR_CODES.USER_NOT_FOUND,
      `User profile ${userUid} does not exist.`,
    );
  }

  return decodeUserProfileDocument({ ...snapshot.data(), id: snapshot.id });
}

export function createOperatorAccountLinkRepository({
  adapter = defaultFirestoreAdapter,
  db = firestoreDb,
  timestampFactory = serverTimestamp,
} = {}) {
  const resolvedDb = requireFirestore(db);
  const createWriteTimestamp = requireTimestampFactory(timestampFactory);
  const getOperatorReference = (operatorId) =>
    adapter.doc(resolvedDb, 'operators', normalizeOperatorId(operatorId));
  const getUserReference = (userUid) => adapter.doc(resolvedDb, 'users', normalizeUserUid(userUid));

  return Object.freeze({
    async getUserByUid(userUid) {
      const resolvedUserUid = normalizeUserUid(userUid);
      const snapshot = await adapter.getDoc(getUserReference(resolvedUserUid));

      if (!snapshot.exists()) return null;
      return decodeUserProfileDocument({ ...snapshot.data(), id: snapshot.id });
    },

    async linkOperatorToUser(operatorId, userUid, { actorUid } = {}) {
      const resolvedOperatorId = normalizeOperatorId(operatorId);
      const resolvedUserUid = normalizeUserUid(userUid);
      const resolvedActorUid = normalizeOperatorActorUid(actorUid);
      const operatorReference = getOperatorReference(resolvedOperatorId);
      const userReference = getUserReference(resolvedUserUid);

      return adapter.runTransaction(resolvedDb, async (transaction) => {
        const operatorSnapshot = await transaction.get(operatorReference);
        const userSnapshot = await transaction.get(userReference);
        const operator = decodeOperatorSnapshot(operatorSnapshot, resolvedOperatorId);
        const user = decodeUserSnapshot(userSnapshot, resolvedUserUid);

        if (operator.linkedUserUid !== null) {
          throw createRepositoryError(
            OPERATOR_ACCOUNT_LINK_ERROR_CODES.OPERATOR_ALREADY_LINKED,
            `${operator.displayName} is already linked to a user profile.`,
          );
        }

        if (user.operatorId !== null) {
          throw createRepositoryError(
            OPERATOR_ACCOUNT_LINK_ERROR_CODES.USER_ALREADY_LINKED,
            `${user.displayName} is already linked to an operator profile.`,
          );
        }

        const writeTimestamp = createWriteTimestamp();
        transaction.update(operatorReference, {
          linkedUserUid: resolvedUserUid,
          updatedAt: writeTimestamp,
          updatedByUid: resolvedActorUid,
        });
        transaction.update(userReference, {
          operatorId: resolvedOperatorId,
          updatedAt: writeTimestamp,
        });

        return Object.freeze({ operatorId: resolvedOperatorId, userUid: resolvedUserUid });
      });
    },

    async unlinkOperatorFromUser(operatorId, { actorUid } = {}) {
      const resolvedOperatorId = normalizeOperatorId(operatorId);
      const resolvedActorUid = normalizeOperatorActorUid(actorUid);
      const operatorReference = getOperatorReference(resolvedOperatorId);

      return adapter.runTransaction(resolvedDb, async (transaction) => {
        const operatorSnapshot = await transaction.get(operatorReference);
        const operator = decodeOperatorSnapshot(operatorSnapshot, resolvedOperatorId);

        if (operator.linkedUserUid === null) {
          throw createRepositoryError(
            OPERATOR_ACCOUNT_LINK_ERROR_CODES.OPERATOR_NOT_LINKED,
            `${operator.displayName} is not linked to a user profile.`,
          );
        }

        const resolvedUserUid = operator.linkedUserUid;
        const userReference = getUserReference(resolvedUserUid);
        const userSnapshot = await transaction.get(userReference);
        const user = decodeUserSnapshot(userSnapshot, resolvedUserUid);

        if (user.operatorId !== resolvedOperatorId) {
          throw createRepositoryError(
            OPERATOR_ACCOUNT_LINK_ERROR_CODES.INVARIANT_BROKEN,
            'The operator and user profile do not contain reciprocal account links.',
          );
        }

        const writeTimestamp = createWriteTimestamp();
        transaction.update(operatorReference, {
          linkedUserUid: null,
          updatedAt: writeTimestamp,
          updatedByUid: resolvedActorUid,
        });
        transaction.update(userReference, {
          operatorId: null,
          updatedAt: writeTimestamp,
        });

        return Object.freeze({ operatorId: resolvedOperatorId, userUid: resolvedUserUid });
      });
    },
  });
}

export const operatorAccountLinkRepository = createOperatorAccountLinkRepository();
