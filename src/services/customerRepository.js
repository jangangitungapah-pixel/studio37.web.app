import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

import {
  CUSTOMERS_COLLECTION_NAME,
  CUSTOMER_PHONE_MATCH_LIMIT,
  decodeCustomerDocument,
  normalizeCustomerActorUid,
  normalizeCustomerDetails,
  normalizeCustomerId,
  normalizeCustomerPhoneMatch,
} from '../features/customers/customers.js';
import { firestoreDb } from '../lib/firebase/client.js';

const defaultFirestoreAdapter = Object.freeze({
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
});

function requireTimestampFactory(value) {
  if (typeof value !== 'function') {
    throw new TypeError('timestampFactory must be a function.');
  }
  return value;
}

function requireFirestore(value) {
  if (!value) {
    throw new Error('Firestore is unavailable for repository "customers".');
  }
  return value;
}

function decodeSnapshot(snapshot) {
  if (!snapshot.exists()) return null;

  return decodeCustomerDocument({
    ...snapshot.data(),
    id: snapshot.id,
  });
}

export function createCustomerRepository({
  adapter = defaultFirestoreAdapter,
  db = firestoreDb,
  timestampFactory = serverTimestamp,
} = {}) {
  const resolvedDb = requireFirestore(db);
  const createWriteTimestamp = requireTimestampFactory(timestampFactory);
  const collectionReference = adapter.collection(resolvedDb, CUSTOMERS_COLLECTION_NAME);

  const getDocumentReference = (customerId) =>
    adapter.doc(collectionReference, normalizeCustomerId(customerId));

  return Object.freeze({
    collectionName: CUSTOMERS_COLLECTION_NAME,
    phoneMatchLimit: CUSTOMER_PHONE_MATCH_LIMIT,

    async getCustomer(customerId) {
      return decodeSnapshot(await adapter.getDoc(getDocumentReference(customerId)));
    },

    async findCustomersByPhone(phone) {
      const normalizedPhone = normalizeCustomerPhoneMatch(phone);
      const phoneQuery = adapter.query(
        collectionReference,
        adapter.where('normalizedPhone', '==', normalizedPhone),
        adapter.limit(CUSTOMER_PHONE_MATCH_LIMIT),
      );
      const snapshot = await adapter.getDocs(phoneQuery);

      return Object.freeze(
        snapshot.docs.map((customerSnapshot) =>
          decodeCustomerDocument({
            ...customerSnapshot.data(),
            id: customerSnapshot.id,
          }),
        ),
      );
    },

    async createCustomer(value, { actorUid } = {}) {
      const details = normalizeCustomerDetails(value);
      const resolvedActorUid = normalizeCustomerActorUid(actorUid);
      const reference = adapter.doc(collectionReference);
      const customerId = normalizeCustomerId(reference.id);
      const writeTimestamp = createWriteTimestamp();

      await adapter.setDoc(reference, {
        ...details,
        createdAt: writeTimestamp,
        createdByUid: resolvedActorUid,
        updatedAt: writeTimestamp,
        updatedByUid: resolvedActorUid,
      });

      return customerId;
    },

    async updateCustomer(customerId, value, { actorUid } = {}) {
      const details = normalizeCustomerDetails(value);
      const resolvedActorUid = normalizeCustomerActorUid(actorUid);
      const resolvedCustomerId = normalizeCustomerId(customerId);

      await adapter.updateDoc(getDocumentReference(resolvedCustomerId), {
        ...details,
        updatedAt: createWriteTimestamp(),
        updatedByUid: resolvedActorUid,
      });

      return resolvedCustomerId;
    },
  });
}

export const customerRepository = createCustomerRepository();
