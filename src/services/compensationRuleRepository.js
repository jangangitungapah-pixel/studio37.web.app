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
  compareCompensationRules,
  COMPENSATION_RULE_LIST_LIMIT,
  COMPENSATION_RULE_STATUSES,
  COMPENSATION_RULES_COLLECTION_NAME,
  decodeCompensationRuleDocument,
  encodeCompensationRuleDetails,
  normalizeCompensationRuleActorUid,
  normalizeCompensationRuleId,
  normalizeCompensationRuleStatus,
} from '../features/commissions/compensationRules.js';
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
    throw new Error('Firestore is unavailable for repository "compensationRules".');
  }
  return value;
}

export function createCompensationRuleRepository({
  adapter = defaultFirestoreAdapter,
  db = firestoreDb,
  timestampFactory = serverTimestamp,
} = {}) {
  const resolvedDb = requireFirestore(db);
  const createWriteTimestamp = requireTimestampFactory(timestampFactory);
  const collectionReference = adapter.collection(resolvedDb, COMPENSATION_RULES_COLLECTION_NAME);

  const getDocumentReference = (compensationRuleId) =>
    adapter.doc(collectionReference, normalizeCompensationRuleId(compensationRuleId));

  return Object.freeze({
    collectionName: COMPENSATION_RULES_COLLECTION_NAME,
    listLimit: COMPENSATION_RULE_LIST_LIMIT,

    async listCompensationRules() {
      const compensationRuleQuery = adapter.query(
        collectionReference,
        adapter.orderBy('priority', 'desc'),
        adapter.limit(COMPENSATION_RULE_LIST_LIMIT),
      );
      const snapshot = await adapter.getDocs(compensationRuleQuery);

      return Object.freeze(
        snapshot.docs
          .map((compensationRuleSnapshot) =>
            decodeCompensationRuleDocument({
              ...compensationRuleSnapshot.data(),
              id: compensationRuleSnapshot.id,
            }),
          )
          .sort(compareCompensationRules),
      );
    },

    async createCompensationRule(value, { actorUid } = {}) {
      const details = encodeCompensationRuleDetails(value);
      const resolvedActorUid = normalizeCompensationRuleActorUid(actorUid);
      const reference = adapter.doc(collectionReference);
      const compensationRuleId = normalizeCompensationRuleId(reference.id);
      const writeTimestamp = createWriteTimestamp();

      await adapter.setDoc(reference, {
        ...details,
        createdAt: writeTimestamp,
        createdByUid: resolvedActorUid,
        status: COMPENSATION_RULE_STATUSES.ACTIVE,
        updatedAt: writeTimestamp,
        updatedByUid: resolvedActorUid,
      });

      return compensationRuleId;
    },

    async updateCompensationRule(compensationRuleId, value, { actorUid } = {}) {
      const details = encodeCompensationRuleDetails(value);
      const resolvedActorUid = normalizeCompensationRuleActorUid(actorUid);
      const resolvedCompensationRuleId = normalizeCompensationRuleId(compensationRuleId);

      await adapter.updateDoc(getDocumentReference(resolvedCompensationRuleId), {
        ...details,
        updatedAt: createWriteTimestamp(),
        updatedByUid: resolvedActorUid,
      });

      return resolvedCompensationRuleId;
    },

    async setCompensationRuleStatus(compensationRuleId, status, { actorUid } = {}) {
      const resolvedCompensationRuleId = normalizeCompensationRuleId(compensationRuleId);
      const resolvedStatus = normalizeCompensationRuleStatus(status);
      const resolvedActorUid = normalizeCompensationRuleActorUid(actorUid);

      await adapter.updateDoc(getDocumentReference(resolvedCompensationRuleId), {
        status: resolvedStatus,
        updatedAt: createWriteTimestamp(),
        updatedByUid: resolvedActorUid,
      });

      return resolvedCompensationRuleId;
    },
  });
}

export const compensationRuleRepository = createCompensationRuleRepository();
