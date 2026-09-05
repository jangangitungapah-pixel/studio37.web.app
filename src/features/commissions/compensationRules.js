import { toFirestoreTimestamp, toJavaScriptDate } from '../../lib/datetime/timestamps.js';
import { requireIntegerIdr } from '../../lib/money/idr.js';
import { OPERATOR_TYPES } from '../settings/operators.js';

export const COMPENSATION_RULES_COLLECTION_NAME = 'compensationRules';
export const COMPENSATION_RULE_LIST_LIMIT = 200;
export const COMPENSATION_RULE_DURATION_STEP_MINUTES = 15;
export const COMPENSATION_RULE_MAX_DURATION_MINUTES = 24 * 60;

export const COMPENSATION_RULE_MODELS = Object.freeze({
  FIXED: 'fixed',
  PACKAGE: 'package',
  PERCENTAGE: 'percentage',
  PER_HOUR: 'per_hour',
  PER_SESSION: 'per_session',
});

export const COMPENSATION_PERCENTAGE_BASES = Object.freeze({
  BOOKING_SUBTOTAL_BEFORE_DISCOUNT: 'booking_subtotal_before_discount',
  BOOKING_TOTAL_AFTER_DISCOUNT: 'booking_total_after_discount',
  SERVICE_AMOUNT: 'service_amount',
});

export const COMPENSATION_RULE_STATUSES = Object.freeze({
  ACTIVE: 'active',
  DISABLED: 'disabled',
});

