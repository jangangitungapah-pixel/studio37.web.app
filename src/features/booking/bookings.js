import { toJavaScriptDate } from '../../lib/datetime/timestamps.js';
import { requireIntegerIdr } from '../../lib/money/idr.js';
import { buildCustomerSnapshot, decodeCustomerSnapshot } from '../customers/customers.js';
import { SESSION_TYPE_STATUSES } from '../pricing/sessionTypes.js';
import { STUDIO_ROOM_STATUSES } from '../settings/studioRooms.js';

export const BOOKINGS_COLLECTION_NAME = 'bookings';
export const BOOKING_CONFLICT_QUERY_LIMIT = 100;
export const BOOKING_DURATION_STEP_MINUTES = 15;
export const BOOKING_MAX_DURATION_MINUTES = 24 * 60;

export const BOOKING_STATUSES = Object.freeze({
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
  CONFIRMED: 'confirmed',
  IN_PROGRESS: 'in_progress',
});

export const BOOKING_PAYMENT_STATUSES = Object.freeze({
  DP: 'dp',
  LUNAS: 'lunas',
  PENDING: 'pending',
});

const conflictRelevantStatuses = new Set([
  BOOKING_STATUSES.COMPLETED,
  BOOKING_STATUSES.CONFIRMED,
  BOOKING_STATUSES.IN_PROGRESS,
]);
const supportedBookingStatuses = new Set(Object.values(BOOKING_STATUSES));
const supportedPaymentStatuses = new Set(Object.values(BOOKING_PAYMENT_STATUSES));
const persistedBookingFieldNames = Object.freeze([
  'addOnAmountIdr',
  'assignedOperatorIds',
  'balanceAmountIdr',
  'bookingNumber',
  'compensationSnapshot',
  'compensationSummary',
  'createdAt',
  'createdByUid',
  'customerId',
  'customerSnapshot',
  'discountAmountIdr',
  'durationMinutes',
  'endAt',
  'id',
  'notes',
  'paidAmountIdr',
  'paymentStatus',
  'pricingSnapshot',
  'sessionSnapshot',
  'sessionTypeId',
  'startAt',
  'status',
  'studioId',
  'studioSnapshot',
  'subtotalAmountIdr',
  'totalAmountIdr',
  'updatedAt',
  'updatedByUid',
]);
const studioSnapshotFieldNames = Object.freeze(['code', 'name', 'studioId']);
const sessionSnapshotFieldNames = Object.freeze([
  'code',
  'name',
  'requiresStudioReservation',
  'sessionTypeId',
]);
const pricingSnapshotFieldNames = Object.freeze([
  'addOnCalculation',
  'amounts',
  'baseCalculation',
  'calculationVersion',
  'discountCalculation',
  'pricingTimeIso',
  'rule',
  'snapshotVersion',
]);
const pricingAmountFieldNames = Object.freeze([
  'addOnAmountIdr',
  'baseAmountIdr',
  'discountAmountIdr',
  'discountableAmountIdr',
  'finalAmountIdr',
  'nonDiscountableAmountIdr',
  'subtotalAmountIdr',
]);
const pricingRuleSnapshotFieldNames = Object.freeze([
  'configuration',
  'effectiveFromIso',
  'effectiveUntilIso',
  'id',
  'name',
  'pricingModel',
  'priority',
  'sessionTypeId',
  'sourceUpdatedAtIso',
  'sourceUpdatedByUid',
  'studioId',
]);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireRecord(value, label) {
  if (!isRecord(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value;
}

function requireExactFields(value, expectedFields, label) {
  const actualFields = Object.keys(value).sort();
  const expected = [...expectedFields].sort();

  if (
    actualFields.length !== expected.length ||
    actualFields.some((field, index) => field !== expected[index])
  ) {
    throw new TypeError(`${label} has an unsupported document shape.`);
  }
}

function requireTrimmedString(value, label, { allowEmpty = false, maxLength }) {
  if (typeof value !== 'string') {
    throw new TypeError(`${label} must be a string.`);
  }

  const normalized = value.trim();
  if (!allowEmpty && !normalized) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
  if (normalized.length > maxLength) {
    throw new RangeError(`${label} must be at most ${maxLength} characters.`);
  }

  return normalized;
}

function requireSingleSegmentId(value, label) {
  const normalized = requireTrimmedString(value, label, { maxLength: 128 });
  if (normalized.includes('/')) {
    throw new TypeError(`${label} must be a Firestore document id.`);
  }
  return normalized;
}

function normalizeOptionalSingleSegmentId(value, label) {
  if (value === null) return null;
  return requireSingleSegmentId(value, label);
}

function requireCanonicalIso(value, label, { allowNull = false } = {}) {
  if (allowNull && value === null) return null;
  const iso = requireTrimmedString(value, label, { maxLength: 64 });
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== iso) {
    throw new TypeError(`${label} must be a canonical ISO timestamp.`);
  }
  return iso;
}

function requirePositiveVersion(value, label) {
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new RangeError(`${label} must be an integer between 1 and 100.`);
  }
  return value;
}

