import { describe, expect, it } from 'vitest';

import { PRICING_RULE_MODELS, PRICING_RULE_STATUSES } from '../pricing/pricingRules.js';
import { hasPricingRuleWriteCollision } from './pricingRuleCollision.js';

function createRule(overrides = {}) {
  return {
    configuration: { amountIdr: 500000 },
    id: 'rule-a',
    pricingModel: PRICING_RULE_MODELS.FIXED_SESSION,
    priority: 100,
    sessionTypeId: 'session-recording',
    status: PRICING_RULE_STATUSES.ACTIVE,
    studioId: null,
    ...overrides,
  };
}

function createPackageRule(durationMinutes, overrides = {}) {
  return createRule({
    configuration: {
      additionalAmountPerIncrementIdr: null,
      additionalIncrementMinutes: null,
      amountIdr: 450000,
      durationMinutes,
      extraTimePolicy: 'blocked',
      roundingMode: null,
    },
    pricingModel: PRICING_RULE_MODELS.DURATION_PACKAGE,
    ...overrides,
  });
}

describe('hasPricingRuleWriteCollision', () => {
  it('blocks an active non-package rule with the same session, studio scope, and priority', () => {
    const existing = createRule();
    const incoming = createRule({ id: undefined, name: 'new rule' });

    expect(hasPricingRuleWriteCollision([existing], incoming)).toBe(true);
  });

  it('allows distinct duration packages in the same resolution envelope', () => {
    const threeHours = createPackageRule(180);
    const sixHours = createPackageRule(360, { id: undefined });

    expect(hasPricingRuleWriteCollision([threeHours], sixHours)).toBe(false);
  });

  it('blocks duplicate duration packages in the same resolution envelope', () => {
    const first = createPackageRule(180);
    const duplicate = createPackageRule(180, { id: undefined });

    expect(hasPricingRuleWriteCollision([first], duplicate)).toBe(true);
  });

  it('ignores disabled, excluded, different-scope, and different-priority rules', () => {
    const incoming = createPackageRule(180, { id: undefined });
    const pricingRules = [
      createPackageRule(180, { status: PRICING_RULE_STATUSES.DISABLED }),
      createPackageRule(180, { id: 'editing-rule' }),
      createPackageRule(180, { id: 'studio-rule', studioId: 'studio-a' }),
      createPackageRule(180, { id: 'priority-rule', priority: 90 }),
    ];

    expect(
      hasPricingRuleWriteCollision(pricingRules, incoming, { excludeId: 'editing-rule' }),
    ).toBe(false);
  });

  it('rejects a malformed pricing-rule candidate container', () => {
    expect(() => hasPricingRuleWriteCollision(null, createRule())).toThrow(TypeError);
  });
});
