import { sumIntegerIdr } from '../../lib/money/idr.js';
import { ADD_ON_PRICING_TYPES, calculateAddOnPrices } from './addOnPricing.js';
import { decodeAddOnDocument } from './addOns.js';
import { calculateBaseAdditionalPrice } from './baseAdditionalPricing.js';
import { calculateDurationPackagePrice } from './durationPackagePricing.js';
import { calculateFixedSessionPrice } from './fixedSessionPricing.js';
import { calculateHourlyPrice } from './hourlyPricing.js';
import { decodePricingRuleDocument, PRICING_RULE_MODELS } from './pricingRules.js';

const previewInputFieldNames = Object.freeze(['addOns', 'durationMinutes', 'pricingRule']);
const addOnSelectionFieldNames = Object.freeze(['addOn', 'durationMinutes', 'quantity']);

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

function calculateBasePrice(rule, durationMinutes) {
  switch (rule.pricingModel) {
    case PRICING_RULE_MODELS.HOURLY:
      return calculateHourlyPrice({
        configuration: rule.configuration,
        durationMinutes,
        pricingModel: rule.pricingModel,
      });

    case PRICING_RULE_MODELS.FIXED_SESSION:
      if (durationMinutes !== null) {
        throw new TypeError('pricingPreview.durationMinutes must be null for fixed-session pricing.');
      }
      return calculateFixedSessionPrice({
        configuration: rule.configuration,
        pricingModel: rule.pricingModel,
      });

    case PRICING_RULE_MODELS.DURATION_PACKAGE:
      return calculateDurationPackagePrice({
        configuration: rule.configuration,
        durationMinutes,
        pricingModel: rule.pricingModel,
      });

    case PRICING_RULE_MODELS.BASE_PLUS_ADDITIONAL:
      return calculateBaseAdditionalPrice({
        configuration: rule.configuration,
        durationMinutes,
        pricingModel: rule.pricingModel,
      });

    default:
      throw new RangeError('pricingPreview pricing model is not supported.');
  }
}

function toAddOnCalculationInput(value, index, sessionTypeId) {
  const label = `pricingPreview.addOns[${index}]`;
  const selection = requireRecord(value, label);
  requireExactFields(selection, addOnSelectionFieldNames, label);
  const addOn = decodeAddOnDocument(selection.addOn);

  if (addOn.sessionTypeId !== null && addOn.sessionTypeId !== sessionTypeId) {
    throw new RangeError(`${label}.addOn is not available for the selected pricing-rule session.`);
  }

  if (addOn.pricingType === ADD_ON_PRICING_TYPES.FIXED) {
    if (selection.quantity !== null || selection.durationMinutes !== null) {
      throw new TypeError(`${label} fixed add-on transaction inputs must be null.`);
    }

    return Object.freeze({
      addOnId: addOn.id,
      configuration: addOn.configuration,
      pricingType: addOn.pricingType,
    });
  }

  if (addOn.pricingType === ADD_ON_PRICING_TYPES.QUANTITY) {
    if (selection.durationMinutes !== null) {
      throw new TypeError(`${label}.durationMinutes must be null for quantity add-ons.`);
    }

    return Object.freeze({
      addOnId: addOn.id,
      configuration: addOn.configuration,
      pricingType: addOn.pricingType,
      quantity: selection.quantity,
    });
  }

  if (selection.quantity !== null) {
    throw new TypeError(`${label}.quantity must be null for time add-ons.`);
  }

  return Object.freeze({
    addOnId: addOn.id,
    configuration: addOn.configuration,
    durationMinutes: selection.durationMinutes,
    pricingType: addOn.pricingType,
  });
}

export function buildPricingPreview(value) {
  const input = requireRecord(value, 'pricingPreview input');
  requireExactFields(input, previewInputFieldNames, 'pricingPreview input');

  if (!Array.isArray(input.addOns)) {
    throw new TypeError('pricingPreview.addOns must be an array.');
  }

  const pricingRule = decodePricingRuleDocument(input.pricingRule);
  const baseCalculation = calculateBasePrice(pricingRule, input.durationMinutes);
  const addOnCalculation = calculateAddOnPrices({
    addOns: input.addOns.map((selection, index) =>
      toAddOnCalculationInput(selection, index, pricingRule.sessionTypeId),
    ),
  });
  const totalAmountIdr = sumIntegerIdr(
    [baseCalculation.totalAmountIdr, addOnCalculation.totalAddOnAmountIdr],
    { label: 'pricingPreview.amounts' },
  );

  return Object.freeze({
    addOnCalculation,
    baseCalculation,
    pricingModel: pricingRule.pricingModel,
    pricingRuleId: pricingRule.id,
    pricingRuleStatus: pricingRule.status,
    sessionTypeId: pricingRule.sessionTypeId,
    studioId: pricingRule.studioId,
    totalAmountIdr,
  });
}