function clonePlainValue(value, label, depth = 0) {
  if (depth > 12) {
    throw new RangeError(`${label} is nested too deeply.`);
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new TypeError(`${label} numeric values must be safe integers.`);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return Object.freeze(
      value.map((item, index) => clonePlainValue(item, `${label}[${index}]`, depth + 1)),
    );
  }
  if (isRecord(value)) {
    return Object.freeze(
      Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          clonePlainValue(item, `${label}.${key}`, depth + 1),
        ]),
      ),
    );
  }
  throw new TypeError(`${label} must contain only persistable snapshot values.`);
}

function requireBookingDuration(value) {
  if (
    !Number.isInteger(value) ||
    value < BOOKING_DURATION_STEP_MINUTES ||
    value > BOOKING_MAX_DURATION_MINUTES ||
    value % BOOKING_DURATION_STEP_MINUTES !== 0
  ) {
    throw new RangeError(
      `booking.durationMinutes must be a ${BOOKING_DURATION_STEP_MINUTES}-minute increment between ${BOOKING_DURATION_STEP_MINUTES} and ${BOOKING_MAX_DURATION_MINUTES}.`,
    );
  }
  return value;
}

function normalizeBookingStatus(value) {
  if (typeof value !== 'string' || !supportedBookingStatuses.has(value)) {
    throw new RangeError('booking.status is not supported.');
  }
  return value;
}

function normalizePaymentStatus(value) {
  if (typeof value !== 'string' || !supportedPaymentStatuses.has(value)) {
    throw new RangeError('booking.paymentStatus is not supported.');
  }
  return value;
}

function normalizeAssignedOperatorIds(value) {
  if (!Array.isArray(value) || value.length > 20) {
    throw new TypeError('booking.assignedOperatorIds must be an array with at most 20 items.');
  }

  const normalized = value.map((operatorId, index) =>
    requireSingleSegmentId(operatorId, `booking.assignedOperatorIds[${index}]`),
  );
  if (new Set(normalized).size !== normalized.length) {
    throw new RangeError('booking.assignedOperatorIds must not contain duplicates.');
  }

  return Object.freeze(normalized);
}

