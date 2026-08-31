import { toJavaScriptDate } from '../../lib/datetime/timestamps.js';
import { requireIntegerIdr } from '../../lib/money/idr.js';
import { ADD_ON_PRICING_TYPES } from './addOnPricing.js';
import {
  PRICING_RULE_DURATION_STEP_MINUTES,
  PRICING_RULE_MAX_DURATION_MINUTES,
  PRICING_RULE_ROUNDING_MODES,
} from './pricingRules.js';

export const ADD_ONS_COLLECTION_NAME = 'addOns';
export const ADD_ON_LIST_LIMIT = 100;

export const ADD_ON_STATUSES = Object.freeze({
  ACTIVE: 'active',
  DISABLED: 'disabled',
});

const mutableFieldNames = Object.freeze([
  'configuration',
  'description',
  'displayOrder',
  'name',
  'pricingType',
  'sessionTypeId',
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
const supportedPricingTypes = new Set(Object.values(ADD_ON_PRICING_TYPES));
const supportedRoundingModes = new Set(Object.values(PRICING_RULE_ROUNDING_MODES));
const supportedStatuses = new Set(Object.values(ADD_ON_STATUSES));

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireRecord(value, label) {
  if (!isRecord(value)) throw new TypeError(`${label} must be an object.`);
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
  if (typeof value !== 'string') throw new TypeError(`${label} must be a string.`);
  const normalized = value.trim();

  if (!allowEmpty && !normalized) throw new TypeError(`${label} must be a non-empty string.`);
  if (normalized.length > maxLength) {
    throw new RangeError(`${label} must be at most ${maxLength} characters.`);
  }

  return normalized;
}

function requireSingleSegmentId(value, label) {
  const id = requireTrimmedString(value, label, { maxLength: 128 });
  if (id.includes('/')) throw new TypeError(`${label} must be a Firestore document id.`);
  return id;
}

function normalizeNullableSessionTypeId(value) {
  return value === null ? null : requireSingleSegmentId(value, 'addOn.sessionTypeId');
}

function normalizeDisplayOrder(value) {
  if (!Number.isInteger(value) || value < 1 || value > 999) {
    throw new RangeError('addOn.displayOrder must be an integer between 1 and 999.');
  }
  return value;
}

function normalizePricingType(value) {
  if (typeof value !== 'string' || !supportedPricingTypes.has(value)) {
    throw new RangeError('addOn.pricingType is not supported.');
  }
  return value;
}

function normalizeConfiguredDuration(value, label) {
  if (
    !Number.isInteger(value) ||
    value < PRICING_RULE_DURATION_STEP_MINUTES ||
    value > PRICING_RULE_MAX_DURATION_MINUTES ||
    value % PRICING_RULE_DURATION_STEP_MINUTES !== 0
  ) {
    throw new RangeError(
      `${label} must be a ${PRICING_RULE_DURATION_STEP_MINUTES}-minute increment between ${PRICING_RULE_DURATION_STEP_MINUTES} and ${PRICING_RULE_MAX_DURATION_MINUTES}.`,
    );
  }
  return value;
}

function normalizeRoundingMode(value) {
  if (typeof value !== 'string' || !supportedRoundingModes.has(value)) {
    throw new RangeError('addOn.configuration.roundingMode is not supported.');
  }
  return value;
}

function normalizeFixedConfiguration(value) {
  const configuration = requireRecord(value, 'addOn.configuration');
  requireExactFields(configuration, ['amountIdr'], 'addOn.configuration');
  return Object.freeze({
    amountIdr: requireIntegerIdr(configuration.amountIdr, {
      label: 'addOn.configuration.amountIdr',
    }),
  });
}

function normalizeQuantityConfiguration(value) {
  const configuration = requireRecord(value, 'addOn.configuration');
  requireExactFields(configuration, ['amountPerUnitIdr'], 'addOn.configuration');
  return Object.freeze({
    amountPerUnitIdr: requireIntegerIdr(configuration.amountPerUnitIdr, {
      label: 'addOn.configuration.amountPerUnitIdr',
    }),
  });
}

function normalizeTimeConfiguration(value) {
  const configuration = requireRecord(value, 'addOn.configuration');
  requireExactFields(
    configuration,
    ['amountPerIncrementIdr', 'incrementMinutes', 'roundingMode'],
    'addOn.configuration',
  );
  return Object.freeze({
    amountPerIncrementIdr: requireIntegerIdr(configuration.amountPerIncrementIdr, {
      label: 'addOn.configuration.amountPerIncrementIdr',
    }),
    incrementMinutes: normalizeConfiguredDuration(
      configuration.incrementMinutes,
      'addOn.configuration.incrementMinutes',
    ),
    roundingMode: normalizeRoundingMode(configuration.roundingMode),
  });
}

function normalizeConfiguration(pricingType, value) {
  if (pricingType === ADD_ON_PRICING_TYPES.FIXED) return normalizeFixedConfiguration(value);
  if (pricingType === ADD_ON_PRICING_TYPES.QUANTITY) return normalizeQuantityConfiguration(value);
  return normalizeTimeConfiguration(value);
}

export function normalizeAddOnDetails(value) {
  const addOn = requireRecord(value, 'addOn');
  requireExactFields(addOn, mutableFieldNames, 'addOn');
  const pricingType = normalizePricingType(addOn.pricingType);

  return Object.freeze({
    configuration: normalizeConfiguration(pricingType, addOn.configuration),
    description: requireTrimmedString(addOn.description, 'addOn.description', {
      allowEmpty: true,
      maxLength: 240,
    }),
    displayOrder: normalizeDisplayOrder(addOn.displayOrder),
    name: requireTrimmedString(addOn.name, 'addOn.name', { maxLength: 100 }),
    pricingType,
    sessionTypeId: normalizeNullableSessionTypeId(addOn.sessionTypeId),
  });
}

export function normalizeAddOnStatus(value) {
  if (typeof value !== 'string' || !supportedStatuses.has(value)) {
    throw new RangeError('addOn.status is not supported.');
  }
  return value;
}

export function normalizeAddOnActorUid(value) {
  return requireSingleSegmentId(value, 'actorUid');
}

export function normalizeAddOnId(value) {
  return requireSingleSegmentId(value, 'addOnId');
}

export function decodeAddOnDocument(value) {
  const addOn = requireRecord(value, 'addOn document');
  requireExactFields(addOn, persistedFieldNames, 'addOn document');
  const details = normalizeAddOnDetails({
    configuration: addOn.configuration,
    description: addOn.description,
    displayOrder: addOn.displayOrder,
    name: addOn.name,
    pricingType: addOn.pricingType,
    sessionTypeId: addOn.sessionTypeId,
  });
  const createdAt = toJavaScriptDate(addOn.createdAt, { label: 'addOn.createdAt' });
  const updatedAt = toJavaScriptDate(addOn.updatedAt, { label: 'addOn.updatedAt' });

  if (updatedAt.getTime() < createdAt.getTime()) {
    throw new RangeError('addOn.updatedAt cannot be earlier than createdAt.');
  }

  return Object.freeze({
    ...details,
    createdAt,
    createdByUid: requireSingleSegmentId(addOn.createdByUid, 'addOn.createdByUid'),
    id: normalizeAddOnId(addOn.id),
    status: normalizeAddOnStatus(addOn.status),
    updatedAt,
    updatedByUid: requireSingleSegmentId(addOn.updatedByUid, 'addOn.updatedByUid'),
  });
}

export function compareAddOns(left, right) {
  const orderDifference = left.displayOrder - right.displayOrder;
  if (orderDifference !== 0) return orderDifference;

  const nameDifference = left.name.localeCompare(right.name, 'id', { sensitivity: 'base' });
  if (nameDifference !== 0) return nameDifference;
  return left.id.localeCompare(right.id);
}
