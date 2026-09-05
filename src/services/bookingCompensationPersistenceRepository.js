import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore';

import {
  COMMISSION_ENTRY_SOURCE_EVENTS,
  COMMISSION_ENTRY_STATES,
} from '../features/commissions/bookingCompensation.js';
import { firestoreDb } from '../lib/firebase/client.js';
import { requireIntegerIdr } from '../lib/money/idr.js';

export const BOOKINGS_COLLECTION_NAME = 'bookings';
export const COMMISSION_ENTRIES_COLLECTION_NAME = 'commissionEntries';
export const COMMISSION_ENTRY_LIST_LIMIT = 200;

const defaultFirestoreAdapter = Object.freeze({
  collection,
  doc,
  runTransaction,
});

function requireRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value;
}

function requireFirestore(value) {
  if (!value) {
    throw new Error('Firestore is unavailable for booking compensation persistence.');
  }
  return value;
}

function requireTimestampFactory(value) {
  if (typeof value !== 'function') {
    throw new TypeError('timestampFactory must be a function.');
  }
  return value;
}

function requireSingleSegmentId(value, label) {
  if (typeof value !== 'string') {
    throw new TypeError(`${label} must be a string.`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
  if (normalized.length > 128) {
    throw new RangeError(`${label} must be at most 128 characters.`);
  }
  if (normalized.includes('/')) {
    throw new TypeError(`${label} must be a Firestore document id.`);
  }

  return normalized;
}

function requireSourceKey(value, label = 'sourceKey') {
  if (typeof value !== 'string') {
    throw new TypeError(`${label} must be a string.`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
  if (normalized.length > 1024) {
    throw new RangeError(`${label} must be at most 1024 characters.`);
  }

  return normalized;
}

function stableNormalize(value) {
  if (Array.isArray(value)) return value.map(stableNormalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableNormalize(value[key])]),
    );
  }
  return value;
}

function stableSerialize(value) {
  return JSON.stringify(stableNormalize(value));
}

function areEquivalent(left, right) {
  return stableSerialize(left) === stableSerialize(right);
}

function assertSourceKeySetsMatch(snapshotEntries, commissionEntryDrafts) {
  if (!Array.isArray(snapshotEntries)) {
    throw new TypeError('projection.bookingSnapshot.entries must be an array.');
  }

  const snapshotSourceKeys = snapshotEntries.map((entry, index) =>
    requireSourceKey(requireRecord(entry, `projection.bookingSnapshot.entries[${index}]`).sourceKey),
  );
  const draftSourceKeys = commissionEntryDrafts.map((entry, index) =>
    requireSourceKey(entry.sourceKey, `projection.commissionEntryDrafts[${index}].sourceKey`),
  );

  const snapshotUniqueKeys = new Set(snapshotSourceKeys);
  const draftUniqueKeys = new Set(draftSourceKeys);
  if (
    snapshotUniqueKeys.size !== snapshotSourceKeys.length ||
    draftUniqueKeys.size !== draftSourceKeys.length
  ) {
    throw new DuplicateCommissionSourceKeyError();
  }

  if (
    snapshotSourceKeys.length !== draftSourceKeys.length ||
    [...snapshotUniqueKeys].some((sourceKey) => !draftUniqueKeys.has(sourceKey))
  ) {
    throw new TypeError(
      'projection.bookingSnapshot entries must match commissionEntryDrafts source keys exactly.',
    );
  }
}

function normalizeCommissionEntryDraft(entryValue, index, bookingId) {
  const entry = requireRecord(entryValue, `projection.commissionEntryDrafts[${index}]`);
  const normalizedBookingId = requireSingleSegmentId(
    entry.bookingId,
    `projection.commissionEntryDrafts[${index}].bookingId`,
  );

  if (normalizedBookingId !== bookingId) {
    throw new TypeError('Every commission entry draft must reference the persisted booking.');
  }
  if (entry.state !== COMMISSION_ENTRY_STATES.PENDING) {
    throw new TypeError('Initial commission entry drafts must be pending.');
  }
  if (entry.payoutId !== null) {
    throw new TypeError('Initial commission entry drafts must not reference a payout.');
  }
  if (entry.sourceEvent !== COMMISSION_ENTRY_SOURCE_EVENTS.BOOKING_CONFIRMATION) {
    throw new TypeError('Initial commission entry drafts must use booking_confirmation sourceEvent.');
  }

  requireSingleSegmentId(entry.operatorId, `projection.commissionEntryDrafts[${index}].operatorId`);
  requireSingleSegmentId(entry.ruleId, `projection.commissionEntryDrafts[${index}].ruleId`);
  requireIntegerIdr(entry.amountIdr, {
    label: `projection.commissionEntryDrafts[${index}].amountIdr`,
  });
  requireRecord(entry.calculationSnapshot, `projection.commissionEntryDrafts[${index}].calculationSnapshot`);
  requireSourceKey(entry.sourceKey, `projection.commissionEntryDrafts[${index}].sourceKey`);

  return entry;
}

function normalizeProjection(projectionValue, bookingId) {
  const projection = requireRecord(projectionValue, 'projection');
  const bookingSnapshot = requireRecord(projection.bookingSnapshot, 'projection.bookingSnapshot');

  if (!Array.isArray(projection.commissionEntryDrafts)) {
    throw new TypeError('projection.commissionEntryDrafts must be an array.');
  }
  if (!Array.isArray(projection.diagnostics) || !Array.isArray(bookingSnapshot.diagnostics)) {
    throw new TypeError('projection diagnostics must be arrays.');
  }
  if (projection.diagnostics.length > 0 || bookingSnapshot.diagnostics.length > 0) {
    throw new IncompleteBookingCompensationProjectionError();
  }

  const commissionEntryDrafts = projection.commissionEntryDrafts.map((entry, index) =>
    normalizeCommissionEntryDraft(entry, index, bookingId),
  );
  assertSourceKeySetsMatch(bookingSnapshot.entries, commissionEntryDrafts);

  if (!Number.isSafeInteger(bookingSnapshot.schemaVersion) || bookingSnapshot.schemaVersion <= 0) {
    throw new TypeError('projection.bookingSnapshot.schemaVersion must be a positive integer.');
  }
  requireRecord(bookingSnapshot.summary, 'projection.bookingSnapshot.summary');

  return Object.freeze({
    bookingSnapshot,
    commissionEntryDrafts: Object.freeze(commissionEntryDrafts),
  });
}

function getImmutableCommissionEntryEvidence(entry) {
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

function isExistingCommissionEntryCompatible(existingEntry, draft) {
  return areEquivalent(
    getImmutableCommissionEntryEvidence(existingEntry),
    getImmutableCommissionEntryEvidence(draft),
  );
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export class BookingCompensationPersistenceError extends Error {}

export class BookingNotFoundError extends BookingCompensationPersistenceError {
  constructor(bookingId) {
    super(`Booking ${bookingId} does not exist.`);
    this.name = 'BookingNotFoundError';
    this.bookingId = bookingId;
  }
}

export class ExistingBookingCompensationError extends BookingCompensationPersistenceError {
  constructor(bookingId) {
    super(`Booking ${bookingId} already has different compensation evidence.`);
    this.name = 'ExistingBookingCompensationError';
    this.bookingId = bookingId;
  }
}

export class CommissionEntryConflictError extends BookingCompensationPersistenceError {
  constructor(entryId) {
    super(`Commission entry ${entryId} conflicts with the requested source evidence.`);
    this.name = 'CommissionEntryConflictError';
    this.entryId = entryId;
  }
}

export class DuplicateCommissionSourceKeyError extends BookingCompensationPersistenceError {
  constructor() {
    super('Commission projection contains duplicate source keys.');
    this.name = 'DuplicateCommissionSourceKeyError';
  }
}

export class CommissionEntryIdCollisionError extends BookingCompensationPersistenceError {
  constructor(entryId) {
    super(`Commission entry document id collision detected for ${entryId}.`);
    this.name = 'CommissionEntryIdCollisionError';
    this.entryId = entryId;
  }
}

export class IncompleteBookingCompensationProjectionError extends BookingCompensationPersistenceError {
  constructor() {
    super('Booking compensation persistence refuses projections with unresolved diagnostics.');
    this.name = 'IncompleteBookingCompensationProjectionError';
  }
}

export async function deriveCommissionEntryDocumentId(sourceKeyValue, { cryptoImpl } = {}) {
  const sourceKey = requireSourceKey(sourceKeyValue);
  const resolvedCrypto = cryptoImpl ?? globalThis.crypto;
  if (!resolvedCrypto?.subtle || typeof resolvedCrypto.subtle.digest !== 'function') {
    throw new Error('Web Crypto SHA-256 is unavailable for commission entry id derivation.');
  }

  const digest = await resolvedCrypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(sourceKey),
  );
  return `booking-comp-${bytesToHex(new Uint8Array(digest))}`;
}

export function createBookingCompensationPersistenceRepository({
  adapter = defaultFirestoreAdapter,
  db = firestoreDb,
  entryIdFactory = deriveCommissionEntryDocumentId,
  timestampFactory = serverTimestamp,
} = {}) {
  const resolvedDb = requireFirestore(db);
  const createWriteTimestamp = requireTimestampFactory(timestampFactory);
  const bookings = adapter.collection(resolvedDb, BOOKINGS_COLLECTION_NAME);
  const commissionEntries = adapter.collection(resolvedDb, COMMISSION_ENTRIES_COLLECTION_NAME);

  return Object.freeze({
    bookingsCollectionName: BOOKINGS_COLLECTION_NAME,
    commissionEntriesCollectionName: COMMISSION_ENTRIES_COLLECTION_NAME,

    async initializeBookingCompensation(bookingIdValue, projectionValue, { actorUid } = {}) {
      const bookingId = requireSingleSegmentId(bookingIdValue, 'bookingId');
      const resolvedActorUid = requireSingleSegmentId(actorUid, 'actorUid');
      const projection = normalizeProjection(projectionValue, bookingId);
      const bookingReference = adapter.doc(bookings, bookingId);

      const entryDescriptors = await Promise.all(
        projection.commissionEntryDrafts.map(async (draft) => ({
          draft,
          entryId: requireSingleSegmentId(await entryIdFactory(draft.sourceKey), 'entryId'),
        })),
      );

      const seenEntryIds = new Map();
      for (const descriptor of entryDescriptors) {
        const previousSourceKey = seenEntryIds.get(descriptor.entryId);
        if (previousSourceKey && previousSourceKey !== descriptor.draft.sourceKey) {
          throw new CommissionEntryIdCollisionError(descriptor.entryId);
        }
        seenEntryIds.set(descriptor.entryId, descriptor.draft.sourceKey);
      }

      const entryReferences = entryDescriptors.map(({ draft, entryId }) => ({
        draft,
        entryId,
        reference: adapter.doc(commissionEntries, entryId),
      }));
      const writeTimestamp = createWriteTimestamp();

      return adapter.runTransaction(resolvedDb, async (transaction) => {
        const bookingDocument = await transaction.get(bookingReference);
        if (!bookingDocument.exists()) {
          throw new BookingNotFoundError(bookingId);
        }

        const entryDocuments = [];
        for (const entryReference of entryReferences) {
          entryDocuments.push({
            ...entryReference,
            snapshot: await transaction.get(entryReference.reference),
          });
        }

        const existingBooking = bookingDocument.data();
        const existingSnapshot = existingBooking.compensationSnapshot ?? null;
        const existingSummary = existingBooking.compensationSummary ?? null;
        const hasExistingSnapshot = existingSnapshot !== null;

        if (
          hasExistingSnapshot &&
          (!areEquivalent(existingSnapshot, projection.bookingSnapshot) ||
            !areEquivalent(existingSummary, projection.bookingSnapshot.summary))
        ) {
          throw new ExistingBookingCompensationError(bookingId);
        }

        for (const entryDocument of entryDocuments) {
          if (
            entryDocument.snapshot.exists() &&
            !isExistingCommissionEntryCompatible(entryDocument.snapshot.data(), entryDocument.draft)
          ) {
            throw new CommissionEntryConflictError(entryDocument.entryId);
          }
        }

        if (!hasExistingSnapshot) {
          transaction.update(bookingReference, {
            compensationSnapshot: projection.bookingSnapshot,
            compensationSummary: projection.bookingSnapshot.summary,
            updatedAt: writeTimestamp,
            updatedByUid: resolvedActorUid,
          });
        }

        const createdEntryIds = [];
        const existingEntryIds = [];
        for (const entryDocument of entryDocuments) {
          if (entryDocument.snapshot.exists()) {
            existingEntryIds.push(entryDocument.entryId);
            continue;
          }

          transaction.set(entryDocument.reference, {
            ...entryDocument.draft,
            createdAt: writeTimestamp,
            createdByUid: resolvedActorUid,
            updatedAt: writeTimestamp,
            updatedByUid: resolvedActorUid,
          });
          createdEntryIds.push(entryDocument.entryId);
        }

        return Object.freeze({
          bookingId,
          createdEntryIds: Object.freeze(createdEntryIds),
          existingEntryIds: Object.freeze(existingEntryIds),
          initializedBookingSnapshot: !hasExistingSnapshot,
        });
      });
    },
  });
}

export const bookingCompensationPersistenceRepository =
  createBookingCompensationPersistenceRepository();
