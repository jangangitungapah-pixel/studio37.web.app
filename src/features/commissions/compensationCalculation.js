import { multiplyIntegerIdr, requireIntegerIdr } from '../../lib/money/idr.js';
import {
  COMPENSATION_PERCENTAGE_BASES,
  COMPENSATION_RULE_MODELS,
} from './compensationRules.js';

export const COMPENSATION_PERCENTAGE_BASIS_POINTS = 10_000;

const supportedModels = new Set(Object.values(COMPENSATION_RULE_MODELS));
const supportedPercentageBases = new Set(Object.values(COMPENSATION_PERCENTAGE_BASES));

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

function requireSupportedModel(value) {
  if (typeof value !== 'string' || !supportedModels.has(value)) {
    throw new RangeError('compensationCalculation.compensationModel is not supported.');
  }

  return value;
}

function requireConfiguredAmount(value, label) {
  return requireIntegerIdr(value, { label });
}

function requirePositiveWholeHours(value) {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError('compensationCalculation.input.compensatedHours must be a safe integer.');
  }
  if (value <= 0) {
    throw new RangeError('compensationCalculation.input.compensatedHours must be greater than zero.');
  }

  return value;
}

function requireDurationMinutes(value, label) {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be a safe integer number of minutes.`);
  }
  if (value <= 0 || value % 15 !== 0) {
    throw new RangeError(`${label} must be a positive 15-minute-aligned duration.`);
  }

  return value;
}

function requireBasisPoints(value) {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError('compensationCalculation.configuration.basisPoints must be a safe integer.');
  }
  if (value < 0 || value > COMPENSATION_PERCENTAGE_BASIS_POINTS) {
    throw new RangeError(
      `compensationCalculation.configuration.basisPoints must be between 0 and ${COMPENSATION_PERCENTAGE_BASIS_POINTS}.`,
    );
  }

  return value;
}

function requirePercentageBase(value) {
  if (typeof value !== 'string' || !supportedPercentageBases.has(value)) {
    throw new RangeError('compensationCalculation percentage base is not supported.');
  }

  return value;
}

function calculateBasisPointAmount(baseAmountIdr, basisPoints) {
  const wholeBlocks = Math.floor(baseAmountIdr / COMPENSATION_PERCENTAGE_BASIS_POINTS);
  const remainderIdr = baseAmountIdr % COMPENSATION_PERCENTAGE_BASIS_POINTS;
  const wholeBlockAmountIdr = wholeBlocks * basisPoints;
  const remainderAmountIdr = Math.floor(
    (remainderIdr * basisPoints) / COMPENSATION_PERCENTAGE_BASIS_POINTS,
  );
  const amountIdr = wholeBlockAmountIdr + remainderAmountIdr;

  if (!Number.isSafeInteger(amountIdr)) {
    throw new RangeError('compensationCalculation percentage result exceeds safe integer IDR.');
  }

  return amountIdr;
}

function buildResult({ amountIdr, compensationModel, inputs = {} }) {
  return Object.freeze({
    amountIdr: requireIntegerIdr(amountIdr, { label: 'compensationCalculation.amountIdr' }),
    compensationModel,
    inputs: Object.freeze({ ...inputs }),
  });
}

function calculatePerHour(configuration, input) {
  requireExactFields(configuration, ['amountPerHourIdr'], 'compensationCalculation.configuration');
  requireExactFields(input, ['compensatedHours'], 'compensationCalculation.input');

  const amountPerHourIdr = requireConfiguredAmount(
    configuration.amountPerHourIdr,
    'compensationCalculation.configuration.amountPerHourIdr',
  );
  const compensatedHours = requirePositiveWholeHours(input.compensatedHours);
  const amountIdr = multiplyIntegerIdr(amountPerHourIdr, compensatedHours, {
    label: 'compensationCalculation.configuration.amountPerHourIdr',
    multiplierLabel: 'compensationCalculation.input.compensatedHours',
  });

  return buildResult({
    amountIdr,
    compensationModel: COMPENSATION_RULE_MODELS.PER_HOUR,
    inputs: { amountPerHourIdr, compensatedHours },
  });
}

function calculateConfiguredAmount(compensationModel, configuration, input) {
  requireExactFields(configuration, ['amountIdr'], 'compensationCalculation.configuration');
  requireExactFields(input, [], 'compensationCalculation.input');

  const configuredAmountIdr = requireConfiguredAmount(
    configuration.amountIdr,
    'compensationCalculation.configuration.amountIdr',
  );

  return buildResult({
    amountIdr: configuredAmountIdr,
    compensationModel,
    inputs: { configuredAmountIdr },
  });
}

function calculatePackage(configuration, input) {
  requireExactFields(
    configuration,
    ['amountIdr', 'durationMinutes'],
    'compensationCalculation.configuration',
  );
  requireExactFields(input, ['durationMinutes'], 'compensationCalculation.input');

  const configuredAmountIdr = requireConfiguredAmount(
    configuration.amountIdr,
    'compensationCalculation.configuration.amountIdr',
  );
  const configuredDurationMinutes = requireDurationMinutes(
    configuration.durationMinutes,
    'compensationCalculation.configuration.durationMinutes',
  );
  const durationMinutes = requireDurationMinutes(
    input.durationMinutes,
    'compensationCalculation.input.durationMinutes',
  );

  if (durationMinutes !== configuredDurationMinutes) {
    throw new RangeError(
      'compensationCalculation package duration must exactly match the configured duration.',
    );
  }

  return buildResult({
    amountIdr: configuredAmountIdr,
    compensationModel: COMPENSATION_RULE_MODELS.PACKAGE,
    inputs: { configuredAmountIdr, configuredDurationMinutes, durationMinutes },
  });
}

function calculatePercentage(configuration, input) {
  requireExactFields(
    configuration,
    ['base', 'basisPoints'],
    'compensationCalculation.configuration',
  );
  requireExactFields(input, ['base', 'baseAmountIdr'], 'compensationCalculation.input');

  const configuredBase = requirePercentageBase(configuration.base);
  const suppliedBase = requirePercentageBase(input.base);
  if (suppliedBase !== configuredBase) {
    throw new RangeError(
      'compensationCalculation input base must exactly match the configured percentage base.',
    );
  }

  const basisPoints = requireBasisPoints(configuration.basisPoints);
  const baseAmountIdr = requireIntegerIdr(input.baseAmountIdr, {
    label: 'compensationCalculation.input.baseAmountIdr',
  });
  const amountIdr = calculateBasisPointAmount(baseAmountIdr, basisPoints);

  return buildResult({
    amountIdr,
    compensationModel: COMPENSATION_RULE_MODELS.PERCENTAGE,
    inputs: { base: configuredBase, baseAmountIdr, basisPoints },
  });
}

export function calculateCompensation(value) {
  const request = requireRecord(value, 'compensationCalculation');
  requireExactFields(
    request,
    ['compensationModel', 'configuration', 'input'],
    'compensationCalculation',
  );

  const compensationModel = requireSupportedModel(request.compensationModel);
  const configuration = requireRecord(
    request.configuration,
    'compensationCalculation.configuration',
  );
  const input = requireRecord(request.input, 'compensationCalculation.input');

  switch (compensationModel) {
    case COMPENSATION_RULE_MODELS.PER_HOUR:
      return calculatePerHour(configuration, input);
    case COMPENSATION_RULE_MODELS.PER_SESSION:
      return calculateConfiguredAmount(compensationModel, configuration, input);
    case COMPENSATION_RULE_MODELS.FIXED:
      return calculateConfiguredAmount(compensationModel, configuration, input);
    case COMPENSATION_RULE_MODELS.PACKAGE:
      return calculatePackage(configuration, input);
    case COMPENSATION_RULE_MODELS.PERCENTAGE:
      return calculatePercentage(configuration, input);
    default:
      throw new RangeError('compensationCalculation.compensationModel is not supported.');
  }
}