const mutableFieldNames = Object.freeze([
  'compensationModel',
  'configuration',
  'effectiveFrom',
  'effectiveUntil',
  'name',
  'operatorId',
  'operatorType',
  'priority',
  'sessionTypeId',
  'studioId',
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
const supportedModels = new Set(Object.values(COMPENSATION_RULE_MODELS));
const supportedOperatorTypes = new Set(Object.values(OPERATOR_TYPES));
const supportedPercentageBases = new Set(Object.values(COMPENSATION_PERCENTAGE_BASES));
const supportedStatuses = new Set(Object.values(COMPENSATION_RULE_STATUSES));

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

function normalizeOptionalReference(value, label) {
  return value === null ? null : requireSingleSegmentId(value, label);
}

function normalizeCompensationModel(value) {
  if (typeof value !== 'string' || !supportedModels.has(value)) {
    throw new RangeError('compensationRule.compensationModel is not supported.');
  }
  return value;
}

function normalizeOperatorType(value) {
  if (typeof value !== 'string' || !supportedOperatorTypes.has(value)) {
    throw new RangeError('compensationRule.operatorType is not supported.');
  }
  return value;
}

function normalizeAmount(value, label) {
  return requireIntegerIdr(value, { label });
}

function normalizeDuration(value, label) {
  if (
    !Number.isInteger(value) ||
    value < COMPENSATION_RULE_DURATION_STEP_MINUTES ||
    value > COMPENSATION_RULE_MAX_DURATION_MINUTES ||
    value % COMPENSATION_RULE_DURATION_STEP_MINUTES !== 0
  ) {
    throw new RangeError(
      `${label} must be a ${COMPENSATION_RULE_DURATION_STEP_MINUTES}-minute increment between ${COMPENSATION_RULE_DURATION_STEP_MINUTES} and ${COMPENSATION_RULE_MAX_DURATION_MINUTES}.`,
    );
  }
  return value;
}

function normalizePriority(value) {
  if (!Number.isInteger(value) || value < 1 || value > 999) {
    throw new RangeError('compensationRule.priority must be an integer between 1 and 999.');
  }
  return value;
}

function normalizeEffectiveTimestamp(value, label) {
  if (value === null) return null;
  if (value === undefined) throw new TypeError(`${label} must be null or a timestamp.`);
  return toJavaScriptDate(value, { label });
}

function normalizeAmountConfiguration(value, label) {
  const configuration = requireRecord(value, label);
  requireExactFields(configuration, ['amountIdr'], label);
  return Object.freeze({
    amountIdr: normalizeAmount(configuration.amountIdr, `${label}.amountIdr`),
  });
}

function normalizePerHourConfiguration(value) {
  const label = 'compensationRule.configuration';
  const configuration = requireRecord(value, label);
  requireExactFields(configuration, ['amountPerHourIdr'], label);
  return Object.freeze({
    amountPerHourIdr: normalizeAmount(
      configuration.amountPerHourIdr,
      'compensationRule.configuration.amountPerHourIdr',
    ),
  });
}

function normalizePackageConfiguration(value) {
  const label = 'compensationRule.configuration';
  const configuration = requireRecord(value, label);
  requireExactFields(configuration, ['amountIdr', 'durationMinutes'], label);
  return Object.freeze({
    amountIdr: normalizeAmount(configuration.amountIdr, `${label}.amountIdr`),
    durationMinutes: normalizeDuration(
      configuration.durationMinutes,
      `${label}.durationMinutes`,
    ),
  });
}

function normalizePercentageConfiguration(value) {
  const label = 'compensationRule.configuration';
  const configuration = requireRecord(value, label);
  requireExactFields(configuration, ['base', 'basisPoints'], label);

  if (
    typeof configuration.base !== 'string' ||
    !supportedPercentageBases.has(configuration.base)
  ) {
    throw new RangeError('compensationRule.configuration.base is not supported.');
  }
  if (
    !Number.isInteger(configuration.basisPoints) ||
    configuration.basisPoints < 0 ||
    configuration.basisPoints > 10000
  ) {
    throw new RangeError('compensationRule.configuration.basisPoints must be between 0 and 10000.');
  }

  return Object.freeze({
    base: configuration.base,
    basisPoints: configuration.basisPoints,
  });
}

function normalizeConfiguration(compensationModel, value) {
  switch (compensationModel) {
    case COMPENSATION_RULE_MODELS.PER_HOUR:
      return normalizePerHourConfiguration(value);
    case COMPENSATION_RULE_MODELS.PER_SESSION:
      return normalizeAmountConfiguration(value, 'compensationRule.configuration');
    case COMPENSATION_RULE_MODELS.FIXED:
      return normalizeAmountConfiguration(value, 'compensationRule.configuration');
    case COMPENSATION_RULE_MODELS.PACKAGE:
      return normalizePackageConfiguration(value);
    case COMPENSATION_RULE_MODELS.PERCENTAGE:
      return normalizePercentageConfiguration(value);
    default:
      throw new RangeError('compensationRule.compensationModel is not supported.');
  }
}

export function normalizeCompensationRuleDetails(value) {
  const compensationRule = requireRecord(value, 'compensationRule');
  requireExactFields(compensationRule, mutableFieldNames, 'compensationRule');

  const compensationModel = normalizeCompensationModel(compensationRule.compensationModel);
  const effectiveFrom = normalizeEffectiveTimestamp(
    compensationRule.effectiveFrom,
    'compensationRule.effectiveFrom',
  );
  const effectiveUntil = normalizeEffectiveTimestamp(
    compensationRule.effectiveUntil,
    'compensationRule.effectiveUntil',
  );

  if (
    effectiveFrom !== null &&
    effectiveUntil !== null &&
    effectiveUntil.getTime() <= effectiveFrom.getTime()
  ) {
    throw new RangeError('compensationRule.effectiveUntil must be later than effectiveFrom.');
  }

  return Object.freeze({
    compensationModel,
    configuration: normalizeConfiguration(compensationModel, compensationRule.configuration),
    effectiveFrom,
    effectiveUntil,
    name: requireTrimmedString(compensationRule.name, 'compensationRule.name', {
      maxLength: 100,
    }),
    operatorId: normalizeOptionalReference(
      compensationRule.operatorId,
      'compensationRule.operatorId',
    ),
    operatorType: normalizeOperatorType(compensationRule.operatorType),
    priority: normalizePriority(compensationRule.priority),
    sessionTypeId: normalizeOptionalReference(
      compensationRule.sessionTypeId,
      'compensationRule.sessionTypeId',
    ),
    studioId: normalizeOptionalReference(compensationRule.studioId, 'compensationRule.studioId'),
  });
}

export function encodeCompensationRuleDetails(value) {
  const compensationRule = normalizeCompensationRuleDetails(value);
  return Object.freeze({
    ...compensationRule,
    effectiveFrom: toFirestoreTimestamp(compensationRule.effectiveFrom, {
      allowNull: true,
      label: 'compensationRule.effectiveFrom',
    }),
    effectiveUntil: toFirestoreTimestamp(compensationRule.effectiveUntil, {
      allowNull: true,
      label: 'compensationRule.effectiveUntil',
    }),
  });
}

export function normalizeCompensationRuleStatus(value) {
  if (typeof value !== 'string' || !supportedStatuses.has(value)) {
    throw new RangeError('compensationRule.status is not supported.');
  }
  return value;
}

export function normalizeCompensationRuleActorUid(value) {
  return requireSingleSegmentId(value, 'actorUid');
}

export function normalizeCompensationRuleId(value) {
  return requireSingleSegmentId(value, 'compensationRuleId');
}

export function decodeCompensationRuleDocument(value) {
  const compensationRule = requireRecord(value, 'compensationRule document');
  requireExactFields(compensationRule, persistedFieldNames, 'compensationRule document');

  const details = normalizeCompensationRuleDetails({
    compensationModel: compensationRule.compensationModel,
    configuration: compensationRule.configuration,
    effectiveFrom: compensationRule.effectiveFrom,
    effectiveUntil: compensationRule.effectiveUntil,
    name: compensationRule.name,
    operatorId: compensationRule.operatorId,
    operatorType: compensationRule.operatorType,
    priority: compensationRule.priority,
    sessionTypeId: compensationRule.sessionTypeId,
    studioId: compensationRule.studioId,
  });
  const createdAt = toJavaScriptDate(compensationRule.createdAt, {
    label: 'compensationRule.createdAt',
  });
  const updatedAt = toJavaScriptDate(compensationRule.updatedAt, {
    label: 'compensationRule.updatedAt',
  });

  if (updatedAt.getTime() < createdAt.getTime()) {
    throw new RangeError('compensationRule.updatedAt cannot be earlier than createdAt.');
  }

  return Object.freeze({
    ...details,
    createdAt,
    createdByUid: requireSingleSegmentId(
      compensationRule.createdByUid,
      'compensationRule.createdByUid',
    ),
    id: normalizeCompensationRuleId(compensationRule.id),
    status: normalizeCompensationRuleStatus(compensationRule.status),
    updatedAt,
    updatedByUid: requireSingleSegmentId(
      compensationRule.updatedByUid,
      'compensationRule.updatedByUid',
    ),
  });
}

export function compareCompensationRules(left, right) {
  const priorityDifference = right.priority - left.priority;
  if (priorityDifference !== 0) return priorityDifference;

  const nameDifference = left.name.localeCompare(right.name, 'id', { sensitivity: 'base' });
  if (nameDifference !== 0) return nameDifference;

  return left.id.localeCompare(right.id);
}
