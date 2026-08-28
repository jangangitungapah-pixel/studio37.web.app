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

describe('duration-package pricing calculation', () => {
  it('returns the configured package amount for an exact blocked package duration', () => {
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

  it('returns the package amount for exact duration when another package is required only for overtime', () => {
    const result = calculateDurationPackagePrice(
      createCalculationInput({ configuration: createAnotherPackageConfiguration() }),
    );

    expect(result.totalAmountIdr).toBe(450_000);
    expect(result.extraTimePolicy).toBe(
      PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.ANOTHER_PACKAGE,
    );
  });

  it('keeps configured additional-time metadata with zero overtime on exact package duration', () => {
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

  it('rounds additional time up deterministically and adds the overtime amount', () => {
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

  it('prices aligned additional time exactly without inventing another increment', () => {
    const result = calculateDurationPackagePrice(
      createCalculationInput({
        configuration: createAdditionalConfiguration({
          roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT,
        }),
        durationMinutes: 240,
      }),
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

  it('rejects partial additional increments in exact mode', () => {
    expect(() =>
      calculateDurationPackagePrice(
        createCalculationInput({
          configuration: createAdditionalConfiguration({
            roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT,
          }),
          durationMinutes: 210,
        }),
      ),
    ).toThrow(/additional increment in exact mode/);
  });

  it('rejects overtime when the package blocks extra time', () => {
    expect(() =>
      calculateDurationPackagePrice(createCalculationInput({ durationMinutes: 181 })),
    ).toThrow(/extra time is blocked/);
  });

  it('rejects overtime that requires another package instead of silently choosing one', () => {
    expect(() =>
      calculateDurationPackagePrice(
        createCalculationInput({
          configuration: createAnotherPackageConfiguration(),
          durationMinutes: 240,
        }),
      ),
    ).toThrow(/requires another package/);
  });

  it('rejects a requested duration shorter than the selected package duration', () => {
    expect(() =>
      calculateDurationPackagePrice(createCalculationInput({ durationMinutes: 120 })),
    ).toThrow(/meet the configured package duration/);
  });

  it('rejects a non-package pricing model and unsupported top-level fields', () => {
    expect(() =>
      calculateDurationPackagePrice(
        createCalculationInput({ pricingModel: PRICING_RULE_MODELS.HOURLY }),
      ),
    ).toThrow(/must be duration_package/);

    expect(() =>
      calculateDurationPackagePrice({
        ...createCalculationInput(),
        packageId: 'package-3h',
      }),
    ).toThrow(/unsupported input shape/);
  });

  it.each([null, undefined, [], 'package', 450_000])(
    'rejects non-object calculation input: %j',
    (value) => {
      expect(() => calculateDurationPackagePrice(value)).toThrow(/must be an object/);
    },
  );

  it.each([null, undefined, [], 'config', 450_000])(
    'rejects non-object package configuration: %j',
    (configuration) => {
      expect(() =>
        calculateDurationPackagePrice(createCalculationInput({ configuration })),
      ).toThrow(/must be an object/);
    },
  );

  it('rejects missing, extra, and mismatched package configuration fields', () => {
    expect(() =>
      calculateDurationPackagePrice(createCalculationInput({ configuration: {} })),
    ).toThrow(/unsupported input shape/);

    expect(() =>
      calculateDurationPackagePrice(
        createCalculationInput({
          configuration: { ...createBlockedConfiguration(), discountIdr: 10_000 },
        }),
      ),
    ).toThrow(/unsupported input shape/);

    expect(() =>
      calculateDurationPackagePrice(
        createCalculationInput({
          configuration: createBlockedConfiguration({
            additionalAmountPerIncrementIdr: 100_000,
          }),
        }),
      ),
    ).toThrow(/additional policy/);
  });

  it('rejects unsupported policy and rounding values', () => {
    expect(() =>
      calculateDurationPackagePrice(
        createCalculationInput({
          configuration: createBlockedConfiguration({ extraTimePolicy: 'free' }),
        }),
      ),
    ).toThrow(/extraTimePolicy/);

    expect(() =>
      calculateDurationPackagePrice(
        createCalculationInput({
          configuration: createAdditionalConfiguration({ roundingMode: 'nearest' }),
        }),
      ),
    ).toThrow(/roundingMode/);
  });

  it('rejects invalid configured amounts and durations', () => {
    expect(() =>
      calculateDurationPackagePrice(
        createCalculationInput({
          configuration: createBlockedConfiguration({ amountIdr: -1 }),
        }),
      ),
    ).toThrow(/must not be negative/);

    expect(() =>
      calculateDurationPackagePrice(
        createCalculationInput({
          configuration: createAdditionalConfiguration({ additionalAmountPerIncrementIdr: 1.5 }),
        }),
      ),
    ).toThrow(/safe integer IDR amount/);

    expect(() =>
      calculateDurationPackagePrice(
        createCalculationInput({
          configuration: createBlockedConfiguration({ durationMinutes: 20 }),
        }),
      ),
    ).toThrow(/15-minute increment/);
  });

  it('rejects invalid requested duration values', () => {
    for (const durationMinutes of [0, -1]) {
      expect(() =>
        calculateDurationPackagePrice(createCalculationInput({ durationMinutes })),
      ).toThrow(/greater than zero/);
    }

    for (const durationMinutes of [1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity]) {
      expect(() =>
        calculateDurationPackagePrice(createCalculationInput({ durationMinutes })),
      ).toThrow(/safe integer number of minutes/);
    }
  });

  it('rejects unsafe overtime multiplication and unsafe package-plus-overtime totals', () => {
    expect(() =>
      calculateDurationPackagePrice(
        createCalculationInput({
          configuration: createAdditionalConfiguration({
            additionalAmountPerIncrementIdr: Number.MAX_SAFE_INTEGER,
          }),
          durationMinutes: 300,
        }),
      ),
    ).toThrow(/product exceeds the safe integer IDR range/);

    expect(() =>
      calculateDurationPackagePrice(
        createCalculationInput({
          configuration: createAdditionalConfiguration({
            additionalAmountPerIncrementIdr: 1,
            amountIdr: Number.MAX_SAFE_INTEGER,
          }),
          durationMinutes: 240,
        }),
      ),
    ).toThrow(/total exceeds the safe integer IDR range/);
  });

  it('preserves the safe integer boundary when the package amount is zero', () => {
    const result = calculateDurationPackagePrice(
      createCalculationInput({
        configuration: createAdditionalConfiguration({
          additionalAmountPerIncrementIdr: Number.MAX_SAFE_INTEGER,
          amountIdr: 0,
        }),
        durationMinutes: 240,
      }),
    );

    expect(result.totalAmountIdr).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('returns a frozen deterministic result without mutating its input', () => {
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
