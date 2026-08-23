import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import {
  compareOperators,
  decodeOperatorDocument,
  normalizeOperatorActorUid,
  normalizeOperatorDetails,
  normalizeOperatorId,
  normalizeOperatorStatus,
  OPERATOR_LIST_LIMIT,
  OPERATOR_STATUSES,
  OPERATORS_COLLECTION_NAME,
} from '../features/settings/operators.js';
import { firestoreDb } from '../lib/firebase/client.js';

const defaultFirestoreAdapter = Object.freeze({
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
});

function requireTimestampFactory(value) {
  if (typeof value !== 'function') {
    throw new TypeError('timestampFactory must be a function.');
  }

  return value;
}

function requireFirestore(value) {
  if (!value) {
    throw new Error('Firestore is unavailable for repository "operators".');
  }

  return value;
}

export function createOperatorRepository({
  adapter = defaultFirestoreAdapter,
  db = firestoreDb,
  timestampFactory = serverTimestamp,
} = {}) {
  const resolvedDb = requireFirestore(db);
  const createWriteTimestamp = requireTimestampFactory(timestampFactory);
  const collectionReference = adapter.collection(resolvedDb, OPERATORS_COLLECTION_NAME);

  const getDocumentReference = (operatorId) =>
    adapter.doc(collectionReference, normalizeOperatorId(operatorId));

  return Object.freeze({
    collectionName: OPERATORS_COLLECTION_NAME,
    listLimit: OPERATOR_LIST_LIMIT,

    async listOperators() {
      const operatorQuery = adapter.query(
        collectionReference,
        adapter.orderBy('displayName', 'asc'),
        adapter.limit(OPERATOR_LIST_LIMIT),
      );
      const snapshot = await adapter.getDocs(operatorQuery);

      return Object.freeze(
        snapshot.docs
          .map((operatorSnapshot) =>
            decodeOperatorDocument({
              ...operatorSnapshot.data(),
              id: operatorSnapshot.id,
            }),
          )
          .sort(compareOperators),
      );
    },

    async createOperator(value, { actorUid } = {}) {
      const details = normalizeOperatorDetails(value);
      const resolvedActorUid = normalizeOperatorActorUid(actorUid);
      const reference = adapter.doc(collectionReference);
      const operatorId = normalizeOperatorId(reference.id);
      const writeTimestamp = createWriteTimestamp();

      await adapter.setDoc(reference, {
        ...details,
        createdAt: writeTimestamp,
        createdByUid: resolvedActorUid,
        linkedUserUid: null,
        status: OPERATOR_STATUSES.ACTIVE,
        updatedAt: writeTimestamp,
        updatedByUid: resolvedActorUid,
      });

      return operatorId;
    },

    async updateOperator(operatorId, value, { actorUid } = {}) {
      const details = normalizeOperatorDetails(value);
      const resolvedActorUid = normalizeOperatorActorUid(actorUid);
      const resolvedOperatorId = normalizeOperatorId(operatorId);

      await adapter.updateDoc(getDocumentReference(resolvedOperatorId), {
        ...details,
        updatedAt: createWriteTimestamp(),
        updatedByUid: resolvedActorUid,
      });

      return resolvedOperatorId;
    },

    async setOperatorStatus(operatorId, status, { actorUid } = {}) {
      const resolvedOperatorId = normalizeOperatorId(operatorId);
      const resolvedStatus = normalizeOperatorStatus(status);
      const resolvedActorUid = normalizeOperatorActorUid(actorUid);

      await adapter.updateDoc(getDocumentReference(resolvedOperatorId), {
        status: resolvedStatus,
        updatedAt: createWriteTimestamp(),
        updatedByUid: resolvedActorUid,
      });

      return resolvedOperatorId;
    },
  });
}

export const operatorRepository = createOperatorRepository();
