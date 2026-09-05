import { describe, expect, it } from 'vitest';

import { OPERATOR_TYPES } from '../settings/operators.js';
import {
  COMPENSATION_PERCENTAGE_BASES,
  COMPENSATION_RULE_MODELS,
  COMPENSATION_RULE_STATUSES,
} from './compensationRules.js';
import {
  calculateCompensationAmount,
  CompensationRuleAmbiguityError,
  getCompensationRuleSpecificity,
  resolveAndCalculateCompensation,
  resolveCompensationRule,
} from './compensationEngine.js';

function makeContext(overrides = {}) {
  return {
    durationMinutes: 120,
    effectiveAt: new Date('2026-09-06T10:00:00.000Z'),
    operatorId: 'operator-1',
    operatorType: OPERATOR_TYPES.STUDIO_OPERATOR,
    percentageBaseAmounts: {},
    sessionTypeId: 'rehearsal',
    studioId: 'studio-a',
    ...overrides,
  };
}

function makeRule(overrides = {}) {
  return {
    compensationModel: COMPENSATION_RULE_MODELS.PER_SESSION,
    configuration: { amountIdr: 50000 },
    effectiveFrom: null,
    effectiveUntil: null,
    id: 'rule-default',
    name: 'Default rule',
    operatorId: null,
    operatorType: OPERATOR_TYPES.STUDIO_OPERATOR,
    priority: 100,
    sessionTypeId: null,
    status: COMPENSATION_RULE_STATUSES.ACTIVE,
    studioId: null,
    ...overrides,
  };
}

describe('compensation rule resolver', () => {
  it('matches active rules by operator type, exact scopes, and effective window', () => {
    const rules = [
      makeRule({ id: 'disabled', status: COMPENSATION_RULE_STATUSES.DISABLED }),
      makeRule({
        effectiveUntil: new Date('2026-09-06T10:00:00.000Z'),
        id: 'expired-at-boundary',
        priority: 900,
      }),
      makeRule({ id: 'wrong-operator', operatorId: 'operator-2', priority: 800 }),
      makeRule({ id: 'generic', priority: 100 }),
      makeRule({
        id: 'exact',
        operatorId: 'operator-1',
        priority: 10,
        sessionTypeId: 'rehearsal',
        studioId: 'studio-a',
      }),
    ];

    expect(resolveCompensationRule(rules, makeContext())?.id).toBe('exact');
  });

  it('prefers scope specificity before numeric priority', () => {
    const rules = [
      makeRule({ id: 'generic-high-priority', priority: 999 }),
      makeRule({ id: 'operator-specific', operatorId: 'operator-1', priority: 1 }),
    ];

    expect(resolveCompensationRule(rules, makeContext())?.id).toBe('operator-specific');
  });

  it('counts package duration as an explicit scope dimension', () => {
    const packageRule = makeRule({
      compensationModel: COMPENSATION_RULE_MODELS.PACKAGE,
      configuration: { amountIdr: 80000, durationMinutes: 120 },
      id: 'package',
    });

    expect(getCompensationRuleSpecificity(makeRule())).toBe(0);
    expect(getCompensationRuleSpecificity(packageRule)).toBe(1);
    expect(resolveCompensationRule([makeRule({ id: 'generic', priority: 999 }), packageRule], makeContext())?.id).toBe(
      'package',
    );
  });

  it('rejects equal-winning rules instead of falling back to name, id, or query order', () => {
    const rules = [
      makeRule({ id: 'operator-rule', operatorId: 'operator-1', priority: 500 }),
      makeRule({ id: 'session-rule', priority: 500, sessionTypeId: 'rehearsal' }),
    ];

    expect(() => resolveCompensationRule(rules, makeContext())).toThrow(
      CompensationRuleAmbiguityError,
    );
    expect(() => resolveCompensationRule(rules, makeContext())).toThrow(
      'Ambiguous compensation rules: operator-rule, session-rule.',
    );
  });

  it('returns null when no rule qualifies', () => {
    expect(
      resolveCompensationRule(
        [makeRule({ operatorType: OPERATOR_TYPES.RECORDING_ENGINEER })],
        makeContext(),
      ),
    ).toBeNull();
  });
});

