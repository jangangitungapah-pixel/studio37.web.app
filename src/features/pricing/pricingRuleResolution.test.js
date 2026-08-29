import { describe, expect, it } from 'vitest';

import {
  filterEligiblePricingRules,
  PRICING_RULE_STUDIO_MATCH_SCOPES,
  resolveStudioPricingScope,
} from './pricingRuleResolution.js';
import {
  PRICING_RULE_MODELS,
  PRICING_RULE_STATUSES,
} from './pricingRules.js';

function createRule(overrides = {}) {
  return {
    configuration: { amountIdr: 500_000 },
    createdAt: new Date('2026-08-25T01:00:00.000Z'),
    createdByUid: 'owner-1',
    effectiveFrom: null,
    effectiveUntil: null,
    id: 'rule-general',
    name: 'General fixed session',
    pricingModel: PRICING_RULE_MODELS.FIXED_SESSION,
    priority: 100,
    sessionTypeId: 'session-mixing',
    status: PRICING_RULE_STATUSES.ACTIVE,
    studioId: null,
    updatedAt: new Date('2026-08-25T02:00:00.000Z'),
    updatedByUid: 'owner-1',
    ...overrides,
  };
}

function createEligibilityInput(overrides = {}) {
  return {
    pricingTime: new Date('2026-09-01T10:00:00.000Z'),
    rules: [createRule()],
    sessionTypeId: 'session-mixing',
    ...overrides,
  };
}

describe('pricing rule eligibility filtering', () => {
  it('keeps only active rules for the exact session and effective pricing instant', () => {
    const pricingTime = new Date('2026-09-01T10:00:00.000Z');
    const result = filterEligiblePricingRules(
      createEligibilityInput({
        pricingTime,
        rules: [
          createRule({ id: 'general-unbounded' }),
          createRule({ effectiveFrom: pricingTime, id: 'starts-now' }),
          createRule({ effectiveUntil: pricingTime, id: 'ends-now' }),
          createRule({
            effectiveFrom: new Date('2026-09-01T10:00:00.001Z'),
            id: 'future',
          }),
          createRule({ id: 'disabled', status: PRICING_RULE_STATUSES.DISABLED }),
          createRule({ id: 'other-session', sessionTypeId: 'session-rehearsal' }),
        ],
      }),
    );

    expect(result.rules.map(({ id }) => id)).toEqual(['general-unbounded', 'starts-now']);
    expect(result.pricingTime).toEqual(pricingTime);
    expect(result.pricingTime).not.toBe(pricingTime);
  });

  it('treats effective windows as start-inclusive and end-exclusive', () => {
    const result = filterEligiblePricingRules(
      createEligibilityInput({
        pricingTime: new Date('2026-09-15T00:00:00.000Z'),
        rules: [
          createRule({
            effectiveFrom: new Date('2026-09-15T00:00:00.000Z'),
            effectiveUntil: new Date('2026-10-01T00:00:00.000Z'),
            id: 'inside-window',
          }),
          createRule({
            effectiveFrom: new Date('2026-08-01T00:00:00.000Z'),
            effectiveUntil: new Date('2026-09-15T00:00:00.000Z'),
            id: 'expired-at-boundary',
          }),
        ],
      }),
    );

    expect(result.rules.map(({ id }) => id)).toEqual(['inside-window']);
  });

  it('returns an empty frozen candidate set when no rule is eligible', () => {
    const result = filterEligiblePricingRules(
      createEligibilityInput({
        rules: [createRule({ status: PRICING_RULE_STATUSES.DISABLED })],
      }),
    );

    expect(result.rules).toEqual([]);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.rules)).toBe(true);
  });
});

