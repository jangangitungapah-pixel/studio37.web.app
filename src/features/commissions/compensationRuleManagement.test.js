import { describe, expect, it } from 'vitest';

import { OPERATOR_TYPES } from '../settings/operators.js';
import {
  COMPENSATION_RULE_MODELS,
  COMPENSATION_RULE_STATUSES,
} from './compensationRules.js';
import {
  COMPENSATION_RULE_MANAGEMENT_ALL,
  createCompensationRuleManagementSnapshot,
  filterCompensationRulesForManagement,
  normalizeCompensationRuleManagementFilters,
  summarizeCompensationRulesForManagement,
} from './compensationRuleManagement.js';

function makeRule(overrides = {}) {
  return {
    compensationModel: COMPENSATION_RULE_MODELS.PER_SESSION,
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

describe('compensation rule management core', () => {
  it('normalizes empty filters to bounded all-values defaults', () => {
    expect(normalizeCompensationRuleManagementFilters()).toEqual({
      compensationModel: COMPENSATION_RULE_MANAGEMENT_ALL,
      operatorId: COMPENSATION_RULE_MANAGEMENT_ALL,
      operatorType: COMPENSATION_RULE_MANAGEMENT_ALL,
      searchQuery: '',
      sessionTypeId: COMPENSATION_RULE_MANAGEMENT_ALL,
      status: COMPENSATION_RULE_MANAGEMENT_ALL,
      studioId: COMPENSATION_RULE_MANAGEMENT_ALL,
    });
  });

  it('rejects unsupported enum filters', () => {
    expect(() =>
      normalizeCompensationRuleManagementFilters({ compensationModel: 'mystery' }),
    ).toThrow('filters.compensationModel is not supported.');
    expect(() => normalizeCompensationRuleManagementFilters({ status: 'deleted' })).toThrow(
      'filters.status is not supported.',
    );
  });

  it('filters by admin dimensions, searches name/id, and preserves canonical ordering', () => {
    const rules = [
      makeRule({
        id: 'rule-b',
        name: 'Recording Session',
        operatorType: OPERATOR_TYPES.RECORDING_ENGINEER,
        priority: 200,
        sessionTypeId: 'recording',
      }),
      makeRule({
        id: 'rule-a',
        name: 'Studio Rehearsal',
        operatorId: 'operator-1',
        priority: 300,
        sessionTypeId: 'rehearsal',
      }),
      makeRule({
        id: 'rule-c',
        name: 'Studio Rehearsal Disabled',
        operatorId: 'operator-1',
        priority: 400,
        sessionTypeId: 'rehearsal',
        status: COMPENSATION_RULE_STATUSES.DISABLED,
      }),
    ];

    expect(
      filterCompensationRulesForManagement(rules, {
        operatorId: 'operator-1',
        operatorType: OPERATOR_TYPES.STUDIO_OPERATOR,
        searchQuery: 'rehearsal',
        sessionTypeId: 'rehearsal',
        status: COMPENSATION_RULE_STATUSES.ACTIVE,
      }).map((rule) => rule.id),
    ).toEqual(['rule-a']);

    expect(
      filterCompensationRulesForManagement(rules, { searchQuery: 'RULE' }).map((rule) => rule.id),
    ).toEqual(['rule-c', 'rule-a', 'rule-b']);
  });

  it('summarizes only the provided management result set', () => {
    const summary = summarizeCompensationRulesForManagement([
      makeRule({ id: 'rule-a', operatorId: 'operator-1', studioId: 'studio-a' }),
      makeRule({
        compensationModel: COMPENSATION_RULE_MODELS.PERCENTAGE,
        id: 'rule-b',
        operatorType: OPERATOR_TYPES.RECORDING_ENGINEER,
        sessionTypeId: 'recording',
        status: COMPENSATION_RULE_STATUSES.DISABLED,
      }),
    ]);

    expect(summary.total).toBe(2);
    expect(summary.byStatus).toEqual({ active: 1, disabled: 1 });
    expect(summary.byOperatorType).toEqual({ recording_engineer: 1, studio_operator: 1 });
    expect(summary.byModel.per_session).toBe(1);
    expect(summary.byModel.percentage).toBe(1);
    expect(summary.exactOperatorScoped).toBe(1);
    expect(summary.sessionTypeScoped).toBe(1);
    expect(summary.studioScoped).toBe(1);
  });

  it('builds a snapshot with visible-rule summary while preserving load diagnostics', () => {
    const snapshot = createCompensationRuleManagementSnapshot({
      filters: { status: COMPENSATION_RULE_STATUSES.ACTIVE },
      invalidDocuments: [{ id: 'broken-rule', reason: 'bad shape' }],
      rules: [
        makeRule({ id: 'rule-active' }),
        makeRule({ id: 'rule-disabled', status: COMPENSATION_RULE_STATUSES.DISABLED }),
      ],
    });

    expect(snapshot.totalLoaded).toBe(2);
    expect(snapshot.visibleRules.map((rule) => rule.id)).toEqual(['rule-active']);
    expect(snapshot.summary.total).toBe(1);
    expect(snapshot.invalidDocuments).toEqual([{ id: 'broken-rule', reason: 'bad shape' }]);
  });
});
