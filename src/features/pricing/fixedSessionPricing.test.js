import { describe, expect, it } from 'vitest';

import { calculateFixedSessionPrice } from './fixedSessionPricing.js';
import { PRICING_RULE_MODELS } from './pricingRules.js';

function createCalculationInput(overrides = {}) {
  return {
    configuration: { amountIdr: 500_000 },
    pricingModel: PRICING_RULE_MODELS.FIXED_SESSION,
    ...overrides,
  };
}

describe('fixed-session pricing calculation', () => {
  it('returns the configured fixed amount as a deterministic frozen breakdown', () => {
    const input = createCalculationInput();
    const result = calculateFixedSessionPrice(input);

    expect(result).toEqual({
      amountIdr: 500_000,
      pricingModel: PRICING_RULE_MODELS.FIXED_SESSION,
      totalAmountIdr: 500_000,
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(input).toEqual(createCalculationInput());
  });

  it('allows a zero-price fixed session without inventing a positive minimum', () => {
    expect(
      calculateFixedSessionPrice(createCalculationInput({ configuration: { amountIdr: 0 } })),
    ).toEqual({
      amountIdr: 0,
      pricingModel: PRICING_RULE_MODELS.FIXED_SESSION,
      totalAmountIdr: 0,
    });
  });

  it('preserves the maximum safe integer IDR amount exactly', () => {
    const result = calculateFixedSessionPrice(
      createCalculationInput({ configuration: { amountIdr: Number.MAX_SAFE_INTEGER } }),
    );

    expect(result.totalAmountIdr).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('rejects a non-fixed pricing model', () => {
    expect(() =>
      calculateFixedSessionPrice(
        createCalculationInput({ pricingModel: PRICING_RULE_MODELS.HOURLY }),
      ),
    ).toThrow(/must be fixed_session/);
  });

  it.each([null, undefined, [], 'fixed', 500_000])(
    'rejects non-object calculation input: %j',
    (value) => {
      expect(() => calculateFixedSessionPrice(value)).toThrow(/must be an object/);
    },
  );

  it('rejects extra calculation fields so duration cannot silently affect a fixed session', () => {
    expect(() =>
      calculateFixedSessionPrice({
        ...createCalculationInput(),
        durationMinutes: 180,
      }),
    ).toThrow(/unsupported input shape/);
  });

  it.each([null, undefined, [], 'config', 500_000])(
    'rejects non-object configuration: %j',
    (configuration) => {
      expect(() => calculateFixedSessionPrice(createCalculationInput({ configuration }))).toThrow(
        /must be an object/,
      );
    },
  );

  it('rejects missing or extra configuration fields', () => {
    expect(() => calculateFixedSessionPrice(createCalculationInput({ configuration: {} }))).toThrow(
      /unsupported input shape/,
    );

    expect(() =>
      calculateFixedSessionPrice(
        createCalculationInput({
          configuration: { amountIdr: 500_000, durationMinutes: 180 },
        }),
      ),
    ).toThrow(/unsupported input shape/);
  });

  it.each([
    [-1, /must not be negative/],
    [1.5, /safe integer IDR amount/],
    [Number.MAX_SAFE_INTEGER + 1, /safe integer IDR amount/],
    [NaN, /safe integer IDR amount/],
    [Infinity, /safe integer IDR amount/],
    ['500000', /safe integer IDR amount/],
  ])('rejects invalid fixed amount %j', (amountIdr, expectedError) => {
    expect(() =>
      calculateFixedSessionPrice(createCalculationInput({ configuration: { amountIdr } })),
    ).toThrow(expectedError);
  });

  it('does not mutate the nested configuration object', () => {
    const configuration = { amountIdr: 750_000 };
    const input = createCalculationInput({ configuration });

    calculateFixedSessionPrice(input);

    expect(configuration).toEqual({ amountIdr: 750_000 });
    expect(input.configuration).toBe(configuration);
  });
});
