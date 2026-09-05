import { buildBookingCompensationProjection } from '../features/commissions/bookingCompensation.js';

export const TRUSTED_BOOKING_COMPENSATION_CAPABILITY = 'booking.create';
export const TRUSTED_BOOKING_COMPENSATION_BOOKING_STATE = 'confirmed';

function requireRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value;
}

function requireFunction(value, label) {
  if (typeof value !== 'function') {
    throw new TypeError(`${label} must be a function.`);
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

function normalizeAuthoritativeBookingContext(value, bookingId) {
  const context = requireRecord(value, 'authoritative booking compensation context');
  const contextBookingId = requireSingleSegmentId(context.bookingId, 'context.bookingId');

  if (contextBookingId !== bookingId) {
    throw new TrustedBookingCompensationContextError(
      'Authoritative booking context does not match the requested booking.',
    );
  }
  if (context.status !== TRUSTED_BOOKING_COMPENSATION_BOOKING_STATE) {
    throw new TrustedBookingCompensationContextError(
      `Booking must be ${TRUSTED_BOOKING_COMPENSATION_BOOKING_STATE} before confirmation compensation is generated.`,
    );
  }
  if (!Array.isArray(context.assignments)) {
    throw new TrustedBookingCompensationContextError('Booking assignments must be authoritative data.');
  }
  if (!context.effectiveAt) {
    throw new TrustedBookingCompensationContextError(
      'Booking compensation effectiveAt must come from authoritative booking data.',
    );
  }

  return Object.freeze({
    assignments: context.assignments,
    bookingId: contextBookingId,
    bookingNumber: context.bookingNumber ?? null,
    durationMinutes: context.durationMinutes,
    effectiveAt: context.effectiveAt,
    percentageBaseAmounts: context.percentageBaseAmounts ?? {},
    sessionTypeId: context.sessionTypeId ?? null,
    studioId: context.studioId ?? null,
  });
}

function normalizePersistenceResult(value, bookingId) {
  const result = requireRecord(value, 'booking compensation persistence result');
  const persistedBookingId = requireSingleSegmentId(result.bookingId, 'persistenceResult.bookingId');

  if (persistedBookingId !== bookingId) {
    throw new TrustedBookingCompensationPersistenceError(
      'Persistence result does not match the requested booking.',
    );
  }
  if (!Array.isArray(result.createdEntryIds) || !Array.isArray(result.existingEntryIds)) {
    throw new TrustedBookingCompensationPersistenceError(
      'Persistence result must include createdEntryIds and existingEntryIds arrays.',
    );
  }

  return Object.freeze({
    bookingId,
    createdEntryCount: result.createdEntryIds.length,
    existingEntryCount: result.existingEntryIds.length,
    initializedBookingSnapshot: result.initializedBookingSnapshot === true,
  });
}

export class TrustedBookingCompensationExecutionError extends Error {}

export class TrustedBookingCompensationAuthorizationError extends TrustedBookingCompensationExecutionError {
  constructor() {
    super('Actor is not authorized to execute trusted booking compensation.');
    this.name = 'TrustedBookingCompensationAuthorizationError';
  }
}

export class TrustedBookingCompensationContextError extends TrustedBookingCompensationExecutionError {
  constructor(message) {
    super(message);
    this.name = 'TrustedBookingCompensationContextError';
  }
}

export class TrustedBookingCompensationProjectionError extends TrustedBookingCompensationExecutionError {
  constructor(diagnostics) {
    super('Trusted booking compensation projection contains unresolved diagnostics.');
    this.name = 'TrustedBookingCompensationProjectionError';
    this.diagnostics = Object.freeze([...diagnostics]);
  }
}

export class TrustedBookingCompensationPersistenceError extends TrustedBookingCompensationExecutionError {
  constructor(message) {
    super(message);
    this.name = 'TrustedBookingCompensationPersistenceError';
  }
}

export function createTrustedBookingCompensationExecutor({
  authorizeActor,
  loadAuthoritativeBookingContext,
  loadCanonicalCompensationRules,
  persistBookingCompensation,
  projectionBuilder = buildBookingCompensationProjection,
} = {}) {
  const authorize = requireFunction(authorizeActor, 'authorizeActor');
  const loadContext = requireFunction(
    loadAuthoritativeBookingContext,
    'loadAuthoritativeBookingContext',
  );
  const loadRules = requireFunction(
    loadCanonicalCompensationRules,
    'loadCanonicalCompensationRules',
  );
  const persist = requireFunction(persistBookingCompensation, 'persistBookingCompensation');
  const buildProjection = requireFunction(projectionBuilder, 'projectionBuilder');

  return Object.freeze({
    async execute({ actorUid, bookingId } = {}) {
      const normalizedActorUid = requireSingleSegmentId(actorUid, 'actorUid');
      const normalizedBookingId = requireSingleSegmentId(bookingId, 'bookingId');

      const authorization = await authorize({
        actorUid: normalizedActorUid,
        bookingId: normalizedBookingId,
        capability: TRUSTED_BOOKING_COMPENSATION_CAPABILITY,
      });
      if (authorization !== true) {
        throw new TrustedBookingCompensationAuthorizationError();
      }

      const context = normalizeAuthoritativeBookingContext(
        await loadContext({ bookingId: normalizedBookingId }),
        normalizedBookingId,
      );
      const rules = await loadRules({
        bookingId: normalizedBookingId,
        effectiveAt: context.effectiveAt,
      });
      if (!Array.isArray(rules)) {
        throw new TypeError('Canonical compensation rules must be an array.');
      }

      const projection = buildProjection({
        assignments: context.assignments,
        bookingId: context.bookingId,
        bookingNumber: context.bookingNumber,
        durationMinutes: context.durationMinutes,
        effectiveAt: context.effectiveAt,
        percentageBaseAmounts: context.percentageBaseAmounts,
        rules,
        sessionTypeId: context.sessionTypeId,
        studioId: context.studioId,
      });

      if (!Array.isArray(projection?.diagnostics)) {
        throw new TypeError('Trusted booking compensation projection must include diagnostics.');
      }
      if (projection.diagnostics.length > 0) {
        throw new TrustedBookingCompensationProjectionError(projection.diagnostics);
      }

      const persistenceResult = await persist({
        actorUid: normalizedActorUid,
        bookingId: normalizedBookingId,
        projection,
      });

      return normalizePersistenceResult(persistenceResult, normalizedBookingId);
    },
  });
}