function normalizePricingSnapshot(value) {
  const snapshot = requireRecord(value, 'booking.pricingSnapshot');
  requireExactFields(snapshot, pricingSnapshotFieldNames, 'booking.pricingSnapshot');

  const amounts = requireRecord(snapshot.amounts, 'booking.pricingSnapshot.amounts');
  requireExactFields(amounts, pricingAmountFieldNames, 'booking.pricingSnapshot.amounts');
  const normalizedAmounts = Object.freeze(
    Object.fromEntries(
      pricingAmountFieldNames.map((field) => [
        field,
        requireIntegerIdr(amounts[field], { label: `booking.pricingSnapshot.amounts.${field}` }),
      ]),
    ),
  );

  if (
    normalizedAmounts.subtotalAmountIdr !==
    normalizedAmounts.baseAmountIdr + normalizedAmounts.addOnAmountIdr
  ) {
    throw new RangeError('booking.pricingSnapshot subtotal does not reconcile.');
  }
  if (
    normalizedAmounts.finalAmountIdr !==
    normalizedAmounts.subtotalAmountIdr - normalizedAmounts.discountAmountIdr
  ) {
    throw new RangeError('booking.pricingSnapshot final amount does not reconcile.');
  }

  const rule = requireRecord(snapshot.rule, 'booking.pricingSnapshot.rule');
  requireExactFields(rule, pricingRuleSnapshotFieldNames, 'booking.pricingSnapshot.rule');
  const normalizedRule = Object.freeze({
    configuration: clonePlainValue(rule.configuration, 'booking.pricingSnapshot.rule.configuration'),
    effectiveFromIso: requireCanonicalIso(
      rule.effectiveFromIso,
      'booking.pricingSnapshot.rule.effectiveFromIso',
      { allowNull: true },
    ),
    effectiveUntilIso: requireCanonicalIso(
      rule.effectiveUntilIso,
      'booking.pricingSnapshot.rule.effectiveUntilIso',
      { allowNull: true },
    ),
    id: requireSingleSegmentId(rule.id, 'booking.pricingSnapshot.rule.id'),
    name: requireTrimmedString(rule.name, 'booking.pricingSnapshot.rule.name', { maxLength: 100 }),
    pricingModel: requireTrimmedString(rule.pricingModel, 'booking.pricingSnapshot.rule.pricingModel', {
      maxLength: 40,
    }),
    priority: Number.isInteger(rule.priority) ? rule.priority : NaN,
    sessionTypeId: requireSingleSegmentId(
      rule.sessionTypeId,
      'booking.pricingSnapshot.rule.sessionTypeId',
    ),
    sourceUpdatedAtIso: requireCanonicalIso(
      rule.sourceUpdatedAtIso,
      'booking.pricingSnapshot.rule.sourceUpdatedAtIso',
    ),
    sourceUpdatedByUid: requireSingleSegmentId(
      rule.sourceUpdatedByUid,
      'booking.pricingSnapshot.rule.sourceUpdatedByUid',
    ),
    studioId: normalizeOptionalSingleSegmentId(
      rule.studioId,
      'booking.pricingSnapshot.rule.studioId',
    ),
  });
  if (!Number.isInteger(normalizedRule.priority) || normalizedRule.priority < 1) {
    throw new RangeError('booking.pricingSnapshot.rule.priority must be a positive integer.');
  }

  return Object.freeze({
    addOnCalculation: clonePlainValue(
      snapshot.addOnCalculation,
      'booking.pricingSnapshot.addOnCalculation',
    ),
    amounts: normalizedAmounts,
    baseCalculation: clonePlainValue(
      snapshot.baseCalculation,
      'booking.pricingSnapshot.baseCalculation',
    ),
    calculationVersion: requirePositiveVersion(
      snapshot.calculationVersion,
      'booking.pricingSnapshot.calculationVersion',
    ),
    discountCalculation: clonePlainValue(
      snapshot.discountCalculation,
      'booking.pricingSnapshot.discountCalculation',
    ),
    pricingTimeIso: requireCanonicalIso(
      snapshot.pricingTimeIso,
      'booking.pricingSnapshot.pricingTimeIso',
    ),
    rule: normalizedRule,
    snapshotVersion: requirePositiveVersion(
      snapshot.snapshotVersion,
      'booking.pricingSnapshot.snapshotVersion',
    ),
  });
}

export function normalizeBookingId(value) {
  return requireSingleSegmentId(value, 'bookingId');
}

export function normalizeBookingActorUid(value) {
  return requireSingleSegmentId(value, 'actorUid');
}

export function buildBookingNumber(bookingId) {
  return `ST37-${normalizeBookingId(bookingId)}`;
}

export function calculateBookingEndAt(startAt, durationMinutes) {
  const start = toJavaScriptDate(startAt, { label: 'booking.startAt' });
  const duration = requireBookingDuration(durationMinutes);
  return new Date(start.getTime() + duration * 60_000);
}

export function buildStudioSnapshot(value) {
  const studio = requireRecord(value, 'studio snapshot source');
  if (studio.status !== STUDIO_ROOM_STATUSES.ACTIVE) {
    throw new RangeError('New bookings require an active studio room.');
  }

  return Object.freeze({
    code: requireTrimmedString(studio.code, 'studio.code', { maxLength: 24 }),
    name: requireTrimmedString(studio.name, 'studio.name', { maxLength: 80 }),
    studioId: requireSingleSegmentId(studio.id, 'studio.id'),
  });
}

