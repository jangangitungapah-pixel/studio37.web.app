import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

import { firestoreDb } from '../../lib/firebase/client.js';

const defaultFirestoreAdapter = Object.freeze({
  doc,
  getDoc,
  setDoc,
  updateDoc,
});

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }

  return value.trim();
}

function requireRecordPayload(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }

  return value;
}

export function createDocumentRepository({
  adapter = defaultFirestoreAdapter,
  collectionName,
  db = firestoreDb,
  decode = (record) => record,
  encode = (record) => record,
}) {
  const resolvedCollectionName = requireNonEmptyString(collectionName, 'collectionName');

  if (!db) {
    throw new Error(`Firestore is unavailable for repository "${resolvedCollectionName}".`);
  }

  const getRef = (id) =>
    adapter.doc(db, resolvedCollectionName, requireNonEmptyString(id, 'document id'));

  return Object.freeze({
    collectionName: resolvedCollectionName,

    async getById(id) {
      const snapshot = await adapter.getDoc(getRef(id));

      if (!snapshot.exists()) {
        return null;
      }

      return decode({
        ...snapshot.data(),
        id: snapshot.id,
      });
    },

    async setById(id, value, { merge = false } = {}) {
      const resolvedId = requireNonEmptyString(id, 'document id');
      const payload = requireRecordPayload(encode(value), 'encoded document');

      if (merge) {
        await adapter.setDoc(getRef(resolvedId), payload, { merge: true });
      } else {
        await adapter.setDoc(getRef(resolvedId), payload);
      }

      return resolvedId;
    },

    async updateById(id, patch) {
      const resolvedId = requireNonEmptyString(id, 'document id');
      const payload = requireRecordPayload(encode(patch), 'encoded patch');

      await adapter.updateDoc(getRef(resolvedId), payload);
      return resolvedId;
    },
  });
}