describe('studio-specific pricing rule resolution', () => {
  it('prefers exact-studio candidates over general candidates regardless of priority', () => {
    const result = resolveStudioPricingScope({
      rules: [
        createRule({ id: 'general-high-priority', priority: 999 }),
        createRule({ id: 'studio-a-low-priority', priority: 1, studioId: 'studio-a' }),
      ],
      studioId: 'studio-a',
    });

    expect(result.matchScope).toBe(PRICING_RULE_STUDIO_MATCH_SCOPES.EXACT_STUDIO);
    expect(result.rules.map(({ id }) => id)).toEqual(['studio-a-low-priority']);
  });

  it('falls back to general scope when no exact-studio candidate remains', () => {
    const eligible = filterEligiblePricingRules(
      createEligibilityInput({
        rules: [
          createRule({ id: 'general' }),
          createRule({
            id: 'studio-a-disabled',
            status: PRICING_RULE_STATUSES.DISABLED,
            studioId: 'studio-a',
          }),
          createRule({ id: 'studio-b', studioId: 'studio-b' }),
        ],
      }),
    );
    const result = resolveStudioPricingScope({ rules: eligible.rules, studioId: 'studio-a' });

    expect(result.matchScope).toBe(PRICING_RULE_STUDIO_MATCH_SCOPES.GENERAL_STUDIO);
    expect(result.rules.map(({ id }) => id)).toEqual(['general']);
  });

  it('uses only general-scope rules when the requested studio is null', () => {
    const result = resolveStudioPricingScope({
      rules: [
        createRule({ id: 'general' }),
        createRule({ id: 'studio-a', studioId: 'studio-a' }),
      ],
      studioId: null,
    });

    expect(result.matchScope).toBe(PRICING_RULE_STUDIO_MATCH_SCOPES.GENERAL_STUDIO);
    expect(result.rules.map(({ id }) => id)).toEqual(['general']);
  });

  it('keeps every exact-studio candidate instead of prematurely selecting a winner', () => {
    const result = resolveStudioPricingScope({
      rules: [
        createRule({ id: 'studio-a-first', priority: 50, studioId: 'studio-a' }),
        createRule({ id: 'studio-a-second', priority: 50, studioId: 'studio-a' }),
        createRule({ id: 'general', priority: 999 }),
      ],
      studioId: 'studio-a',
    });

    expect(result.rules.map(({ id }) => id)).toEqual(['studio-a-first', 'studio-a-second']);
  });

  it('keeps every general candidate when general scope is the best available scope', () => {
    const result = resolveStudioPricingScope({
      rules: [
        createRule({ id: 'general-first', priority: 10 }),
        createRule({ id: 'general-second', priority: 20 }),
        createRule({ id: 'studio-b', studioId: 'studio-b' }),
      ],
      studioId: 'studio-a',
    });

    expect(result.matchScope).toBe(PRICING_RULE_STUDIO_MATCH_SCOPES.GENERAL_STUDIO);
    expect(result.rules.map(({ id }) => id)).toEqual(['general-first', 'general-second']);
  });

  it('returns an explicit none scope when neither exact nor general candidates exist', () => {
    const result = resolveStudioPricingScope({
      rules: [createRule({ id: 'studio-b', studioId: 'studio-b' })],
      studioId: 'studio-a',
    });

    expect(result).toMatchObject({
      matchScope: PRICING_RULE_STUDIO_MATCH_SCOPES.NONE,
      rules: [],
      studioId: 'studio-a',
    });
  });

  it('preserves candidate order and does not apply deterministic priority yet', () => {
    const rules = [
      createRule({ id: 'studio-a-low', priority: 1, studioId: 'studio-a' }),
      createRule({ id: 'studio-a-high', priority: 999, studioId: 'studio-a' }),
    ];
    const result = resolveStudioPricingScope({ rules, studioId: 'studio-a' });

    expect(result.rules.map(({ id }) => id)).toEqual(['studio-a-low', 'studio-a-high']);
    expect(rules.map(({ id }) => id)).toEqual(['studio-a-low', 'studio-a-high']);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.rules)).toBe(true);
  });
});

describe('pricing rule resolution validation', () => {
  it('rejects unsupported input shapes and malformed identifiers', () => {
    expect(() =>
      filterEligiblePricingRules({ ...createEligibilityInput(), studioId: 'studio-a' }),
    ).toThrow(/unsupported input shape/);
    expect(() =>
      filterEligiblePricingRules(createEligibilityInput({ sessionTypeId: 'sessionTypes/mixing' })),
    ).toThrow(/document id/);
    expect(() =>
      resolveStudioPricingScope({ rules: [createRule()], studioId: 'studios/a' }),
    ).toThrow(/document id/);
  });

  it('rejects non-array, oversized, and malformed rule collections', () => {
    expect(() =>
      filterEligiblePricingRules(createEligibilityInput({ rules: 'not-an-array' })),
    ).toThrow(/must be an array/);
    expect(() =>
      filterEligiblePricingRules(
        createEligibilityInput({
          rules: Array.from({ length: 201 }, (_, index) =>
            createRule({ id: `rule-${index}` }),
          ),
        }),
      ),
    ).toThrow(/at most 200 rules/);
    expect(() =>
      resolveStudioPricingScope({
        rules: [{ ...createRule(), unexpectedField: true }],
        studioId: null,
      }),
    ).toThrow(/unsupported document shape/);
  });

  it('fails closed when studio resolution receives disabled or mixed-session candidates', () => {
    expect(() =>
      resolveStudioPricingScope({
        rules: [createRule({ status: PRICING_RULE_STATUSES.DISABLED })],
        studioId: null,
      }),
    ).toThrow(/must all be active/);
    expect(() =>
      resolveStudioPricingScope({
        rules: [createRule(), createRule({ id: 'other', sessionTypeId: 'session-rehearsal' })],
        studioId: null,
      }),
    ).toThrow(/one session type/);
  });

  it('rejects invalid pricing instants', () => {
    expect(() =>
      filterEligiblePricingRules(createEligibilityInput({ pricingTime: new Date('invalid') })),
    ).toThrow();
  });
});
