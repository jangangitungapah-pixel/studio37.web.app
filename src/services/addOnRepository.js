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
  ADD_ON_LIST_LIMIT,
  ADD_ON_STATUSES,
  ADD_ONS_COLLECTION_NAME,
  compareAddOns,
  decodeAddOnDocument,
  normalizeAddOnActorUid,
  normalizeAddOnDetails,
  normalizeAddOnId,
  normalizeAddOnStatus,
} from '../features/pricing/addOns.js';
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
  if (typeof value !== 'function') throw new TypeError('timestampFactory must be a function.');
  return value;
}

function requireFirestore(value) {
  if (!value) throw new Error('Firestore is unavailable for repository "addOns".');
  return value;
}

export function createAddOnRepository({
  adapter = defaultFirestoreAdapter,
  db = firestoreDb,
  timestampFactory = serverTimestamp,
} = {}) {
  const resolvedDb = requireFirestore(db);
  const createWriteTimestamp = requireTimestampFactory(timestampFactory);
  const collectionReference = adapter.collection(resolvedDb, ADD_ONS_COLLECTION_NAME);
  const getDocumentReference = (addOnId) =>
    adapter.doc(collectionReference, normalizeAddOnId(addOnId));

  return Object.freeze({
    collectionName: ADD_ONS_COLLECTION_NAME,
    listLimit: ADD_ON_LIST_LIMIT,

    async listAddOns() {
      const addOnQuery = adapter.query(
        collectionReference,
        adapter.orderBy('displayOrder', 'asc'),
        adapter.limit(ADD_ON_LIST_LIMIT),
      );
      const snapshot = await adapter.getDocs(addOnQuery);

      return Object.freeze(
        snapshot.docs
          .map((addOnSnapshot) =>
            decodeAddOnDocument({ ...addOnSnapshot.data(), id: addOnSnapshot.id }),
          )
          .sort(compareAddOns),
      );
    },

    async createAddOn(value, { actorUid } = {}) {
      const details = normalizeAddOnDetails(value);
      const resolvedActorUid = normalizeAddOnActorUid(actorUid);
      const reference = adapter.doc(collectionReference);
      const addOnId = normalizeAddOnId(reference.id);
      const writeTimestamp = createWriteTimestamp();

      await adapter.setDoc(reference, {
        ...details,
        createdAt: writeTimestamp,
        createdByUid: resolvedActorUid,
        status: ADD_ON_STATUSES.ACTIVE,
        updatedAt: writeTimestamp,
        updatedByUid: resolvedActorUid,
      });
      return addOnId;
    },

    async updateAddOn(addOnId, value, { actorUid } = {}) {
      const details = normalizeAddOnDetails(value);
      const resolvedActorUid = normalizeAddOnActorUid(actorUid);
      const resolvedAddOnId = normalizeAddOnId(addOnId);

      await adapter.updateDoc(getDocumentReference(resolvedAddOnId), {
        ...details,
        updatedAt: createWriteTimestamp(),
        updatedByUid: resolvedActorUid,
      });
      return resolvedAddOnId;
    },

    async setAddOnStatus(addOnId, status, { actorUid } = {}) {
      const resolvedAddOnId = normalizeAddOnId(addOnId);
      const resolvedStatus = normalizeAddOnStatus(status);
      const resolvedActorUid = normalizeAddOnActorUid(actorUid);

      await adapter.updateDoc(getDocumentReference(resolvedAddOnId), {
        status: resolvedStatus,
        updatedAt: createWriteTimestamp(),
        updatedByUid: resolvedActorUid,
      });
      return resolvedAddOnId;
    },
  });
}

export const addOnRepository = createAddOnRepository();