export function decodeStudioSnapshot(value) {
  const snapshot = requireRecord(value, 'booking.studioSnapshot');
  requireExactFields(snapshot, studioSnapshotFieldNames, 'booking.studioSnapshot');
  return Object.freeze({
    code: requireTrimmedString(snapshot.code, 'booking.studioSnapshot.code', { maxLength: 24 }),
    name: requireTrimmedString(snapshot.name, 'booking.studioSnapshot.name', { maxLength: 80 }),
    studioId: requireSingleSegmentId(snapshot.studioId, 'booking.studioSnapshot.studioId'),
  });
}

export function buildSessionSnapshot(value) {
  const sessionType = requireRecord(value, 'session snapshot source');
  if (sessionType.status !== SESSION_TYPE_STATUSES.ACTIVE) {
    throw new RangeError('New bookings require an active session type.');
  }
  if (typeof sessionType.requiresStudioReservation !== 'boolean') {
    throw new TypeError('sessionType.requiresStudioReservation must be a boolean.');
  }

  return Object.freeze({
    code: requireTrimmedString(sessionType.code, 'sessionType.code', { maxLength: 24 }),
    name: requireTrimmedString(sessionType.name, 'sessionType.name', { maxLength: 80 }),
    requiresStudioReservation: sessionType.requiresStudioReservation,
    sessionTypeId: requireSingleSegmentId(sessionType.id, 'sessionType.id'),
  });
}

export function decodeSessionSnapshot(value) {
  const snapshot = requireRecord(value, 'booking.sessionSnapshot');
  requireExactFields(snapshot, sessionSnapshotFieldNames, 'booking.sessionSnapshot');
  if (typeof snapshot.requiresStudioReservation !== 'boolean') {
    throw new TypeError('booking.sessionSnapshot.requiresStudioReservation must be a boolean.');
  }
  return Object.freeze({
    code: requireTrimmedString(snapshot.code, 'booking.sessionSnapshot.code', { maxLength: 24 }),
    name: requireTrimmedString(snapshot.name, 'booking.sessionSnapshot.name', { maxLength: 80 }),
    requiresStudioReservation: snapshot.requiresStudioReservation,
    sessionTypeId: requireSingleSegmentId(
      snapshot.sessionTypeId,
      'booking.sessionSnapshot.sessionTypeId',
    ),
  });
}

export function derivePaymentSummary(totalAmountIdr, paidAmountIdr) {
  const total = requireIntegerIdr(totalAmountIdr, { label: 'booking.totalAmountIdr' });
  const paid = requireIntegerIdr(paidAmountIdr, { label: 'booking.paidAmountIdr' });
  if (paid > total) {
    throw new RangeError('booking.paidAmountIdr cannot exceed booking.totalAmountIdr.');
  }

  const paymentStatus =
    paid === 0
      ? BOOKING_PAYMENT_STATUSES.PENDING
      : paid === total
        ? BOOKING_PAYMENT_STATUSES.LUNAS
        : BOOKING_PAYMENT_STATUSES.DP;

  return Object.freeze({
    balanceAmountIdr: total - paid,
    paidAmountIdr: paid,
    paymentStatus,
    totalAmountIdr: total,
  });
}

export function isConflictRelevantBooking(value) {
  const booking = requireRecord(value, 'booking');
  return conflictRelevantStatuses.has(normalizeBookingStatus(booking.status));
}

export function bookingsOverlap(leftValue, rightValue) {
  const left = requireRecord(leftValue, 'left booking');
  const right = requireRecord(rightValue, 'right booking');
  const leftStudioId = normalizeOptionalSingleSegmentId(left.studioId, 'left booking.studioId');
  const rightStudioId = normalizeOptionalSingleSegmentId(right.studioId, 'right booking.studioId');
  if (leftStudioId === null || rightStudioId === null || leftStudioId !== rightStudioId) return false;
  if (!isConflictRelevantBooking(left) || !isConflictRelevantBooking(right)) return false;

  const leftStart = toJavaScriptDate(left.startAt, { label: 'left booking.startAt' });
  const leftEnd = toJavaScriptDate(left.endAt, { label: 'left booking.endAt' });
  const rightStart = toJavaScriptDate(right.startAt, { label: 'right booking.startAt' });
  const rightEnd = toJavaScriptDate(right.endAt, { label: 'right booking.endAt' });

  if (leftEnd.getTime() <= leftStart.getTime() || rightEnd.getTime() <= rightStart.getTime()) {
    throw new RangeError('Booking endAt must be later than startAt.');
  }

  return leftStart < rightEnd && leftEnd > rightStart;
}

