import { createHash } from 'node:crypto';

const BOOKINGS_COLLECTION = 'bookings';
const COMMISSION_ENTRIES_COLLECTION = 'commissionEntries';
const COMPENSATION_RULES_COLLECTION = 'compensationRules';
const OPERATORS_COLLECTION = 'operators';
const PERMISSION_SETS_COLLECTION = 'permissionSets';
const USERS_COLLECTION = 'users';

function stableNormalize(value) {
  if (Array.isArray(value)) return value.map(stableNormalize);
  if (value && typeof value === 'object') {
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableNormalize(value[key])]),
    );
  }
  return value;
}

function areEquivalent(left, right) {
  return JSON.stringify(stableNormalize(left)) === JSON.stringify(stableNormalize(right));
}

function requireProjection(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('projection must be an object.');
  }
  if (!value.bookingSnapshot || !Array.isArray(value.commissionEntryDrafts)) {
    throw new TypeError('projection must contain bookingSnapshot and commissionEntryDrafts.');
  }
  if (!Array.isArray(value.diagnostics) || value.diagnostics.length > 0) {
    throw new TypeError('projection must not contain unresolved diagnostics.');
  }
  return value;
}

function requireActorUid(value) {
  if (typeof value !== 'string' || !value.trim() || value.includes('/') || value.length > 128) {
    throw new TypeError('actorUid must be a valid document id.');
  }
  return value.trim();
}

function entryIdFromSourceKey(sourceKey) {
  if (typeof sourceKey !== 'string' || !sourceKey) {
    throw new TypeError('commission entry sourceKey is required.');
  }
  return `booking-comp-${createHash('sha256').update(sourceKey, 'utf8').digest('hex')}`;
}

function immutableEvidence(entry) {
  return {
    amountIdr: entry.amountIdr,
    bookingId: entry.bookingId,
    bookingNumber: entry.bookingNumber ?? null,
    calculationSnapshot: entry.calculationSnapshot,
    compensationModel: entry.compensationModel,
    operatorId: entry.operatorId,
    operatorType: entry.operatorType,
    ruleId: entry.ruleId,
    sourceEvent: entry.sourceEvent,
    sourceKey: entry.sourceKey,
  };
}

async function readDocument(reference) {
  const snapshot = await reference.get();
  return snapshot.exists ? snapshot.data() : null;
}

export class TrustedPersistenceConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TrustedPersistenceConflictError';
  }
}

export function createTrustedBookingCompensationFirestoreGateway({ db, serverTimestamp }) {
  if (!db || typeof db.collection !== 'function' || typeof db.runTransaction !== 'function') {
    throw new TypeError('Admin Firestore db is required.');
  }
  if (typeof serverTimestamp !== 'function') {
    throw new TypeError('serverTimestamp must be a function.');
  }

  return Object.freeze({
    async getBooking(bookingId) {
      return readDocument(db.collection(BOOKINGS_COLLECTION).doc(bookingId));
    },

    async getOperator(operatorId) {
      return readDocument(db.collection(OPERATORS_COLLECTION).doc(operatorId));
    },

    async getPermissionSet(permissionSetId) {
      return readDocument(db.collection(PERMISSION_SETS_COLLECTION).doc(permissionSetId));
    },

    async getUser(uid) {
      return readDocument(db.collection(USERS_COLLECTION).doc(uid));
    },

    async listActiveCompensationRules(limit) {
      const snapshot = await db
        .collection(COMPENSATION_RULES_COLLECTION)
        .where('status', '==', 'active')
        .limit(limit)
        .get();
      return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
    },

    async persistProjection(bookingId, projectionValue, { actorUid } = {}) {
      const projection = requireProjection(projectionValue);
      const resolvedActorUid = requireActorUid(actorUid);
      const bookingReference = db.collection(BOOKINGS_COLLECTION).doc(bookingId);
      const entryDescriptors = projection.commissionEntryDrafts.map((draft) => ({
        draft,
        entryId: entryIdFromSourceKey(draft.sourceKey),
      }));
      const entryReferences = entryDescriptors.map((descriptor) => ({
        ...descriptor,
        reference: db.collection(COMMISSION_ENTRIES_COLLECTION).doc(descriptor.entryId),
      }));

      return db.runTransaction(async (transaction) => {
        const bookingSnapshot = await transaction.get(bookingReference);
        if (!bookingSnapshot.exists) {
          throw new TrustedPersistenceConflictError(`Booking ${bookingId} no longer exists.`);
        }

        const entrySnapshots = [];
        for (const entryReference of entryReferences) {
          entrySnapshots.push({
            ...entryReference,
            snapshot: await transaction.get(entryReference.reference),
          });
        }

        const booking = bookingSnapshot.data();
        const existingCompensationSnapshot = booking.compensationSnapshot ?? null;
        const existingCompensationSummary = booking.compensationSummary ?? null;
        const hasExistingSnapshot = existingCompensationSnapshot !== null;

        if (
          hasExistingSnapshot &&
          (!areEquivalent(existingCompensationSnapshot, projection.bookingSnapshot) ||
            !areEquivalent(existingCompensationSummary, projection.bookingSnapshot.summary))
        ) {
          throw new TrustedPersistenceConflictError(
            `Booking ${bookingId} already contains different compensation evidence.`,
          );
        }

        for (const entry of entrySnapshots) {
          if (
            entry.snapshot.exists &&
            !areEquivalent(immutableEvidence(entry.snapshot.data()), immutableEvidence(entry.draft))
          ) {
            throw new TrustedPersistenceConflictError(
              `Commission entry ${entry.entryId} contains conflicting source evidence.`,
            );
          }
        }

        const timestamp = serverTimestamp();
        if (!hasExistingSnapshot) {
          transaction.update(bookingReference, {
            compensationSnapshot: projection.bookingSnapshot,
            compensationSummary: projection.bookingSnapshot.summary,
            updatedAt: timestamp,
            updatedByUid: resolvedActorUid,
          });
        }

        const createdEntryIds = [];
        const existingEntryIds = [];
        for (const entry of entrySnapshots) {
          if (entry.snapshot.exists) {
            existingEntryIds.push(entry.entryId);
            continue;
          }
          if (entry.draft.state !== 'pending' || entry.draft.payoutId !== null) {
            throw new TrustedPersistenceConflictError(
              'Trusted initialization can create pending unpaid commission entries only.',
            );
          }
          transaction.set(entry.reference, {
            ...entry.draft,
            createdAt: timestamp,
            createdByUid: resolvedActorUid,
            updatedAt: timestamp,
            updatedByUid: resolvedActorUid,
          });
          createdEntryIds.push(entry.entryId);
        }

        return {
          bookingId,
          createdEntryIds,
          existingEntryIds,
          initializedBookingSnapshot: !hasExistingSnapshot,
        };
      });
    },
  });
}
