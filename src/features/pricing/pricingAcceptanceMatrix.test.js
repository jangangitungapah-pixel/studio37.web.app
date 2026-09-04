import { describe, expect, it } from 'vitest';

import { USER_PROFILE_ROLES, USER_PROFILE_STATUSES } from '../auth/userProfile.js';
import { validatePricingConfiguration } from '../settings/pricingConfigurationValidation.js';
import { calculateAddOnPrices } from './addOnPricing.js';
import { calculateBaseAdditionalPrice } from './baseAdditionalPricing.js';
import { calculateDiscount, DISCOUNT_TYPES } from './discountPricing.js';
import { calculateDurationPackagePrice } from './durationPackagePricing.js';
import { calculateFixedSessionPrice } from './fixedSessionPricing.js';
import { calculateHourlyPrice } from './hourlyPricing.js';
import { applyAuthorizedManualPriceOverride } from './manualPriceOverride.js';
import {
  PricingRuleAmbiguityError,
  filterEligiblePricingRules,
  resolvePricingRulePriority,
  resolveStudioPricingScope,
  resolveUniquePricingRuleMatch,
} from './pricingRuleResolution.js';
import {
  PRICING_RULE_MODELS,
  PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES,
  PRICING_RULE_ROUNDING_MODES,
  PRICING_RULE_STATUSES,
} from './pricingRules.js';
import { buildPricingSnapshot } from './pricingSnapshot.js';

const pricingTime = new Date('2026-09-05T01:00:00.000Z');

function createRule(overrides = {}) {
  return {
    configuration: { amountIdr: 500_000 },
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    createdByUid: 'owner-1',
    effectiveFrom: null,
    effectiveUntil: null,
    id: 'rule-fixed',
    name: 'Canonical fixed rule',
    pricingModel: PRICING_RULE_MODELS.FIXED_SESSION,
    priority: 100,
    sessionTypeId: 'session-rehearsal',
    status: PRICING_RULE_STATUSES.ACTIVE,
    studioId: null,
    updatedAt: new Date('2026-09-04T00:00:00.000Z'),
    updatedByUid: 'owner-1',
    ...overrides,
  };
}

function createSessionType(overrides = {}) {
  return {
    id: 'session-rehearsal',
    name: 'Rehearsal',
    status: 'active',
    ...overrides,
  };
}

function createOwnerAccess() {
  return {
    capabilities: [],
    profile: {
      role: USER_PROFILE_ROLES.OWNER,
      status: USER_PROFILE_STATUSES.ACTIVE,
      uid: 'owner-1',
    },
    status: 'authenticated',
    user: { uid: 'owner-1' },
  };
}

function createFixedSnapshot(amountIdr = 500_000) {
  const pricingRule = createRule({ configuration: { amountIdr } });
  const baseCalculation = calculateFixedSessionPrice({
    configuration: pricingRule.configuration,
    pricingModel: PRICING_RULE_MODELS.FIXED_SESSION,
  });
  const addOnCalculation = calculateAddOnPrices({ addOns: [] });
  const discountCalculation = calculateDiscount({
    discount: null,
    discountableAmountIdr: baseCalculation.totalAmountIdr,
  });

  return {
    pricingRule,
    snapshot: buildPricingSnapshot({
      addOnCalculation,
      baseCalculation,
      discountCalculation,
      pricingRule,
      pricingTime,
    }),
  };
}

