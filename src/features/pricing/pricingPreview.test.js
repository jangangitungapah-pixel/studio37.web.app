import { describe, expect, it } from 'vitest';

import { ADD_ON_PRICING_TYPES } from './addOnPricing.js';
import { buildPricingPreview } from './pricingPreview.js';
import {
  PRICING_RULE_MODELS,
  PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES,
  PRICING_RULE_ROUNDING_MODES,
} from './pricingRules.js';

const FIXTURE_TIME = new Date('2026-09-02T02:00:00.000Z');

function createPricingRule(overrides = {}) {
  return {
    configuration: {
      amountPerIncrementIdr: 120_000,
      incrementMinutes: 60,
      minimumDurationMinutes: 60,
      roundingMode: PRICING_RULE_ROUNDING_MODES.ROUND_UP,
    },
    createdAt: FIXTURE_TIME,
    createdByUid: 'owner-1',
    effectiveFrom: null,
    effectiveUntil: null,
    id: 'rule-hourly',
    name: 'Rehearsal hourly',
    pricingModel: PRICING_RULE_MODELS.HOURLY,
    priority: 100,
    sessionTypeId: 'session-rehearsal',
    status: 'active',
    studioId: null,
    updatedAt: FIXTURE_TIME,
    updatedByUid: 'owner-1',
    ...overrides,
  };
}

function createAddOn(overrides = {}) {
  return {
    configuration: { amountIdr: 50_000 },
    createdAt: FIXTURE_TIME,
    createdByUid: 'owner-1',
    description: 'Extra microphone',
    displayOrder: 1,
    id: 'addon-mic',
    name: 'Extra microphone',
    pricingType: ADD_ON_PRICING_TYPES.FIXED,
    sessionTypeId: null,
    status: 'active',
    updatedAt: FIXTURE_TIME,
    updatedByUid: 'owner-1',
    ...overrides,
  };
}

function selection(addOn, overrides = {}) {
  return {
    addOn,
    durationMinutes: null,
    quantity: null,
    ...overrides,
  };
}

