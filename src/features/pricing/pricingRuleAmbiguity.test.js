import { describe, expect, it } from 'vitest';

import {
  PricingRuleAmbiguityError,
  PRICING_RULE_MATCH_STATUSES,
  resolvePricingRulePriority,
  resolveStudioPricingScope,
  resolveUniquePricingRuleMatch,
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

function resolvePriority(rules) {
  return resolvePricingRulePriority({ rules });
}

describe('pricing rule unique-match resolution', () => {
  it('returns the single highest-priority candidate as the unique match', () => {
    const priorityResult = resolvePriority([
      createRule({ id: 'low', priority: 10 }),
      createRule({ id: 'winner', priority: 200 }),
      createRule({ id: 'middle', priority: 50 }),
    ]);
    const result = resolveUniquePricingRuleMatch(priorityResult);

    expect(result.highestPriority).toBe(200);
    expect(result.matchStatus).toBe(PRICING_RULE_MATCH_STATUSES.UNIQUE);
    expect(result.rule.id).toBe('winner');
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.rule)).toBe(true);
  });

  it('returns an explicit none result when no candidate remains', () => {
    const result = resolveUniquePricingRuleMatch(resolvePriority([]));

    expect(result).toEqual({
      highestPriority: null,
      matchStatus: PRICING_RULE_MATCH_STATUSES.NONE,
      rule: null,
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('does not treat lower-priority alternatives as ambiguity after priority resolution', () => {
    const priorityResult = resolvePriority([
      createRule({ id: 'winner', priority: 500 }),
      createRule({ id: 'lower-a', priority: 100 }),
      createRule({ id: 'lower-b', priority: 100 }),
    ]);

    expect(() => resolveUniquePricingRuleMatch(priorityResult)).not.toThrow();
    expect(resolveUniquePricingRuleMatch(priorityResult).rule.id).toBe('winner');
  });

  it('keeps studio specificity stronger than general-scope priority before the unique gate', () => {
    const studioScope = resolveStudioPricingScope({
      rules: [
        createRule({ id: 'general-high', priority: 999 }),
        createRule({ id: 'studio-low', priority: 1, studioId: 'studio-a' }),
      ],
      studioId: 'studio-a',
    });
    const result = resolveUniquePricingRuleMatch(resolvePriority(studioScope.rules));

    expect(result.highestPriority).toBe(1);
    expect(result.rule.id).toBe('studio-low');
  });
});

describe('pricing rule ambiguity rejection', () => {
  it('throws a typed configuration error when multiple highest-priority candidates remain', () => {
    const priorityResult = resolvePriority([
      createRule({ id: 'rule-z', priority: 500 }),
      createRule({ id: 'rule-low', priority: 100 }),
      createRule({ id: 'rule-a', priority: 500 }),
    ]);

    let error;
    try {
      resolveUniquePricingRuleMatch(priorityResult);
    } catch (caughtError) {
      error = caughtError;
    }

    expect(error).toBeInstanceOf(PricingRuleAmbiguityError);
    expect(error).toMatchObject({
      code: 'PRICING_RULE_AMBIGUITY',
      highestPriority: 500,
      name: 'PricingRuleAmbiguityError',
      ruleIds: ['rule-a', 'rule-z'],
    });
    expect(error.message).toMatch(/ambiguous at priority 500/);
    expect(Object.isFrozen(error.ruleIds)).toBe(true);
  });

  it('reports the same ambiguity regardless of caller input order', () => {
    const firstPriority = resolvePriority([
      createRule({ id: 'rule-z', priority: 500 }),
      createRule({ id: 'rule-a', priority: 500 }),
    ]);
    const secondPriority = resolvePriority([
      createRule({ id: 'rule-a', priority: 500 }),
      createRule({ id: 'rule-z', priority: 500 }),
    ]);

    const capture = (priorityResult) => {
      try {
        resolveUniquePricingRuleMatch(priorityResult);
      } catch (error) {
        return {
          code: error.code,
          highestPriority: error.highestPriority,
          ruleIds: error.ruleIds,
        };
      }

      throw new Error('Expected ambiguity error.');
    };

    expect(capture(secondPriority)).toEqual(capture(firstPriority));
  });

  it('rejects ambiguity inside the selected exact-studio scope without falling back to general', () => {
    const studioScope = resolveStudioPricingScope({
      rules: [
        createRule({ id: 'general', priority: 999 }),
        createRule({ id: 'studio-a-one', priority: 100, studioId: 'studio-a' }),
        createRule({ id: 'studio-a-two', priority: 100, studioId: 'studio-a' }),
      ],
      studioId: 'studio-a',
    });
    const priorityResult = resolvePriority(studioScope.rules);

    expect(() => resolveUniquePricingRuleMatch(priorityResult)).toThrow(PricingRuleAmbiguityError);
  });
});

describe('pricing rule unique-match validation', () => {
  it('rejects candidate sets that bypass or contradict priority resolution', () => {
    expect(() =>
      resolveUniquePricingRuleMatch({
        highestPriority: 200,
        rules: [
          createRule({ id: 'high', priority: 200 }),
          createRule({ id: 'low', priority: 100 }),
        ],
      }),
    ).toThrow(/must all equal highestPriority/);

    expect(() =>
      resolveUniquePricingRuleMatch({
        highestPriority: 999,
        rules: [createRule({ id: 'winner', priority: 200 })],
      }),
    ).toThrow(/must all equal highestPriority/);
  });

  it('requires null highestPriority for an empty candidate set', () => {
    expect(() => resolveUniquePricingRuleMatch({ highestPriority: 100, rules: [] })).toThrow(
      /must be null when no candidates remain/,
    );
  });

  it('rejects duplicate candidate ids as malformed pipeline input rather than ambiguity', () => {
    const duplicate = createRule({ id: 'same-rule', priority: 500 });

    expect(() =>
      resolveUniquePricingRuleMatch({
        highestPriority: 500,
        rules: [duplicate, { ...duplicate }],
      }),
    ).toThrow(/distinct rule ids/);
  });

  it('fails closed for disabled, mixed-session, and mixed-studio candidate sets', () => {
    expect(() =>
      resolveUniquePricingRuleMatch({
        highestPriority: 100,
        rules: [createRule({ status: PRICING_RULE_STATUSES.DISABLED })],
      }),
    ).toThrow(/must all be active/);

    expect(() =>
      resolveUniquePricingRuleMatch({
        highestPriority: 100,
        rules: [createRule(), createRule({ id: 'other', sessionTypeId: 'session-rehearsal' })],
      }),
    ).toThrow(/one session type/);

    expect(() =>
      resolveUniquePricingRuleMatch({
        highestPriority: 100,
        rules: [createRule(), createRule({ id: 'studio-a', studioId: 'studio-a' })],
      }),
    ).toThrow(/one studio scope/);
  });

  it('rejects unsupported input shapes, malformed documents, and invalid highest priority', () => {
    expect(() =>
      resolveUniquePricingRuleMatch({ highestPriority: null, rules: [], extra: true }),
    ).toThrow(/unsupported input shape/);
    expect(() =>
      resolveUniquePricingRuleMatch({
        highestPriority: 100,
        rules: [{ ...createRule(), unexpectedField: true }],
      }),
    ).toThrow(/unsupported document shape/);
    expect(() =>
      resolveUniquePricingRuleMatch({
        highestPriority: 1_000,
        rules: [createRule({ priority: 999 })],
      }),
    ).toThrow(/highestPriority must be an integer between 1 and 999/);
  });
});
