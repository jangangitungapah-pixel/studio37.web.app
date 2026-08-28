import { describe, expect, it } from 'vitest';

import { calculateDurationPackagePrice } from './durationPackagePricing.js';
import {
  PRICING_RULE_MODELS,
  PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES,
  PRICING_RULE_ROUNDING_MODES,
} from './pricingRules.js';

function createBlockedConfiguration(overrides = {}) {
  return {
    additionalAmountPerIncrementIdr: null,
    additionalIncrementMinutes: null,
    amountIdr: 450_000,
    durationMinutes: 180,
    extraTimePolicy: PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.BLOCKED,
    roundingMode: null,
    ...overrides,
  };
}

function createAdditionalConfiguration(overrides = {}) {
  return {
    additionalAmountPerIncrementIdr: 100_000,
    additionalIncrementMinutes: 60,
    amountIdr: 450_000,
    durationMinutes: 180,
    extraTimePolicy: PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.ADDITIONAL,
    roundingMode: PRICING_RULE_ROUNDING_MODES.ROUND_UP,
    ...overrides,
  };
}

function createAnotherPackageConfiguration(overrides = {}) {
  return {
    additionalAmountPerIncrementIdr: null,
    additionalIncrementMinutes: null,
    amountIdr: 450_000,
    durationMinutes: 180,
    extraTimePolicy: PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.ANOTHER_PACKAGE,
    roundingMode: null,
    ...overrides,
  };
}

function createCalculationInput(overrides = {}) {
  return {
    configuration: createBlockedConfiguration(),
    durationMinutes: 180,
    pricingModel: PRICING_RULE_MODELS.DURATION_PACKAGE,
    ...overrides,
  };
}

function expectCalculationError(input, expectedError) {
  expect(() => calculateDurationPackagePrice(input)).toThrow(expectedError);
}

