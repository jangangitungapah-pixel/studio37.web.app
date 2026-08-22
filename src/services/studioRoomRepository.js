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
  compareStudioRooms,
  decodeStudioRoomDocument,
  normalizeStudioRoomActorUid,
  normalizeStudioRoomDetails,
  normalizeStudioRoomId,
  normalizeStudioRoomStatus,
  STUDIO_ROOM_LIST_LIMIT,
  STUDIO_ROOM_STATUSES,
  STUDIO_ROOMS_COLLECTION_NAME,
} from '../features/settings/studioRooms.js';
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
    throw new Error('Firestore is unavailable for repository "studios".');
  }

  return value;
}

export function createStudioRoomRepository({
  adapter = defaultFirestoreAdapter,
  db = firestoreDb,
  timestampFactory = serverTimestamp,
} = {}) {
  const resolvedDb = requireFirestore(db);
  const createWriteTimestamp = requireTimestampFactory(timestampFactory);
  const collectionReference = adapter.collection(resolvedDb, STUDIO_ROOMS_COLLECTION_NAME);

  const getDocumentReference = (roomId) =>
    adapter.doc(collectionReference, normalizeStudioRoomId(roomId));

  return Object.freeze({
    collectionName: STUDIO_ROOMS_COLLECTION_NAME,
    listLimit: STUDIO_ROOM_LIST_LIMIT,

    async listStudioRooms() {
      const roomQuery = adapter.query(
        collectionReference,
        adapter.orderBy('displayOrder', 'asc'),
        adapter.limit(STUDIO_ROOM_LIST_LIMIT),
      );
      const snapshot = await adapter.getDocs(roomQuery);

      return Object.freeze(
        snapshot.docs
          .map((roomSnapshot) =>
            decodeStudioRoomDocument({
              ...roomSnapshot.data(),
              id: roomSnapshot.id,
            }),
          )
          .sort(compareStudioRooms),
      );
    },

    async createStudioRoom(value, { actorUid } = {}) {
      const details = normalizeStudioRoomDetails(value);
      const resolvedActorUid = normalizeStudioRoomActorUid(actorUid);
      const reference = adapter.doc(collectionReference);
      const roomId = normalizeStudioRoomId(reference.id);
      const writeTimestamp = createWriteTimestamp();

      await adapter.setDoc(reference, {
        ...details,
        createdAt: writeTimestamp,
        createdByUid: resolvedActorUid,
        status: STUDIO_ROOM_STATUSES.ACTIVE,
        updatedAt: writeTimestamp,
        updatedByUid: resolvedActorUid,
      });

      return roomId;
    },

    async updateStudioRoom(roomId, value, { actorUid } = {}) {
      const details = normalizeStudioRoomDetails(value);
      const resolvedActorUid = normalizeStudioRoomActorUid(actorUid);
      const resolvedRoomId = normalizeStudioRoomId(roomId);

      await adapter.updateDoc(getDocumentReference(resolvedRoomId), {
        ...details,
        updatedAt: createWriteTimestamp(),
        updatedByUid: resolvedActorUid,
      });

      return resolvedRoomId;
    },

    async setStudioRoomStatus(roomId, status, { actorUid } = {}) {
      const resolvedRoomId = normalizeStudioRoomId(roomId);
      const resolvedStatus = normalizeStudioRoomStatus(status);
      const resolvedActorUid = normalizeStudioRoomActorUid(actorUid);

      await adapter.updateDoc(getDocumentReference(resolvedRoomId), {
        status: resolvedStatus,
        updatedAt: createWriteTimestamp(),
        updatedByUid: resolvedActorUid,
      });

      return resolvedRoomId;
    },
  });
}

export const studioRoomRepository = createStudioRoomRepository();
