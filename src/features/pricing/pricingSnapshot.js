import { toIsoDateTime, toJavaScriptDate } from '../../lib/datetime/timestamps.js';
import { requireIntegerIdr, sumIntegerIdr } from '../../lib/money/idr.js';
import { ADD_ON_PRICING_TYPES, calculateAddOnPrices } from './addOnPricing.js';
import { calculateBaseAdditionalPrice } from './baseAdditionalPricing.js';
import { calculateDiscount, DISCOUNT_TYPES } from './discountPricing.js';
import { calculateDurationPackagePrice } from './durationPackagePricing.js';
import { calculateFixedSessionPrice } from './fixedSessionPricing.js';
import { calculateHourlyPrice } from './hourlyPricing.js';
import {
  decodePricingRuleDocument,
  PRICING_RULE_MODELS,
  PRICING_RULE_STATUSES,
} from './pricingRules.js';

export const PRICING_SNAPSHOT_VERSION = 1;
export const PRICING_CALCULATION_VERSION = 1;

const snapshotInputFieldNames = Object.freeze([
  'addOnCalculation',
  'baseCalculation',
  'discountCalculation',
  'pricingRule',
  'pricingTime',
]);

const baseCalculationFieldNames = Object.freeze({
  [PRICING_RULE_MODELS.HOURLY]: Object.freeze([
    'amountPerIncrementIdr',
    'billableDurationMinutes',
    'billedIncrementCount',
    'incrementMinutes',
    'inputDurationMinutes',
    'minimumDurationMinutes',
    'pricingModel',
    'roundingMode',
    'totalAmountIdr',
  ]),
  [PRICING_RULE_MODELS.FIXED_SESSION]: Object.freeze([
    'amountIdr',
    'pricingModel',
    'totalAmountIdr',
  ]),
  [PRICING_RULE_MODELS.DURATION_PACKAGE]: Object.freeze([
    'additionalAmountIdr',
    'additionalAmountPerIncrementIdr',
    'additionalDurationMinutes',
    'additionalIncrementMinutes',
    'billableDurationMinutes',
    'billedAdditionalDurationMinutes',
    'billedAdditionalIncrementCount',
    'extraTimePolicy',
    'inputDurationMinutes',
    'packageAmountIdr',
    'packageDurationMinutes',
    'pricingModel',
    'roundingMode',
    'totalAmountIdr',
  ]),
  [PRICING_RULE_MODELS.BASE_PLUS_ADDITIONAL]: Object.freeze([
    'additionalAmountIdr',
    'additionalAmountPerIncrementIdr',
    'additionalDurationMinutes',
    'additionalIncrementMinutes',
    'baseAmountIdr',
    'baseDurationMinutes',
    'billableDurationMinutes',
    'billedAdditionalDurationMinutes',
    'billedAdditionalIncrementCount',
    'inputDurationMinutes',
    'pricingModel',
    'roundingMode',
    'totalAmountIdr',
  ]),
});

