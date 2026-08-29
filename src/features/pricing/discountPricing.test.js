import { describe, expect, it } from 'vitest';

import {
  DISCOUNT_PERCENTAGE_BASIS_POINTS,
  DISCOUNT_TYPES,
  calculateDiscount,
} from './discountPricing.js';

function createFixedDiscount(overrides = {}) {
  return {
    configuration: { amountIdr: 50_000 },
    discountType: DISCOUNT_TYPES.FIXED,
    ...overrides,
  };
}

function createPercentageDiscount(overrides = {}) {
  return {
    configuration: { percentageBasisPoints: 1_000 },
    discountType: DISCOUNT_TYPES.PERCENTAGE,
    ...overrides,
  };
}

function calculate(discountableAmountIdr, discount) {
  return calculateDiscount({ discount, discountableAmountIdr });
}

describe('discount pricing calculation', () => {
  it('returns the original amount when no discount is selected', () => {
    expect(calculate(250_000, null)).toEqual({
      configuredAmountIdr: null,
      discountAmountIdr: 0,
      discountType: null,
      discountableAmountIdr: 250_000,
      finalAmountIdr: 250_000,
      percentageBasisPoints: null,
    });
  });

  it('subtracts a fixed discount exactly once', () => {
    expect(calculate(250_000, createFixedDiscount())).toEqual({
      configuredAmountIdr: 50_000,
      discountAmountIdr: 50_000,
      discountType: DISCOUNT_TYPES.FIXED,
      discountableAmountIdr: 250_000,
      finalAmountIdr: 200_000,
      percentageBasisPoints: null,
    });
  });

  it('allows a fixed discount equal to the discountable amount', () => {
    const result = calculate(
      250_000,
      createFixedDiscount({ configuration: { amountIdr: 250_000 } }),
    );

    expect(result.discountAmountIdr).toBe(250_000);
    expect(result.finalAmountIdr).toBe(0);
  });

  it('rejects a fixed discount that would make the final amount negative', () => {
    expect(() =>
      calculate(250_000, createFixedDiscount({ configuration: { amountIdr: 250_001 } })),
    ).toThrow(/must not exceed discountableAmountIdr/);
  });

  it('calculates percentage discounts from integer basis points', () => {
    expect(calculate(250_000, createPercentageDiscount())).toEqual({
      configuredAmountIdr: null,
      discountAmountIdr: 25_000,
      discountType: DISCOUNT_TYPES.PERCENTAGE,
      discountableAmountIdr: 250_000,
      finalAmountIdr: 225_000,
      percentageBasisPoints: 1_000,
    });
  });

  it('rounds fractional percentage discount IDR down deterministically', () => {
    const result = calculate(
      199_999,
      createPercentageDiscount({ configuration: { percentageBasisPoints: 1_250 } }),
    );

    expect(result.discountAmountIdr).toBe(24_999);
    expect(result.finalAmountIdr).toBe(175_000);
  });

  it('supports zero and one-hundred-percent percentage discounts', () => {
    const zeroResult = calculate(
      250_000,
      createPercentageDiscount({ configuration: { percentageBasisPoints: 0 } }),
    );
    const fullResult = calculate(
      250_000,
      createPercentageDiscount({
        configuration: { percentageBasisPoints: DISCOUNT_PERCENTAGE_BASIS_POINTS },
      }),
    );

    expect(zeroResult.discountAmountIdr).toBe(0);
    expect(zeroResult.finalAmountIdr).toBe(250_000);
    expect(fullResult.discountAmountIdr).toBe(250_000);
    expect(fullResult.finalAmountIdr).toBe(0);
  });

  it('calculates a full percentage discount at the maximum safe integer without overflow', () => {
    const result = calculate(
      Number.MAX_SAFE_INTEGER,
      createPercentageDiscount({
        configuration: { percentageBasisPoints: DISCOUNT_PERCENTAGE_BASIS_POINTS },
      }),
    );

    expect(result.discountAmountIdr).toBe(Number.MAX_SAFE_INTEGER);
    expect(result.finalAmountIdr).toBe(0);
  });

  it('rejects unsupported top-level, discount, and configuration shapes', () => {
    expect(() =>
      calculateDiscount({
        discount: null,
        discountableAmountIdr: 250_000,
        reason: 'promo',
      }),
    ).toThrow(/unsupported input shape/);
    expect(() =>
      calculate(250_000, {
        ...createFixedDiscount(),
        reason: 'promo',
      }),
    ).toThrow(/unsupported input shape/);
    expect(() =>
      calculate(
        250_000,
        createFixedDiscount({ configuration: { amountIdr: 50_000, label: 'promo' } }),
      ),
    ).toThrow(/unsupported input shape/);
  });

  it('rejects unsupported discount types', () => {
    expect(() =>
      calculate(250_000, {
        configuration: { amountIdr: 50_000 },
        discountType: 'coupon',
      }),
    ).toThrow(/discountType is not supported/);
  });

  it('rejects invalid discountable and fixed IDR amounts', () => {
    for (const amount of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity]) {
      expect(() => calculate(amount, null)).toThrow();
    }

    expect(() =>
      calculate(250_000, createFixedDiscount({ configuration: { amountIdr: -1 } })),
    ).toThrow(/must not be negative/);
    expect(() =>
      calculate(250_000, createFixedDiscount({ configuration: { amountIdr: 1.5 } })),
    ).toThrow(/safe integer IDR amount/);
  });

  it('rejects invalid percentage basis points', () => {
    for (const percentageBasisPoints of [-1, DISCOUNT_PERCENTAGE_BASIS_POINTS + 1]) {
      expect(() =>
        calculate(
          250_000,
          createPercentageDiscount({ configuration: { percentageBasisPoints } }),
        ),
      ).toThrow(/must be between 0 and 10000 basis points/);
    }

    for (const percentageBasisPoints of [1.5, NaN, Infinity]) {
      expect(() =>
        calculate(
          250_000,
          createPercentageDiscount({ configuration: { percentageBasisPoints } }),
        ),
      ).toThrow(/safe integer number of basis points/);
    }
  });

  it('supports zero discountable amount only when the discount cannot make it negative', () => {
    expect(calculate(0, null).finalAmountIdr).toBe(0);
    expect(calculate(0, createFixedDiscount({ configuration: { amountIdr: 0 } })).finalAmountIdr).toBe(
      0,
    );
    expect(
      calculate(
        0,
        createPercentageDiscount({ configuration: { percentageBasisPoints: 5_000 } }),
      ).finalAmountIdr,
    ).toBe(0);
    expect(() =>
      calculate(0, createFixedDiscount({ configuration: { amountIdr: 1 } })),
    ).toThrow(/must not exceed discountableAmountIdr/);
  });

  it('returns frozen deterministic output without mutating caller input', () => {
    const discount = createPercentageDiscount({
      configuration: { percentageBasisPoints: 1_250 },
    });
    const firstResult = calculate(199_999, discount);
    const secondResult = calculate(199_999, discount);

    expect(firstResult).toEqual(secondResult);
    expect(Object.isFrozen(firstResult)).toBe(true);
    expect(discount.configuration.percentageBasisPoints).toBe(1_250);
  });
});
