import { describe, expect, it } from 'vitest';

import { ADD_ON_PRICING_TYPES, calculateAddOnPrices } from './addOnPricing.js';
import { PRICING_RULE_ROUNDING_MODES } from './pricingRules.js';

function createFixedAddOn(overrides = {}) {
  return {
    addOnId: 'addon-microphone',
    configuration: { amountIdr: 50_000 },
    pricingType: ADD_ON_PRICING_TYPES.FIXED,
    ...overrides,
  };
}

function createQuantityAddOn(overrides = {}) {
  return {
    addOnId: 'addon-instrument',
    configuration: { amountPerUnitIdr: 75_000 },
    pricingType: ADD_ON_PRICING_TYPES.QUANTITY,
    quantity: 2,
    ...overrides,
  };
}

function createTimeAddOn(overrides = {}) {
  return {
    addOnId: 'addon-engineer',
    configuration: {
      amountPerIncrementIdr: 100_000,
      incrementMinutes: 60,
      roundingMode: PRICING_RULE_ROUNDING_MODES.ROUND_UP,
    },
    durationMinutes: 60,
    pricingType: ADD_ON_PRICING_TYPES.TIME,
    ...overrides,
  };
}

function expectCalculationError(addOns, matcher) {
  expect(() => calculateAddOnPrices({ addOns })).toThrow(matcher);
}