const addOnCalculationFieldNames = Object.freeze(['items', 'totalAddOnAmountIdr']);
const addOnItemFieldNames = Object.freeze([
  'addOnId',
  'billedDurationMinutes',
  'billedIncrementCount',
  'inputDurationMinutes',
  'incrementMinutes',
  'pricingType',
  'quantity',
  'roundingMode',
  'totalAmountIdr',
  'unitAmountIdr',
]);
const discountCalculationFieldNames = Object.freeze([
  'configuredAmountIdr',
  'discountAmountIdr',
  'discountType',
  'discountableAmountIdr',
  'finalAmountIdr',
  'percentageBasisPoints',
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

function assertSamePrimitiveRecord(actual, expected, label) {
  requireExactFields(actual, Object.keys(expected), label);

  for (const field of Object.keys(expected)) {
    if (!Object.is(actual[field], expected[field])) {
      throw new RangeError(`${label}.${field} does not match the canonical calculation result.`);
    }
  }
}

function replayBaseCalculation(value, rule) {
  const calculation = requireRecord(value, 'pricingSnapshot.baseCalculation');
  const expectedFields = baseCalculationFieldNames[rule.pricingModel];

  if (!expectedFields) {
    throw new RangeError('pricingSnapshot pricing model is not supported.');
  }

  requireExactFields(calculation, expectedFields, 'pricingSnapshot.baseCalculation');

  let canonical;

  switch (rule.pricingModel) {
    case PRICING_RULE_MODELS.HOURLY:
      canonical = calculateHourlyPrice({
        configuration: rule.configuration,
        durationMinutes: calculation.inputDurationMinutes,
        pricingModel: rule.pricingModel,
      });
      break;
    case PRICING_RULE_MODELS.FIXED_SESSION:
      canonical = calculateFixedSessionPrice({
        configuration: rule.configuration,
        pricingModel: rule.pricingModel,
      });
      break;
    case PRICING_RULE_MODELS.DURATION_PACKAGE:
      canonical = calculateDurationPackagePrice({
        configuration: rule.configuration,
        durationMinutes: calculation.inputDurationMinutes,
        pricingModel: rule.pricingModel,
      });
      break;
    case PRICING_RULE_MODELS.BASE_PLUS_ADDITIONAL:
      canonical = calculateBaseAdditionalPrice({
        configuration: rule.configuration,
        durationMinutes: calculation.inputDurationMinutes,
        pricingModel: rule.pricingModel,
      });
      break;
    default:
      throw new RangeError('pricingSnapshot pricing model is not supported.');
  }

  assertSamePrimitiveRecord(calculation, canonical, 'pricingSnapshot.baseCalculation');
  return canonical;
}

function toAddOnInput(item, index) {
  const label = `pricingSnapshot.addOnCalculation.items[${index}]`;
  const value = requireRecord(item, label);
  requireExactFields(value, addOnItemFieldNames, label);

  if (value.pricingType === ADD_ON_PRICING_TYPES.FIXED) {
    return {
      addOnId: value.addOnId,
      configuration: { amountIdr: value.unitAmountIdr },
      pricingType: value.pricingType,
    };
  }

  if (value.pricingType === ADD_ON_PRICING_TYPES.QUANTITY) {
    return {
      addOnId: value.addOnId,
      configuration: { amountPerUnitIdr: value.unitAmountIdr },
      pricingType: value.pricingType,
      quantity: value.quantity,
    };
  }

  if (value.pricingType === ADD_ON_PRICING_TYPES.TIME) {
    return {
      addOnId: value.addOnId,
      configuration: {
        amountPerIncrementIdr: value.unitAmountIdr,
        incrementMinutes: value.incrementMinutes,
        roundingMode: value.roundingMode,
      },
      durationMinutes: value.inputDurationMinutes,
      pricingType: value.pricingType,
    };
  }

  throw new RangeError(`${label}.pricingType is not supported.`);
}

function replayAddOnCalculation(value) {
  const calculation = requireRecord(value, 'pricingSnapshot.addOnCalculation');
  requireExactFields(
    calculation,
    addOnCalculationFieldNames,
    'pricingSnapshot.addOnCalculation',
  );

  if (!Array.isArray(calculation.items)) {
    throw new TypeError('pricingSnapshot.addOnCalculation.items must be an array.');
  }

  const canonical = calculateAddOnPrices({
    addOns: calculation.items.map((item, index) => toAddOnInput(item, index)),
  });

  if (calculation.totalAddOnAmountIdr !== canonical.totalAddOnAmountIdr) {
    throw new RangeError(
      'pricingSnapshot.addOnCalculation.totalAddOnAmountIdr does not match the canonical calculation result.',
    );
  }

  canonical.items.forEach((item, index) => {
    assertSamePrimitiveRecord(
      calculation.items[index],
      item,
      `pricingSnapshot.addOnCalculation.items[${index}]`,
    );
  });

  return canonical;
}

function toDiscountInput(calculation) {
  if (calculation.discountType === null) {
    return {
      discount: null,
      discountableAmountIdr: calculation.discountableAmountIdr,
    };
  }

  if (calculation.discountType === DISCOUNT_TYPES.FIXED) {
    return {
      discount: {
        configuration: { amountIdr: calculation.configuredAmountIdr },
        discountType: calculation.discountType,
      },
      discountableAmountIdr: calculation.discountableAmountIdr,
    };
  }

  if (calculation.discountType === DISCOUNT_TYPES.PERCENTAGE) {
    return {
      discount: {
        configuration: { percentageBasisPoints: calculation.percentageBasisPoints },
        discountType: calculation.discountType,
      },
      discountableAmountIdr: calculation.discountableAmountIdr,
    };
  }

  throw new RangeError('pricingSnapshot.discountCalculation.discountType is not supported.');
}

function replayDiscountCalculation(value) {
  const calculation = requireRecord(value, 'pricingSnapshot.discountCalculation');
  requireExactFields(
    calculation,
    discountCalculationFieldNames,
    'pricingSnapshot.discountCalculation',
  );

  const canonical = calculateDiscount(toDiscountInput(calculation));
  assertSamePrimitiveRecord(calculation, canonical, 'pricingSnapshot.discountCalculation');
  return canonical;
}

function cloneAddOnCalculation(calculation) {
  return Object.freeze({
    items: Object.freeze(calculation.items.map((item) => Object.freeze({ ...item }))),
    totalAddOnAmountIdr: calculation.totalAddOnAmountIdr,
  });
}

function buildRuleSnapshot(rule) {
  return Object.freeze({
    configuration: Object.freeze({ ...rule.configuration }),
    effectiveFromIso: toIsoDateTime(rule.effectiveFrom, {
      allowNull: true,
      label: 'pricingSnapshot.pricingRule.effectiveFrom',
    }),
    effectiveUntilIso: toIsoDateTime(rule.effectiveUntil, {
      allowNull: true,
      label: 'pricingSnapshot.pricingRule.effectiveUntil',
    }),
    id: rule.id,
    name: rule.name,
    pricingModel: rule.pricingModel,
    priority: rule.priority,
    sessionTypeId: rule.sessionTypeId,
    sourceUpdatedAtIso: toIsoDateTime(rule.updatedAt, {
      label: 'pricingSnapshot.pricingRule.updatedAt',
    }),
    sourceUpdatedByUid: rule.updatedByUid,
    studioId: rule.studioId,
  });
}

function assertRuleSelectableAtPricingTime(rule, pricingTime) {
  if (rule.status !== PRICING_RULE_STATUSES.ACTIVE) {
    throw new RangeError('pricingSnapshot.pricingRule must be active at snapshot construction.');
  }

  const pricingTimeMs = pricingTime.getTime();
  const startsOnTime = rule.effectiveFrom === null || rule.effectiveFrom.getTime() <= pricingTimeMs;
  const endsAfterTime =
    rule.effectiveUntil === null || pricingTimeMs < rule.effectiveUntil.getTime();

  if (!startsOnTime || !endsAfterTime) {
    throw new RangeError('pricingSnapshot.pricingRule must be effective at pricingTime.');
  }
}

export function buildPricingSnapshot(value) {
  const input = requireRecord(value, 'pricingSnapshot input');
  requireExactFields(input, snapshotInputFieldNames, 'pricingSnapshot input');

  const rule = decodePricingRuleDocument(input.pricingRule);
  const pricingTime = toJavaScriptDate(input.pricingTime, {
    label: 'pricingSnapshot.pricingTime',
  });
  assertRuleSelectableAtPricingTime(rule, pricingTime);

  const baseCalculation = replayBaseCalculation(input.baseCalculation, rule);
  const addOnCalculation = replayAddOnCalculation(input.addOnCalculation);
  const discountCalculation = replayDiscountCalculation(input.discountCalculation);
  const baseAmountIdr = requireIntegerIdr(baseCalculation.totalAmountIdr, {
    label: 'pricingSnapshot.baseAmountIdr',
  });
  const addOnAmountIdr = requireIntegerIdr(addOnCalculation.totalAddOnAmountIdr, {
    label: 'pricingSnapshot.addOnAmountIdr',
  });
  const subtotalAmountIdr = sumIntegerIdr([baseAmountIdr, addOnAmountIdr], {
    label: 'pricingSnapshot.subtotalAmounts',
  });
  const discountableAmountIdr = requireIntegerIdr(discountCalculation.discountableAmountIdr, {
    label: 'pricingSnapshot.discountableAmountIdr',
  });

  if (discountableAmountIdr > subtotalAmountIdr) {
    throw new RangeError(
      'pricingSnapshot.discountableAmountIdr must not exceed the base-plus-add-on subtotal.',
    );
  }

  const nonDiscountableAmountIdr = subtotalAmountIdr - discountableAmountIdr;
  const finalAmountIdr = sumIntegerIdr(
    [discountCalculation.finalAmountIdr, nonDiscountableAmountIdr],
    { label: 'pricingSnapshot.finalAmounts' },
  );
  const amounts = Object.freeze({
    addOnAmountIdr,
    baseAmountIdr,
    discountAmountIdr: discountCalculation.discountAmountIdr,
    discountableAmountIdr,
    finalAmountIdr,
    nonDiscountableAmountIdr,
    subtotalAmountIdr,
  });

  return Object.freeze({
    addOnCalculation: cloneAddOnCalculation(addOnCalculation),
    amounts,
    baseCalculation: Object.freeze({ ...baseCalculation }),
    calculationVersion: PRICING_CALCULATION_VERSION,
    discountCalculation: Object.freeze({ ...discountCalculation }),
    pricingTimeIso: pricingTime.toISOString(),
    rule: buildRuleSnapshot(rule),
    snapshotVersion: PRICING_SNAPSHOT_VERSION,
  });
}
