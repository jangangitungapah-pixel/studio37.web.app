import { OPERATOR_TYPES } from '../settings/operators.js';
import {
  compareCompensationRules,
  COMPENSATION_RULE_MODELS,
  COMPENSATION_RULE_STATUSES,
} from './compensationRules.js';

export const COMPENSATION_RULE_MANAGEMENT_ALL = 'all';

const supportedModels = new Set(Object.values(COMPENSATION_RULE_MODELS));
const supportedOperatorTypes = new Set(Object.values(OPERATOR_TYPES));
const supportedStatuses = new Set(Object.values(COMPENSATION_RULE_STATUSES));

function requireArray(value, label) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array.`);
  }
  return value;
}

function normalizeSearchQuery(value) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') {
    throw new TypeError('filters.searchQuery must be a string.');
  }
  return value.trim().toLocaleLowerCase('id-ID');
}

function normalizeEnumFilter(value, supportedValues, label) {
  if (value === undefined || value === null || value === COMPENSATION_RULE_MANAGEMENT_ALL) {
    return COMPENSATION_RULE_MANAGEMENT_ALL;
  }
  if (typeof value !== 'string' || !supportedValues.has(value)) {
    throw new RangeError(`${label} is not supported.`);
  }
  return value;
}

function normalizeOptionalIdFilter(value, label) {
  if (value === undefined || value === null || value === COMPENSATION_RULE_MANAGEMENT_ALL) {
    return COMPENSATION_RULE_MANAGEMENT_ALL;
  }
  if (typeof value !== 'string') {
    throw new TypeError(`${label} must be a string.`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
  if (normalized.length > 128) {
    throw new RangeError(`${label} must be at most 128 characters.`);
  }
  if (normalized.includes('/')) {
    throw new TypeError(`${label} must be a Firestore document id.`);
  }

  return normalized;
}

function matchesOptionalReference(ruleValue, filterValue) {
  return filterValue === COMPENSATION_RULE_MANAGEMENT_ALL || ruleValue === filterValue;
}

function freezeCountMap(source) {
  return Object.freeze({ ...source });
}

export function normalizeCompensationRuleManagementFilters(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('filters must be an object.');
  }

  return Object.freeze({
    compensationModel: normalizeEnumFilter(
      value.compensationModel,
      supportedModels,
      'filters.compensationModel',
    ),
    operatorId: normalizeOptionalIdFilter(value.operatorId, 'filters.operatorId'),
    operatorType: normalizeEnumFilter(
      value.operatorType,
      supportedOperatorTypes,
      'filters.operatorType',
    ),
    searchQuery: normalizeSearchQuery(value.searchQuery),
    sessionTypeId: normalizeOptionalIdFilter(value.sessionTypeId, 'filters.sessionTypeId'),
    status: normalizeEnumFilter(value.status, supportedStatuses, 'filters.status'),
    studioId: normalizeOptionalIdFilter(value.studioId, 'filters.studioId'),
  });
}

export function filterCompensationRulesForManagement(rules, filters = {}) {
  const resolvedRules = requireArray(rules, 'rules');
  const resolvedFilters = normalizeCompensationRuleManagementFilters(filters);

  const filteredRules = resolvedRules.filter((rule) => {
    if (
      resolvedFilters.status !== COMPENSATION_RULE_MANAGEMENT_ALL &&
      rule.status !== resolvedFilters.status
    ) {
      return false;
    }
    if (
      resolvedFilters.operatorType !== COMPENSATION_RULE_MANAGEMENT_ALL &&
      rule.operatorType !== resolvedFilters.operatorType
    ) {
      return false;
    }
    if (
      resolvedFilters.compensationModel !== COMPENSATION_RULE_MANAGEMENT_ALL &&
      rule.compensationModel !== resolvedFilters.compensationModel
    ) {
      return false;
    }
    if (!matchesOptionalReference(rule.operatorId, resolvedFilters.operatorId)) return false;
    if (!matchesOptionalReference(rule.sessionTypeId, resolvedFilters.sessionTypeId)) return false;
    if (!matchesOptionalReference(rule.studioId, resolvedFilters.studioId)) return false;

    if (resolvedFilters.searchQuery) {
      const searchable = `${rule.name} ${rule.id}`.toLocaleLowerCase('id-ID');
      if (!searchable.includes(resolvedFilters.searchQuery)) return false;
    }

    return true;
  });

  return Object.freeze([...filteredRules].sort(compareCompensationRules));
}

export function summarizeCompensationRulesForManagement(rules) {
  const resolvedRules = requireArray(rules, 'rules');
  const byModel = Object.fromEntries(
    Object.values(COMPENSATION_RULE_MODELS).map((model) => [model, 0]),
  );
  const byOperatorType = Object.fromEntries(
    Object.values(OPERATOR_TYPES).map((operatorType) => [operatorType, 0]),
  );
  const byStatus = Object.fromEntries(
    Object.values(COMPENSATION_RULE_STATUSES).map((status) => [status, 0]),
  );

  let exactOperatorScoped = 0;
  let sessionTypeScoped = 0;
  let studioScoped = 0;

  for (const rule of resolvedRules) {
    if (Object.hasOwn(byModel, rule.compensationModel)) byModel[rule.compensationModel] += 1;
    if (Object.hasOwn(byOperatorType, rule.operatorType)) byOperatorType[rule.operatorType] += 1;
    if (Object.hasOwn(byStatus, rule.status)) byStatus[rule.status] += 1;
    if (rule.operatorId !== null) exactOperatorScoped += 1;
    if (rule.sessionTypeId !== null) sessionTypeScoped += 1;
    if (rule.studioId !== null) studioScoped += 1;
  }

  return Object.freeze({
    byModel: freezeCountMap(byModel),
    byOperatorType: freezeCountMap(byOperatorType),
    byStatus: freezeCountMap(byStatus),
    exactOperatorScoped,
    sessionTypeScoped,
    studioScoped,
    total: resolvedRules.length,
  });
}

export function createCompensationRuleManagementSnapshot({
  filters = {},
  invalidDocuments = [],
  rules = [],
} = {}) {
  const resolvedInvalidDocuments = requireArray(invalidDocuments, 'invalidDocuments');
  const resolvedRules = requireArray(rules, 'rules');
  const normalizedFilters = normalizeCompensationRuleManagementFilters(filters);
  const visibleRules = filterCompensationRulesForManagement(resolvedRules, normalizedFilters);

  return Object.freeze({
    filters: normalizedFilters,
    invalidDocuments: Object.freeze([...resolvedInvalidDocuments]),
    summary: summarizeCompensationRulesForManagement(visibleRules),
    totalLoaded: resolvedRules.length,
    visibleRules,
  });
}