describe('add-on pricing calculation', () => {
  it('returns a zero subtotal for no selected add-ons', () => {
    expect(calculateAddOnPrices({ addOns: [] })).toEqual({
      items: [],
      totalAddOnAmountIdr: 0,
    });
  });

  it('calculates a fixed add-on exactly once', () => {
    expect(calculateAddOnPrices({ addOns: [createFixedAddOn()] })).toEqual({
      items: [
        {
          addOnId: 'addon-microphone',
          billedDurationMinutes: null,
          billedIncrementCount: null,
          inputDurationMinutes: null,
          incrementMinutes: null,
          pricingType: ADD_ON_PRICING_TYPES.FIXED,
          quantity: 1,
          roundingMode: null,
          totalAmountIdr: 50_000,
          unitAmountIdr: 50_000,
        },
      ],
      totalAddOnAmountIdr: 50_000,
    });
  });

  it('multiplies quantity add-ons with checked integer-IDR arithmetic', () => {
    const result = calculateAddOnPrices({ addOns: [createQuantityAddOn()] });

    expect(result.items[0]).toMatchObject({
      addOnId: 'addon-instrument',
      pricingType: ADD_ON_PRICING_TYPES.QUANTITY,
      quantity: 2,
      totalAmountIdr: 150_000,
      unitAmountIdr: 75_000,
    });
    expect(result.totalAddOnAmountIdr).toBe(150_000);
  });

  it('calculates aligned time add-ons in exact mode', () => {
    const result = calculateAddOnPrices({
      addOns: [
        createTimeAddOn({
          configuration: {
            amountPerIncrementIdr: 100_000,
            incrementMinutes: 60,
            roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT,
          },
          durationMinutes: 120,
        }),
      ],
    });

    expect(result.items[0]).toMatchObject({
      billedDurationMinutes: 120,
      billedIncrementCount: 2,
      inputDurationMinutes: 120,
      totalAmountIdr: 200_000,
    });
  });

  it('rounds partial time add-ons up deterministically', () => {
    const result = calculateAddOnPrices({
      addOns: [createTimeAddOn({ durationMinutes: 61 })],
    });

    expect(result.items[0]).toMatchObject({
      billedDurationMinutes: 120,
      billedIncrementCount: 2,
      inputDurationMinutes: 61,
      totalAmountIdr: 200_000,
    });
  });

  it('sums mixed fixed, quantity, and time add-ons', () => {
    const result = calculateAddOnPrices({
      addOns: [createFixedAddOn(), createQuantityAddOn(), createTimeAddOn()],
    });

    expect(result.items.map(({ addOnId }) => addOnId)).toEqual([
      'addon-microphone',
      'addon-instrument',
      'addon-engineer',
    ]);
    expect(result.totalAddOnAmountIdr).toBe(300_000);
  });

  it('rejects duplicate add-on identifiers instead of silently double charging', () => {
    expectCalculationError(
      [createFixedAddOn(), createFixedAddOn()],
      /duplicate addOnId addon-microphone/,
    );
  });

  it('rejects unsupported top-level, item, and configuration shapes', () => {
    expect(() => calculateAddOnPrices({ addOns: [], discountIdr: 10_000 })).toThrow(
      /unsupported input shape/,
    );
    expectCalculationError(
      [{ ...createFixedAddOn(), quantity: 1 }],
      /unsupported input shape/,
    );
    expectCalculationError(
      [createQuantityAddOn({ configuration: { amountIdr: 75_000 } })],
      /unsupported input shape/,
    );
  });

  it('rejects unsupported pricing types and malformed identifiers', () => {
    expectCalculationError(
      [createFixedAddOn({ pricingType: 'percentage' })],
      /pricingType is not supported/,
    );
    expectCalculationError(
      [createFixedAddOn({ addOnId: 'addons/microphone' })],
      /opaque add-on identifier/,
    );
  });

  it('rejects invalid quantity values', () => {
    for (const quantity of [0, -1]) {
      expectCalculationError(
        [createQuantityAddOn({ quantity })],
        /quantity must be greater than zero/,
      );
    }

    for (const quantity of [1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity]) {
      expectCalculationError([createQuantityAddOn({ quantity })], /quantity must be a safe integer/);
    }
  });

  it('rejects invalid time configuration and duration values', () => {
    expectCalculationError(
      [createTimeAddOn({ durationMinutes: 0 })],
      /durationMinutes must be greater than zero/,
    );
    expectCalculationError(
      [createTimeAddOn({ durationMinutes: 1.5 })],
      /safe integer number of minutes/,
    );
    expectCalculationError(
      [
        createTimeAddOn({
          configuration: {
            amountPerIncrementIdr: 100_000,
            incrementMinutes: 20,
            roundingMode: PRICING_RULE_ROUNDING_MODES.ROUND_UP,
          },
        }),
      ],
      /15-minute increment/,
    );
    expectCalculationError(
      [
        createTimeAddOn({
          configuration: {
            amountPerIncrementIdr: 100_000,
            incrementMinutes: 60,
            roundingMode: 'nearest',
          },
        }),
      ],
      /roundingMode is not supported/,
    );
  });

  it('rejects partial time increments in exact mode', () => {
    expectCalculationError(
      [
        createTimeAddOn({
          configuration: {
            amountPerIncrementIdr: 100_000,
            incrementMinutes: 60,
            roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT,
          },
          durationMinutes: 61,
        }),
      ],
      /must align with the configured increment/,
    );
  });

  it('rejects unsafe multiplication and unsafe add-on subtotals', () => {
    expectCalculationError(
      [
        createQuantityAddOn({
          configuration: { amountPerUnitIdr: Number.MAX_SAFE_INTEGER },
          quantity: 2,
        }),
      ],
      /product exceeds the safe integer IDR range/,
    );
    expectCalculationError(
      [
        createFixedAddOn({ configuration: { amountIdr: Number.MAX_SAFE_INTEGER } }),
        createFixedAddOn({
          addOnId: 'addon-second',
          configuration: { amountIdr: 1 },
        }),
      ],
      /total exceeds the safe integer IDR range/,
    );
  });

  it('supports zero-priced add-ons without inventing a charge', () => {
    const result = calculateAddOnPrices({
      addOns: [
        createFixedAddOn({ configuration: { amountIdr: 0 } }),
        createQuantityAddOn({ configuration: { amountPerUnitIdr: 0 } }),
        createTimeAddOn({
          configuration: {
            amountPerIncrementIdr: 0,
            incrementMinutes: 60,
            roundingMode: PRICING_RULE_ROUNDING_MODES.ROUND_UP,
          },
          durationMinutes: 61,
        }),
      ],
    });

    expect(result.totalAddOnAmountIdr).toBe(0);
    expect(result.items[2].billedIncrementCount).toBe(2);
  });

  it('returns frozen deterministic output without mutating caller input', () => {
    const addOns = [createFixedAddOn(), createQuantityAddOn(), createTimeAddOn()];
    const firstResult = calculateAddOnPrices({ addOns });
    const secondResult = calculateAddOnPrices({ addOns });

    expect(firstResult).toEqual(secondResult);
    expect(Object.isFrozen(firstResult)).toBe(true);
    expect(Object.isFrozen(firstResult.items)).toBe(true);
    expect(firstResult.items.every((item) => Object.isFrozen(item))).toBe(true);
    expect(addOns[1].quantity).toBe(2);
    expect(addOns[2].durationMinutes).toBe(60);
  });
});
