import { createCompensationRuleManagementSnapshot } from '../features/commissions/compensationRuleManagement.js';
import { compensationRuleRepository } from './compensationRuleRepository.js';

function requireRepository(repository) {
  const requiredMethods = [
    'createCompensationRule',
    'listCompensationRulesWithDiagnostics',
    'setCompensationRuleStatus',
    'updateCompensationRule',
  ];

  if (!repository || typeof repository !== 'object') {
    throw new TypeError('compensationRuleRepository must be an object.');
  }

  for (const method of requiredMethods) {
    if (typeof repository[method] !== 'function') {
      throw new TypeError(`compensationRuleRepository.${method} must be a function.`);
    }
  }

  return repository;
}

export function createCompensationRuleManagementService({
  repository = compensationRuleRepository,
} = {}) {
  const resolvedRepository = requireRepository(repository);

  return Object.freeze({
    async loadSnapshot(filters = {}) {
      const result = await resolvedRepository.listCompensationRulesWithDiagnostics();
      return createCompensationRuleManagementSnapshot({
        filters,
        invalidDocuments: result.invalidDocuments,
        rules: result.rules,
      });
    },

    createRule(value, { actorUid } = {}) {
      return resolvedRepository.createCompensationRule(value, { actorUid });
    },

    updateRule(compensationRuleId, value, { actorUid } = {}) {
      return resolvedRepository.updateCompensationRule(compensationRuleId, value, { actorUid });
    },

    setRuleStatus(compensationRuleId, status, { actorUid } = {}) {
      return resolvedRepository.setCompensationRuleStatus(compensationRuleId, status, { actorUid });
    },
  });
}

export const compensationRuleManagementService = createCompensationRuleManagementService();
