import { describe, expect, it } from 'vitest';

import { calculateBaseAdditionalPrice } from './baseAdditionalPricing.js';
import { PRICING_RULE_MODELS, PRICING_RULE_ROUNDING_MODES } from './pricingRules.js';

function createConfiguration(overrides = {}) {
  return {
    additionalAmountPerIncrementIdr: 80_000,
    additionalIncrementMinutes: 60,
    baseAmountIdr: 200_000,
    baseDurationMinutes: 120,
    roundingMode: PRICING_RULE_ROUNDING_MODES.ROUND_UP,
    ...overrides,
  };
}

function createCalculationInput(overrides = {}) {
  return {
    configuration: createConfiguration(),
    durationMinutes: 120,
    pricingModel: PRICING_RULE_MODELS.BASE_PLUS_ADDITIONAL,
    ...overrides,
  };
}

function expectCalculationError(input, matcher) {
  expect(() => calculateBaseAdditionalPrice(input)).toThrow(matcher);
}

describe('base-plus-additional pricing calculation', () => {
  it('returns only the base amount at the exact base duration', () => {
    expect(calculateBaseAdditionalPrice(createCalculationInput())).toEqual({
      additionalAmountIdr: 0,
      additionalAmountPerIncrementIdr: 80_000,
      additionalDurationMinutes: 0,
      additionalIncrementMinutes: 60,
      baseAmountIdr: 200_000,
      baseDurationMinutes: 120,
      billableDurationMinutes: 120,
      billedAdditionalDurationMinutes: 0,
      billedAdditionalIncrementCount: 0,
      inputDurationMinutes: 120,
      pricingModel: PRICING_RULE_MODELS.BASE_PLUS_ADDITIONAL,
      roundingMode: PRICING_RULE_ROUNDING_MODES.ROUND_UP,
      totalAmountIdr: 200_000,
    });
  });

  it('charges the base amount when requested duration is shorter than the base duration', () => {
    const result = calculateBaseAdditionalPrice(
      createCalculationInput({ durationMinutes: 60 }),
    );

    expect(result).toMatchObject({
      additionalAmountIdr: 0,
      additionalDurationMinutes: 0,
      billableDurationMinutes: 120,
      billedAdditionalIncrementCount: 0,
      inputDurationMinutes: 60,
      totalAmountIdr: 200_000,
    });
  });

  it('prices aligned additional time exactly', () => {
    const result = calculateBaseAdditionalPrice(
      createCalculationInput({
        configuration: createConfiguration({ roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT }),
        durationMinutes: 180,
      }),
    );

    expect(result).toMatchObject({
      additionalAmountIdr: 80_000,
      additionalDurationMinutes: 60,
      billableDurationMinutes: 180,
      billedAdditionalDurationMinutes: 60,
      billedAdditionalIncrementCount: 1,
      totalAmountIdr: 280_000,
    });
  });

  it('rounds partial additional time up deterministically', () => {
    const result = calculateBaseAdditionalPrice(
      createCalculationInput({ durationMinutes: 121 }),
    );

    expect(result).toMatchObject({
      additionalAmountIdr: 80_000,
      additionalDurationMinutes: 1,
      billableDurationMinutes: 180,
      billedAdditionalDurationMinutes: 60,
      billedAdditionalIncrementCount: 1,
      totalAmountIdr: 280_000,
    });
  });

  it('rejects partial additional time in exact mode', () => {
    expectCalculationError(
      createCalculationInput({
        configuration: createConfiguration({ roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT }),
        durationMinutes: 121,
      }),
      /configured increment in exact mode/,
    );
  });

  it('rejects the wrong pricing model and unsupported top-level fields', () => {
    expectCalculationError(
      createCalculationInput({ pricingModel: PRICING_RULE_MODELS.HOURLY }),
      /must be base_plus_additional/,
    );
    expectCalculationError(
      { ...createCalculationInput(), discountIdr: 10_000 },
      /unsupported input shape/,
    );
  });

  it('rejects non-object calculation inputs', () => {
    for (const value of [null, undefined, [], 'pricing', 200_000]) {
      expectCalculationError(value, /must be an object/);
    }
  });

  it('rejects non-object configurations', () => {
    for (const configuration of [null, undefined, [], 'config', 200_000]) {
      expectCalculationError(createCalculationInput({ configuration }), /must be an object/);
    }
  });

  it('rejects missing and extra configuration fields', () => {
    expectCalculationError(
      createCalculationInput({ configuration: {} }),
      /unsupported input shape/,
    );
    expectCalculationError(
      createCalculationInput({
        configuration: { ...createConfiguration(), packageId: 'package-3h' },
      }),
      /unsupported input shape/,
    );
  });

  it('rejects unsupported rounding modes', () => {
    expectCalculationError(
      createCalculationInput({
        configuration: createConfiguration({ roundingMode: 'nearest' }),
      }),
      /roundingMode/,
    );
  });

  it('rejects invalid configured amounts and durations', () => {
    expectCalculationError(
      createCalculationInput({
        configuration: createConfiguration({ baseAmountIdr: -1 }),
      }),
      /must not be negative/,
    );
    expectCalculationError(
      createCalculationInput({
        configuration: createConfiguration({ additionalAmountPerIncrementIdr: 1.5 }),
      }),
      /safe integer IDR amount/,
    );
    expectCalculationError(
      createCalculationInput({
        configuration: createConfiguration({ baseDurationMinutes: 20 }),
      }),
      /15-minute increment/,
    );
    expectCalculationError(
      createCalculationInput({
        configuration: createConfiguration({ additionalIncrementMinutes: 20 }),
      }),
      /15-minute increment/,
    );
  });

  it('rejects invalid requested duration values', () => {
    for (const durationMinutes of [0, -1]) {
      expectCalculationError(
        createCalculationInput({ durationMinutes }),
        /greater than zero/,
      );
    }

    for (const durationMinutes of [1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity]) {
      expectCalculationError(
        createCalculationInput({ durationMinutes }),
        /safe integer number of minutes/,
      );
    }
  });

  it('rejects unsafe additional multiplication and unsafe final totals', () => {
    expectCalculationError(
      createCalculationInput({
        configuration: createConfiguration({
          additionalAmountPerIncrementIdr: Number.MAX_SAFE_INTEGER,
        }),
        durationMinutes: 240,
      }),
      /product exceeds the safe integer IDR range/,
    );

    expectCalculationError(
      createCalculationInput({
        configuration: createConfiguration({
          additionalAmountPerIncrementIdr: 1,
          baseAmountIdr: Number.MAX_SAFE_INTEGER,
        }),
        durationMinutes: 180,
      }),
      /total exceeds the safe integer IDR range/,
    );
  });

  it('preserves the safe integer boundary when the base amount is zero', () => {
    const result = calculateBaseAdditionalPrice(
      createCalculationInput({
        configuration: createConfiguration({
          additionalAmountPerIncrementIdr: Number.MAX_SAFE_INTEGER,
          baseAmountIdr: 0,
        }),
        durationMinutes: 180,
      }),
    );

    expect(result.totalAmountIdr).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('supports a fully zero-priced configuration without inventing charges', () => {
    const result = calculateBaseAdditionalPrice(
      createCalculationInput({
        configuration: createConfiguration({
          additionalAmountPerIncrementIdr: 0,
          baseAmountIdr: 0,
        }),
        durationMinutes: 240,
      }),
    );

    expect(result.totalAmountIdr).toBe(0);
    expect(result.billedAdditionalIncrementCount).toBe(2);
  });

  it('returns a frozen deterministic result without mutating input', () => {
    const configuration = createConfiguration();
    const input = createCalculationInput({ configuration, durationMinutes: 180 });
    const firstResult = calculateBaseAdditionalPrice(input);
    const secondResult = calculateBaseAdditionalPrice(input);

    expect(firstResult).toEqual(secondResult);
    expect(Object.isFrozen(firstResult)).toBe(true);
    expect(configuration).toEqual(createConfiguration());
    expect(input.configuration).toBe(configuration);
  });
});