describe('duration-package pricing calculation', () => {
  it('returns the configured amount for an exact blocked package', () => {
    expect(calculateDurationPackagePrice(createCalculationInput())).toEqual({
      additionalAmountIdr: 0,
      additionalAmountPerIncrementIdr: null,
      additionalDurationMinutes: 0,
      additionalIncrementMinutes: null,
      billableDurationMinutes: 180,
      billedAdditionalDurationMinutes: 0,
      billedAdditionalIncrementCount: 0,
      extraTimePolicy: PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.BLOCKED,
      inputDurationMinutes: 180,
      packageAmountIdr: 450_000,
      packageDurationMinutes: 180,
      pricingModel: PRICING_RULE_MODELS.DURATION_PACKAGE,
      roundingMode: null,
      totalAmountIdr: 450_000,
    });
  });

  it('returns the package amount for exact another-package duration', () => {
    const result = calculateDurationPackagePrice(
      createCalculationInput({ configuration: createAnotherPackageConfiguration() }),
    );

    expect(result.totalAmountIdr).toBe(450_000);
    expect(result.extraTimePolicy).toBe(PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.ANOTHER_PACKAGE);
  });

  it('keeps additional metadata with zero overtime on exact duration', () => {
    const result = calculateDurationPackagePrice(
      createCalculationInput({ configuration: createAdditionalConfiguration() }),
    );

    expect(result).toMatchObject({
      additionalAmountIdr: 0,
      additionalAmountPerIncrementIdr: 100_000,
      additionalDurationMinutes: 0,
      additionalIncrementMinutes: 60,
      billedAdditionalDurationMinutes: 0,
      billedAdditionalIncrementCount: 0,
      roundingMode: PRICING_RULE_ROUNDING_MODES.ROUND_UP,
      totalAmountIdr: 450_000,
    });
  });

  it('rounds overtime up and adds the configured amount', () => {
    const result = calculateDurationPackagePrice(
      createCalculationInput({
        configuration: createAdditionalConfiguration(),
        durationMinutes: 241,
      }),
    );

    expect(result).toMatchObject({
      additionalAmountIdr: 200_000,
      additionalDurationMinutes: 61,
      billableDurationMinutes: 300,
      billedAdditionalDurationMinutes: 120,
      billedAdditionalIncrementCount: 2,
      inputDurationMinutes: 241,
      totalAmountIdr: 650_000,
    });
  });

  it('prices aligned overtime exactly', () => {
    const configuration = createAdditionalConfiguration({
      roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT,
    });
    const result = calculateDurationPackagePrice(
      createCalculationInput({ configuration, durationMinutes: 240 }),
    );

    expect(result).toMatchObject({
      additionalAmountIdr: 100_000,
      additionalDurationMinutes: 60,
      billableDurationMinutes: 240,
      billedAdditionalDurationMinutes: 60,
      billedAdditionalIncrementCount: 1,
      totalAmountIdr: 550_000,
    });
  });

  it('rejects partial overtime in exact mode', () => {
    const configuration = createAdditionalConfiguration({
      roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT,
    });

    expectCalculationError(
      createCalculationInput({ configuration, durationMinutes: 210 }),
      /additional increment in exact mode/,
    );
  });

  it('rejects blocked and another-package overtime', () => {
    expectCalculationError(
      createCalculationInput({ durationMinutes: 181 }),
      /extra time is blocked/,
    );
    expectCalculationError(
      createCalculationInput({
        configuration: createAnotherPackageConfiguration(),
        durationMinutes: 240,
      }),
      /requires another package/,
    );
  });

  it('rejects duration shorter than the selected package', () => {
    expectCalculationError(
      createCalculationInput({ durationMinutes: 120 }),
      /meet the configured package duration/,
    );
  });

  it('rejects the wrong model and extra input fields', () => {
    expectCalculationError(
      createCalculationInput({ pricingModel: PRICING_RULE_MODELS.HOURLY }),
      /must be duration_package/,
    );
    expectCalculationError(
      { ...createCalculationInput(), packageId: 'package-3h' },
      /unsupported input shape/,
    );
  });

  it('rejects non-object calculation inputs', () => {
    for (const input of [null, undefined, [], 'package', 450_000]) {
      expectCalculationError(input, /must be an object/);
    }
  });

  it('rejects non-object package configurations', () => {
    for (const configuration of [null, undefined, [], 'config', 450_000]) {
      expectCalculationError(createCalculationInput({ configuration }), /must be an object/);
    }
  });

  it('rejects malformed package configuration shapes', () => {
    expectCalculationError(
      createCalculationInput({ configuration: {} }),
      /unsupported input shape/,
    );
    expectCalculationError(
      createCalculationInput({
        configuration: { ...createBlockedConfiguration(), discountIdr: 10_000 },
      }),
      /unsupported input shape/,
    );
    expectCalculationError(
      createCalculationInput({
        configuration: createBlockedConfiguration({
          additionalAmountPerIncrementIdr: 100_000,
        }),
      }),
      /additional policy/,
    );
  });

  it('rejects unsupported policy and rounding values', () => {
    expectCalculationError(
      createCalculationInput({
        configuration: createBlockedConfiguration({ extraTimePolicy: 'free' }),
      }),
      /extraTimePolicy/,
    );
    expectCalculationError(
      createCalculationInput({
        configuration: createAdditionalConfiguration({ roundingMode: 'nearest' }),
      }),
      /roundingMode/,
    );
  });

  it('rejects invalid configured amounts and durations', () => {
    expectCalculationError(
      createCalculationInput({
        configuration: createBlockedConfiguration({ amountIdr: -1 }),
      }),
      /must not be negative/,
    );
    expectCalculationError(
      createCalculationInput({
        configuration: createAdditionalConfiguration({
          additionalAmountPerIncrementIdr: 1.5,
        }),
      }),
      /safe integer IDR amount/,
    );
    expectCalculationError(
      createCalculationInput({
        configuration: createBlockedConfiguration({ durationMinutes: 20 }),
      }),
      /15-minute increment/,
    );
  });

  it('rejects invalid requested duration values', () => {
    for (const durationMinutes of [0, -1]) {
      expectCalculationError(createCalculationInput({ durationMinutes }), /greater than zero/);
    }

    for (const durationMinutes of [1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity]) {
      expectCalculationError(
        createCalculationInput({ durationMinutes }),
        /safe integer number of minutes/,
      );
    }
  });

  it('rejects unsafe overtime and unsafe final totals', () => {
    expectCalculationError(
      createCalculationInput({
        configuration: createAdditionalConfiguration({
          additionalAmountPerIncrementIdr: Number.MAX_SAFE_INTEGER,
        }),
        durationMinutes: 300,
      }),
      /product exceeds the safe integer IDR range/,
    );
    expectCalculationError(
      createCalculationInput({
        configuration: createAdditionalConfiguration({
          additionalAmountPerIncrementIdr: 1,
          amountIdr: Number.MAX_SAFE_INTEGER,
        }),
        durationMinutes: 240,
      }),
      /total exceeds the safe integer IDR range/,
    );
  });

  it('preserves the safe integer boundary with a zero package amount', () => {
    const configuration = createAdditionalConfiguration({
      additionalAmountPerIncrementIdr: Number.MAX_SAFE_INTEGER,
      amountIdr: 0,
    });
    const result = calculateDurationPackagePrice(
      createCalculationInput({ configuration, durationMinutes: 240 }),
    );

    expect(result.totalAmountIdr).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('returns a frozen deterministic result without mutating input', () => {
    const configuration = createAdditionalConfiguration();
    const input = createCalculationInput({ configuration, durationMinutes: 240 });
    const firstResult = calculateDurationPackagePrice(input);
    const secondResult = calculateDurationPackagePrice(input);

    expect(firstResult).toEqual(secondResult);
    expect(Object.isFrozen(firstResult)).toBe(true);
    expect(configuration).toEqual(createAdditionalConfiguration());
    expect(input.configuration).toBe(configuration);
  });
});
