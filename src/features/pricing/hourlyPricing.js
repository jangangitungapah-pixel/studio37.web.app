import { multiplyIntegerIdr } from '../../lib/money/idr.js';
import {
  normalizeHourlyPricingConfiguration,
  PRICING_RULE_MODELS,
  PRICING_RULE_ROUNDING_MODES,
} from './pricingRules.js';

const calculationInputFieldNames = Object.freeze([
  'configuration',
  'durationMinutes',
  'pricingModel',
]);

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

function normalizeDurationMinutes(value) {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError('hourlyPricing.durationMinutes must be a safe integer number of minutes.');
  }

  if (value <= 0) {
    throw new RangeError('hourlyPricing.durationMinutes must be greater than zero.');
  }

  return value;
}

function resolveBillableDuration(durationMinutes, configuration) {
  const { incrementMinutes, roundingMode } = configuration;
  const hasPartialIncrement = durationMinutes % incrementMinutes !== 0;

  if (roundingMode === PRICING_RULE_ROUNDING_MODES.EXACT && hasPartialIncrement) {
    throw new RangeError(
      'hourlyPricing.durationMinutes must align with the configured increment in exact mode.',
    );
  }

  const billedIncrementCount =
    roundingMode === PRICING_RULE_ROUNDING_MODES.ROUND_UP
      ? (durationMinutes - (durationMinutes % incrementMinutes)) / incrementMinutes +
        (hasPartialIncrement ? 1 : 0)
      : durationMinutes / incrementMinutes;
  const billableDurationMinutes = billedIncrementCount * incrementMinutes;

  if (!Number.isSafeInteger(billableDurationMinutes)) {
    throw new RangeError('hourlyPricing billable duration exceeds the safe integer minute range.');
  }

  return Object.freeze({ billableDurationMinutes, billedIncrementCount });
}

export function calculateHourlyPrice(value) {
  const input = requireRecord(value, 'hourlyPricing input');
  requireExactFields(input, calculationInputFieldNames, 'hourlyPricing input');

  if (input.pricingModel !== PRICING_RULE_MODELS.HOURLY) {
    throw new RangeError('hourlyPricing.pricingModel must be hourly.');
  }

  const configuration = normalizeHourlyPricingConfiguration(input.configuration);
  const inputDurationMinutes = normalizeDurationMinutes(input.durationMinutes);

  if (inputDurationMinutes < configuration.minimumDurationMinutes) {
    throw new RangeError(
      'hourlyPricing.durationMinutes must meet the configured minimum duration.',
    );
  }

  const { billableDurationMinutes, billedIncrementCount } = resolveBillableDuration(
    inputDurationMinutes,
    configuration,
  );
  const totalAmountIdr = multiplyIntegerIdr(
    configuration.amountPerIncrementIdr,
    billedIncrementCount,
    {
      label: 'hourlyPricing.amountPerIncrementIdr',
      multiplierLabel: 'hourlyPricing.billedIncrementCount',
    },
  );

  return Object.freeze({
    amountPerIncrementIdr: configuration.amountPerIncrementIdr,
    billableDurationMinutes,
    billedIncrementCount,
    incrementMinutes: configuration.incrementMinutes,
    inputDurationMinutes,
    minimumDurationMinutes: configuration.minimumDurationMinutes,
    pricingModel: PRICING_RULE_MODELS.HOURLY,
    roundingMode: configuration.roundingMode,
    totalAmountIdr,
  });
}
