import { requireIntegerIdr } from '../../lib/money/idr.js';
import { PRICING_RULE_MODELS } from './pricingRules.js';

const calculationInputFieldNames = Object.freeze(['configuration', 'pricingModel']);
const configurationFieldNames = Object.freeze(['amountIdr']);

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

function normalizeFixedSessionConfiguration(value) {
  const configuration = requireRecord(value, 'fixedSessionPricing.configuration');
  requireExactFields(configuration, configurationFieldNames, 'fixedSessionPricing.configuration');

  return Object.freeze({
    amountIdr: requireIntegerIdr(configuration.amountIdr, {
      label: 'fixedSessionPricing.configuration.amountIdr',
    }),
  });
}

export function calculateFixedSessionPrice(value) {
  const input = requireRecord(value, 'fixedSessionPricing input');
  requireExactFields(input, calculationInputFieldNames, 'fixedSessionPricing input');

  if (input.pricingModel !== PRICING_RULE_MODELS.FIXED_SESSION) {
    throw new RangeError('fixedSessionPricing.pricingModel must be fixed_session.');
  }

  const configuration = normalizeFixedSessionConfiguration(input.configuration);

  return Object.freeze({
    amountIdr: configuration.amountIdr,
    pricingModel: PRICING_RULE_MODELS.FIXED_SESSION,
    totalAmountIdr: configuration.amountIdr,
  });
}
