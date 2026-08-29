import { requireIntegerIdr } from '../../lib/money/idr.js';

export const DISCOUNT_TYPES = Object.freeze({
  FIXED: 'fixed',
  PERCENTAGE: 'percentage',
});

export const DISCOUNT_PERCENTAGE_BASIS_POINTS = 10_000;

const calculationInputFieldNames = Object.freeze(['discount', 'discountableAmountIdr']);
const discountFieldNames = Object.freeze(['configuration', 'discountType']);
const supportedDiscountTypes = new Set(Object.values(DISCOUNT_TYPES));

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

function normalizeFixedConfiguration(value, label) {
  const configuration = requireRecord(value, label);
  requireExactFields(configuration, ['amountIdr'], label);

  return Object.freeze({
    amountIdr: requireIntegerIdr(configuration.amountIdr, {
      label: `${label}.amountIdr`,
    }),
  });
}

function normalizePercentageBasisPoints(value, label) {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be a safe integer number of basis points.`);
  }

  if (value < 0 || value > DISCOUNT_PERCENTAGE_BASIS_POINTS) {
    throw new RangeError(
      `${label} must be between 0 and ${DISCOUNT_PERCENTAGE_BASIS_POINTS} basis points.`,
    );
  }

  return value;
}

function normalizePercentageConfiguration(value, label) {
  const configuration = requireRecord(value, label);
  requireExactFields(configuration, ['percentageBasisPoints'], label);

  return Object.freeze({
    percentageBasisPoints: normalizePercentageBasisPoints(
      configuration.percentageBasisPoints,
      `${label}.percentageBasisPoints`,
    ),
  });
}

function calculatePercentageDiscountAmount(discountableAmountIdr, percentageBasisPoints) {
  const wholeBasisPointBlocks = Math.floor(
    discountableAmountIdr / DISCOUNT_PERCENTAGE_BASIS_POINTS,
  );
  const remainderIdr = discountableAmountIdr % DISCOUNT_PERCENTAGE_BASIS_POINTS;
  const wholeBlockAmountIdr = wholeBasisPointBlocks * percentageBasisPoints;
  const remainderAmountIdr = Math.floor(
    (remainderIdr * percentageBasisPoints) / DISCOUNT_PERCENTAGE_BASIS_POINTS,
  );
  const discountAmountIdr = wholeBlockAmountIdr + remainderAmountIdr;

  if (!Number.isSafeInteger(discountAmountIdr)) {
    throw new RangeError('discountPricing percentage result exceeds the safe integer IDR range.');
  }

  return discountAmountIdr;
}

function buildResult({
  configuredAmountIdr,
  discountAmountIdr,
  discountType,
  discountableAmountIdr,
  percentageBasisPoints,
}) {
  const finalAmountIdr = discountableAmountIdr - discountAmountIdr;

  if (!Number.isSafeInteger(finalAmountIdr) || finalAmountIdr < 0) {
    throw new RangeError('discountPricing finalAmountIdr must be a non-negative safe integer IDR.');
  }

  return Object.freeze({
    configuredAmountIdr,
    discountAmountIdr,
    discountType,
    discountableAmountIdr,
    finalAmountIdr,
    percentageBasisPoints,
  });
}

export function calculateDiscount(value) {
  const input = requireRecord(value, 'discountPricing input');
  requireExactFields(input, calculationInputFieldNames, 'discountPricing input');

  const discountableAmountIdr = requireIntegerIdr(input.discountableAmountIdr, {
    label: 'discountPricing.discountableAmountIdr',
  });

  if (input.discount === null) {
    return buildResult({
      configuredAmountIdr: null,
      discountAmountIdr: 0,
      discountType: null,
      discountableAmountIdr,
      percentageBasisPoints: null,
    });
  }

  const discount = requireRecord(input.discount, 'discountPricing.discount');
  requireExactFields(discount, discountFieldNames, 'discountPricing.discount');

  if (!supportedDiscountTypes.has(discount.discountType)) {
    throw new RangeError('discountPricing.discount.discountType is not supported.');
  }

  if (discount.discountType === DISCOUNT_TYPES.FIXED) {
    const configuration = normalizeFixedConfiguration(
      discount.configuration,
      'discountPricing.discount.configuration',
    );

    if (configuration.amountIdr > discountableAmountIdr) {
      throw new RangeError(
        'discountPricing fixed discount must not exceed discountableAmountIdr.',
      );
    }

    return buildResult({
      configuredAmountIdr: configuration.amountIdr,
      discountAmountIdr: configuration.amountIdr,
      discountType: DISCOUNT_TYPES.FIXED,
      discountableAmountIdr,
      percentageBasisPoints: null,
    });
  }

  const configuration = normalizePercentageConfiguration(
    discount.configuration,
    'discountPricing.discount.configuration',
  );
  const discountAmountIdr = calculatePercentageDiscountAmount(
    discountableAmountIdr,
    configuration.percentageBasisPoints,
  );

  return buildResult({
    configuredAmountIdr: null,
    discountAmountIdr,
    discountType: DISCOUNT_TYPES.PERCENTAGE,
    discountableAmountIdr,
    percentageBasisPoints: configuration.percentageBasisPoints,
  });
}
