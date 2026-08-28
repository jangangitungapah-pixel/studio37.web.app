import { describe, expect, it } from 'vitest';

import { calculateHourlyPrice } from './hourlyPricing.js';
import { PRICING_RULE_MODELS, PRICING_RULE_ROUNDING_MODES } from './pricingRules.js';

function createHourlyConfiguration(overrides = {}) {
  return {
    amountPerIncrementIdr: 120_000,
    incrementMinutes: 60,
    minimumDurationMinutes: 120,
    roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT,
    ...overrides,
  };
}

function createCalculationInput(overrides = {}) {
  return {
    configuration: createHourlyConfiguration(),
    durationMinutes: 120,
    pricingModel: PRICING_RULE_MODELS.HOURLY,
    ...overrides,
  };
}

describe('hourly pricing calculation', () => {
  it('calculates an exact aligned duration into a deterministic frozen breakdown', () => {
    const input = createCalculationInput();
    const result = calculateHourlyPrice(input);

    expect(result).toEqual({
      amountPerIncrementIdr: 120_000,
      billableDurationMinutes: 120,
      billedIncrementCount: 2,
      incrementMinutes: 60,
      inputDurationMinutes: 120,
      minimumDurationMinutes: 120,
      pricingModel: PRICING_RULE_MODELS.HOURLY,
      roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT,
      totalAmountIdr: 240_000,
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(input).toEqual(createCalculationInput());
  });

  it('rejects a partial increment in exact mode', () => {
    expect(() =>
      calculateHourlyPrice(
        createCalculationInput({
          configuration: createHourlyConfiguration({ minimumDurationMinutes: 90 }),
          durationMinutes: 90,
        }),
      ),
    ).toThrow(/align with the configured increment/);
  });

  it('rounds a partial increment up without changing the requested duration', () => {
    expect(
      calculateHourlyPrice(
        createCalculationInput({
          configuration: createHourlyConfiguration({
            minimumDurationMinutes: 90,
            roundingMode: PRICING_RULE_ROUNDING_MODES.ROUND_UP,
          }),
          durationMinutes: 90,
        }),
      ),
    ).toEqual({
      amountPerIncrementIdr: 120_000,
      billableDurationMinutes: 120,
      billedIncrementCount: 2,
      incrementMinutes: 60,
      inputDurationMinutes: 90,
      minimumDurationMinutes: 90,
      pricingModel: PRICING_RULE_MODELS.HOURLY,
      roundingMode: PRICING_RULE_ROUNDING_MODES.ROUND_UP,
      totalAmountIdr: 240_000,
    });
  });

  it('keeps an already aligned duration unchanged in round-up mode', () => {
    const result = calculateHourlyPrice(
      createCalculationInput({
        configuration: createHourlyConfiguration({
          roundingMode: PRICING_RULE_ROUNDING_MODES.ROUND_UP,
        }),
      }),
    );

    expect(result.billableDurationMinutes).toBe(120);
    expect(result.billedIncrementCount).toBe(2);
  });

  it.each([
    [121, 180, 3, 360_000],
    [179, 180, 3, 360_000],
    [180, 180, 3, 360_000],
    [181, 240, 4, 480_000],
  ])(
    'rounds %i requested minutes to %i billable minutes and %i increments',
    (durationMinutes, billableDurationMinutes, billedIncrementCount, totalAmountIdr) => {
      const result = calculateHourlyPrice(
        createCalculationInput({
          configuration: createHourlyConfiguration({
            roundingMode: PRICING_RULE_ROUNDING_MODES.ROUND_UP,
          }),
          durationMinutes,
        }),
      );

      expect(result).toMatchObject({
        billableDurationMinutes,
        billedIncrementCount,
        inputDurationMinutes: durationMinutes,
        totalAmountIdr,
      });
    },
  );

  it('does not invent a duration maximum or booking-granularity rule', () => {
    const result = calculateHourlyPrice(
      createCalculationInput({
        configuration: createHourlyConfiguration({
          incrementMinutes: 15,
          minimumDurationMinutes: 15,
          roundingMode: PRICING_RULE_ROUNDING_MODES.ROUND_UP,
        }),
        durationMinutes: 1_441,
      }),
    );

    expect(result.inputDurationMinutes).toBe(1_441);
    expect(result.billableDurationMinutes).toBe(1_455);
  });

  it('rejects a duration below the configured minimum before applying rounding', () => {
    expect(() =>
      calculateHourlyPrice(
        createCalculationInput({
          configuration: createHourlyConfiguration({
            roundingMode: PRICING_RULE_ROUNDING_MODES.ROUND_UP,
          }),
          durationMinutes: 90,
        }),
      ),
    ).toThrow(/minimum duration/);
  });

  it('rejects a non-hourly model and malformed calculation input', () => {
    expect(() =>
      calculateHourlyPrice(createCalculationInput({ pricingModel: 'fixed_session' })),
    ).toThrow(/pricingModel must be hourly/);
    expect(() => calculateHourlyPrice(null)).toThrow(/must be an object/);
    expect(() => calculateHourlyPrice({ ...createCalculationInput(), ruleId: 'rule-1' })).toThrow(
      /unsupported input shape/,
    );
    expect(() => calculateHourlyPrice(createCalculationInput({ durationMinutes: 90.5 }))).toThrow(
      /safe integer number of minutes/,
    );
    expect(() => calculateHourlyPrice(createCalculationInput({ durationMinutes: 0 }))).toThrow(
      /greater than zero/,
    );
  });

  it('reuses the canonical hourly configuration validation and rejects malformed fields', () => {
    expect(() =>
      calculateHourlyPrice(
        createCalculationInput({
          configuration: createHourlyConfiguration({ amountPerIncrementIdr: 120_000.5 }),
        }),
      ),
    ).toThrow(/safe integer IDR amount/);
    expect(() =>
      calculateHourlyPrice(
        createCalculationInput({
          configuration: { ...createHourlyConfiguration(), amountIdr: 120_000 },
        }),
      ),
    ).toThrow(/unsupported document shape/);
  });

  it('rejects unsafe derived durations and unsafe integer-IDR multiplication', () => {
    expect(() =>
      calculateHourlyPrice(
        createCalculationInput({
          configuration: createHourlyConfiguration({
            incrementMinutes: 15,
            minimumDurationMinutes: 15,
            roundingMode: PRICING_RULE_ROUNDING_MODES.ROUND_UP,
          }),
          durationMinutes: Number.MAX_SAFE_INTEGER,
        }),
      ),
    ).toThrow(/billable duration exceeds the safe integer minute range/);

    expect(() =>
      calculateHourlyPrice(
        createCalculationInput({
          configuration: createHourlyConfiguration({
            amountPerIncrementIdr: Number.MAX_SAFE_INTEGER,
            incrementMinutes: 15,
            minimumDurationMinutes: 15,
          }),
          durationMinutes: 30,
        }),
      ),
    ).toThrow(/safe integer IDR range/);
  });

  it('accepts the largest safe two-increment result and canonicalizes a zero-price configuration', () => {
    const largestSafeTwoIncrementAmount = Math.floor(Number.MAX_SAFE_INTEGER / 2);
    const boundaryResult = calculateHourlyPrice(
      createCalculationInput({
        configuration: createHourlyConfiguration({
          amountPerIncrementIdr: largestSafeTwoIncrementAmount,
          incrementMinutes: 15,
          minimumDurationMinutes: 15,
        }),
        durationMinutes: 30,
      }),
    );
    const freeResult = calculateHourlyPrice(
      createCalculationInput({
        configuration: createHourlyConfiguration({ amountPerIncrementIdr: -0 }),
      }),
    );

    expect(boundaryResult.totalAmountIdr).toBe(largestSafeTwoIncrementAmount * 2);
    expect(freeResult.amountPerIncrementIdr).toBe(0);
    expect(freeResult.totalAmountIdr).toBe(0);
  });
});
