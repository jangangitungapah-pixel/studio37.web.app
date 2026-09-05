import {
  collection,
  deleteDoc,
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
  comparePricingRules,
  decodePricingRuleDocument,
  encodePricingRuleDetails,
  normalizePricingRuleActorUid,
  normalizePricingRuleId,
  normalizePricingRuleStatus,
  PRICING_RULE_LIST_LIMIT,
  PRICING_RULE_STATUSES,
  PRICING_RULES_COLLECTION_NAME,
} from '../features/pricing/pricingRules.js';
import { firestoreDb } from '../lib/firebase/client.js';

const defaultFirestoreAdapter = Object.freeze({
  collection,
  deleteDoc,
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
    throw new Error('Firestore is unavailable for repository "pricingRules".');
  }

  return value;
}

export function createPricingRuleRepository({
  adapter = defaultFirestoreAdapter,
  db = firestoreDb,
  timestampFactory = serverTimestamp,
} = {}) {
  const resolvedDb = requireFirestore(db);
  const createWriteTimestamp = requireTimestampFactory(timestampFactory);
  const collectionReference = adapter.collection(resolvedDb, PRICING_RULES_COLLECTION_NAME);

  const getDocumentReference = (pricingRuleId) =>
    adapter.doc(collectionReference, normalizePricingRuleId(pricingRuleId));

  return Object.freeze({
    collectionName: PRICING_RULES_COLLECTION_NAME,
    listLimit: PRICING_RULE_LIST_LIMIT,

    async listPricingRules() {
      const pricingRuleQuery = adapter.query(
        collectionReference,
        adapter.orderBy('priority', 'desc'),
        adapter.limit(PRICING_RULE_LIST_LIMIT),
      );
      const snapshot = await adapter.getDocs(pricingRuleQuery);

      return Object.freeze(
        snapshot.docs
          .map((pricingRuleSnapshot) =>
            decodePricingRuleDocument({
              ...pricingRuleSnapshot.data(),
              id: pricingRuleSnapshot.id,
            }),
          )
          .sort(comparePricingRules),
      );
    },

    async createPricingRule(value, { actorUid } = {}) {
      const details = encodePricingRuleDetails(value);
      const resolvedActorUid = normalizePricingRuleActorUid(actorUid);
      const reference = adapter.doc(collectionReference);
      const pricingRuleId = normalizePricingRuleId(reference.id);
      const writeTimestamp = createWriteTimestamp();

      await adapter.setDoc(reference, {
        ...details,
        createdAt: writeTimestamp,
        createdByUid: resolvedActorUid,
        status: PRICING_RULE_STATUSES.ACTIVE,
        updatedAt: writeTimestamp,
        updatedByUid: resolvedActorUid,
      });

      return pricingRuleId;
    },

    async updatePricingRule(pricingRuleId, value, { actorUid } = {}) {
      const details = encodePricingRuleDetails(value);
      const resolvedActorUid = normalizePricingRuleActorUid(actorUid);
      const resolvedPricingRuleId = normalizePricingRuleId(pricingRuleId);

      await adapter.updateDoc(getDocumentReference(resolvedPricingRuleId), {
        ...details,
        updatedAt: createWriteTimestamp(),
        updatedByUid: resolvedActorUid,
      });

      return resolvedPricingRuleId;
    },

    async setPricingRuleStatus(pricingRuleId, status, { actorUid } = {}) {
      const resolvedPricingRuleId = normalizePricingRuleId(pricingRuleId);
      const resolvedStatus = normalizePricingRuleStatus(status);
      const resolvedActorUid = normalizePricingRuleActorUid(actorUid);

      await adapter.updateDoc(getDocumentReference(resolvedPricingRuleId), {
        status: resolvedStatus,
        updatedAt: createWriteTimestamp(),
        updatedByUid: resolvedActorUid,
      });

      return resolvedPricingRuleId;
    },

    async deletePricingRule(pricingRuleId) {
      const resolvedPricingRuleId = normalizePricingRuleId(pricingRuleId);
      await adapter.deleteDoc(getDocumentReference(resolvedPricingRuleId));
      return resolvedPricingRuleId;
    },
  });
}

export const pricingRuleRepository = createPricingRuleRepository();
