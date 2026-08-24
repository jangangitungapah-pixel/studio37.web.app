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
  compareSessionTypes,
  decodeSessionTypeDocument,
  normalizeSessionTypeActorUid,
  normalizeSessionTypeDetails,
  normalizeSessionTypeId,
  normalizeSessionTypeStatus,
  SESSION_TYPE_LIST_LIMIT,
  SESSION_TYPE_STATUSES,
  SESSION_TYPES_COLLECTION_NAME,
} from '../features/pricing/sessionTypes.js';
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
    throw new Error('Firestore is unavailable for repository "sessionTypes".');
  }

  return value;
}

export function createSessionTypeRepository({
  adapter = defaultFirestoreAdapter,
  db = firestoreDb,
  timestampFactory = serverTimestamp,
} = {}) {
  const resolvedDb = requireFirestore(db);
  const createWriteTimestamp = requireTimestampFactory(timestampFactory);
  const collectionReference = adapter.collection(resolvedDb, SESSION_TYPES_COLLECTION_NAME);

  const getDocumentReference = (sessionTypeId) =>
    adapter.doc(collectionReference, normalizeSessionTypeId(sessionTypeId));

  return Object.freeze({
    collectionName: SESSION_TYPES_COLLECTION_NAME,
    listLimit: SESSION_TYPE_LIST_LIMIT,

    async listSessionTypes() {
      const sessionTypeQuery = adapter.query(
        collectionReference,
        adapter.orderBy('displayOrder', 'asc'),
        adapter.limit(SESSION_TYPE_LIST_LIMIT),
      );
      const snapshot = await adapter.getDocs(sessionTypeQuery);

      return Object.freeze(
        snapshot.docs
          .map((sessionTypeSnapshot) =>
            decodeSessionTypeDocument({
              ...sessionTypeSnapshot.data(),
              id: sessionTypeSnapshot.id,
            }),
          )
          .sort(compareSessionTypes),
      );
    },

    async createSessionType(value, { actorUid } = {}) {
      const details = normalizeSessionTypeDetails(value);
      const resolvedActorUid = normalizeSessionTypeActorUid(actorUid);
      const reference = adapter.doc(collectionReference);
      const sessionTypeId = normalizeSessionTypeId(reference.id);
      const writeTimestamp = createWriteTimestamp();

      await adapter.setDoc(reference, {
        ...details,
        createdAt: writeTimestamp,
        createdByUid: resolvedActorUid,
        status: SESSION_TYPE_STATUSES.ACTIVE,
        updatedAt: writeTimestamp,
        updatedByUid: resolvedActorUid,
      });

      return sessionTypeId;
    },

    async updateSessionType(sessionTypeId, value, { actorUid } = {}) {
      const details = normalizeSessionTypeDetails(value);
      const resolvedActorUid = normalizeSessionTypeActorUid(actorUid);
      const resolvedSessionTypeId = normalizeSessionTypeId(sessionTypeId);

      await adapter.updateDoc(getDocumentReference(resolvedSessionTypeId), {
        ...details,
        updatedAt: createWriteTimestamp(),
        updatedByUid: resolvedActorUid,
      });

      return resolvedSessionTypeId;
    },

    async setSessionTypeStatus(sessionTypeId, status, { actorUid } = {}) {
      const resolvedSessionTypeId = normalizeSessionTypeId(sessionTypeId);
      const resolvedStatus = normalizeSessionTypeStatus(status);
      const resolvedActorUid = normalizeSessionTypeActorUid(actorUid);

      await adapter.updateDoc(getDocumentReference(resolvedSessionTypeId), {
        status: resolvedStatus,
        updatedAt: createWriteTimestamp(),
        updatedByUid: resolvedActorUid,
      });

      return resolvedSessionTypeId;
    },
  });
}

export const sessionTypeRepository = createSessionTypeRepository();
