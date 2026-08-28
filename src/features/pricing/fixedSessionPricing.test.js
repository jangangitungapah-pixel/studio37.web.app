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

function expectInvalidInput(value, expectedError) {
  expect(() => calculateFixedSessionPrice(value)).toThrow(expectedError);
}

function expectInvalidConfiguration(configuration, expectedError) {
  const input = createCalculationInput({ configuration });
  expect(() => calculateFixedSessionPrice(input)).toThrow(expectedError);
}

describe('fixed-session pricing calculation', () => {
  it('returns the configured amount as a deterministic frozen breakdown', () => {
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

  it('allows a zero-price fixed session', () => {
    const input = createCalculationInput({ configuration: { amountIdr: 0 } });
    const result = calculateFixedSessionPrice(input);

    expect(result).toEqual({
      amountIdr: 0,
      pricingModel: PRICING_RULE_MODELS.FIXED_SESSION,
      totalAmountIdr: 0,
    });
  });

  it('preserves the maximum safe integer amount exactly', () => {
    const configuration = { amountIdr: Number.MAX_SAFE_INTEGER };
    const input = createCalculationInput({ configuration });
    const result = calculateFixedSessionPrice(input);

    expect(result.totalAmountIdr).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('rejects a non-fixed pricing model', () => {
    const input = createCalculationInput({ pricingModel: PRICING_RULE_MODELS.HOURLY });

    expectInvalidInput(input, /must be fixed_session/);
  });

  it('rejects non-object calculation input', () => {
    expectInvalidInput(null, /must be an object/);
    expectInvalidInput(undefined, /must be an object/);
    expectInvalidInput([], /must be an object/);
    expectInvalidInput('fixed', /must be an object/);
    expectInvalidInput(500_000, /must be an object/);
  });

  it('rejects extra calculation fields', () => {
    const input = {
      ...createCalculationInput(),
      durationMinutes: 180,
    };

    expectInvalidInput(input, /unsupported input shape/);
  });

  it('rejects non-object configuration', () => {
    expectInvalidConfiguration(null, /must be an object/);
    expectInvalidConfiguration(undefined, /must be an object/);
    expectInvalidConfiguration([], /must be an object/);
    expectInvalidConfiguration('config', /must be an object/);
    expectInvalidConfiguration(500_000, /must be an object/);
  });

  it('rejects missing or extra configuration fields', () => {
    expectInvalidConfiguration({}, /unsupported input shape/);

    const configuration = {
      amountIdr: 500_000,
      durationMinutes: 180,
    };
    expectInvalidConfiguration(configuration, /unsupported input shape/);
  });

  it('rejects invalid fixed amounts', () => {
    expectInvalidConfiguration({ amountIdr: -1 }, /must not be negative/);
    expectInvalidConfiguration({ amountIdr: 1.5 }, /safe integer IDR amount/);
    expectInvalidConfiguration(
      { amountIdr: Number.MAX_SAFE_INTEGER + 1 },
      /safe integer IDR amount/,
    );
    expectInvalidConfiguration({ amountIdr: NaN }, /safe integer IDR amount/);
    expectInvalidConfiguration({ amountIdr: Infinity }, /safe integer IDR amount/);
    expectInvalidConfiguration({ amountIdr: '500000' }, /safe integer IDR amount/);
  });

  it('does not mutate the nested configuration object', () => {
    const configuration = { amountIdr: 750_000 };
    const input = createCalculationInput({ configuration });

    calculateFixedSessionPrice(input);

    expect(configuration).toEqual({ amountIdr: 750_000 });
    expect(input.configuration).toBe(configuration);
  });
});
