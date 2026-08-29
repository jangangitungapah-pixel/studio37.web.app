import { describe, expect, it } from 'vitest';

import { calculateAddOnPrices } from './addOnPricing.js';
import { calculateBaseAdditionalPrice } from './baseAdditionalPricing.js';
import { calculateDiscount, DISCOUNT_TYPES } from './discountPricing.js';
import { calculateDurationPackagePrice } from './durationPackagePricing.js';
import { calculateFixedSessionPrice } from './fixedSessionPricing.js';
import { calculateHourlyPrice } from './hourlyPricing.js';
import {
  PRICING_CALCULATION_VERSION,
  PRICING_SNAPSHOT_VERSION,
  buildPricingSnapshot,
} from './pricingSnapshot.js';
import {
  PRICING_RULE_MODELS,
  PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES,
  PRICING_RULE_ROUNDING_MODES,
  PRICING_RULE_STATUSES,
} from './pricingRules.js';

const pricingTime = new Date('2026-08-29T12:00:00.000Z');

function createRule(overrides = {}) {
  return {
    configuration: { amountIdr: 500_000 },
    createdAt: new Date('2026-08-20T01:00:00.000Z'),
    createdByUid: 'owner-1',
    effectiveFrom: new Date('2026-08-25T00:00:00.000Z'),
    effectiveUntil: null,
    id: 'rule-fixed',
    name: 'Mixing fixed session',
    pricingModel: PRICING_RULE_MODELS.FIXED_SESSION,
    priority: 500,
    sessionTypeId: 'session-mixing',
    status: PRICING_RULE_STATUSES.ACTIVE,
    studioId: 'studio-a',
    updatedAt: new Date('2026-08-28T03:00:00.000Z'),
    updatedByUid: 'owner-1',
    ...overrides,
  };
}

function emptyAddOns() {
  return calculateAddOnPrices({ addOns: [] });
}

function noDiscount(amountIdr) {
  return calculateDiscount({ discount: null, discountableAmountIdr: amountIdr });
}

function buildFixedBase(amountIdr = 500_000) {
  return calculateFixedSessionPrice({
    configuration: { amountIdr },
    pricingModel: PRICING_RULE_MODELS.FIXED_SESSION,
  });
}

function buildSnapshotInput(overrides = {}) {
  const baseCalculation = buildFixedBase();

  return {
    addOnCalculation: emptyAddOns(),
    baseCalculation,
    discountCalculation: noDiscount(baseCalculation.totalAmountIdr),
    pricingRule: createRule(),
    pricingTime,
    ...overrides,
  };
}