describe('compensation arithmetic', () => {
  it('prorates per-hour compensation by minute and rounds half-up to one IDR', () => {
    const rule = makeRule({
      compensationModel: COMPENSATION_RULE_MODELS.PER_HOUR,
      configuration: { amountPerHourIdr: 20000 },
    });

    expect(calculateCompensationAmount(rule, makeContext({ durationMinutes: 90 }))).toBe(30000);
    expect(
      calculateCompensationAmount(
        makeRule({
          compensationModel: COMPENSATION_RULE_MODELS.PER_HOUR,
          configuration: { amountPerHourIdr: 1 },
        }),
        makeContext({ durationMinutes: 30 }),
      ),
    ).toBe(1);
  });

  it('returns canonical per-session and fixed amounts unchanged', () => {
    expect(
      calculateCompensationAmount(
        makeRule({ configuration: { amountIdr: 50000 } }),
        makeContext(),
      ),
    ).toBe(50000);
    expect(
      calculateCompensationAmount(
        makeRule({
          compensationModel: COMPENSATION_RULE_MODELS.FIXED,
          configuration: { amountIdr: 150000 },
        }),
        makeContext(),
      ),
    ).toBe(150000);
  });

  it('requires package duration to match exactly', () => {
    const rule = makeRule({
      compensationModel: COMPENSATION_RULE_MODELS.PACKAGE,
      configuration: { amountIdr: 175000, durationMinutes: 360 },
    });

    expect(calculateCompensationAmount(rule, makeContext({ durationMinutes: 360 }))).toBe(175000);
    expect(() => calculateCompensationAmount(rule, makeContext({ durationMinutes: 180 }))).toThrow(
      'Package compensation requires an exact duration match.',
    );
  });

  it('calculates percentage compensation from the rule-selected explicit base', () => {
    const base = COMPENSATION_PERCENTAGE_BASES.BOOKING_TOTAL_AFTER_DISCOUNT;
    const rule = makeRule({
      compensationModel: COMPENSATION_RULE_MODELS.PERCENTAGE,
      configuration: { base, basisPoints: 1250 },
    });

    expect(
      calculateCompensationAmount(
        rule,
        makeContext({ percentageBaseAmounts: { [base]: 999 } }),
      ),
    ).toBe(125);
  });

  it('fails closed when a percentage rule base amount is not supplied', () => {
    const base = COMPENSATION_PERCENTAGE_BASES.SERVICE_AMOUNT;
    const rule = makeRule({
      compensationModel: COMPENSATION_RULE_MODELS.PERCENTAGE,
      configuration: { base, basisPoints: 1000 },
    });

    expect(() => calculateCompensationAmount(rule, makeContext())).toThrow(
      `Missing percentage base amount for ${base}.`,
    );
  });

  it('returns a serialization-ready calculation snapshot for later booking integration', () => {
    const result = resolveAndCalculateCompensation(
      [
        makeRule({
          compensationModel: COMPENSATION_RULE_MODELS.PER_HOUR,
          configuration: { amountPerHourIdr: 20000 },
          id: 'hourly-rule',
          operatorId: 'operator-1',
        }),
      ],
      makeContext({ durationMinutes: 90 }),
    );

    expect(result?.expectedAmountIdr).toBe(30000);
    expect(result?.snapshot).toEqual({
      compensationModel: COMPENSATION_RULE_MODELS.PER_HOUR,
      configuration: { amountPerHourIdr: 20000 },
      durationMinutes: 90,
      effectiveAtIso: '2026-09-06T10:00:00.000Z',
      expectedAmountIdr: 30000,
      operatorId: 'operator-1',
      operatorType: OPERATOR_TYPES.STUDIO_OPERATOR,
      percentageBase: null,
      ruleId: 'hourly-rule',
      sessionTypeId: 'rehearsal',
      studioId: 'studio-a',
    });
  });
});
