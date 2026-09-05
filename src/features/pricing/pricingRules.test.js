import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';

import {
  comparePricingRules,
  decodePricingRuleDocument,
  encodePricingRuleDetails,
  normalizePricingRuleDetails,
  normalizePricingRuleStatus,
  PRICING_RULE_LIST_LIMIT,
  PRICING_RULE_MODELS,
  PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES,
  PRICING_RULE_ROUNDING_MODES,
} from './pricingRules.js';

function createHourlyConfiguration(overrides = {}) {
  return {
    amountPerIncrementIdr: 120_000,
    incrementMinutes: 60,
    minimumDurationMinutes: 120,
    roundingMode: PRICING_RULE_ROUNDING_MODES.ROUND_UP,
    ...overrides,
  };
}

function createDetails(overrides = {}) {
  return {
    configuration: createHourlyConfiguration(),
    effectiveFrom: null,
    effectiveUntil: null,
    name: 'Rehearsal hourly — general',
    pricingModel: PRICING_RULE_MODELS.HOURLY,
    priority: 100,
    sessionTypeId: 'session-rehearsal',
    studioId: null,
    ...overrides,
  };
}

function createDocument(overrides = {}) {
  return {
    ...createDetails(),
    createdAt: new Date('2026-08-25T01:00:00.000Z'),
    createdByUid: 'owner-1',
    id: 'rule-rehearsal-general',
    name: 'Rehearsal hourly — general',
    status: 'active',
    updatedAt: new Date('2026-08-25T02:00:00.000Z'),
    updatedByUid: 'owner-1',
    ...overrides,
  };
}

