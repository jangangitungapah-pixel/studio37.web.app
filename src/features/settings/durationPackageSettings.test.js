import { describe, expect, it } from 'vitest';

import {
  PRICING_RULE_MODELS,
  PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES,
  PRICING_RULE_ROUNDING_MODES,
} from '../pricing/pricingRules.js';
import {
  formatDurationPackageExtraTime,
  groupDurationPackageRules,
  toDurationPackageFormValues,
  validateDurationPackageForm,
} from './durationPackageSettings.js';

function createPackageRule(durationMinutes, overrides = {}) {
  return {
    configuration: {
      additionalAmountPerIncrementIdr: null,
      additionalIncrementMinutes: null,
      amountIdr: durationMinutes === 180 ? 450000 : 800000,
      durationMinutes,
      extraTimePolicy: PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.BLOCKED,
      roundingMode: null,
    },
    effectiveFrom: null,
    effectiveUntil: null,
    id: `package-${durationMinutes}`,
    name: `${durationMinutes} minute package`,
    pricingModel: PRICING_RULE_MODELS.DURATION_PACKAGE,
    priority: 100,
    sessionTypeId: 'session-recording',
    status: 'active',
    studioId: null,
    ...overrides,
  };
}

function createForm(overrides = {}) {
  return {
    additionalAmountPerIncrementIdr: '',
    additionalIncrementMinutes: '60',
    amountIdr: '450000',
    durationMinutes: '180',
    extraTimePolicy: PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.BLOCKED,
    name: 'Recording 3 jam',
    roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT,
    sessionTypeId: 'session-recording',
    ...overrides,
  };
}

describe('durationPackageSettings', () => {
  it('builds a new general-scope package with the 5B3 default envelope', () => {
    const result = validateDurationPackageForm(createForm());

    expect(result.errors).toEqual({});
    expect(result.value).toEqual({
      configuration: {
        additionalAmountPerIncrementIdr: null,
        additionalIncrementMinutes: null,
        amountIdr: 450000,
        durationMinutes: 180,
        extraTimePolicy: PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.BLOCKED,
        roundingMode: null,
      },
      effectiveFrom: null,
      effectiveUntil: null,
      name: 'Recording 3 jam',
      pricingModel: PRICING_RULE_MODELS.DURATION_PACKAGE,
      priority: 100,
      sessionTypeId: 'session-recording',
      studioId: null,
    });
  });

  it('inherits session, studio, priority, and effective window from a package-set template', () => {
    const effectiveFrom = new Date('2026-09-01T00:00:00.000Z');
    const effectiveUntil = new Date('2026-10-01T00:00:00.000Z');
    const templateRule = createPackageRule(180, {
      effectiveFrom,
      effectiveUntil,
      priority: 220,
      studioId: 'studio-a',
    });
    const result = validateDurationPackageForm(createForm({ durationMinutes: '360' }), {
      templateRule,
    });

    expect(result.value).toEqual(
      expect.objectContaining({
        effectiveFrom,
        effectiveUntil,
        priority: 220,
        sessionTypeId: 'session-recording',
        studioId: 'studio-a',
      }),
    );
    expect(result.value.configuration.durationMinutes).toBe(360);
  });

  it('supports additional-time package configuration and round-up behavior', () => {
    const result = validateDurationPackageForm(
      createForm({
        additionalAmountPerIncrementIdr: '100000',
        additionalIncrementMinutes: '60',
        extraTimePolicy: PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.ADDITIONAL,
        roundingMode: PRICING_RULE_ROUNDING_MODES.ROUND_UP,
      }),
    );

    expect(result.value.configuration).toEqual({
      additionalAmountPerIncrementIdr: 100000,
      additionalIncrementMinutes: 60,
      amountIdr: 450000,
      durationMinutes: 180,
      extraTimePolicy: PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.ADDITIONAL,
      roundingMode: PRICING_RULE_ROUNDING_MODES.ROUND_UP,
    });
  });

  it('rejects malformed money, duration, policy, and session values without producing a write', () => {
    const result = validateDurationPackageForm(
      createForm({
        amountIdr: '-1',
        durationMinutes: '181',
        extraTimePolicy: 'mystery',
        sessionTypeId: 'bad/id',
      }),
    );

    expect(result.value).toBeNull();
    expect(result.errors).toEqual(
      expect.objectContaining({
        amountIdr: true,
        durationMinutes: true,
        extraTimePolicy: true,
        sessionTypeId: true,
      }),
    );
  });

  it('round-trips an existing package into form values', () => {
    const rule = createPackageRule(180, {
      configuration: {
        additionalAmountPerIncrementIdr: 90000,
        additionalIncrementMinutes: 30,
        amountIdr: 450000,
        durationMinutes: 180,
        extraTimePolicy: PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.ADDITIONAL,
        roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT,
      },
      name: 'Recording 3 jam',
    });

    expect(toDurationPackageFormValues(rule)).toEqual(
      expect.objectContaining({
        additionalAmountPerIncrementIdr: '90000',
        additionalIncrementMinutes: '30',
        amountIdr: '450000',
        durationMinutes: '180',
        name: 'Recording 3 jam',
        sessionTypeId: 'session-recording',
      }),
    );
  });

  it('groups packages by the full resolution envelope and sorts siblings by duration', () => {
    const groups = groupDurationPackageRules([
      createPackageRule(360),
      createPackageRule(180),
      createPackageRule(240, { id: 'studio-package', studioId: 'studio-a' }),
      { ...createPackageRule(120), id: 'fixed', pricingModel: PRICING_RULE_MODELS.FIXED_SESSION },
    ]);

    expect(groups).toHaveLength(2);
    const generalGroup = groups.find((group) => group.studioId === null);
    expect(generalGroup.rules.map((rule) => rule.configuration.durationMinutes)).toEqual([
      180, 360,
    ]);
    expect(Object.isFrozen(groups)).toBe(true);
    expect(Object.isFrozen(generalGroup.rules)).toBe(true);
  });

  it('formats blocked, another-package, and additional overtime policies', () => {
    const blocked = createPackageRule(180);
    const anotherPackage = createPackageRule(180, {
      configuration: {
        ...blocked.configuration,
        extraTimePolicy: PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.ANOTHER_PACKAGE,
      },
    });
    const additional = createPackageRule(180, {
      configuration: {
        additionalAmountPerIncrementIdr: 100000,
        additionalIncrementMinutes: 60,
        amountIdr: 450000,
        durationMinutes: 180,
        extraTimePolicy: PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.ADDITIONAL,
        roundingMode: PRICING_RULE_ROUNDING_MODES.ROUND_UP,
      },
    });

    expect(formatDurationPackageExtraTime(blocked)).toBe('Extra time diblokir');
    expect(formatDurationPackageExtraTime(anotherPackage)).toBe(
      'Extra time wajib pilih paket lain',
    );
    expect(formatDurationPackageExtraTime(additional)).toMatch(/100\.000/);
    expect(formatDurationPackageExtraTime(additional)).toMatch(/bulatkan ke atas/);
  });
});
