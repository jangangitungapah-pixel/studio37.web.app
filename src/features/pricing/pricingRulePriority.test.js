import { describe, expect, it } from 'vitest';

import {
  resolvePricingRulePriority,
  resolveStudioPricingScope,
} from './pricingRuleResolution.js';
import { PRICING_RULE_MODELS, PRICING_RULE_STATUSES } from './pricingRules.js';

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

describe('pricing rule deterministic priority resolution', () => {
  it('keeps only the highest numeric priority candidate', () => {
    const result = resolvePricingRulePriority({
      rules: [
        createRule({ id: 'low', priority: 1 }),
        createRule({ id: 'high', priority: 999 }),
        createRule({ id: 'middle', priority: 500 }),
      ],
    });

    expect(result.highestPriority).toBe(999);
    expect(result.rules.map(({ id }) => id)).toEqual(['high']);
  });

  it('produces the same winning candidate regardless of input order', () => {
    const firstResult = resolvePricingRulePriority({
      rules: [
        createRule({ id: 'low', priority: 10 }),
        createRule({ id: 'winner', priority: 20 }),
      ],
    });
    const secondResult = resolvePricingRulePriority({
      rules: [
        createRule({ id: 'winner', priority: 20 }),
        createRule({ id: 'low', priority: 10 }),
      ],
    });

    expect(firstResult.highestPriority).toBe(20);
    expect(firstResult.rules.map(({ id }) => id)).toEqual(['winner']);
    expect(secondResult).toEqual(firstResult);
  });

  it('preserves every equal-highest candidate for the later ambiguity gate', () => {
    const result = resolvePricingRulePriority({
      rules: [
        createRule({ id: 'rule-z', name: 'Zulu', priority: 500 }),
        createRule({ id: 'rule-low', priority: 100 }),
        createRule({ id: 'rule-a', name: 'Alpha', priority: 500 }),
      ],
    });

    expect(result.highestPriority).toBe(500);
    expect(result.rules.map(({ id }) => id)).toEqual(['rule-a', 'rule-z']);
  });

  it('uses rule ids only to stabilize equal-priority output order, never as a winner tie-break', () => {
    const firstResult = resolvePricingRulePriority({
      rules: [
        createRule({ id: 'rule-z', priority: 500 }),
        createRule({ id: 'rule-a', priority: 500 }),
      ],
    });
    const secondResult = resolvePricingRulePriority({
      rules: [
        createRule({ id: 'rule-a', priority: 500 }),
        createRule({ id: 'rule-z', priority: 500 }),
      ],
    });

    expect(firstResult.rules).toHaveLength(2);
    expect(firstResult.rules.map(({ id }) => id)).toEqual(['rule-a', 'rule-z']);
    expect(secondResult).toEqual(firstResult);
  });

  it('applies studio specificity before numeric priority when the resolvers are composed', () => {
    const studioScope = resolveStudioPricingScope({
      rules: [
        createRule({ id: 'general-high', priority: 999 }),
        createRule({ id: 'studio-low', priority: 1, studioId: 'studio-a' }),
      ],
      studioId: 'studio-a',
    });
    const result = resolvePricingRulePriority({ rules: studioScope.rules });

    expect(result.highestPriority).toBe(1);
    expect(result.rules.map(({ id }) => id)).toEqual(['studio-low']);
  });

  it('returns an explicit empty result when no candidate remains', () => {
    const result = resolvePricingRulePriority({ rules: [] });

    expect(result).toEqual({
      highestPriority: null,
      rules: [],
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.rules)).toBe(true);
  });

  it('returns frozen normalized candidates without mutating caller order', () => {
    const rules = [
      createRule({ id: 'low', priority: 10 }),
      createRule({ id: 'high', priority: 20 }),
    ];
    const result = resolvePricingRulePriority({ rules });

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.rules)).toBe(true);
    expect(Object.isFrozen(result.rules[0])).toBe(true);
    expect(rules.map(({ id }) => id)).toEqual(['low', 'high']);
  });
});

describe('pricing rule priority validation', () => {
  it('rejects unsupported input shapes and malformed rule documents', () => {
    expect(() => resolvePricingRulePriority({ rules: [], studioId: null })).toThrow(
      /unsupported input shape/,
    );
    expect(() =>
      resolvePricingRulePriority({ rules: [{ ...createRule(), unexpectedField: true }] }),
    ).toThrow(/unsupported document shape/);
  });

  it('fails closed for disabled or mixed-session candidate sets', () => {
    expect(() =>
      resolvePricingRulePriority({
        rules: [createRule({ status: PRICING_RULE_STATUSES.DISABLED })],
      }),
    ).toThrow(/must all be active/);
    expect(() =>
      resolvePricingRulePriority({
        rules: [createRule(), createRule({ id: 'other', sessionTypeId: 'session-rehearsal' })],
      }),
    ).toThrow(/one session type/);
  });

  it('fails closed when priority receives candidates from different studio scopes', () => {
    expect(() =>
      resolvePricingRulePriority({
        rules: [createRule(), createRule({ id: 'studio-a', studioId: 'studio-a' })],
      }),
    ).toThrow(/one studio scope/);
  });

  it('reuses canonical priority validation from the pricing rule document model', () => {
    for (const priority of [0, 1_000, 1.5, NaN, Infinity]) {
      expect(() => resolvePricingRulePriority({ rules: [createRule({ priority })] })).toThrow(
        /priority must be an integer between 1 and 999/,
      );
    }
  });
});
