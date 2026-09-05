import { describe, expect, it } from 'vitest';

import {
  COMPENSATION_PERCENTAGE_BASES,
  COMPENSATION_RULE_MODELS,
  decodeCompensationRuleDocument,
  normalizeCompensationRuleDetails,
} from './compensationRules.js';

function makeRule(overrides = {}) {
  return {
    compensationModel: COMPENSATION_RULE_MODELS.PER_HOUR,
    configuration: { amountPerHourIdr: 10000 },
    effectiveFrom: null,
    effectiveUntil: null,
    name: 'Rehearsal studio operator',
    operatorId: null,
    operatorType: 'studio_operator',
    priority: 100,
    sessionTypeId: 'rehearsal',
    studioId: null,
    ...overrides,
  };
}

describe('compensationRules', () => {
  it('normalizes a scoped per-hour rule without coupling it to customer pricing', () => {
    expect(normalizeCompensationRuleDetails(makeRule())).toEqual({
      compensationModel: 'per_hour',
      configuration: { amountPerHourIdr: 10000 },
      effectiveFrom: null,
      effectiveUntil: null,
      name: 'Rehearsal studio operator',
      operatorId: null,
      operatorType: 'studio_operator',
      priority: 100,
      sessionTypeId: 'rehearsal',
      studioId: null,
    });
  });

  it.each([
    ['per_session', { amountIdr: 50000 }],
    ['fixed', { amountIdr: 450000 }],
    ['package', { amountIdr: 450000, durationMinutes: 360 }],
    [
      'percentage',
      {
        base: COMPENSATION_PERCENTAGE_BASES.SERVICE_AMOUNT,
        basisPoints: 1000,
      },
    ],
  ])('supports the %s compensation model', (compensationModel, configuration) => {
    expect(
      normalizeCompensationRuleDetails(
        makeRule({
          compensationModel,
          configuration,
          operatorType: 'recording_engineer',
        }),
      ).configuration,
    ).toEqual(configuration);
  });

  it('allows exact operator, studio, session and effective-period scoping', () => {
    const effectiveFrom = new Date('2026-09-01T00:00:00.000Z');
    const effectiveUntil = new Date('2026-10-01T00:00:00.000Z');

    const result = normalizeCompensationRuleDetails(
      makeRule({
        effectiveFrom,
        effectiveUntil,
        operatorId: 'operator-1',
        studioId: 'studio-a',
      }),
    );

    expect(result.operatorId).toBe('operator-1');
    expect(result.studioId).toBe('studio-a');
    expect(result.effectiveFrom).toEqual(effectiveFrom);
    expect(result.effectiveUntil).toEqual(effectiveUntil);
  });

  it('rejects ambiguous percentage configuration without an explicit base', () => {
    expect(() =>
      normalizeCompensationRuleDetails(
        makeRule({
          compensationModel: 'percentage',
          configuration: { basisPoints: 1000 },
        }),
      ),
    ).toThrow('unsupported document shape');
  });

  it('rejects unsupported operator types and malformed references', () => {
    expect(() => normalizeCompensationRuleDetails(makeRule({ operatorType: 'owner' }))).toThrow(
      'operatorType is not supported',
    );
    expect(() => normalizeCompensationRuleDetails(makeRule({ operatorId: 'operators/a' }))).toThrow(
      'Firestore document id',
    );
  });

  it('rejects invalid package durations and inverted effective periods', () => {
    expect(() =>
      normalizeCompensationRuleDetails(
        makeRule({
          compensationModel: 'package',
          configuration: { amountIdr: 450000, durationMinutes: 61 },
        }),
      ),
    ).toThrow('15-minute increment');

    expect(() =>
      normalizeCompensationRuleDetails(
        makeRule({
          effectiveFrom: new Date('2026-10-01T00:00:00.000Z'),
          effectiveUntil: new Date('2026-09-01T00:00:00.000Z'),
        }),
      ),
    ).toThrow('effectiveUntil must be later');
  });

  it('decodes persisted metadata and keeps immutable historical context', () => {
    const createdAt = new Date('2026-09-05T01:00:00.000Z');
    const updatedAt = new Date('2026-09-05T02:00:00.000Z');

    const result = decodeCompensationRuleDocument({
      ...makeRule(),
      createdAt,
      createdByUid: 'owner-1',
      id: 'rule-1',
      status: 'active',
      updatedAt,
      updatedByUid: 'owner-1',
    });

    expect(result.id).toBe('rule-1');
    expect(result.status).toBe('active');
    expect(result.createdAt).toEqual(createdAt);
    expect(Object.isFrozen(result)).toBe(true);
  });
});