export function canTransitionBookingStatus(fromStatus, toStatus) {
  const from = normalizeBookingStatus(fromStatus);
  const to = normalizeBookingStatus(toStatus);
  if (from === to) return false;

  if (from === BOOKING_STATUSES.CONFIRMED) {
    return [
      BOOKING_STATUSES.CANCELLED,
      BOOKING_STATUSES.COMPLETED,
      BOOKING_STATUSES.IN_PROGRESS,
    ].includes(to);
  }
  if (from === BOOKING_STATUSES.IN_PROGRESS) {
    return [BOOKING_STATUSES.CANCELLED, BOOKING_STATUSES.COMPLETED].includes(to);
  }
  return false;
}

export function buildBookingDraft({
  assignedOperatorIds = [],
  bookingId,
  customer,
  durationMinutes,
  notes = '',
  pricingSnapshot,
  sessionType,
  startAt,
  studio,
}) {
  const id = normalizeBookingId(bookingId);
  const customerSnapshot = buildCustomerSnapshot(customer);
  const sessionSnapshot = buildSessionSnapshot(sessionType);
  const studioSnapshot = studio === null ? null : buildStudioSnapshot(studio);
  const studioId = studioSnapshot?.studioId ?? null;
  const duration = requireBookingDuration(durationMinutes);
  const start = toJavaScriptDate(startAt, { label: 'booking.startAt' });
  const end = calculateBookingEndAt(start, duration);
  const normalizedPricingSnapshot = normalizePricingSnapshot(pricingSnapshot);

  if (sessionSnapshot.requiresStudioReservation && studioSnapshot === null) {
    throw new RangeError('This session type requires a studio room reservation.');
  }
  if (normalizedPricingSnapshot.rule.sessionTypeId !== sessionSnapshot.sessionTypeId) {
    throw new RangeError('Pricing snapshot session type does not match the booking session type.');
  }
  if (
    normalizedPricingSnapshot.rule.studioId !== null &&
    normalizedPricingSnapshot.rule.studioId !== studioId
  ) {
    throw new RangeError('Pricing snapshot studio scope does not match the booking studio.');
  }

  const amounts = normalizedPricingSnapshot.amounts;
  const payment = derivePaymentSummary(amounts.finalAmountIdr, 0);

  return Object.freeze({
    addOnAmountIdr: amounts.addOnAmountIdr,
    assignedOperatorIds: normalizeAssignedOperatorIds(assignedOperatorIds),
    balanceAmountIdr: payment.balanceAmountIdr,
    bookingNumber: buildBookingNumber(id),
    compensationSnapshot: null,
    compensationSummary: null,
    customerId: customerSnapshot.customerId,
    customerSnapshot,
    discountAmountIdr: amounts.discountAmountIdr,
    durationMinutes: duration,
    endAt: end,
    notes: requireTrimmedString(notes, 'booking.notes', { allowEmpty: true, maxLength: 4000 }),
    paidAmountIdr: payment.paidAmountIdr,
    paymentStatus: payment.paymentStatus,
    pricingSnapshot: normalizedPricingSnapshot,
    sessionSnapshot,
    sessionTypeId: sessionSnapshot.sessionTypeId,
    startAt: start,
    status: BOOKING_STATUSES.CONFIRMED,
    studioId,
    studioSnapshot,
    subtotalAmountIdr: amounts.subtotalAmountIdr,
    totalAmountIdr: payment.totalAmountIdr,
  });
}

