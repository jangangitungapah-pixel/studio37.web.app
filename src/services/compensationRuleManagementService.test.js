import { describe, expect, it, vi } from 'vitest';

import { OPERATOR_TYPES } from '../features/settings/operators.js';
import {
  COMPENSATION_RULE_MODELS,
  COMPENSATION_RULE_STATUSES,
} from '../features/commissions/compensationRules.js';
import { createCompensationRuleManagementService } from './compensationRuleManagementService.js';

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

function makeRepository(overrides = {}) {
  return {
    createCompensationRule: vi.fn(),
    listCompensationRulesWithDiagnostics: vi.fn().mockResolvedValue({
      invalidDocuments: [],
      rules: [],
    }),
    setCompensationRuleStatus: vi.fn(),
    updateCompensationRule: vi.fn(),
    ...overrides,
  };
}

describe('compensation rule management service', () => {
  it('requires the focused compensation rule repository contract', () => {
    expect(() => createCompensationRuleManagementService({ repository: {} })).toThrow(
      'compensationRuleRepository.createCompensationRule must be a function.',
    );
  });

  it('loads diagnostics once and builds the filtered management snapshot', async () => {
    const repository = makeRepository({
      listCompensationRulesWithDiagnostics: vi.fn().mockResolvedValue({
        invalidDocuments: [{ id: 'broken', reason: 'bad shape' }],
        rules: [
          makeRule({ id: 'active-rule' }),
          makeRule({ id: 'disabled-rule', status: COMPENSATION_RULE_STATUSES.DISABLED }),
        ],
      }),
    });
    const service = createCompensationRuleManagementService({ repository });

    const snapshot = await service.loadSnapshot({ status: COMPENSATION_RULE_STATUSES.ACTIVE });

    expect(repository.listCompensationRulesWithDiagnostics).toHaveBeenCalledTimes(1);
    expect(snapshot.totalLoaded).toBe(2);
    expect(snapshot.visibleRules.map((rule) => rule.id)).toEqual(['active-rule']);
    expect(snapshot.invalidDocuments).toEqual([{ id: 'broken', reason: 'bad shape' }]);
  });

  it('delegates create, update, and soft-status writes with actor metadata context', async () => {
    const repository = makeRepository({
      createCompensationRule: vi.fn().mockResolvedValue('created-rule'),
      setCompensationRuleStatus: vi.fn().mockResolvedValue('rule-1'),
      updateCompensationRule: vi.fn().mockResolvedValue('rule-1'),
    });
    const service = createCompensationRuleManagementService({ repository });
    const details = { name: 'Rule details' };

    await expect(service.createRule(details, { actorUid: 'owner-1' })).resolves.toBe('created-rule');
    await expect(service.updateRule('rule-1', details, { actorUid: 'owner-1' })).resolves.toBe(
      'rule-1',
    );
    await expect(
      service.setRuleStatus('rule-1', COMPENSATION_RULE_STATUSES.DISABLED, {
        actorUid: 'owner-1',
      }),
    ).resolves.toBe('rule-1');

    expect(repository.createCompensationRule).toHaveBeenCalledWith(details, {
      actorUid: 'owner-1',
    });
    expect(repository.updateCompensationRule).toHaveBeenCalledWith('rule-1', details, {
      actorUid: 'owner-1',
    });
    expect(repository.setCompensationRuleStatus).toHaveBeenCalledWith(
      'rule-1',
      COMPENSATION_RULE_STATUSES.DISABLED,
      { actorUid: 'owner-1' },
    );
  });
});
