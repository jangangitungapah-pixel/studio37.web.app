import { multiplyIntegerIdr, requireIntegerIdr, sumIntegerIdr } from '../../lib/money/idr.js';
import {
  PRICING_RULE_DURATION_STEP_MINUTES,
  PRICING_RULE_MAX_DURATION_MINUTES,
  PRICING_RULE_MODELS,
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
  'baseAmountIdr',
  'baseDurationMinutes',
  'roundingMode',
]);
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
      'baseAdditionalPricing.durationMinutes must be a safe integer number of minutes.',
    );
  }

  if (value <= 0) {
    throw new RangeError('baseAdditionalPricing.durationMinutes must be greater than zero.');
  }

  return value;
}

function normalizeConfiguration(value) {
  const configuration = requireRecord(value, 'baseAdditionalPricing.configuration');
  requireExactFields(configuration, configurationFieldNames, 'baseAdditionalPricing.configuration');

  if (!supportedRoundingModes.has(configuration.roundingMode)) {
    throw new RangeError('baseAdditionalPricing.configuration.roundingMode is not supported.');
  }

  return Object.freeze({
    additionalAmountPerIncrementIdr: requireIntegerIdr(
      configuration.additionalAmountPerIncrementIdr,
      {
        label: 'baseAdditionalPricing.configuration.additionalAmountPerIncrementIdr',
      },
    ),
    additionalIncrementMinutes: normalizeConfiguredDuration(
      configuration.additionalIncrementMinutes,
      'baseAdditionalPricing.configuration.additionalIncrementMinutes',
    ),
    baseAmountIdr: requireIntegerIdr(configuration.baseAmountIdr, {
      label: 'baseAdditionalPricing.configuration.baseAmountIdr',
    }),
    baseDurationMinutes: normalizeConfiguredDuration(
      configuration.baseDurationMinutes,
      'baseAdditionalPricing.configuration.baseDurationMinutes',
    ),
    roundingMode: configuration.roundingMode,
  });
}

function resolveAdditionalTime(inputDurationMinutes, configuration) {
  const additionalDurationMinutes = Math.max(
    inputDurationMinutes - configuration.baseDurationMinutes,
    0,
  );

  if (additionalDurationMinutes === 0) {
    return Object.freeze({
      additionalAmountIdr: 0,
      additionalDurationMinutes: 0,
      billableDurationMinutes: configuration.baseDurationMinutes,
      billedAdditionalDurationMinutes: 0,
      billedAdditionalIncrementCount: 0,
    });
  }

  const hasPartialIncrement =
    additionalDurationMinutes % configuration.additionalIncrementMinutes !== 0;

  if (configuration.roundingMode === PRICING_RULE_ROUNDING_MODES.EXACT && hasPartialIncrement) {
    throw new RangeError(
      'baseAdditionalPricing additional time must align with the configured increment in exact mode.',
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
  const billableDurationMinutes =
    configuration.baseDurationMinutes + billedAdditionalDurationMinutes;

  if (
    !Number.isSafeInteger(billedAdditionalDurationMinutes) ||
    !Number.isSafeInteger(billableDurationMinutes)
  ) {
    throw new RangeError(
      'baseAdditionalPricing billable duration exceeds the safe integer minute range.',
    );
  }

  const additionalAmountIdr = multiplyIntegerIdr(
    configuration.additionalAmountPerIncrementIdr,
    billedAdditionalIncrementCount,
    {
      label: 'baseAdditionalPricing.additionalAmountPerIncrementIdr',
      multiplierLabel: 'baseAdditionalPricing.billedAdditionalIncrementCount',
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

export function calculateBaseAdditionalPrice(value) {
  const input = requireRecord(value, 'baseAdditionalPricing input');
  requireExactFields(input, calculationInputFieldNames, 'baseAdditionalPricing input');

  if (input.pricingModel !== PRICING_RULE_MODELS.BASE_PLUS_ADDITIONAL) {
    throw new RangeError('baseAdditionalPricing.pricingModel must be base_plus_additional.');
  }

  const configuration = normalizeConfiguration(input.configuration);
  const inputDurationMinutes = normalizeRequestedDuration(input.durationMinutes);
  const additionalTime = resolveAdditionalTime(inputDurationMinutes, configuration);
  const totalAmountIdr = sumIntegerIdr(
    [configuration.baseAmountIdr, additionalTime.additionalAmountIdr],
    { label: 'baseAdditionalPricing.amounts' },
  );

  return Object.freeze({
    additionalAmountIdr: additionalTime.additionalAmountIdr,
    additionalAmountPerIncrementIdr: configuration.additionalAmountPerIncrementIdr,
    additionalDurationMinutes: additionalTime.additionalDurationMinutes,
    additionalIncrementMinutes: configuration.additionalIncrementMinutes,
    baseAmountIdr: configuration.baseAmountIdr,
    baseDurationMinutes: configuration.baseDurationMinutes,
    billableDurationMinutes: additionalTime.billableDurationMinutes,
    billedAdditionalDurationMinutes: additionalTime.billedAdditionalDurationMinutes,
    billedAdditionalIncrementCount: additionalTime.billedAdditionalIncrementCount,
    inputDurationMinutes,
    pricingModel: PRICING_RULE_MODELS.BASE_PLUS_ADDITIONAL,
    roundingMode: configuration.roundingMode,
    totalAmountIdr,
  });
}
