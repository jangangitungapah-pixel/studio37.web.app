import { buildBookingCompensationProjection } from '../../src/features/commissions/bookingCompensation.js';

export const TRUSTED_COMPENSATION_RULE_LIMIT = 200;
export const TRUSTED_BOOKING_STATUS = 'confirmed';
export const TRUSTED_BOOKING_CAPABILITY = 'booking.create';

const supportedRoles = new Set(['owner', 'studio_operator']);
const supportedOperatorTypes = new Set(['studio_operator', 'recording_engineer']);
const allowedRequestFields = new Set(['bookingId']);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireRecord(value, label) {
  if (!isRecord(value)) {
    throw new TrustedBookingCompensationError('invalid-argument', `${label} must be an object.`);
  }
  return value;
}

function requireSingleSegmentId(value, label) {
  if (typeof value !== 'string') {
    throw new TrustedBookingCompensationError('invalid-argument', `${label} must be a string.`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > 128 || normalized.includes('/')) {
    throw new TrustedBookingCompensationError(
      'invalid-argument',
      `${label} must be a valid Firestore document id.`,
    );
  }
  return normalized;
}

function requireSafeNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TrustedBookingCompensationError(
      'failed-precondition',
      `${label} must be a non-negative safe integer.`,
    );
  }
  return value;
}

function assertExactRequestShape(dataValue) {
  const data = requireRecord(dataValue, 'request.data');
  const fields = Object.keys(data);
  if (fields.some((field) => !allowedRequestFields.has(field)) || fields.length !== 1) {
    throw new TrustedBookingCompensationError(
      'invalid-argument',
      'Trusted compensation execution accepts bookingId only.',
    );
  }
  return requireSingleSegmentId(data.bookingId, 'bookingId');
}

function assertGateway(gateway) {
  const requiredMethods = [
    'getBooking',
    'getOperator',
    'getPermissionSet',
    'getUser',
    'listActiveCompensationRules',
    'persistProjection',
  ];
  for (const method of requiredMethods) {
    if (typeof gateway?.[method] !== 'function') {
      throw new TypeError(`gateway.${method} must be a function.`);
    }
  }
  return gateway;
}

function normalizeUserProfile(uid, value) {
  const profile = requireRecord(value, 'user profile');
  if (
    profile.uid !== uid ||
    profile.status !== 'active' ||
    typeof profile.role !== 'string' ||
    !supportedRoles.has(profile.role)
  ) {
    throw new TrustedBookingCompensationError(
      'permission-denied',
      'Caller does not have an active supported Studio37 profile.',
    );
  }
  return profile;
}

async function authorizeCaller(gateway, uid) {
  const profile = normalizeUserProfile(uid, await gateway.getUser(uid));
  if (profile.role === 'owner') {
    return Object.freeze({ profile, role: profile.role });
  }

  const permissionSetId = requireSingleSegmentId(profile.permissionSetId, 'permissionSetId');
  const operatorId = requireSingleSegmentId(profile.operatorId, 'operatorId');
  const [permissionSetValue, operatorValue] = await Promise.all([
    gateway.getPermissionSet(permissionSetId),
    gateway.getOperator(operatorId),
  ]);
  const permissionSet = requireRecord(permissionSetValue, 'permission set');
  const operator = requireRecord(operatorValue, 'operator');

  if (
    permissionSet.status !== 'active' ||
    !Array.isArray(permissionSet.capabilities) ||
    !permissionSet.capabilities.includes(TRUSTED_BOOKING_CAPABILITY)
  ) {
    throw new TrustedBookingCompensationError(
      'permission-denied',
      `Studio Operator requires ${TRUSTED_BOOKING_CAPABILITY}.`,
    );
  }

  if (
    operator.status !== 'active' ||
    operator.linkedUserUid !== uid ||
    !Array.isArray(operator.operatorTypes) ||
    !operator.operatorTypes.includes('studio_operator')
  ) {
    throw new TrustedBookingCompensationError(
      'permission-denied',
      'Caller does not have a reciprocal active Studio Operator link.',
    );
  }

  return Object.freeze({ operatorId, profile, role: profile.role });
}

function normalizeAssignments(booking) {
  if (!Array.isArray(booking.assignedOperators)) {
    throw new TrustedBookingCompensationError(
      'failed-precondition',
      'Confirmed booking must contain assignedOperators.',
    );
  }

  return booking.assignedOperators.map((assignmentValue, index) => {
    const assignment = requireRecord(assignmentValue, `assignedOperators[${index}]`);
    const operatorId = requireSingleSegmentId(
      assignment.operatorId,
      `assignedOperators[${index}].operatorId`,
    );
    if (!supportedOperatorTypes.has(assignment.operatorType)) {
      throw new TrustedBookingCompensationError(
        'failed-precondition',
        `assignedOperators[${index}].operatorType is unsupported.`,
      );
    }
    return Object.freeze({ operatorId, operatorType: assignment.operatorType });
  });
}