describe('buildPricingPreview', () => {
  it('uses the canonical hourly calculator including round-up billing', () => {
    const preview = buildPricingPreview({
      addOns: [],
      durationMinutes: 125,
      pricingRule: createPricingRule(),
    });

    expect(preview.baseCalculation).toMatchObject({
      billableDurationMinutes: 180,
      billedIncrementCount: 3,
      inputDurationMinutes: 125,
      totalAmountIdr: 360_000,
    });
    expect(preview.totalAmountIdr).toBe(360_000);
    expect(Object.isFrozen(preview)).toBe(true);
  });

  it('uses the canonical fixed-session calculator and keeps duration out of the input', () => {
    const pricingRule = createPricingRule({
      configuration: { amountIdr: 500_000 },
      id: 'rule-fixed',
      pricingModel: PRICING_RULE_MODELS.FIXED_SESSION,
    });

    expect(
      buildPricingPreview({ addOns: [], durationMinutes: null, pricingRule }).totalAmountIdr,
    ).toBe(500_000);
    expect(() => buildPricingPreview({ addOns: [], durationMinutes: 60, pricingRule })).toThrow(
      /must be null for fixed-session/i,
    );
  });

  it('uses the canonical duration-package calculator including configured additional time', () => {
    const preview = buildPricingPreview({
      addOns: [],
      durationMinutes: 240,
      pricingRule: createPricingRule({
        configuration: {
          additionalAmountPerIncrementIdr: 100_000,
          additionalIncrementMinutes: 60,
          amountIdr: 450_000,
          durationMinutes: 180,
          extraTimePolicy: PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.ADDITIONAL,
          roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT,
        },
        id: 'rule-package',
        pricingModel: PRICING_RULE_MODELS.DURATION_PACKAGE,
      }),
    });

    expect(preview.baseCalculation).toMatchObject({
      additionalAmountIdr: 100_000,
      packageAmountIdr: 450_000,
      totalAmountIdr: 550_000,
    });
    expect(preview.totalAmountIdr).toBe(550_000);
  });

  it('preserves the canonical blocked-package failure instead of inventing preview logic', () => {
    const pricingRule = createPricingRule({
      configuration: {
        additionalAmountPerIncrementIdr: null,
        additionalIncrementMinutes: null,
        amountIdr: 450_000,
        durationMinutes: 180,
        extraTimePolicy: PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.BLOCKED,
        roundingMode: null,
      },
      id: 'rule-package-blocked',
      pricingModel: PRICING_RULE_MODELS.DURATION_PACKAGE,
    });

    expect(() => buildPricingPreview({ addOns: [], durationMinutes: 240, pricingRule })).toThrow(
      /extra time is blocked by the configured package/i,
    );
  });

  it('preserves the canonical another-package failure instead of auto-resolving siblings', () => {
    const pricingRule = createPricingRule({
      configuration: {
        additionalAmountPerIncrementIdr: null,
        additionalIncrementMinutes: null,
        amountIdr: 450_000,
        durationMinutes: 180,
        extraTimePolicy: PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.ANOTHER_PACKAGE,
        roundingMode: null,
      },
      id: 'rule-package-another',
      pricingModel: PRICING_RULE_MODELS.DURATION_PACKAGE,
    });

    expect(() => buildPricingPreview({ addOns: [], durationMinutes: 240, pricingRule })).toThrow(
      /extra time requires another package/i,
    );
  });

  it('uses the canonical base-plus-additional calculator', () => {
    const preview = buildPricingPreview({
      addOns: [],
      durationMinutes: 180,
      pricingRule: createPricingRule({
        configuration: {
          additionalAmountPerIncrementIdr: 80_000,
          additionalIncrementMinutes: 60,
          baseAmountIdr: 200_000,
          baseDurationMinutes: 120,
          roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT,
        },
        id: 'rule-base-additional',
        pricingModel: PRICING_RULE_MODELS.BASE_PLUS_ADDITIONAL,
      }),
    });

    expect(preview.baseCalculation).toMatchObject({
      additionalAmountIdr: 80_000,
      baseAmountIdr: 200_000,
      totalAmountIdr: 280_000,
    });
    expect(preview.totalAmountIdr).toBe(280_000);
  });

  it('composes fixed, quantity, and time add-ons through the canonical add-on calculator', () => {
    const preview = buildPricingPreview({
      addOns: [
        selection(createAddOn()),
        selection(
          createAddOn({
            configuration: { amountPerUnitIdr: 25_000 },
            displayOrder: 2,
            id: 'addon-cable',
            name: 'Extra cable',
            pricingType: ADD_ON_PRICING_TYPES.QUANTITY,
            sessionTypeId: 'session-rehearsal',
          }),
          { quantity: 2 },
        ),
        selection(
          createAddOn({
            configuration: {
              amountPerIncrementIdr: 80_000,
              incrementMinutes: 30,
              roundingMode: PRICING_RULE_ROUNDING_MODES.ROUND_UP,
            },
            displayOrder: 3,
            id: 'addon-engineer',
            name: 'Engineer time',
            pricingType: ADD_ON_PRICING_TYPES.TIME,
          }),
          { durationMinutes: 45 },
        ),
      ],
      durationMinutes: 120,
      pricingRule: createPricingRule(),
    });

    expect(preview.baseCalculation.totalAmountIdr).toBe(240_000);
    expect(preview.addOnCalculation.totalAddOnAmountIdr).toBe(260_000);
    expect(preview.addOnCalculation.items).toEqual([
      expect.objectContaining({ addOnId: 'addon-mic', totalAmountIdr: 50_000 }),
      expect.objectContaining({ addOnId: 'addon-cable', quantity: 2, totalAmountIdr: 50_000 }),
      expect.objectContaining({
        addOnId: 'addon-engineer',
        billedDurationMinutes: 60,
        totalAmountIdr: 160_000,
      }),
    ]);
    expect(preview.totalAmountIdr).toBe(500_000);
  });

  it('rejects duplicate persisted add-ons through the canonical add-on calculator', () => {
    const addOn = createAddOn();

    expect(() =>
      buildPricingPreview({
        addOns: [selection(addOn), selection(addOn)],
        durationMinutes: 60,
        pricingRule: createPricingRule(),
      }),
    ).toThrow(/duplicate addOnId addon-mic/i);
  });

  it('allows disabled persisted configuration to be simulated without making it selectable for booking', () => {
    const preview = buildPricingPreview({
      addOns: [selection(createAddOn({ status: 'disabled' }))],
      durationMinutes: 60,
      pricingRule: createPricingRule({ status: 'disabled' }),
    });

    expect(preview.pricingRuleStatus).toBe('disabled');
    expect(preview.totalAmountIdr).toBe(170_000);
  });

  it('rejects add-ons scoped to a different session type', () => {
    expect(() =>
      buildPricingPreview({
        addOns: [
          selection(
            createAddOn({
              sessionTypeId: 'session-recording',
            }),
          ),
        ],
        durationMinutes: 60,
        pricingRule: createPricingRule(),
      }),
    ).toThrow(/not available for the selected pricing-rule session/i);
  });

  it('rejects transaction inputs that do not match the add-on pricing type', () => {
    expect(() =>
      buildPricingPreview({
        addOns: [selection(createAddOn(), { quantity: 2 })],
        durationMinutes: 60,
        pricingRule: createPricingRule(),
      }),
    ).toThrow(/fixed add-on transaction inputs must be null/i);

    expect(() =>
      buildPricingPreview({
        addOns: [
          selection(
            createAddOn({
              configuration: { amountPerUnitIdr: 25_000 },
              pricingType: ADD_ON_PRICING_TYPES.QUANTITY,
            }),
            { durationMinutes: 60, quantity: 2 },
          ),
        ],
        durationMinutes: 60,
        pricingRule: createPricingRule(),
      }),
    ).toThrow(/durationMinutes must be null for quantity add-ons/i);
  });
});
