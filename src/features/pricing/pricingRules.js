import { toFirestoreTimestamp, toJavaScriptDate } from '../../lib/datetime/timestamps.js';
import { requireIntegerIdr } from '../../lib/money/idr.js';

export const PRICING_RULES_COLLECTION_NAME = 'pricingRules';
export const PRICING_RULE_LIST_LIMIT = 200;
export const PRICING_RULE_DURATION_STEP_MINUTES = 15;
export const PRICING_RULE_MAX_DURATION_MINUTES = 24 * 60;

export const PRICING_RULE_MODELS = Object.freeze({
  BASE_PLUS_ADDITIONAL: 'base_plus_additional',
  DURATION_PACKAGE: 'duration_package',
  FIXED_SESSION: 'fixed_session',
  HOURLY: 'hourly',
});

export const PRICING_RULE_ROUNDING_MODES = Object.freeze({
  EXACT: 'exact',
  ROUND_UP: 'round_up',
});

export const PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES = Object.freeze({
  ADDITIONAL: 'additional',
  ANOTHER_PACKAGE: 'another_package',
  BLOCKED: 'blocked',
});

export const PRICING_RULE_STATUSES = Object.freeze({
  ACTIVE: 'active',
  DISABLED: 'disabled',
});

const mutableFieldNames = Object.freeze([
  'configuration',
  'effectiveFrom',
  'effectiveUntil',
  'name',
  'pricingModel',
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
const supportedModels = new Set(Object.values(PRICING_RULE_MODELS));
const supportedRoundingModes = new Set(Object.values(PRICING_RULE_ROUNDING_MODES));
const supportedPackageExtraTimePolicies = new Set(
  Object.values(PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES),
);
const supportedStatuses = new Set(Object.values(PRICING_RULE_STATUSES));

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

function normalizeNullableStudioId(value) {
  return value === null ? null : requireSingleSegmentId(value, 'pricingRule.studioId');
}

function normalizePricingModel(value) {
  if (typeof value !== 'string' || !supportedModels.has(value)) {
    throw new RangeError('pricingRule.pricingModel is not supported.');
  }

  return value;
}

function normalizeRoundingMode(value, label) {
  if (typeof value !== 'string' || !supportedRoundingModes.has(value)) {
    throw new RangeError(`${label} is not supported.`);
  }

  return value;
}

function normalizeDuration(value, label) {
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

function normalizeAmount(value, label) {
  return requireIntegerIdr(value, { label });
}

export function normalizeHourlyPricingConfiguration(value) {
  const configuration = requireRecord(value, 'pricingRule.configuration');
  requireExactFields(
    configuration,
    ['amountPerIncrementIdr', 'incrementMinutes', 'minimumDurationMinutes', 'roundingMode'],
    'pricingRule.configuration',
  );

  return Object.freeze({
    amountPerIncrementIdr: normalizeAmount(
      configuration.amountPerIncrementIdr,
      'pricingRule.configuration.amountPerIncrementIdr',
    ),
    incrementMinutes: normalizeDuration(
      configuration.incrementMinutes,
      'pricingRule.configuration.incrementMinutes',
    ),
    minimumDurationMinutes: normalizeDuration(
      configuration.minimumDurationMinutes,
      'pricingRule.configuration.minimumDurationMinutes',
    ),
    roundingMode: normalizeRoundingMode(
      configuration.roundingMode,
      'pricingRule.configuration.roundingMode',
    ),
  });
}

function normalizeFixedSessionConfiguration(value) {
  const configuration = requireRecord(value, 'pricingRule.configuration');
  requireExactFields(configuration, ['amountIdr'], 'pricingRule.configuration');

  return Object.freeze({
    amountIdr: normalizeAmount(configuration.amountIdr, 'pricingRule.configuration.amountIdr'),
  });
}

function normalizeDurationPackageConfiguration(value) {
  const configuration = requireRecord(value, 'pricingRule.configuration');
  requireExactFields(
    configuration,
    [
      'additionalAmountPerIncrementIdr',
      'additionalIncrementMinutes',
      'amountIdr',
      'durationMinutes',
      'extraTimePolicy',
      'roundingMode',
    ],
    'pricingRule.configuration',
  );

  if (!supportedPackageExtraTimePolicies.has(configuration.extraTimePolicy)) {
    throw new RangeError('pricingRule.configuration.extraTimePolicy is not supported.');
  }

  const supportsAdditionalTime =
    configuration.extraTimePolicy === PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.ADDITIONAL;

  const hasEveryAdditionalTimeField =
    configuration.additionalAmountPerIncrementIdr !== null &&
    configuration.additionalIncrementMinutes !== null &&
    configuration.roundingMode !== null;
  const hasOnlyNullAdditionalTimeFields =
    configuration.additionalAmountPerIncrementIdr === null &&
    configuration.additionalIncrementMinutes === null &&
    configuration.roundingMode === null;

  if (
    (supportsAdditionalTime && !hasEveryAdditionalTimeField) ||
    (!supportsAdditionalTime && !hasOnlyNullAdditionalTimeFields)
  ) {
    throw new TypeError(
      'A duration-package additional policy must configure all additional-time fields; other policies must keep them null.',
    );
  }

  return Object.freeze({
    additionalAmountPerIncrementIdr: supportsAdditionalTime
      ? normalizeAmount(
          configuration.additionalAmountPerIncrementIdr,
          'pricingRule.configuration.additionalAmountPerIncrementIdr',
        )
      : null,
    additionalIncrementMinutes: supportsAdditionalTime
      ? normalizeDuration(
          configuration.additionalIncrementMinutes,
          'pricingRule.configuration.additionalIncrementMinutes',
        )
      : null,
    amountIdr: normalizeAmount(configuration.amountIdr, 'pricingRule.configuration.amountIdr'),
    durationMinutes: normalizeDuration(
      configuration.durationMinutes,
      'pricingRule.configuration.durationMinutes',
    ),
    extraTimePolicy: configuration.extraTimePolicy,
    roundingMode: supportsAdditionalTime
      ? normalizeRoundingMode(configuration.roundingMode, 'pricingRule.configuration.roundingMode')
      : null,
  });
}

function normalizeBasePlusAdditionalConfiguration(value) {
  const configuration = requireRecord(value, 'pricingRule.configuration');
  requireExactFields(
    configuration,
    [
      'additionalAmountPerIncrementIdr',
      'additionalIncrementMinutes',
      'baseAmountIdr',
      'baseDurationMinutes',
      'roundingMode',
    ],
    'pricingRule.configuration',
  );

  return Object.freeze({
    additionalAmountPerIncrementIdr: normalizeAmount(
      configuration.additionalAmountPerIncrementIdr,
      'pricingRule.configuration.additionalAmountPerIncrementIdr',
    ),
    additionalIncrementMinutes: normalizeDuration(
      configuration.additionalIncrementMinutes,
      'pricingRule.configuration.additionalIncrementMinutes',
    ),
    baseAmountIdr: normalizeAmount(
      configuration.baseAmountIdr,
      'pricingRule.configuration.baseAmountIdr',
    ),
    baseDurationMinutes: normalizeDuration(
      configuration.baseDurationMinutes,
      'pricingRule.configuration.baseDurationMinutes',
    ),
    roundingMode: normalizeRoundingMode(
      configuration.roundingMode,
      'pricingRule.configuration.roundingMode',
    ),
  });
}

function normalizeConfiguration(pricingModel, value) {
  switch (pricingModel) {
    case PRICING_RULE_MODELS.HOURLY:
      return normalizeHourlyPricingConfiguration(value);
    case PRICING_RULE_MODELS.FIXED_SESSION:
      return normalizeFixedSessionConfiguration(value);
    case PRICING_RULE_MODELS.DURATION_PACKAGE:
      return normalizeDurationPackageConfiguration(value);
    case PRICING_RULE_MODELS.BASE_PLUS_ADDITIONAL:
      return normalizeBasePlusAdditionalConfiguration(value);
    default:
      throw new RangeError('pricingRule.pricingModel is not supported.');
  }
}

function normalizePriority(value) {
  if (!Number.isInteger(value) || value < 1 || value > 999) {
    throw new RangeError('pricingRule.priority must be an integer between 1 and 999.');
  }

  return value;
}

function normalizeEffectiveTimestamp(value, label) {
  if (value === null) return null;
  if (value === undefined) throw new TypeError(`${label} must be null or a timestamp.`);

  return toJavaScriptDate(value, { label });
}

export function normalizePricingRuleDetails(value) {
  const pricingRule = requireRecord(value, 'pricingRule');
  requireExactFields(pricingRule, mutableFieldNames, 'pricingRule');

  const pricingModel = normalizePricingModel(pricingRule.pricingModel);
  const effectiveFrom = normalizeEffectiveTimestamp(
    pricingRule.effectiveFrom,
    'pricingRule.effectiveFrom',
  );
  const effectiveUntil = normalizeEffectiveTimestamp(
    pricingRule.effectiveUntil,
    'pricingRule.effectiveUntil',
  );

  if (
    effectiveFrom !== null &&
    effectiveUntil !== null &&
    effectiveUntil.getTime() <= effectiveFrom.getTime()
  ) {
    throw new RangeError('pricingRule.effectiveUntil must be later than effectiveFrom.');
  }

  return Object.freeze({
    configuration: normalizeConfiguration(pricingModel, pricingRule.configuration),
    effectiveFrom,
    effectiveUntil,
    name: requireTrimmedString(pricingRule.name, 'pricingRule.name', { maxLength: 100 }),
    pricingModel,
    priority: normalizePriority(pricingRule.priority),
    sessionTypeId: requireSingleSegmentId(pricingRule.sessionTypeId, 'pricingRule.sessionTypeId'),
    studioId: normalizeNullableStudioId(pricingRule.studioId),
  });
}

export function encodePricingRuleDetails(value) {
  const pricingRule = normalizePricingRuleDetails(value);

  return Object.freeze({
    ...pricingRule,
    effectiveFrom: toFirestoreTimestamp(pricingRule.effectiveFrom, {
      allowNull: true,
      label: 'pricingRule.effectiveFrom',
    }),
    effectiveUntil: toFirestoreTimestamp(pricingRule.effectiveUntil, {
      allowNull: true,
      label: 'pricingRule.effectiveUntil',
    }),
  });
}

export function normalizePricingRuleStatus(value) {
  if (typeof value !== 'string' || !supportedStatuses.has(value)) {
    throw new RangeError('pricingRule.status is not supported.');
  }

  return value;
}

export function normalizePricingRuleActorUid(value) {
  return requireSingleSegmentId(value, 'actorUid');
}

export function normalizePricingRuleId(value) {
  return requireSingleSegmentId(value, 'pricingRuleId');
}

export function decodePricingRuleDocument(value) {
  const pricingRule = requireRecord(value, 'pricingRule document');
  requireExactFields(pricingRule, persistedFieldNames, 'pricingRule document');

  const details = normalizePricingRuleDetails({
    configuration: pricingRule.configuration,
    effectiveFrom: pricingRule.effectiveFrom,
    effectiveUntil: pricingRule.effectiveUntil,
    name: pricingRule.name,
    pricingModel: pricingRule.pricingModel,
    priority: pricingRule.priority,
    sessionTypeId: pricingRule.sessionTypeId,
    studioId: pricingRule.studioId,
  });
  const createdAt = toJavaScriptDate(pricingRule.createdAt, { label: 'pricingRule.createdAt' });
  const updatedAt = toJavaScriptDate(pricingRule.updatedAt, { label: 'pricingRule.updatedAt' });

  if (updatedAt.getTime() < createdAt.getTime()) {
    throw new RangeError('pricingRule.updatedAt cannot be earlier than createdAt.');
  }

  return Object.freeze({
    ...details,
    createdAt,
    createdByUid: requireSingleSegmentId(pricingRule.createdByUid, 'pricingRule.createdByUid'),
    id: normalizePricingRuleId(pricingRule.id),
    status: normalizePricingRuleStatus(pricingRule.status),
    updatedAt,
    updatedByUid: requireSingleSegmentId(pricingRule.updatedByUid, 'pricingRule.updatedByUid'),
  });
}

export function comparePricingRules(left, right) {
  const priorityDifference = right.priority - left.priority;
  if (priorityDifference !== 0) return priorityDifference;

  const nameDifference = left.name.localeCompare(right.name, 'id', { sensitivity: 'base' });
  if (nameDifference !== 0) return nameDifference;

  return left.id.localeCompare(right.id);
}
