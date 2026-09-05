import { createHash } from 'node:crypto';

import {
  TrustedBookingCompensationAuthorizationError,
  TrustedBookingCompensationContextError,
  TrustedBookingCompensationPersistenceError,
  TrustedBookingCompensationProjectionError,
  createTrustedBookingCompensationExecutor,
} from './runtime-src/services/trustedBookingCompensationExecution.js';

export const TRUSTED_FUNCTION_BOOKING_CAPABILITY = 'booking.create';
export const TRUSTED_FUNCTION_RULE_LIMIT = 200;

const BOOKINGS_COLLECTION = 'bookings';
const COMMISSION_ENTRIES_COLLECTION = 'commissionEntries';
const COMPENSATION_RULES_COLLECTION = 'compensationRules';
const OPERATORS_COLLECTION = 'operators';
const PERMISSION_SETS_COLLECTION = 'permissionSets';
const USERS_COLLECTION = 'users';
const SUPPORTED_OPERATOR_ROLE = 'studio_operator';
const ACTIVE_STATUS = 'active';
const BOOKING_CONFIRMATION_SOURCE_EVENT = 'booking_confirmation';
const PENDING_STATE = 'pending';

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireRecord(value, label) {
  if (!isRecord(value)) {
    throw new TypeError(`${label} must be an object.`);
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
    throw new TypeError(`${label} must be a single Firestore document id.`);
  }
  return normalized;
}

function requireSourceKey(value) {
  if (typeof value !== 'string') {
    throw new TypeError('sourceKey must be a string.');
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > 1024) {
    throw new TypeError('sourceKey must be between 1 and 1024 characters.');
  }
  return normalized;
}