describe('PRD-17 pricing acceptance matrix', () => {
  it('prices an exact hourly duration', () => {
    const result = calculateHourlyPrice({
      configuration: {
        amountPerIncrementIdr: 120_000,
        incrementMinutes: 60,
        minimumDurationMinutes: 60,
        roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT,
      },
      durationMinutes: 120,
      pricingModel: PRICING_RULE_MODELS.HOURLY,
    });

    expect(result.totalAmountIdr).toBe(240_000);
    expect(result.billableDurationMinutes).toBe(120);
  });

  it('rounds a fractional hourly increment up deterministically', () => {
    const result = calculateHourlyPrice({
      configuration: {
        amountPerIncrementIdr: 120_000,
        incrementMinutes: 60,
        minimumDurationMinutes: 60,
        roundingMode: PRICING_RULE_ROUNDING_MODES.ROUND_UP,
      },
      durationMinutes: 90,
      pricingModel: PRICING_RULE_MODELS.HOURLY,
    });

    expect(result.billableDurationMinutes).toBe(120);
    expect(result.totalAmountIdr).toBe(240_000);
  });

  it('enforces the configured minimum duration before pricing', () => {
    expect(() =>
      calculateHourlyPrice({
        configuration: {
          amountPerIncrementIdr: 120_000,
          incrementMinutes: 60,
          minimumDurationMinutes: 120,
          roundingMode: PRICING_RULE_ROUNDING_MODES.ROUND_UP,
        },
        durationMinutes: 90,
        pricingModel: PRICING_RULE_MODELS.HOURLY,
      }),
    ).toThrow(/minimum duration/);
  });

  it.each([
    [180, 350_000],
    [360, 600_000],
  ])('prices the %i-minute duration package', (durationMinutes, amountIdr) => {
    const result = calculateDurationPackagePrice({
      configuration: {
        additionalAmountPerIncrementIdr: null,
        additionalIncrementMinutes: null,
        amountIdr,
        durationMinutes,
        extraTimePolicy: PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.BLOCKED,
        roundingMode: null,
      },
      durationMinutes,
      pricingModel: PRICING_RULE_MODELS.DURATION_PACKAGE,
    });

    expect(result.totalAmountIdr).toBe(amountIdr);
    expect(result.packageDurationMinutes).toBe(durationMinutes);
  });

  it('prices base plus additional time', () => {
    const result = calculateBaseAdditionalPrice({
      configuration: {
        additionalAmountPerIncrementIdr: 80_000,
        additionalIncrementMinutes: 60,
        baseAmountIdr: 200_000,
        baseDurationMinutes: 120,
        roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT,
      },
      durationMinutes: 180,
      pricingModel: PRICING_RULE_MODELS.BASE_PLUS_ADDITIONAL,
    });

    expect(result.totalAmountIdr).toBe(280_000);
  });

  it('prefers an exact-studio rule over a higher-priority general rule', () => {
    const eligible = filterEligiblePricingRules({
      pricingTime,
      rules: [
        createRule({ id: 'general-high', priority: 999 }),
        createRule({ id: 'studio-low', priority: 1, studioId: 'studio-a' }),
      ],
      sessionTypeId: 'session-rehearsal',
    });
    const studioScope = resolveStudioPricingScope({ rules: eligible.rules, studioId: 'studio-a' });
    const match = resolveUniquePricingRuleMatch(
      resolvePricingRulePriority({ rules: studioScope.rules }),
    );

    expect(match.rule.id).toBe('studio-low');
  });

  it('composes optional add-ons without mutating base pricing', () => {
    const result = calculateAddOnPrices({
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

    expect(result.totalAddOnAmountIdr).toBe(100_000);
  });

  it('applies a fixed discount', () => {
    const result = calculateDiscount({
      discount: {
        configuration: { amountIdr: 50_000 },
        discountType: DISCOUNT_TYPES.FIXED,
      },
      discountableAmountIdr: 500_000,
    });

    expect(result.discountAmountIdr).toBe(50_000);
    expect(result.finalAmountIdr).toBe(450_000);
  });

  it('applies a percentage discount using integer basis points', () => {
    const result = calculateDiscount({
      discount: {
        configuration: { percentageBasisPoints: 1_000 },
        discountType: DISCOUNT_TYPES.PERCENTAGE,
      },
      discountableAmountIdr: 500_000,
    });

    expect(result.discountAmountIdr).toBe(50_000);
    expect(result.finalAmountIdr).toBe(450_000);
  });

  it('applies an authorized manual price override while preserving the automatic baseline', () => {
    const { snapshot } = createFixedSnapshot();
    const result = applyAuthorizedManualPriceOverride({
      access: createOwnerAccess(),
      overrideAmountIdr: 450_000,
      overrideTime: new Date('2026-09-05T01:05:00.000Z'),
      pricingSnapshot: snapshot,
      reason: 'Acceptance matrix override',
    });

    expect(result.finalAmountIdr).toBe(450_000);
    expect(result.manualOverride.calculatedOriginalAmountIdr).toBe(500_000);
    expect(snapshot.amounts.finalAmountIdr).toBe(500_000);
  });

  it('rejects equal-highest ambiguous pricing rules', () => {
    const priority = resolvePricingRulePriority({
      rules: [
        createRule({ id: 'rule-a', priority: 500 }),
        createRule({ id: 'rule-b', priority: 500 }),
      ],
    });

    expect(() => resolveUniquePricingRuleMatch(priority)).toThrow(PricingRuleAmbiguityError);
  });

  it('excludes inactive rules before studio and priority resolution', () => {
    const eligible = filterEligiblePricingRules({
      pricingTime,
      rules: [
        createRule({ id: 'active' }),
        createRule({ id: 'inactive', status: PRICING_RULE_STATUSES.DISABLED }),
      ],
      sessionTypeId: 'session-rehearsal',
    });

    expect(eligible.rules.map(({ id }) => id)).toEqual(['active']);
  });

  it('keeps a historical pricing snapshot detached after source settings mutate', () => {
    const { pricingRule, snapshot } = createFixedSnapshot();

    pricingRule.name = 'Changed after booking';
    pricingRule.configuration.amountIdr = 999_999;
    pricingRule.priority = 999;

    expect(snapshot.rule.name).toBe('Canonical fixed rule');
    expect(snapshot.rule.configuration.amountIdr).toBe(500_000);
    expect(snapshot.rule.priority).toBe(100);
    expect(snapshot.amounts.finalAmountIdr).toBe(500_000);
  });

  it('blocks ambiguous active configuration through the final settings validator', () => {
    const validation = validatePricingConfiguration({
      pricingRules: [
        createRule({ id: 'config-a', priority: 500 }),
        createRule({ id: 'config-b', priority: 500 }),
      ],
      sessionTypes: [createSessionType()],
      studioReferencesAvailable: true,
      studioRooms: [],
    });

    expect(validation.blocking).toBe(true);
    expect(validation.errors.some((issue) => issue.code === 'ambiguous_rules')).toBe(true);
  });
});
