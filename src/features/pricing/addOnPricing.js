import { multiplyIntegerIdr, requireIntegerIdr, sumIntegerIdr } from '../../lib/money/idr.js';
import {
  PRICING_RULE_DURATION_STEP_MINUTES,
  PRICING_RULE_MAX_DURATION_MINUTES,
  PRICING_RULE_ROUNDING_MODES,
} from './pricingRules.js';

export const ADD_ON_PRICING_TYPES = Object.freeze({
  FIXED: 'fixed',
  QUANTITY: 'quantity',
  TIME: 'time',
});

const calculationInputFieldNames = Object.freeze(['addOns']);
const commonAddOnFieldNames = Object.freeze(['addOnId', 'configuration', 'pricingType']);
const quantityAddOnFieldNames = Object.freeze([
  'addOnId',
  'configuration',
  'pricingType',
  'quantity',
]);
const timeAddOnFieldNames = Object.freeze([
  'addOnId',
  'configuration',
  'durationMinutes',
  'pricingType',
]);
const supportedPricingTypes = new Set(Object.values(ADD_ON_PRICING_TYPES));
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

function normalizeAddOnId(value, label) {
  if (typeof value !== 'string') {
    throw new TypeError(`${label} must be a string.`);
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }

  if (normalized.length > 128 || normalized.includes('/')) {
    throw new TypeError(`${label} must be an opaque add-on identifier.`);
  }

  return normalized;
}

