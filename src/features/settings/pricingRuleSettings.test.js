import { describe, expect, it } from 'vitest';

import {
  PRICING_RULE_MODELS,
  PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES,
  PRICING_RULE_ROUNDING_MODES,
} from '../pricing/pricingRules.js';
import {
  DEFAULT_PRICING_RULE_FORM_VALUES,
  formatPricingRuleConfigurationSummary,
  toPricingRuleFormValues,
  validatePricingRuleForm,
} from './pricingRuleSettings.js';

function createPersistedRule(overrides = {}) {
  return {
    configuration: { amountIdr: 500000 },
    createdAt: new Date('2026-08-24T01:00:00.000Z'),
    createdByUid: 'owner-1',
    effectiveFrom: null,
    effectiveUntil: null,
    id: 'pricing-rule-1',
    name: 'Mixing fixed',
    pricingModel: PRICING_RULE_MODELS.FIXED_SESSION,
    priority: 100,
    sessionTypeId: 'session-mixing',
    status: 'active',
    studioId: null,
    updatedAt: new Date('2026-08-24T02:00:00.000Z'),
    updatedByUid: 'owner-1',
    ...overrides,
  };
}

function validate(overrides = {}, options) {
  return validatePricingRuleForm(
    {
      ...DEFAULT_PRICING_RULE_FORM_VALUES,
      name: 'Rule utama',
      priority: '100',
      sessionTypeId: 'session-rehearsal',
      ...overrides,
    },
    options,
  );
}

