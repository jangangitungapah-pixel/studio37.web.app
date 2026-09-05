import { describe, expect, it } from 'vitest';

import { calculateAddOnPrices } from './addOnPricing.js';
import { calculateDiscount } from './discountPricing.js';
import { calculateHourlyPrice } from './hourlyPricing.js';
import { buildPricingSnapshot } from './pricingSnapshot.js';
import {
  PRICING_RULE_MODELS,
  PRICING_RULE_ROUNDING_MODES,
  PRICING_RULE_STATUSES,
} from './pricingRules.js';

const pricingTime = new Date('2026-09-05T08:00:00.000Z');

function createConfiguration({ blockDurationMinutes = 180, amountPerBlockIdr = 40_000 } = {}) {
  return {
    amountPerIncrementIdr: 120_000,
    incrementMinutes: 60,
    minimumDurationMinutes: 60,
    recurringDurationDiscount: {
      amountPerBlockIdr,
      blockDurationMinutes,
      enabled: true,
    },
    roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT,
  };
}

function createRule(configuration, updatedAt) {
  return {
    configuration,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    createdByUid: 'owner-1',
    effectiveFrom: null,
    effectiveUntil: null,
    id: 'rehearsal-hourly',
    name: 'Rehearsal hourly',
    pricingModel: PRICING_RULE_MODELS.HOURLY,
    priority: 100,
    sessionTypeId: 'rehearsal',
    status: PRICING_RULE_STATUSES.ACTIVE,
    studioId: null,
    updatedAt,
    updatedByUid: 'owner-1',
  };
}

function buildSnapshot(configuration, updatedAt) {
  const baseCalculation = calculateHourlyPrice({
    configuration,
    durationMinutes: 360,
    pricingModel: PRICING_RULE_MODELS.HOURLY,
  });

  return buildPricingSnapshot({
    addOnCalculation: calculateAddOnPrices({ addOns: [] }),
    baseCalculation,
    discountCalculation: calculateDiscount({
      discount: null,
      discountableAmountIdr: baseCalculation.totalAmountIdr,
    }),
    pricingRule: createRule(configuration, updatedAt),
    pricingTime,
  });
}

describe('recurring discount pricing snapshots', () => {
  it('captures the recurring rule and exact discount breakdown used by the booking', () => {
    const snapshot = buildSnapshot(
      createConfiguration(),
      new Date('2026-09-05T07:00:00.000Z'),
    );

    expect(snapshot.baseCalculation).toMatchObject({
      baseAmountIdr: 720_000,
      discountAmountIdr: 80_000,
      recurringDiscountAmountPerBlockIdr: 40_000,
      recurringDiscountBlockCount: 2,
      recurringDiscountBlockDurationMinutes: 180,
      recurringDiscountEnabled: true,
      totalAmountIdr: 640_000,
    });
    expect(snapshot.rule.configuration.recurringDurationDiscount).toEqual({
      amountPerBlockIdr: 40_000,
      blockDurationMinutes: 180,
      enabled: true,
    });
    expect(snapshot.amounts.finalAmountIdr).toBe(640_000);
  });

  it('keeps an earlier snapshot unchanged after the Owner changes the rule to 4h/Rp20k', () => {
    const previousSnapshot = buildSnapshot(
      createConfiguration(),
      new Date('2026-09-05T07:00:00.000Z'),
    );
    const updatedSnapshot = buildSnapshot(
      createConfiguration({ blockDurationMinutes: 240, amountPerBlockIdr: 20_000 }),
      new Date('2026-09-05T07:30:00.000Z'),
    );

    expect(previousSnapshot.amounts.finalAmountIdr).toBe(640_000);
    expect(previousSnapshot.rule.configuration.recurringDurationDiscount).toEqual({
      amountPerBlockIdr: 40_000,
      blockDurationMinutes: 180,
      enabled: true,
    });

    expect(updatedSnapshot.amounts.finalAmountIdr).toBe(700_000);
    expect(updatedSnapshot.rule.configuration.recurringDurationDiscount).toEqual({
      amountPerBlockIdr: 20_000,
      blockDurationMinutes: 240,
      enabled: true,
    });
  });
});