function normalizeQuantity(value, label) {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be a safe integer.`);
  }

  if (value <= 0) {
    throw new RangeError(`${label} must be greater than zero.`);
  }

  return value;
}

function normalizeRequestedDuration(value, label) {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be a safe integer number of minutes.`);
  }

  if (value <= 0) {
    throw new RangeError(`${label} must be greater than zero.`);
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

function normalizeFixedConfiguration(value, label) {
  const configuration = requireRecord(value, label);
  requireExactFields(configuration, ['amountIdr'], label);

  return Object.freeze({
    amountIdr: requireIntegerIdr(configuration.amountIdr, {
      label: `${label}.amountIdr`,
    }),
  });
}

function normalizeQuantityConfiguration(value, label) {
  const configuration = requireRecord(value, label);
  requireExactFields(configuration, ['amountPerUnitIdr'], label);

  return Object.freeze({
    amountPerUnitIdr: requireIntegerIdr(configuration.amountPerUnitIdr, {
      label: `${label}.amountPerUnitIdr`,
    }),
  });
}

function normalizeTimeConfiguration(value, label) {
  const configuration = requireRecord(value, label);
  requireExactFields(
    configuration,
    ['amountPerIncrementIdr', 'incrementMinutes', 'roundingMode'],
    label,
  );

  if (!supportedRoundingModes.has(configuration.roundingMode)) {
    throw new RangeError(`${label}.roundingMode is not supported.`);
  }

  return Object.freeze({
    amountPerIncrementIdr: requireIntegerIdr(configuration.amountPerIncrementIdr, {
      label: `${label}.amountPerIncrementIdr`,
    }),
    incrementMinutes: normalizeConfiguredDuration(
      configuration.incrementMinutes,
      `${label}.incrementMinutes`,
    ),
    roundingMode: configuration.roundingMode,
  });
}

function calculateFixedAddOn(addOn, addOnId, label) {
  requireExactFields(addOn, commonAddOnFieldNames, label);
  const configuration = normalizeFixedConfiguration(addOn.configuration, `${label}.configuration`);

  return Object.freeze({
    addOnId,
    billedDurationMinutes: null,
    billedIncrementCount: null,
    inputDurationMinutes: null,
    incrementMinutes: null,
    pricingType: ADD_ON_PRICING_TYPES.FIXED,
    quantity: 1,
    roundingMode: null,
    totalAmountIdr: configuration.amountIdr,
    unitAmountIdr: configuration.amountIdr,
  });
}

function calculateQuantityAddOn(addOn, addOnId, label) {
  requireExactFields(addOn, quantityAddOnFieldNames, label);
  const configuration = normalizeQuantityConfiguration(
    addOn.configuration,
    `${label}.configuration`,
  );
  const quantity = normalizeQuantity(addOn.quantity, `${label}.quantity`);
  const totalAmountIdr = multiplyIntegerIdr(configuration.amountPerUnitIdr, quantity, {
    label: `${label}.configuration.amountPerUnitIdr`,
    multiplierLabel: `${label}.quantity`,
  });

  return Object.freeze({
    addOnId,
    billedDurationMinutes: null,
    billedIncrementCount: null,
    inputDurationMinutes: null,
    incrementMinutes: null,
    pricingType: ADD_ON_PRICING_TYPES.QUANTITY,
    quantity,
    roundingMode: null,
    totalAmountIdr,
    unitAmountIdr: configuration.amountPerUnitIdr,
  });
}

function calculateTimeAddOn(addOn, addOnId, label) {
  requireExactFields(addOn, timeAddOnFieldNames, label);
  const configuration = normalizeTimeConfiguration(addOn.configuration, `${label}.configuration`);
  const inputDurationMinutes = normalizeRequestedDuration(
    addOn.durationMinutes,
    `${label}.durationMinutes`,
  );
  const hasPartialIncrement = inputDurationMinutes % configuration.incrementMinutes !== 0;

  if (configuration.roundingMode === PRICING_RULE_ROUNDING_MODES.EXACT && hasPartialIncrement) {
    throw new RangeError(`${label}.durationMinutes must align with the configured increment.`);
  }

  const billedIncrementCount =
    configuration.roundingMode === PRICING_RULE_ROUNDING_MODES.ROUND_UP
      ? Math.ceil(inputDurationMinutes / configuration.incrementMinutes)
      : inputDurationMinutes / configuration.incrementMinutes;
  const billedDurationMinutes = billedIncrementCount * configuration.incrementMinutes;

  if (!Number.isSafeInteger(billedDurationMinutes)) {
    throw new RangeError(`${label} billed duration exceeds the safe integer minute range.`);
  }

  const totalAmountIdr = multiplyIntegerIdr(
    configuration.amountPerIncrementIdr,
    billedIncrementCount,
    {
      label: `${label}.configuration.amountPerIncrementIdr`,
      multiplierLabel: `${label}.billedIncrementCount`,
    },
  );

  return Object.freeze({
    addOnId,
    billedDurationMinutes,
    billedIncrementCount,
    inputDurationMinutes,
    incrementMinutes: configuration.incrementMinutes,
    pricingType: ADD_ON_PRICING_TYPES.TIME,
    quantity: null,
    roundingMode: configuration.roundingMode,
    totalAmountIdr,
    unitAmountIdr: configuration.amountPerIncrementIdr,
  });
}

function calculateSingleAddOn(value, index) {
  const label = `addOnPricing.addOns[${index}]`;
  const addOn = requireRecord(value, label);

  if (!supportedPricingTypes.has(addOn.pricingType)) {
    throw new RangeError(`${label}.pricingType is not supported.`);
  }

  const addOnId = normalizeAddOnId(addOn.addOnId, `${label}.addOnId`);

  if (addOn.pricingType === ADD_ON_PRICING_TYPES.FIXED) {
    return calculateFixedAddOn(addOn, addOnId, label);
  }

  if (addOn.pricingType === ADD_ON_PRICING_TYPES.QUANTITY) {
    return calculateQuantityAddOn(addOn, addOnId, label);
  }

  return calculateTimeAddOn(addOn, addOnId, label);
}

export function calculateAddOnPrices(value) {
  const input = requireRecord(value, 'addOnPricing input');
  requireExactFields(input, calculationInputFieldNames, 'addOnPricing input');

  if (!Array.isArray(input.addOns)) {
    throw new TypeError('addOnPricing.addOns must be an array.');
  }

  const seenAddOnIds = new Set();
  const items = input.addOns.map((addOn, index) => {
    const item = calculateSingleAddOn(addOn, index);

    if (seenAddOnIds.has(item.addOnId)) {
      throw new RangeError(`addOnPricing.addOns contains duplicate addOnId ${item.addOnId}.`);
    }

    seenAddOnIds.add(item.addOnId);
    return item;
  });
  const totalAddOnAmountIdr = sumIntegerIdr(
    items.map(({ totalAmountIdr }) => totalAmountIdr),
    { label: 'addOnPricing.amounts' },
  );

  return Object.freeze({
    items: Object.freeze(items),
    totalAddOnAmountIdr,
  });
}