describe('pricing rule domain contract', () => {
  it('normalizes the hourly model with integer IDR and explicit rounding configuration', () => {
    expect(
      normalizePricingRuleDetails(
        createDetails({ name: '  Rehearsal hourly — general  ', studioId: 'studio-a' }),
      ),
    ).toEqual(createDetails({ studioId: 'studio-a' }));
    expect(PRICING_RULE_LIST_LIMIT).toBe(200);
  });

  it('keeps legacy hourly documents valid while accepting generic recurring discounts', () => {
    const recurring = normalizePricingRuleDetails(
      createDetails({
        configuration: createHourlyConfiguration({
          recurringDurationDiscount: {
            amountPerBlockIdr: 40_000,
            blockDurationMinutes: 180,
            enabled: true,
          },
        }),
      }),
    );

    expect(recurring.configuration.recurringDurationDiscount).toEqual({
      amountPerBlockIdr: 40_000,
      blockDurationMinutes: 180,
      enabled: true,
    });
    expect(normalizePricingRuleDetails(createDetails()).configuration).not.toHaveProperty(
      'recurringDurationDiscount',
    );
  });

  it('rejects malformed recurring discounts and block durations that do not align with the rate increment', () => {
    expect(() =>
      normalizePricingRuleDetails(
        createDetails({
          configuration: createHourlyConfiguration({
            recurringDurationDiscount: {
              amountPerBlockIdr: 40_000,
              blockDurationMinutes: 90,
              enabled: true,
            },
          }),
        }),
      ),
    ).toThrow(/must align with incrementMinutes/);
    expect(() =>
      normalizePricingRuleDetails(
        createDetails({
          configuration: createHourlyConfiguration({
            recurringDurationDiscount: {
              amountPerBlockIdr: 40_000,
              blockDurationMinutes: 180,
              enabled: 'yes',
            },
          }),
        }),
      ),
    ).toThrow(/enabled must be a boolean/);
    expect(() =>
      normalizePricingRuleDetails(
        createDetails({
          configuration: createHourlyConfiguration({
            recurringDurationDiscount: {
              amountPerBlockIdr: 40_000,
              blockDurationMinutes: 180,
              enabled: true,
              sessionCode: 'REHEARSAL',
            },
          }),
        }),
      ),
    ).toThrow(/unsupported document shape/);
  });

  it('supports fixed-session, duration-package, and base-plus-additional configurations', () => {
    const fixed = normalizePricingRuleDetails(
      createDetails({
        configuration: { amountIdr: 500_000 },
        pricingModel: PRICING_RULE_MODELS.FIXED_SESSION,
      }),
    );
    const blockedPackage = normalizePricingRuleDetails(
      createDetails({
        configuration: {
          additionalAmountPerIncrementIdr: null,
          additionalIncrementMinutes: null,
          amountIdr: 450_000,
          durationMinutes: 180,
          extraTimePolicy: PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.BLOCKED,
          roundingMode: null,
        },
        pricingModel: PRICING_RULE_MODELS.DURATION_PACKAGE,
      }),
    );
    const additionalPackage = normalizePricingRuleDetails(
      createDetails({
        configuration: {
          additionalAmountPerIncrementIdr: 100_000,
          additionalIncrementMinutes: 60,
          amountIdr: 450_000,
          durationMinutes: 180,
          extraTimePolicy: PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.ADDITIONAL,
          roundingMode: PRICING_RULE_ROUNDING_MODES.ROUND_UP,
        },
        pricingModel: PRICING_RULE_MODELS.DURATION_PACKAGE,
      }),
    );
    const tiered = normalizePricingRuleDetails(
      createDetails({
        configuration: {
          additionalAmountPerIncrementIdr: 80_000,
          additionalIncrementMinutes: 60,
          baseAmountIdr: 200_000,
          baseDurationMinutes: 120,
          roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT,
        },
        pricingModel: PRICING_RULE_MODELS.BASE_PLUS_ADDITIONAL,
      }),
    );

    expect(fixed.configuration).toEqual({ amountIdr: 500_000 });
    expect(blockedPackage.configuration.extraTimePolicy).toBe('blocked');
    expect(additionalPackage.configuration.additionalAmountPerIncrementIdr).toBe(100_000);
    expect(tiered.configuration.baseDurationMinutes).toBe(120);
  });

  it('normalizes optional effective bounds as cloned instants and encodes Firestore timestamps', () => {
    const effectiveFrom = new Date('2026-09-01T00:00:00.000Z');
    const effectiveUntil = new Date('2026-10-01T00:00:00.000Z');
    const normalized = normalizePricingRuleDetails(
      createDetails({ effectiveFrom, effectiveUntil }),
    );
    const encoded = encodePricingRuleDetails(normalized);

    expect(normalized.effectiveFrom).toEqual(effectiveFrom);
    expect(normalized.effectiveFrom).not.toBe(effectiveFrom);
    expect(normalized.effectiveUntil).not.toBe(effectiveUntil);
    expect(encoded.effectiveFrom).toEqual(Timestamp.fromDate(effectiveFrom));
    expect(encoded.effectiveUntil).toEqual(Timestamp.fromDate(effectiveUntil));
  });

  it('rejects invalid model fields, amounts, durations, references, and effective windows', () => {
    expect(() => normalizePricingRuleDetails(createDetails({ pricingModel: 'per_hour' }))).toThrow(
      /pricingModel/,
    );
    expect(() =>
      normalizePricingRuleDetails(
        createDetails({ configuration: createHourlyConfiguration({ amountPerIncrementIdr: 1.5 }) }),
      ),
    ).toThrow(/safe integer/);
    expect(() =>
      normalizePricingRuleDetails(
        createDetails({ configuration: createHourlyConfiguration({ incrementMinutes: 20 }) }),
      ),
    ).toThrow(/incrementMinutes/);
    expect(() => normalizePricingRuleDetails(createDetails({ priority: 0 }))).toThrow(/priority/);
    expect(() =>
      normalizePricingRuleDetails(createDetails({ sessionTypeId: 'sessionTypes/rehearsal' })),
    ).toThrow(/document id/);
    expect(() =>
      normalizePricingRuleDetails(
        createDetails({
          effectiveFrom: new Date('2026-10-01T00:00:00.000Z'),
          effectiveUntil: new Date('2026-10-01T00:00:00.000Z'),
        }),
      ),
    ).toThrow(/later than/);
  });

  it('rejects mismatched or extra configuration fields instead of silently coercing them', () => {
    expect(() =>
      normalizePricingRuleDetails(
        createDetails({ configuration: { ...createHourlyConfiguration(), amountIdr: 120_000 } }),
      ),
    ).toThrow(/unsupported document shape/);
    expect(() =>
      normalizePricingRuleDetails(
        createDetails({
          configuration: {
            additionalAmountPerIncrementIdr: 100_000,
            additionalIncrementMinutes: null,
            amountIdr: 450_000,
            durationMinutes: 180,
            extraTimePolicy: PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.BLOCKED,
            roundingMode: null,
          },
          pricingModel: PRICING_RULE_MODELS.DURATION_PACKAGE,
        }),
      ),
    ).toThrow(/additional policy/);
    expect(() => normalizePricingRuleDetails({ ...createDetails(), discount: null })).toThrow(
      /unsupported document shape/,
    );
  });

  it('decodes strict persisted metadata and fails closed for malformed documents', () => {
    const source = createDocument();
    const decoded = decodePricingRuleDocument(source);

    expect(decoded).toEqual(source);
    expect(decoded.createdAt).not.toBe(source.createdAt);
    expect(decoded.updatedAt).not.toBe(source.updatedAt);
    expect(() => decodePricingRuleDocument({ ...source, addOns: [] })).toThrow(
      /unsupported document shape/,
    );
    expect(() =>
      decodePricingRuleDocument(
        createDocument({ updatedAt: new Date('2026-08-24T23:00:00.000Z') }),
      ),
    ).toThrow(/earlier than createdAt/);
    expect(() => normalizePricingRuleStatus('archived')).toThrow(/status/);
  });

  it('sorts by descending priority, then name, then immutable id', () => {
    const rules = [
      createDocument({ id: 'rule-c', name: 'Studio B', priority: 100 }),
      createDocument({ id: 'rule-b', name: 'General', priority: 200 }),
      createDocument({ id: 'rule-a', name: 'General', priority: 200 }),
    ];

    expect([...rules].sort(comparePricingRules).map(({ id }) => id)).toEqual([
      'rule-a',
      'rule-b',
      'rule-c',
    ]);
  });
});