describe('pricingRuleSettings form adapter', () => {
  it('builds a canonical general-scope fixed-session rule for creation', () => {
    const result = validate({
      amountIdr: '500000',
      pricingModel: PRICING_RULE_MODELS.FIXED_SESSION,
    });

    expect(result.errors).toEqual({});
    expect(result.value).toMatchObject({
      configuration: { amountIdr: 500000 },
      effectiveFrom: null,
      effectiveUntil: null,
      name: 'Rule utama',
      pricingModel: PRICING_RULE_MODELS.FIXED_SESSION,
      priority: 100,
      sessionTypeId: 'session-rehearsal',
      studioId: null,
    });
  });

  it('builds a canonical exact-studio rule from the form scope', () => {
    const result = validate({
      amountIdr: '500000',
      pricingModel: PRICING_RULE_MODELS.FIXED_SESSION,
      studioId: 'studio-a',
    });

    expect(result.errors).toEqual({});
    expect(result.value.studioId).toBe('studio-a');
  });

  it('supports canonical hourly configuration with a dormant recurring discount', () => {
    const result = validate({
      amountPerIncrementIdr: '120000',
      incrementMinutes: '60',
      minimumDurationMinutes: '120',
      pricingModel: PRICING_RULE_MODELS.HOURLY,
      recurringDiscountAmountPerBlockIdr: '40000',
      recurringDiscountBlockDurationMinutes: '180',
      recurringDiscountState: 'disabled',
      roundingMode: PRICING_RULE_ROUNDING_MODES.ROUND_UP,
    });

    expect(result.value.configuration).toEqual({
      amountPerIncrementIdr: 120000,
      incrementMinutes: 60,
      minimumDurationMinutes: 120,
      recurringDurationDiscount: {
        amountPerBlockIdr: 40000,
        blockDurationMinutes: 180,
        enabled: false,
      },
      roundingMode: PRICING_RULE_ROUNDING_MODES.ROUND_UP,
    });
  });

  it('lets Owner change recurring discount from 3h/Rp40k to 4h/Rp20k as data', () => {
    const result = validate({
      amountPerIncrementIdr: '120000',
      incrementMinutes: '60',
      minimumDurationMinutes: '60',
      pricingModel: PRICING_RULE_MODELS.HOURLY,
      recurringDiscountAmountPerBlockIdr: '20000',
      recurringDiscountBlockDurationMinutes: '240',
      recurringDiscountState: 'enabled',
      roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT,
    });

    expect(result.errors).toEqual({});
    expect(result.value.configuration.recurringDurationDiscount).toEqual({
      amountPerBlockIdr: 20000,
      blockDurationMinutes: 240,
      enabled: true,
    });
  });

  it('rejects recurring discount intervals that do not align with the hourly increment', () => {
    const result = validate({
      amountPerIncrementIdr: '120000',
      incrementMinutes: '60',
      minimumDurationMinutes: '60',
      pricingModel: PRICING_RULE_MODELS.HOURLY,
      recurringDiscountAmountPerBlockIdr: '40000',
      recurringDiscountBlockDurationMinutes: '90',
      recurringDiscountState: 'enabled',
    });

    expect(result.value).toBeNull();
    expect(result.errors.recurringDiscountBlockDurationMinutes).toBe(true);
  });

  it('supports duration-package additional-time configuration', () => {
    const result = validate({
      additionalAmountPerIncrementIdr: '100000',
      additionalIncrementMinutes: '60',
      amountIdr: '450000',
      durationMinutes: '180',
      extraTimePolicy: PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.ADDITIONAL,
      pricingModel: PRICING_RULE_MODELS.DURATION_PACKAGE,
      roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT,
    });

    expect(result.value.configuration).toEqual({
      additionalAmountPerIncrementIdr: 100000,
      additionalIncrementMinutes: 60,
      amountIdr: 450000,
      durationMinutes: 180,
      extraTimePolicy: PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.ADDITIONAL,
      roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT,
    });
  });

  it('nulls package additional-time fields when the policy does not use them', () => {
    const result = validate({
      additionalAmountPerIncrementIdr: '999999',
      additionalIncrementMinutes: '30',
      amountIdr: '450000',
      durationMinutes: '180',
      extraTimePolicy: PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.BLOCKED,
      pricingModel: PRICING_RULE_MODELS.DURATION_PACKAGE,
      roundingMode: PRICING_RULE_ROUNDING_MODES.ROUND_UP,
    });

    expect(result.value.configuration).toMatchObject({
      additionalAmountPerIncrementIdr: null,
      additionalIncrementMinutes: null,
      extraTimePolicy: PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.BLOCKED,
      roundingMode: null,
    });
  });

  it('supports base-plus-additional configuration', () => {
    const result = validate({
      additionalAmountPerIncrementIdr: '80000',
      additionalIncrementMinutes: '60',
      baseAmountIdr: '200000',
      baseDurationMinutes: '120',
      pricingModel: PRICING_RULE_MODELS.BASE_PLUS_ADDITIONAL,
      roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT,
    });

    expect(result.value.configuration).toEqual({
      additionalAmountPerIncrementIdr: 80000,
      additionalIncrementMinutes: 60,
      baseAmountIdr: 200000,
      baseDurationMinutes: 120,
      roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT,
    });
  });

  it('rejects malformed money, duration, priority, and missing model values before a write', () => {
    const result = validate({
      amountIdr: '-1',
      pricingModel: '',
      priority: '0',
    });

    expect(result.value).toBeNull();
    expect(result.errors).toMatchObject({ pricingModel: true, priority: true });
  });

  it('rejects durations outside the canonical 15-minute grid', () => {
    const result = validate({
      amountPerIncrementIdr: '120000',
      incrementMinutes: '50',
      minimumDurationMinutes: '60',
      pricingModel: PRICING_RULE_MODELS.HOURLY,
    });

    expect(result.value).toBeNull();
    expect(result.errors.incrementMinutes).toBe(true);
  });

  it('rejects malformed studio references before repository write', () => {
    const result = validate({
      amountIdr: '500000',
      pricingModel: PRICING_RULE_MODELS.FIXED_SESSION,
      studioId: 'bad/id',
    });

    expect(result.value).toBeNull();
    expect(result.errors.studioId).toBe(true);
  });

  it('allows studio scope edits while preserving hidden effective metadata', () => {
    const editingRule = createPersistedRule({
      effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
      effectiveUntil: new Date('2026-10-01T00:00:00.000Z'),
      studioId: 'studio-a',
    });
    const result = validate(
      {
        amountIdr: '550000',
        name: 'Mixing Studio B',
        pricingModel: PRICING_RULE_MODELS.FIXED_SESSION,
        studioId: 'studio-b',
      },
      { editingRule },
    );

    expect(result.value.studioId).toBe('studio-b');
    expect(result.value.effectiveFrom).toEqual(editingRule.effectiveFrom);
    expect(result.value.effectiveUntil).toEqual(editingRule.effectiveUntil);
  });

  it('round-trips existing studio scope and model configuration into editable strings', () => {
    expect(toPricingRuleFormValues(createPersistedRule({ studioId: 'studio-a' }))).toMatchObject({
      amountIdr: '500000',
      name: 'Mixing fixed',
      pricingModel: PRICING_RULE_MODELS.FIXED_SESSION,
      priority: '100',
      sessionTypeId: 'session-mixing',
      studioId: 'studio-a',
    });
  });

  it('round-trips existing recurring discount configuration into Owner-editable values', () => {
    const values = toPricingRuleFormValues(
      createPersistedRule({
        configuration: {
          amountPerIncrementIdr: 120000,
          incrementMinutes: 60,
          minimumDurationMinutes: 60,
          recurringDurationDiscount: {
            amountPerBlockIdr: 20000,
            blockDurationMinutes: 240,
            enabled: true,
          },
          roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT,
        },
        pricingModel: PRICING_RULE_MODELS.HOURLY,
      }),
    );

    expect(values).toMatchObject({
      recurringDiscountAmountPerBlockIdr: '20000',
      recurringDiscountBlockDurationMinutes: '240',
      recurringDiscountState: 'enabled',
    });
  });

  it('formats a human-readable rule summary without running a booking calculation', () => {
    const summary = formatPricingRuleConfigurationSummary(
      createPersistedRule({
        configuration: {
          amountPerIncrementIdr: 120000,
          incrementMinutes: 60,
          minimumDurationMinutes: 60,
          recurringDurationDiscount: {
            amountPerBlockIdr: 40000,
            blockDurationMinutes: 180,
            enabled: true,
          },
          roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT,
        },
        pricingModel: PRICING_RULE_MODELS.HOURLY,
      }),
    );

    expect(summary).toContain('120.000');
    expect(summary).toContain('60 mnt');
    expect(summary).toContain('harus pas');
    expect(summary).toContain('40.000');
    expect(summary).toContain('180 mnt');
  });
});
