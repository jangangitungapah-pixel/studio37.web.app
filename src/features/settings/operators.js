import { toJavaScriptDate } from '../../lib/datetime/timestamps.js';
import { normalizeIndonesianPhone } from '../../lib/validation/indonesianPhone.js';

export const OPERATORS_COLLECTION_NAME = 'operators';
export const OPERATOR_LIST_LIMIT = 100;

export const OPERATOR_STATUSES = Object.freeze({
  ACTIVE: 'active',
  DISABLED: 'disabled',
});

export const OPERATOR_TYPES = Object.freeze({
  RECORDING_ENGINEER: 'recording_engineer',
  STUDIO_OPERATOR: 'studio_operator',
});

export const DEFAULT_OPERATOR_FORM_VALUES = Object.freeze({
  displayName: '',
  email: '',
  phone: '',
  recordingEngineer: false,
  studioOperator: false,
});

const mutableFieldNames = Object.freeze(['displayName', 'email', 'operatorTypes', 'phone']);
const formFieldNames = Object.freeze([
  'displayName',
  'email',
  'phone',
  'recordingEngineer',
  'studioOperator',
]);
const persistedFieldNames = Object.freeze([
  'createdAt',
  'createdByUid',
  'displayName',
  'email',
  'id',
  'linkedUserUid',
  'operatorTypes',
  'phone',
  'status',
  'updatedAt',
  'updatedByUid',
]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const supportedStatuses = new Set(Object.values(OPERATOR_STATUSES));
const supportedTypes = new Set(Object.values(OPERATOR_TYPES));
const operatorTypeOrder = Object.freeze([
  OPERATOR_TYPES.STUDIO_OPERATOR,
  OPERATOR_TYPES.RECORDING_ENGINEER,
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

function requireTrimmedString(value, label, { maxLength }) {
  if (typeof value !== 'string') {
    throw new TypeError(`${label} must be a string.`);
  }

  const normalized = value.trim();

  if (!normalized) {
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

export function normalizeOperatorEmail(value) {
  if (value === null || value === undefined) return null;

  const email = requireTrimmedString(value, 'operator.email', { maxLength: 254 }).toLowerCase();

  if (!emailPattern.test(email)) {
    throw new TypeError('operator.email must be a valid email address.');
  }

  return email;
}

export function normalizeOperatorTypes(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > operatorTypeOrder.length) {
    throw new RangeError('operator.operatorTypes must contain one or two supported types.');
  }

  const uniqueTypes = new Set(value);
  if (uniqueTypes.size !== value.length) {
    throw new TypeError('operator.operatorTypes cannot contain duplicates.');
  }

  for (const type of value) {
    if (typeof type !== 'string' || !supportedTypes.has(type)) {
      throw new RangeError('operator.operatorTypes contains an unsupported type.');
    }
  }

  return Object.freeze(operatorTypeOrder.filter((type) => uniqueTypes.has(type)));
}

export function normalizeOperatorDetails(value) {
  const operator = requireRecord(value, 'operator');
  requireExactFields(operator, mutableFieldNames, 'operator');

  return Object.freeze({
    displayName: requireTrimmedString(operator.displayName, 'operator.displayName', {
      maxLength: 100,
    }),
    email: normalizeOperatorEmail(operator.email),
    operatorTypes: normalizeOperatorTypes(operator.operatorTypes),
    phone: normalizeIndonesianPhone(operator.phone, {
      allowNull: true,
      label: 'operator.phone',
    }),
  });
}

export function normalizeOperatorStatus(value) {
  if (typeof value !== 'string' || !supportedStatuses.has(value)) {
    throw new RangeError('operator.status is not supported.');
  }

  return value;
}

export function normalizeOperatorActorUid(value) {
  return requireSingleSegmentId(value, 'actorUid');
}

export function normalizeOperatorId(value) {
  return requireSingleSegmentId(value, 'operatorId');
}

export function normalizeLinkedUserUid(value) {
  if (value === null || value === undefined) return null;
  return requireSingleSegmentId(value, 'operator.linkedUserUid');
}

export function decodeOperatorDocument(value) {
  const operator = requireRecord(value, 'operator document');
  requireExactFields(operator, persistedFieldNames, 'operator document');

  const details = normalizeOperatorDetails({
    displayName: operator.displayName,
    email: operator.email,
    operatorTypes: operator.operatorTypes,
    phone: operator.phone,
  });
  const createdAt = toJavaScriptDate(operator.createdAt, { label: 'operator.createdAt' });
  const updatedAt = toJavaScriptDate(operator.updatedAt, { label: 'operator.updatedAt' });

  if (updatedAt.getTime() < createdAt.getTime()) {
    throw new RangeError('operator.updatedAt cannot be earlier than createdAt.');
  }

  return Object.freeze({
    ...details,
    createdAt,
    createdByUid: requireSingleSegmentId(operator.createdByUid, 'operator.createdByUid'),
    id: normalizeOperatorId(operator.id),
    linkedUserUid: normalizeLinkedUserUid(operator.linkedUserUid),
    status: normalizeOperatorStatus(operator.status),
    updatedAt,
    updatedByUid: requireSingleSegmentId(operator.updatedByUid, 'operator.updatedByUid'),
  });
}

export function compareOperators(left, right) {
  const nameDifference = left.displayName.localeCompare(right.displayName, 'id', {
    sensitivity: 'base',
  });
  if (nameDifference !== 0) return nameDifference;

  return left.id.localeCompare(right.id);
}

export function toOperatorFormValues(operator = null) {
  if (!operator) return { ...DEFAULT_OPERATOR_FORM_VALUES };

  const details = normalizeOperatorDetails({
    displayName: operator.displayName,
    email: operator.email,
    operatorTypes: operator.operatorTypes,
    phone: operator.phone,
  });

  return {
    displayName: details.displayName,
    email: details.email ?? '',
    phone: details.phone ?? '',
    recordingEngineer: details.operatorTypes.includes(OPERATOR_TYPES.RECORDING_ENGINEER),
    studioOperator: details.operatorTypes.includes(OPERATOR_TYPES.STUDIO_OPERATOR),
  };
}

export function validateOperatorForm(value) {
  const form = requireRecord(value, 'operator form');
  requireExactFields(form, formFieldNames, 'operator form');

  const errors = {};
  let displayName;
  let email;
  let operatorTypes;
  let phone;

  try {
    displayName = requireTrimmedString(form.displayName, 'operator.displayName', {
      maxLength: 100,
    });
  } catch (error) {
    errors.displayName = error.message;
  }

  try {
    if (typeof form.email !== 'string') {
      throw new TypeError('operator.email must be a string.');
    }
    email = normalizeOperatorEmail(form.email.trim() || null);
  } catch (error) {
    errors.email = error.message;
  }

  try {
    if (typeof form.phone !== 'string') {
      throw new TypeError('operator.phone must be a string.');
    }
    phone = normalizeIndonesianPhone(form.phone.trim() || null, {
      allowNull: true,
      label: 'operator.phone',
    });
  } catch (error) {
    errors.phone = error.message;
  }

  try {
    if (typeof form.studioOperator !== 'boolean' || typeof form.recordingEngineer !== 'boolean') {
      throw new TypeError('operator type selections must be boolean values.');
    }

    operatorTypes = normalizeOperatorTypes([
      ...(form.studioOperator ? [OPERATOR_TYPES.STUDIO_OPERATOR] : []),
      ...(form.recordingEngineer ? [OPERATOR_TYPES.RECORDING_ENGINEER] : []),
    ]);
  } catch (error) {
    errors.operatorTypes = error.message;
  }

  const hasErrors = Object.keys(errors).length > 0;

  return Object.freeze({
    errors: Object.freeze(errors),
    value: hasErrors
      ? null
      : normalizeOperatorDetails({ displayName, email, operatorTypes, phone }),
  });
}
