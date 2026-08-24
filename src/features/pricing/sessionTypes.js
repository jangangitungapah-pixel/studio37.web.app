import { toJavaScriptDate } from '../../lib/datetime/timestamps.js';

export const SESSION_TYPES_COLLECTION_NAME = 'sessionTypes';
export const SESSION_TYPE_LIST_LIMIT = 100;
export const SESSION_TYPE_DURATION_STEP_MINUTES = 15;
export const SESSION_TYPE_MAX_DURATION_MINUTES = 24 * 60;

export const SESSION_TYPE_STATUSES = Object.freeze({
  ACTIVE: 'active',
  DISABLED: 'disabled',
});

const mutableFieldNames = Object.freeze([
  'code',
  'defaultDurationMinutes',
  'description',
  'displayOrder',
  'minimumDurationMinutes',
  'name',
  'requiresStudioReservation',
]);
const persistedFieldNames = Object.freeze([
  ...mutableFieldNames,
  'createdAt',
  'createdByUid',
  'id',
  'status',
  'updatedAt',
  'updatedByUid',
]);
const sessionTypeCodePattern = /^[A-Z0-9][A-Z0-9-]{0,23}$/;
const supportedStatuses = new Set(Object.values(SESSION_TYPE_STATUSES));

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
  const id = requireTrimmedString(value, label, { maxLength: 128 });

  if (id.includes('/')) {
    throw new TypeError(`${label} must be a Firestore document id.`);
  }

  return id;
}

function requireSessionTypeCode(value) {
  const code = requireTrimmedString(value, 'sessionType.code', { maxLength: 24 }).toUpperCase();

  if (!sessionTypeCodePattern.test(code)) {
    throw new TypeError('sessionType.code must use uppercase letters, numbers, or hyphens.');
  }

  return code;
}

function requireDisplayOrder(value) {
  if (!Number.isInteger(value) || value < 1 || value > 999) {
    throw new RangeError('sessionType.displayOrder must be an integer between 1 and 999.');
  }

  return value;
}

function requireReservationFlag(value) {
  if (typeof value !== 'boolean') {
    throw new TypeError('sessionType.requiresStudioReservation must be a boolean.');
  }

  return value;
}

function normalizeNullableDuration(value, label) {
  if (value === null) return null;

  if (
    !Number.isInteger(value) ||
    value < SESSION_TYPE_DURATION_STEP_MINUTES ||
    value > SESSION_TYPE_MAX_DURATION_MINUTES ||
    value % SESSION_TYPE_DURATION_STEP_MINUTES !== 0
  ) {
    throw new RangeError(
      `${label} must be null or a ${SESSION_TYPE_DURATION_STEP_MINUTES}-minute increment between ${SESSION_TYPE_DURATION_STEP_MINUTES} and ${SESSION_TYPE_MAX_DURATION_MINUTES}.`,
    );
  }

  return value;
}

export function normalizeSessionTypeDetails(value) {
  const sessionType = requireRecord(value, 'sessionType');
  requireExactFields(sessionType, mutableFieldNames, 'sessionType');

  const defaultDurationMinutes = normalizeNullableDuration(
    sessionType.defaultDurationMinutes,
    'sessionType.defaultDurationMinutes',
  );
  const minimumDurationMinutes = normalizeNullableDuration(
    sessionType.minimumDurationMinutes,
    'sessionType.minimumDurationMinutes',
  );
  const requiresStudioReservation = requireReservationFlag(sessionType.requiresStudioReservation);

  if ((defaultDurationMinutes === null) !== (minimumDurationMinutes === null)) {
    throw new TypeError(
      'sessionType default and minimum durations must either both be configured or both be null.',
    );
  }

  if (requiresStudioReservation && defaultDurationMinutes === null) {
    throw new TypeError(
      'A studio-reserving sessionType must configure default and minimum duration.',
    );
  }

  if (
    defaultDurationMinutes !== null &&
    minimumDurationMinutes !== null &&
    minimumDurationMinutes > defaultDurationMinutes
  ) {
    throw new RangeError('sessionType.minimumDurationMinutes cannot exceed the default duration.');
  }

  return Object.freeze({
    code: requireSessionTypeCode(sessionType.code),
    defaultDurationMinutes,
    description: requireTrimmedString(sessionType.description, 'sessionType.description', {
      allowEmpty: true,
      maxLength: 240,
    }),
    displayOrder: requireDisplayOrder(sessionType.displayOrder),
    minimumDurationMinutes,
    name: requireTrimmedString(sessionType.name, 'sessionType.name', { maxLength: 80 }),
    requiresStudioReservation,
  });
}

export function normalizeSessionTypeStatus(value) {
  if (typeof value !== 'string' || !supportedStatuses.has(value)) {
    throw new RangeError('sessionType.status is not supported.');
  }

  return value;
}

export function normalizeSessionTypeActorUid(value) {
  return requireSingleSegmentId(value, 'actorUid');
}

export function normalizeSessionTypeId(value) {
  return requireSingleSegmentId(value, 'sessionTypeId');
}

export function decodeSessionTypeDocument(value) {
  const sessionType = requireRecord(value, 'sessionType document');
  requireExactFields(sessionType, persistedFieldNames, 'sessionType document');

  const details = normalizeSessionTypeDetails({
    code: sessionType.code,
    defaultDurationMinutes: sessionType.defaultDurationMinutes,
    description: sessionType.description,
    displayOrder: sessionType.displayOrder,
    minimumDurationMinutes: sessionType.minimumDurationMinutes,
    name: sessionType.name,
    requiresStudioReservation: sessionType.requiresStudioReservation,
  });
  const createdAt = toJavaScriptDate(sessionType.createdAt, { label: 'sessionType.createdAt' });
  const updatedAt = toJavaScriptDate(sessionType.updatedAt, { label: 'sessionType.updatedAt' });

  if (updatedAt.getTime() < createdAt.getTime()) {
    throw new RangeError('sessionType.updatedAt cannot be earlier than createdAt.');
  }

  return Object.freeze({
    ...details,
    createdAt,
    createdByUid: requireSingleSegmentId(sessionType.createdByUid, 'sessionType.createdByUid'),
    id: normalizeSessionTypeId(sessionType.id),
    status: normalizeSessionTypeStatus(sessionType.status),
    updatedAt,
    updatedByUid: requireSingleSegmentId(sessionType.updatedByUid, 'sessionType.updatedByUid'),
  });
}

export function compareSessionTypes(left, right) {
  const orderDifference = left.displayOrder - right.displayOrder;
  if (orderDifference !== 0) return orderDifference;

  const nameDifference = left.name.localeCompare(right.name, 'id', { sensitivity: 'base' });
  if (nameDifference !== 0) return nameDifference;

  return left.id.localeCompare(right.id);
}
