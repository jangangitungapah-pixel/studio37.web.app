import { multiplyIntegerIdr, requireIntegerIdr, sumIntegerIdr } from '../../lib/money/idr.js';
import {
  PRICING_RULE_DURATION_STEP_MINUTES,
  PRICING_RULE_MAX_DURATION_MINUTES,
  PRICING_RULE_MODELS,
  PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES,
  PRICING_RULE_ROUNDING_MODES,
} from './pricingRules.js';

const calculationInputFieldNames = Object.freeze([
  'configuration',
  'durationMinutes',
  'pricingModel',
]);
const configurationFieldNames = Object.freeze([
  'additionalAmountPerIncrementIdr',
  'additionalIncrementMinutes',
  'amountIdr',
  'durationMinutes',
  'extraTimePolicy',
  'roundingMode',
]);
const supportedExtraTimePolicies = new Set(
  Object.values(PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES),
);
const supportedRoundingModes = new Set(Object.values(PRICING_RULE_ROUNDING_MODES));

function requireRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
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
    throw new TypeError(`${label} has an unsupported input shape.`);
  }
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

function normalizeRequestedDuration(value) {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(
      'durationPackagePricing.durationMinutes must be a safe integer number of minutes.',
    );
  }

  if (value <= 0) {
    throw new RangeError('durationPackagePricing.durationMinutes must be greater than zero.');
  }

  return value;
}

function normalizePackageConfiguration(value) {
  const configuration = requireRecord(value, 'durationPackagePricing.configuration');
  requireExactFields(
    configuration,
    configurationFieldNames,
    'durationPackagePricing.configuration',
  );

  if (!supportedExtraTimePolicies.has(configuration.extraTimePolicy)) {
    throw new RangeError(
      'durationPackagePricing.configuration.extraTimePolicy is not supported.',
    );
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

  if (supportsAdditionalTime && !supportedRoundingModes.has(configuration.roundingMode)) {
    throw new RangeError('durationPackagePricing.configuration.roundingMode is not supported.');
  }

  return Object.freeze({
    additionalAmountPerIncrementIdr: supportsAdditionalTime
      ? requireIntegerIdr(configuration.additionalAmountPerIncrementIdr, {
          label: 'durationPackagePricing.configuration.additionalAmountPerIncrementIdr',
        })
      : null,
    additionalIncrementMinutes: supportsAdditionalTime
      ? normalizeConfiguredDuration(
          configuration.additionalIncrementMinutes,
          'durationPackagePricing.configuration.additionalIncrementMinutes',
        )
      : null,
    amountIdr: requireIntegerIdr(configuration.amountIdr, {
      label: 'durationPackagePricing.configuration.amountIdr',
    }),
    durationMinutes: normalizeConfiguredDuration(
      configuration.durationMinutes,
      'durationPackagePricing.configuration.durationMinutes',
    ),
    extraTimePolicy: configuration.extraTimePolicy,
    roundingMode: supportsAdditionalTime ? configuration.roundingMode : null,
  });
}

function resolveAdditionalTime(inputDurationMinutes, configuration) {
  const additionalDurationMinutes = inputDurationMinutes - configuration.durationMinutes;

  if (additionalDurationMinutes === 0) {
    return Object.freeze({
      additionalAmountIdr: 0,
      additionalDurationMinutes: 0,
      billableDurationMinutes: configuration.durationMinutes,
      billedAdditionalDurationMinutes: 0,
      billedAdditionalIncrementCount: 0,
    });
  }

  if (configuration.extraTimePolicy === PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.BLOCKED) {
    throw new RangeError('durationPackagePricing extra time is blocked by the configured package.');
  }

  if (
    configuration.extraTimePolicy === PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.ANOTHER_PACKAGE
  ) {
    throw new RangeError(
      'durationPackagePricing extra time requires another package and cannot be priced by one package rule.',
    );
  }

  const hasPartialIncrement =
    additionalDurationMinutes % configuration.additionalIncrementMinutes !== 0;

  if (configuration.roundingMode === PRICING_RULE_ROUNDING_MODES.EXACT && hasPartialIncrement) {
    throw new RangeError(
      'durationPackagePricing extra time must align with the configured additional increment in exact mode.',
    );
  }

  const billedAdditionalIncrementCount =
    configuration.roundingMode === PRICING_RULE_ROUNDING_MODES.ROUND_UP
      ? (additionalDurationMinutes -
          (additionalDurationMinutes % configuration.additionalIncrementMinutes)) /
          configuration.additionalIncrementMinutes +
        (hasPartialIncrement ? 1 : 0)
      : additionalDurationMinutes / configuration.additionalIncrementMinutes;
  const billedAdditionalDurationMinutes =
    billedAdditionalIncrementCount * configuration.additionalIncrementMinutes;
  const billableDurationMinutes = configuration.durationMinutes + billedAdditionalDurationMinutes;

  if (
    !Number.isSafeInteger(billedAdditionalDurationMinutes) ||
    !Number.isSafeInteger(billableDurationMinutes)
  ) {
    throw new RangeError(
      'durationPackagePricing billable duration exceeds the safe integer minute range.',
    );
  }

  const additionalAmountIdr = multiplyIntegerIdr(
    configuration.additionalAmountPerIncrementIdr,
    billedAdditionalIncrementCount,
    {
      label: 'durationPackagePricing.additionalAmountPerIncrementIdr',
      multiplierLabel: 'durationPackagePricing.billedAdditionalIncrementCount',
    },
  );

  return Object.freeze({
    additionalAmountIdr,
    additionalDurationMinutes,
    billableDurationMinutes,
    billedAdditionalDurationMinutes,
    billedAdditionalIncrementCount,
  });
}

export function calculateDurationPackagePrice(value) {
  const input = requireRecord(value, 'durationPackagePricing input');
  requireExactFields(input, calculationInputFieldNames, 'durationPackagePricing input');

  if (input.pricingModel !== PRICING_RULE_MODELS.DURATION_PACKAGE) {
    throw new RangeError('durationPackagePricing.pricingModel must be duration_package.');
  }

  const configuration = normalizePackageConfiguration(input.configuration);
  const inputDurationMinutes = normalizeRequestedDuration(input.durationMinutes);

  if (inputDurationMinutes < configuration.durationMinutes) {
    throw new RangeError(
      'durationPackagePricing.durationMinutes must meet the configured package duration.',
    );
  }

  const additionalTime = resolveAdditionalTime(inputDurationMinutes, configuration);
  const totalAmountIdr = sumIntegerIdr(
    [configuration.amountIdr, additionalTime.additionalAmountIdr],
    { label: 'durationPackagePricing.amounts' },
  );

  return Object.freeze({
    additionalAmountIdr: additionalTime.additionalAmountIdr,
    additionalAmountPerIncrementIdr: configuration.additionalAmountPerIncrementIdr,
    additionalDurationMinutes: additionalTime.additionalDurationMinutes,
    additionalIncrementMinutes: configuration.additionalIncrementMinutes,
    billableDurationMinutes: additionalTime.billableDurationMinutes,
    billedAdditionalDurationMinutes: additionalTime.billedAdditionalDurationMinutes,
    billedAdditionalIncrementCount: additionalTime.billedAdditionalIncrementCount,
    extraTimePolicy: configuration.extraTimePolicy,
    inputDurationMinutes,
    packageAmountIdr: configuration.amountIdr,
    packageDurationMinutes: configuration.durationMinutes,
    pricingModel: PRICING_RULE_MODELS.DURATION_PACKAGE,
    roundingMode: configuration.roundingMode,
    totalAmountIdr,
  });
}