describe('pricing snapshot builder', () => {
  it('reconciles base, add-ons, a partially discountable subtotal, and final total', () => {
    const baseCalculation = buildFixedBase();
    const addOnCalculation = calculateAddOnPrices({
      addOns: [
        {
          addOnId: 'extra-mic',
          configuration: { amountIdr: 50_000 },
          pricingType: 'fixed',
        },
        {
          addOnId: 'instrument-rental',
          configuration: { amountPerUnitIdr: 25_000 },
          pricingType: 'quantity',
          quantity: 2,
        },
      ],
    });
    const discountCalculation = calculateDiscount({
      discount: {
        configuration: { percentageBasisPoints: 1_000 },
        discountType: DISCOUNT_TYPES.PERCENTAGE,
      },
      discountableAmountIdr: 500_000,
    });
    const snapshot = buildPricingSnapshot({
      addOnCalculation,
      baseCalculation,
      discountCalculation,
      pricingRule: createRule(),
      pricingTime,
    });

    expect(snapshot.amounts).toEqual({
      addOnAmountIdr: 100_000,
      baseAmountIdr: 500_000,
      discountAmountIdr: 50_000,
      discountableAmountIdr: 500_000,
      finalAmountIdr: 550_000,
      nonDiscountableAmountIdr: 100_000,
      subtotalAmountIdr: 600_000,
    });
    expect(snapshot.pricingTimeIso).toBe('2026-08-29T12:00:00.000Z');
    expect(snapshot.snapshotVersion).toBe(PRICING_SNAPSHOT_VERSION);
    expect(snapshot.calculationVersion).toBe(PRICING_CALCULATION_VERSION);
  });

  it.each([
    {
      baseCalculation: calculateHourlyPrice({
        configuration: {
          amountPerIncrementIdr: 120_000,
          incrementMinutes: 60,
          minimumDurationMinutes: 60,
          roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT,
        },
        durationMinutes: 120,
        pricingModel: PRICING_RULE_MODELS.HOURLY,
      }),
      configuration: {
        amountPerIncrementIdr: 120_000,
        incrementMinutes: 60,
        minimumDurationMinutes: 60,
        roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT,
      },
      expectedTotal: 240_000,
      model: PRICING_RULE_MODELS.HOURLY,
    },
    {
      baseCalculation: calculateDurationPackagePrice({
        configuration: {
          additionalAmountPerIncrementIdr: null,
          additionalIncrementMinutes: null,
          amountIdr: 350_000,
          durationMinutes: 180,
          extraTimePolicy: PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.BLOCKED,
          roundingMode: null,
        },
        durationMinutes: 180,
        pricingModel: PRICING_RULE_MODELS.DURATION_PACKAGE,
      }),
      configuration: {
        additionalAmountPerIncrementIdr: null,
        additionalIncrementMinutes: null,
        amountIdr: 350_000,
        durationMinutes: 180,
        extraTimePolicy: PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.BLOCKED,
        roundingMode: null,
      },
      expectedTotal: 350_000,
      model: PRICING_RULE_MODELS.DURATION_PACKAGE,
    },
    {
      baseCalculation: calculateBaseAdditionalPrice({
        configuration: {
          additionalAmountPerIncrementIdr: 80_000,
          additionalIncrementMinutes: 60,
          baseAmountIdr: 200_000,
          baseDurationMinutes: 120,
          roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT,
        },
        durationMinutes: 180,
        pricingModel: PRICING_RULE_MODELS.BASE_PLUS_ADDITIONAL,
      }),
      configuration: {
        additionalAmountPerIncrementIdr: 80_000,
        additionalIncrementMinutes: 60,
        baseAmountIdr: 200_000,
        baseDurationMinutes: 120,
        roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT,
      },
      expectedTotal: 280_000,
      model: PRICING_RULE_MODELS.BASE_PLUS_ADDITIONAL,
    },
  ])('captures a canonical $model base calculation', ({
    baseCalculation,
    configuration,
    expectedTotal,
    model,
  }) => {
    const snapshot = buildPricingSnapshot({
      addOnCalculation: emptyAddOns(),
      baseCalculation,
      discountCalculation: noDiscount(baseCalculation.totalAmountIdr),
      pricingRule: createRule({
        configuration,
        id: `rule-${model}`,
        pricingModel: model,
      }),
      pricingTime,
    });

    expect(snapshot.rule.pricingModel).toBe(model);
    expect(snapshot.baseCalculation.pricingModel).toBe(model);
    expect(snapshot.amounts.finalAmountIdr).toBe(expectedTotal);
  });

  it('captures selected rule identity and source configuration metadata', () => {
    const snapshot = buildPricingSnapshot(buildSnapshotInput());

    expect(snapshot.rule).toEqual({
      configuration: { amountIdr: 500_000 },
      effectiveFromIso: '2026-08-25T00:00:00.000Z',
      effectiveUntilIso: null,
      id: 'rule-fixed',
      name: 'Mixing fixed session',
      pricingModel: PRICING_RULE_MODELS.FIXED_SESSION,
      priority: 500,
      sessionTypeId: 'session-mixing',
      sourceUpdatedAtIso: '2026-08-28T03:00:00.000Z',
      sourceUpdatedByUid: 'owner-1',
      studioId: 'studio-a',
    });
  });

  it('creates a deeply frozen detached historical record', () => {
    const pricingRule = createRule();
    const canonicalBase = buildFixedBase();
    const canonicalAddOns = calculateAddOnPrices({
      addOns: [
        {
          addOnId: 'extra-mic',
          configuration: { amountIdr: 50_000 },
          pricingType: 'fixed',
        },
      ],
    });
    const baseCalculation = { ...canonicalBase };
    const addOnCalculation = {
      items: canonicalAddOns.items.map((item) => ({ ...item })),
      totalAddOnAmountIdr: canonicalAddOns.totalAddOnAmountIdr,
    };
    const discountCalculation = {
      ...calculateDiscount({
        discount: null,
        discountableAmountIdr: 550_000,
      }),
    };
    const snapshot = buildPricingSnapshot({
      addOnCalculation,
      baseCalculation,
      discountCalculation,
      pricingRule,
      pricingTime,
    });

    pricingRule.name = 'Changed later';
    pricingRule.configuration.amountIdr = 999_999;
    baseCalculation.amountIdr = 1;
    addOnCalculation.items[0].unitAmountIdr = 1;
    discountCalculation.discountableAmountIdr = 1;

    expect(snapshot.rule.name).toBe('Mixing fixed session');
    expect(snapshot.rule.configuration.amountIdr).toBe(500_000);
    expect(snapshot.baseCalculation.amountIdr).toBe(500_000);
    expect(snapshot.addOnCalculation.items[0].unitAmountIdr).toBe(50_000);
    expect(snapshot.discountCalculation.discountableAmountIdr).toBe(550_000);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.rule)).toBe(true);
    expect(Object.isFrozen(snapshot.rule.configuration)).toBe(true);
    expect(Object.isFrozen(snapshot.baseCalculation)).toBe(true);
    expect(Object.isFrozen(snapshot.addOnCalculation)).toBe(true);
    expect(Object.isFrozen(snapshot.addOnCalculation.items)).toBe(true);
    expect(Object.isFrozen(snapshot.addOnCalculation.items[0])).toBe(true);
    expect(Object.isFrozen(snapshot.discountCalculation)).toBe(true);
    expect(Object.isFrozen(snapshot.amounts)).toBe(true);
  });

  it('is deterministic for identical historical inputs', () => {
    const first = buildPricingSnapshot(buildSnapshotInput());
    const second = buildPricingSnapshot(buildSnapshotInput());

    expect(second).toEqual(first);
  });

  it('rejects a mathematically valid base calculation from a different rule configuration', () => {
    expect(() =>
      buildPricingSnapshot(
        buildSnapshotInput({
          baseCalculation: buildFixedBase(600_000),
        }),
      ),
    ).toThrow(/canonical calculation result/);
  });

  it('rejects a tampered derived base total', () => {
    const baseCalculation = { ...buildFixedBase(), totalAmountIdr: 499_999 };

    expect(() => buildPricingSnapshot(buildSnapshotInput({ baseCalculation }))).toThrow(
      /canonical calculation result/,
    );
  });

  it('rejects a tampered add-on subtotal or item breakdown', () => {
    const canonical = calculateAddOnPrices({
      addOns: [
        {
          addOnId: 'extra-mic',
          configuration: { amountIdr: 50_000 },
          pricingType: 'fixed',
        },
      ],
    });
    const wrongTotal = {
      items: canonical.items.map((item) => ({ ...item })),
      totalAddOnAmountIdr: 49_999,
    };
    const wrongItem = {
      items: canonical.items.map((item) => ({ ...item, totalAmountIdr: 49_999 })),
      totalAddOnAmountIdr: canonical.totalAddOnAmountIdr,
    };

    expect(() => buildPricingSnapshot(buildSnapshotInput({ addOnCalculation: wrongTotal }))).toThrow(
      /totalAddOnAmountIdr/,
    );
    expect(() => buildPricingSnapshot(buildSnapshotInput({ addOnCalculation: wrongItem }))).toThrow(
      /canonical calculation result/,
    );
  });

  it('rejects a tampered discount breakdown', () => {
    const canonical = calculateDiscount({
      discount: {
        configuration: { amountIdr: 50_000 },
        discountType: DISCOUNT_TYPES.FIXED,
      },
      discountableAmountIdr: 500_000,
    });
    const discountCalculation = { ...canonical, discountAmountIdr: 49_999 };

    expect(() => buildPricingSnapshot(buildSnapshotInput({ discountCalculation }))).toThrow(
      /canonical calculation result/,
    );
  });

  it('rejects a valid discount calculation whose discountable base exceeds the subtotal', () => {
    const discountCalculation = noDiscount(600_000);

    expect(() => buildPricingSnapshot(buildSnapshotInput({ discountCalculation }))).toThrow(
      /must not exceed the base-plus-add-on subtotal/,
    );
  });

  it('rejects inactive and not-yet-effective pricing rules', () => {
    expect(() =>
      buildPricingSnapshot(
        buildSnapshotInput({
          pricingRule: createRule({ status: PRICING_RULE_STATUSES.DISABLED }),
        }),
      ),
    ).toThrow(/must be active/);

    expect(() =>
      buildPricingSnapshot(
        buildSnapshotInput({
          pricingRule: createRule({ effectiveFrom: new Date('2026-08-30T00:00:00.000Z') }),
        }),
      ),
    ).toThrow(/must be effective/);
  });

  it('treats effectiveUntil as an exclusive boundary', () => {
    expect(() =>
      buildPricingSnapshot(
        buildSnapshotInput({
          pricingRule: createRule({ effectiveUntil: new Date(pricingTime.getTime()) }),
        }),
      ),
    ).toThrow(/must be effective/);
  });

  it('rejects unsupported input shapes and invalid pricing times', () => {
    expect(() =>
      buildPricingSnapshot({
        ...buildSnapshotInput(),
        unexpected: true,
      }),
    ).toThrow(/unsupported input shape/);

    expect(() =>
      buildPricingSnapshot(
        buildSnapshotInput({
          pricingTime: '2026-08-29T12:00:00.000Z',
        }),
      ),
    ).toThrow(/must be a Date or Firestore Timestamp/);
  });
});
