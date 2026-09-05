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
  where,
  writeBatch,
} from 'firebase/firestore';

import { ADD_ON_LIST_LIMIT, ADD_ONS_COLLECTION_NAME } from '../features/pricing/addOns.js';
import {
  PRICING_RULE_LIST_LIMIT,
  PRICING_RULES_COLLECTION_NAME,
} from '../features/pricing/pricingRules.js';
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
  where,
  writeBatch,
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

function ensureCascadeQueryComplete(pricingRuleCount, addOnCount) {
  if (pricingRuleCount >= PRICING_RULE_LIST_LIMIT || addOnCount >= ADD_ON_LIST_LIMIT) {
    throw new Error(
      'Session type delete is blocked because the dependent configuration set may be incomplete.',
    );
  }
}

export function createSessionTypeRepository({
  adapter = defaultFirestoreAdapter,
  db = firestoreDb,
  timestampFactory = serverTimestamp,
} = {}) {
  const resolvedDb = requireFirestore(db);
  const createWriteTimestamp = requireTimestampFactory(timestampFactory);
  const collectionReference = adapter.collection(resolvedDb, SESSION_TYPES_COLLECTION_NAME);
  const pricingRuleCollectionReference = adapter.collection(
    resolvedDb,
    PRICING_RULES_COLLECTION_NAME,
  );
  const addOnCollectionReference = adapter.collection(resolvedDb, ADD_ONS_COLLECTION_NAME);

  const getDocumentReference = (sessionTypeId) =>
    adapter.doc(collectionReference, normalizeSessionTypeId(sessionTypeId));

  const queryDeleteDependencies = async (sessionTypeId) => {
    const resolvedSessionTypeId = normalizeSessionTypeId(sessionTypeId);
    const pricingRuleQuery = adapter.query(
      pricingRuleCollectionReference,
      adapter.where('sessionTypeId', '==', resolvedSessionTypeId),
      adapter.limit(PRICING_RULE_LIST_LIMIT),
    );
    const addOnQuery = adapter.query(
      addOnCollectionReference,
      adapter.where('sessionTypeId', '==', resolvedSessionTypeId),
      adapter.limit(ADD_ON_LIST_LIMIT),
    );
    const [pricingRuleSnapshot, addOnSnapshot] = await Promise.all([
      adapter.getDocs(pricingRuleQuery),
      adapter.getDocs(addOnQuery),
    ]);

    ensureCascadeQueryComplete(pricingRuleSnapshot.docs.length, addOnSnapshot.docs.length);

    return {
      addOnDocuments: addOnSnapshot.docs,
      pricingRuleDocuments: pricingRuleSnapshot.docs,
      sessionTypeId: resolvedSessionTypeId,
    };
  };

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

    async getSessionTypeDeleteImpact(sessionTypeId) {
      const dependencies = await queryDeleteDependencies(sessionTypeId);

      return Object.freeze({
        addOnCount: dependencies.addOnDocuments.length,
        pricingRuleCount: dependencies.pricingRuleDocuments.length,
        sessionTypeId: dependencies.sessionTypeId,
      });
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

    async deleteSessionType(sessionTypeId) {
      const dependencies = await queryDeleteDependencies(sessionTypeId);
      const batch = adapter.writeBatch(resolvedDb);

      dependencies.pricingRuleDocuments.forEach((pricingRuleSnapshot) => {
        batch.delete(adapter.doc(pricingRuleCollectionReference, pricingRuleSnapshot.id));
      });
      dependencies.addOnDocuments.forEach((addOnSnapshot) => {
        batch.delete(adapter.doc(addOnCollectionReference, addOnSnapshot.id));
      });
      batch.delete(getDocumentReference(dependencies.sessionTypeId));
      await batch.commit();

      return Object.freeze({
        addOnsDeleted: dependencies.addOnDocuments.length,
        pricingRulesDeleted: dependencies.pricingRuleDocuments.length,
        sessionTypeId: dependencies.sessionTypeId,
      });
    },
  });
}

export const sessionTypeRepository = createSessionTypeRepository();