export function decodeBookingDocument(value) {
  const booking = requireRecord(value, 'booking document');
  requireExactFields(booking, persistedBookingFieldNames, 'booking document');

  const id = normalizeBookingId(booking.id);
  if (booking.bookingNumber !== buildBookingNumber(id)) {
    throw new RangeError('booking.bookingNumber does not match the immutable booking id.');
  }

  const customerSnapshot = decodeCustomerSnapshot(booking.customerSnapshot);
  const studioSnapshot =
    booking.studioSnapshot === null ? null : decodeStudioSnapshot(booking.studioSnapshot);
  const sessionSnapshot = decodeSessionSnapshot(booking.sessionSnapshot);
  const studioId = normalizeOptionalSingleSegmentId(booking.studioId, 'booking.studioId');
  const pricingSnapshot = normalizePricingSnapshot(booking.pricingSnapshot);
  const startAt = toJavaScriptDate(booking.startAt, { label: 'booking.startAt' });
  const endAt = toJavaScriptDate(booking.endAt, { label: 'booking.endAt' });
  const durationMinutes = requireBookingDuration(booking.durationMinutes);
  const expectedEndAt = calculateBookingEndAt(startAt, durationMinutes);
  const payment = derivePaymentSummary(booking.totalAmountIdr, booking.paidAmountIdr);

  if (expectedEndAt.getTime() !== endAt.getTime()) {
    throw new RangeError('booking.endAt does not match startAt plus durationMinutes.');
  }
  if (customerSnapshot.customerId !== normalizeBookingId(booking.customerId)) {
    throw new RangeError('booking.customerSnapshot does not match customerId.');
  }
  if ((studioSnapshot?.studioId ?? null) !== studioId) {
    throw new RangeError('booking.studioSnapshot does not match studioId.');
  }
  if (sessionSnapshot.sessionTypeId !== requireSingleSegmentId(booking.sessionTypeId, 'booking.sessionTypeId')) {
    throw new RangeError('booking.sessionSnapshot does not match sessionTypeId.');
  }
  if (pricingSnapshot.rule.sessionTypeId !== sessionSnapshot.sessionTypeId) {
    throw new RangeError('booking.pricingSnapshot session type does not match sessionTypeId.');
  }
  if (pricingSnapshot.rule.studioId !== null && pricingSnapshot.rule.studioId !== studioId) {
    throw new RangeError('booking.pricingSnapshot studio scope does not match studioId.');
  }
  if (
    booking.subtotalAmountIdr !== pricingSnapshot.amounts.subtotalAmountIdr ||
    booking.discountAmountIdr !== pricingSnapshot.amounts.discountAmountIdr ||
    booking.addOnAmountIdr !== pricingSnapshot.amounts.addOnAmountIdr ||
    booking.totalAmountIdr !== pricingSnapshot.amounts.finalAmountIdr
  ) {
    throw new RangeError('booking top-level pricing amounts do not match pricingSnapshot.');
  }
  if (
    booking.balanceAmountIdr !== payment.balanceAmountIdr ||
    normalizePaymentStatus(booking.paymentStatus) !== payment.paymentStatus
  ) {
    throw new RangeError('booking payment summary does not reconcile.');
  }

  const createdAt = toJavaScriptDate(booking.createdAt, { label: 'booking.createdAt' });
  const updatedAt = toJavaScriptDate(booking.updatedAt, { label: 'booking.updatedAt' });
  if (updatedAt < createdAt) {
    throw new RangeError('booking.updatedAt cannot be earlier than createdAt.');
  }

  return Object.freeze({
    addOnAmountIdr: booking.addOnAmountIdr,
    assignedOperatorIds: normalizeAssignedOperatorIds(booking.assignedOperatorIds),
    balanceAmountIdr: booking.balanceAmountIdr,
    bookingNumber: booking.bookingNumber,
    compensationSnapshot: clonePlainValue(booking.compensationSnapshot, 'booking.compensationSnapshot'),
    compensationSummary: clonePlainValue(booking.compensationSummary, 'booking.compensationSummary'),
    createdAt,
    createdByUid: normalizeBookingActorUid(booking.createdByUid),
    customerId: customerSnapshot.customerId,
    customerSnapshot,
    discountAmountIdr: booking.discountAmountIdr,
    durationMinutes,
    endAt,
    id,
    notes: requireTrimmedString(booking.notes, 'booking.notes', { allowEmpty: true, maxLength: 4000 }),
    paidAmountIdr: payment.paidAmountIdr,
    paymentStatus: payment.paymentStatus,
    pricingSnapshot,
    sessionSnapshot,
    sessionTypeId: sessionSnapshot.sessionTypeId,
    startAt,
    status: normalizeBookingStatus(booking.status),
    studioId,
    studioSnapshot,
    subtotalAmountIdr: booking.subtotalAmountIdr,
    totalAmountIdr: payment.totalAmountIdr,
    updatedAt,
    updatedByUid: normalizeBookingActorUid(booking.updatedByUid),
  });
}