function stableNormalize(value) {
  if (Array.isArray(value)) return value.map(stableNormalize);
  if (isRecord(value)) {
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

function immutableCommissionEvidence(entry) {
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

function deriveCommissionEntryId(sourceKey) {
  const digest = createHash('sha256').update(requireSourceKey(sourceKey), 'utf8').digest('hex');
  return `booking-comp-${digest}`;
}

function isAuthorizedOperatorProfile(profile, permissionSet, operator, actorUid) {
  return (
    profile.role === SUPPORTED_OPERATOR_ROLE &&
    profile.status === ACTIVE_STATUS &&
    typeof profile.permissionSetId === 'string' &&
    typeof profile.operatorId === 'string' &&
    permissionSet?.status === ACTIVE_STATUS &&
    Array.isArray(permissionSet?.capabilities) &&
    permissionSet.capabilities.includes(TRUSTED_FUNCTION_BOOKING_CAPABILITY) &&
    operator?.status === ACTIVE_STATUS &&
    operator.linkedUserUid === actorUid &&
    Array.isArray(operator.operatorTypes) &&
    operator.operatorTypes.includes(SUPPORTED_OPERATOR_ROLE)
  );
}

function normalizeProjectionForPersistence(projectionValue, bookingId) {
  const projection = requireRecord(projectionValue, 'projection');
  const bookingSnapshot = requireRecord(projection.bookingSnapshot, 'projection.bookingSnapshot');
  if (!Array.isArray(projection.diagnostics) || projection.diagnostics.length !== 0) {
    throw new FirebaseBookingCompensationRuntimeError(
      'incomplete-projection',
      'Trusted compensation projection is incomplete.',
    );
  }
  if (!Array.isArray(projection.commissionEntryDrafts)) {
    throw new TypeError('projection.commissionEntryDrafts must be an array.');
  }

  const sourceKeys = new Set();
  const entryDescriptors = projection.commissionEntryDrafts.map((entryValue, index) => {
    const entry = requireRecord(entryValue, `projection.commissionEntryDrafts[${index}]`);
    if (requireSingleSegmentId(entry.bookingId, `entry[${index}].bookingId`) !== bookingId) {
      throw new TypeError('Commission entry bookingId must match the requested booking.');
    }
    if (entry.state !== PENDING_STATE || entry.payoutId !== null) {
      throw new TypeError('Trusted commission entry drafts must start pending and payout-free.');
    }
    if (entry.sourceEvent !== BOOKING_CONFIRMATION_SOURCE_EVENT) {
      throw new TypeError('Trusted commission entry draft has an unsupported source event.');
    }
    const sourceKey = requireSourceKey(entry.sourceKey);
    if (sourceKeys.has(sourceKey)) {
      throw new TypeError('Trusted compensation projection contains duplicate source keys.');
    }
    sourceKeys.add(sourceKey);
    return Object.freeze({
      draft: entry,
      entryId: deriveCommissionEntryId(sourceKey),
    });
  });

  return Object.freeze({ bookingSnapshot, entryDescriptors: Object.freeze(entryDescriptors) });
}

export class FirebaseBookingCompensationRuntimeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'FirebaseBookingCompensationRuntimeError';
    this.code = code;
  }
}

export function normalizeCallableBookingCompensationRequest(value) {
  const data = requireRecord(value, 'callable data');
  const keys = Object.keys(data);
  if (keys.length !== 1 || keys[0] !== 'bookingId') {
    throw new TypeError('Callable data must contain only bookingId.');
  }
  return Object.freeze({ bookingId: requireSingleSegmentId(data.bookingId, 'bookingId') });
}

export function classifyTrustedBookingCompensationError(error) {
  if (error instanceof TrustedBookingCompensationAuthorizationError) {
    return Object.freeze({
      code: 'permission-denied',
      message: 'You are not authorized to initialize booking compensation.',
    });
  }

  if (error instanceof TrustedBookingCompensationProjectionError) {
    return Object.freeze({
      code: 'failed-precondition',
      message: 'Booking compensation cannot be initialized from the current booking state.',
    });
  }

  if (
    error instanceof TrustedBookingCompensationContextError ||
    error instanceof TrustedBookingCompensationPersistenceError
  ) {
    return Object.freeze({
      code: 'failed-precondition',
      message: 'Booking compensation could not be initialized safely.',
    });
  }

  if (error instanceof FirebaseBookingCompensationRuntimeError) {
    const mappings = {
      'booking-not-found': ['not-found', 'Booking was not found.'],
      'booking-context-missing': [
        'failed-precondition',
        'Booking compensation context is not ready.',
      ],
      'commission-conflict': [
        'aborted',
        'Existing booking compensation evidence conflicts with this request.',
      ],
      'existing-snapshot-conflict': [
        'aborted',
        'Existing booking compensation evidence conflicts with this request.',
      ],
      'incomplete-projection': [
        'failed-precondition',
        'Booking compensation cannot be initialized from the current booking state.',
      ],
      'rule-limit-exceeded': [
        'failed-precondition',
        'Compensation rules exceed the trusted execution limit.',
      ],
    };
    const [code, message] = mappings[error.code] ?? [
      'failed-precondition',
      'Booking compensation could not be initialized safely.',
    ];
    return Object.freeze({ code, message });
  }

  if (error instanceof TypeError || error instanceof RangeError) {
    return Object.freeze({
      code: 'failed-precondition',
      message: 'Booking compensation data is invalid.',
    });
  }

  return Object.freeze({
    code: 'internal',
    message: 'Booking compensation initialization failed.',
  });
}

export function createFirebaseBookingCompensationRuntime({ db, timestampFactory } = {}) {
  if (!db || typeof db.doc !== 'function' || typeof db.collection !== 'function') {
    throw new TypeError('db must provide the Firebase Admin Firestore interface.');
  }
  if (typeof db.runTransaction !== 'function') {
    throw new TypeError('db.runTransaction must be a function.');
  }
  if (typeof timestampFactory !== 'function') {
    throw new TypeError('timestampFactory must be a function.');
  }

  const authorizeActor = async ({ actorUid }) => {
    const profileSnapshot = await db.doc(`${USERS_COLLECTION}/${actorUid}`).get();
    if (!profileSnapshot.exists) return false;
    const profile = profileSnapshot.data();
    if (profile?.status !== ACTIVE_STATUS) return false;
    if (profile.role === 'owner') return true;
    if (profile.role !== SUPPORTED_OPERATOR_ROLE) return false;

    let permissionSetId;
    let operatorId;
    try {
      permissionSetId = requireSingleSegmentId(profile.permissionSetId, 'profile.permissionSetId');
      operatorId = requireSingleSegmentId(profile.operatorId, 'profile.operatorId');
    } catch {
      return false;
    }

    const [permissionSetSnapshot, operatorSnapshot] = await Promise.all([
      db.doc(`${PERMISSION_SETS_COLLECTION}/${permissionSetId}`).get(),
      db.doc(`${OPERATORS_COLLECTION}/${operatorId}`).get(),
    ]);
    if (!permissionSetSnapshot.exists || !operatorSnapshot.exists) return false;

    return isAuthorizedOperatorProfile(
      profile,
      permissionSetSnapshot.data(),
      operatorSnapshot.data(),
      actorUid,
    );
  };

  const loadAuthoritativeBookingContext = async ({ bookingId }) => {
    const bookingSnapshot = await db.doc(`${BOOKINGS_COLLECTION}/${bookingId}`).get();
    if (!bookingSnapshot.exists) {
      throw new FirebaseBookingCompensationRuntimeError(
        'booking-not-found',
        'Booking does not exist.',
      );
    }

    const booking = bookingSnapshot.data();
    if (!isRecord(booking?.compensationContext)) {
      throw new FirebaseBookingCompensationRuntimeError(
        'booking-context-missing',
        'Booking is missing authoritative compensationContext.',
      );
    }

    const context = booking.compensationContext;
    return Object.freeze({
      assignments: context.assignments,
      bookingId,
      bookingNumber: booking.bookingNumber ?? null,
      durationMinutes: context.durationMinutes,
      effectiveAt: context.effectiveAt,
      percentageBaseAmounts: context.percentageBaseAmounts ?? {},
      sessionTypeId: context.sessionTypeId ?? null,
      status: booking.status,
      studioId: context.studioId ?? null,
    });
  };

  const loadCanonicalCompensationRules = async () => {
    const rulesSnapshot = await db
      .collection(COMPENSATION_RULES_COLLECTION)
      .where('status', '==', ACTIVE_STATUS)
      .limit(TRUSTED_FUNCTION_RULE_LIMIT + 1)
      .get();
    const documents = Array.isArray(rulesSnapshot.docs) ? rulesSnapshot.docs : [];
    if (documents.length > TRUSTED_FUNCTION_RULE_LIMIT) {
      throw new FirebaseBookingCompensationRuntimeError(
        'rule-limit-exceeded',
        'Active compensation rule count exceeds the trusted runtime limit.',
      );
    }

    return documents.map((document) => Object.freeze({ id: document.id, ...document.data() }));
  };

  const persistBookingCompensation = async ({ actorUid, bookingId, projection }) => {
    const normalizedActorUid = requireSingleSegmentId(actorUid, 'actorUid');
    const normalizedBookingId = requireSingleSegmentId(bookingId, 'bookingId');
    const normalizedProjection = normalizeProjectionForPersistence(
      projection,
      normalizedBookingId,
    );
    const bookingReference = db.doc(`${BOOKINGS_COLLECTION}/${normalizedBookingId}`);
    const entryReferences = normalizedProjection.entryDescriptors.map((descriptor) => ({
      ...descriptor,
      reference: db.doc(`${COMMISSION_ENTRIES_COLLECTION}/${descriptor.entryId}`),
    }));

    return db.runTransaction(async (transaction) => {
      const bookingDocument = await transaction.get(bookingReference);
      if (!bookingDocument.exists) {
        throw new FirebaseBookingCompensationRuntimeError(
          'booking-not-found',
          'Booking disappeared before compensation persistence.',
        );
      }

      const existingEntries = [];
      for (const descriptor of entryReferences) {
        existingEntries.push({
          ...descriptor,
          snapshot: await transaction.get(descriptor.reference),
        });
      }

      const booking = bookingDocument.data();
      const existingSnapshot = booking.compensationSnapshot ?? null;
      const existingSummary = booking.compensationSummary ?? null;
      const hasExistingSnapshot = existingSnapshot !== null;

      if (
        hasExistingSnapshot &&
        (!areEquivalent(existingSnapshot, normalizedProjection.bookingSnapshot) ||
          !areEquivalent(existingSummary, normalizedProjection.bookingSnapshot.summary))
      ) {
        throw new FirebaseBookingCompensationRuntimeError(
          'existing-snapshot-conflict',
          'Booking already has different compensation evidence.',
        );
      }

      for (const entry of existingEntries) {
        if (
          entry.snapshot.exists &&
          !areEquivalent(
            immutableCommissionEvidence(entry.snapshot.data()),
            immutableCommissionEvidence(entry.draft),
          )
        ) {
          throw new FirebaseBookingCompensationRuntimeError(
            'commission-conflict',
            'Existing commission entry has conflicting immutable evidence.',
          );
        }
      }

      const writeTimestamp = timestampFactory();
      if (!hasExistingSnapshot) {
        transaction.update(bookingReference, {
          compensationSnapshot: normalizedProjection.bookingSnapshot,
          compensationSummary: normalizedProjection.bookingSnapshot.summary,
          updatedAt: writeTimestamp,
          updatedByUid: normalizedActorUid,
        });
      }

      const createdEntryIds = [];
      const existingEntryIds = [];
      for (const entry of existingEntries) {
        if (entry.snapshot.exists) {
          existingEntryIds.push(entry.entryId);
          continue;
        }

        transaction.set(entry.reference, {
          ...entry.draft,
          createdAt: writeTimestamp,
          createdByUid: normalizedActorUid,
          updatedAt: writeTimestamp,
          updatedByUid: normalizedActorUid,
        });
        createdEntryIds.push(entry.entryId);
      }

      return Object.freeze({
        bookingId: normalizedBookingId,
        createdEntryIds: Object.freeze(createdEntryIds),
        existingEntryIds: Object.freeze(existingEntryIds),
        initializedBookingSnapshot: !hasExistingSnapshot,
      });
    });
  };

  return createTrustedBookingCompensationExecutor({
    authorizeActor,
    loadAuthoritativeBookingContext,
    loadCanonicalCompensationRules,
    persistBookingCompensation,
  });
}