function buildPercentageBaseAmounts(booking) {
  const mappings = [
    ['booking_subtotal_before_discount', 'subtotalAmountIdr'],
    ['booking_total_after_discount', 'totalAmountIdr'],
    ['service_amount', 'serviceAmountIdr'],
  ];
  const result = {};
  for (const [base, field] of mappings) {
    if (booking[field] !== null && booking[field] !== undefined) {
      result[base] = requireSafeNonNegativeInteger(booking[field], field);
    }
  }
  return Object.freeze(result);
}

function requireConfirmedBooking(bookingId, value) {
  const booking = requireRecord(value, 'booking');
  if (booking.status !== TRUSTED_BOOKING_STATUS) {
    throw new TrustedBookingCompensationError(
      'failed-precondition',
      `Booking ${bookingId} must be confirmed before compensation initialization.`,
    );
  }
  if (!booking.confirmedAt) {
    throw new TrustedBookingCompensationError(
      'failed-precondition',
      `Booking ${bookingId} must have confirmedAt.`,
    );
  }
  return booking;
}

function normalizeRules(value) {
  if (!Array.isArray(value)) {
    throw new TrustedBookingCompensationError(
      'internal',
      'Compensation rule gateway returned an invalid result.',
    );
  }
  if (value.length > TRUSTED_COMPENSATION_RULE_LIMIT) {
    throw new TrustedBookingCompensationError(
      'failed-precondition',
      `Active compensation rule count exceeds the trusted limit of ${TRUSTED_COMPENSATION_RULE_LIMIT}.`,
    );
  }
  return value;
}

function sanitizePersistenceResult(bookingId, value) {
  const result = requireRecord(value, 'persistence result');
  const createdEntryIds = Array.isArray(result.createdEntryIds) ? result.createdEntryIds : [];
  const existingEntryIds = Array.isArray(result.existingEntryIds) ? result.existingEntryIds : [];
  return Object.freeze({
    bookingId,
    createdEntryCount: createdEntryIds.length,
    existingEntryCount: existingEntryIds.length,
    initializedBookingSnapshot: result.initializedBookingSnapshot === true,
    status: 'initialized',
  });
}

export class TrustedBookingCompensationError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = 'TrustedBookingCompensationError';
    this.code = code;
  }
}

export async function executeTrustedBookingCompensation(requestValue, { gateway } = {}) {
  const resolvedGateway = assertGateway(gateway);
  const request = requireRecord(requestValue, 'request');
  const uid = request.auth?.uid;
  if (typeof uid !== 'string' || !uid.trim()) {
    throw new TrustedBookingCompensationError(
      'unauthenticated',
      'Authentication is required for compensation execution.',
    );
  }

  const bookingId = assertExactRequestShape(request.data);
  await authorizeCaller(resolvedGateway, uid);

  const bookingValue = await resolvedGateway.getBooking(bookingId);
  if (!bookingValue) {
    throw new TrustedBookingCompensationError('not-found', `Booking ${bookingId} was not found.`);
  }
  const booking = requireConfirmedBooking(bookingId, bookingValue);
  const rules = normalizeRules(
    await resolvedGateway.listActiveCompensationRules(TRUSTED_COMPENSATION_RULE_LIMIT + 1),
  );

  let projection;
  try {
    projection = buildBookingCompensationProjection({
      assignments: normalizeAssignments(booking),
      bookingId,
      bookingNumber: booking.bookingNumber ?? null,
      durationMinutes: booking.durationMinutes,
      effectiveAt: booking.confirmedAt,
      percentageBaseAmounts: buildPercentageBaseAmounts(booking),
      rules,
      sessionTypeId: booking.sessionTypeId ?? null,
      studioId: booking.studioId ?? null,
    });
  } catch (error) {
    if (error instanceof TrustedBookingCompensationError) throw error;
    throw new TrustedBookingCompensationError(
      'failed-precondition',
      'Authoritative booking compensation calculation failed.',
      { cause: error },
    );
  }

  if (projection.diagnostics.length > 0) {
    throw new TrustedBookingCompensationError(
      'failed-precondition',
      'Authoritative booking compensation has unresolved rule diagnostics.',
    );
  }

  const persistenceResult = await resolvedGateway.persistProjection(bookingId, projection, {
    actorUid: uid,
  });
  return sanitizePersistenceResult(bookingId, persistenceResult);
}
