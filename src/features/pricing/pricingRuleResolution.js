import { toJavaScriptDate } from '../../lib/datetime/timestamps.js';
import {
  decodePricingRuleDocument,
  PRICING_RULE_LIST_LIMIT,
  PRICING_RULE_STATUSES,
} from './pricingRules.js';

export const PRICING_RULE_STUDIO_MATCH_SCOPES = Object.freeze({
  EXACT_STUDIO: 'exact_studio',
  GENERAL_STUDIO: 'general_studio',
  NONE: 'none',
});

export const PRICING_RULE_MATCH_STATUSES = Object.freeze({
  NONE: 'none',
  UNIQUE: 'unique',
});

export class PricingRuleAmbiguityError extends Error {
  constructor({ highestPriority, ruleIds }) {
    super(
      `Pricing rule configuration is ambiguous at priority ${highestPriority}: ${ruleIds.join(', ')}.`,
    );
    this.name = 'PricingRuleAmbiguityError';
    this.code = 'PRICING_RULE_AMBIGUITY';
    this.highestPriority = highestPriority;
    this.ruleIds = Object.freeze([...ruleIds]);
  }
}

const ambiguityResolutionInputFieldNames = Object.freeze(['highestPriority', 'rules']);
const eligibilityInputFieldNames = Object.freeze(['pricingTime', 'rules', 'sessionTypeId']);
const priorityResolutionInputFieldNames = Object.freeze(['rules']);
const studioResolutionInputFieldNames = Object.freeze(['rules', 'studioId']);

function requireRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }

  return value;
}

function requireExactFields(value, expectedFields, label) {
  const actualFields = Object.keys(value).sort();
  const expected = [...expectedFields].sort();

  if (
    actualFields.length !== expected.length ||
    actualFields.some((field, index) => field !== expected[index])
  ) {
    throw new TypeError(`${label} has an unsupported input shape.`);
  }
}

function normalizeDocumentId(value, label) {
  if (typeof value !== 'string') {
    throw new TypeError(`${label} must be a string.`);
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }

  if (normalized.length > 128 || normalized.includes('/')) {
    throw new TypeError(`${label} must be a Firestore document id.`);
  }

  return normalized;
}

function normalizeNullableStudioId(value) {
  return value === null ? null : normalizeDocumentId(value, 'pricingRuleResolution.studioId');
}

function normalizeRules(value) {
  if (!Array.isArray(value)) {
    throw new TypeError('pricingRuleResolution.rules must be an array.');
  }

  if (value.length > PRICING_RULE_LIST_LIMIT) {
    throw new RangeError(
      `pricingRuleResolution.rules must contain at most ${PRICING_RULE_LIST_LIMIT} rules.`,
    );
  }

  return Object.freeze(value.map((rule) => decodePricingRuleDocument(rule)));
}

function requireStudioCandidateSet(rules) {
  if (rules.some((rule) => rule.status !== PRICING_RULE_STATUSES.ACTIVE)) {
    throw new TypeError('pricingRuleResolution studio candidates must all be active rules.');
  }

  const sessionTypeIds = new Set(rules.map((rule) => rule.sessionTypeId));

  if (sessionTypeIds.size > 1) {
    throw new TypeError(
      'pricingRuleResolution studio candidates must all belong to one session type.',
    );
  }

  return rules;
}

function requirePriorityCandidateSet(rules) {
  const candidates = requireStudioCandidateSet(rules);
  const studioIds = new Set(candidates.map((rule) => rule.studioId));

  if (studioIds.size > 1) {
    throw new TypeError(
      'pricingRuleResolution priority candidates must all belong to one studio scope.',
    );
  }

  return candidates;
}

function requireDistinctRuleIds(rules) {
  const ruleIds = rules.map((rule) => rule.id);

  if (new Set(ruleIds).size !== ruleIds.length) {
    throw new TypeError('pricingRuleResolution match candidates must have distinct rule ids.');
  }

  return rules;
}

function normalizeResolvedHighestPriority(value, rules) {
  if (rules.length === 0) {
    if (value !== null) {
      throw new TypeError(
        'pricingRuleResolution.highestPriority must be null when no candidates remain.',
      );
    }

    return null;
  }

  if (!Number.isInteger(value) || value < 1 || value > 999) {
    throw new RangeError(
      'pricingRuleResolution.highestPriority must be an integer between 1 and 999.',
    );
  }

  if (rules.some((rule) => rule.priority !== value)) {
    throw new TypeError(
      'pricingRuleResolution match candidates must all equal highestPriority after priority resolution.',
    );
  }

  return value;
}

function isEffectiveAt(rule, pricingTimeMs) {
  const startsOnTime = rule.effectiveFrom === null || rule.effectiveFrom.getTime() <= pricingTimeMs;
  const endsAfterTime =
    rule.effectiveUntil === null || pricingTimeMs < rule.effectiveUntil.getTime();

  return startsOnTime && endsAfterTime;
}

export function filterEligiblePricingRules(value) {
  const input = requireRecord(value, 'pricingRuleResolution eligibility input');
  requireExactFields(input, eligibilityInputFieldNames, 'pricingRuleResolution eligibility input');

  const rules = normalizeRules(input.rules);
  const pricingTime = toJavaScriptDate(input.pricingTime, {
    label: 'pricingRuleResolution.pricingTime',
  });
  const sessionTypeId = normalizeDocumentId(
    input.sessionTypeId,
    'pricingRuleResolution.sessionTypeId',
  );
  const pricingTimeMs = pricingTime.getTime();
  const eligibleRules = rules.filter(
    (rule) =>
      rule.status === PRICING_RULE_STATUSES.ACTIVE &&
      rule.sessionTypeId === sessionTypeId &&
      isEffectiveAt(rule, pricingTimeMs),
  );

  return Object.freeze({
    pricingTime,
    rules: Object.freeze(eligibleRules),
    sessionTypeId,
  });
}

export function resolveStudioPricingScope(value) {
  const input = requireRecord(value, 'pricingRuleResolution studio input');
  requireExactFields(input, studioResolutionInputFieldNames, 'pricingRuleResolution studio input');

  const rules = requireStudioCandidateSet(normalizeRules(input.rules));
  const studioId = normalizeNullableStudioId(input.studioId);
  const generalRules = rules.filter((rule) => rule.studioId === null);

  if (studioId === null) {
    return Object.freeze({
      matchScope:
        generalRules.length > 0
          ? PRICING_RULE_STUDIO_MATCH_SCOPES.GENERAL_STUDIO
          : PRICING_RULE_STUDIO_MATCH_SCOPES.NONE,
      rules: Object.freeze(generalRules),
      studioId,
    });
  }

  const exactStudioRules = rules.filter((rule) => rule.studioId === studioId);
  const selectedRules = exactStudioRules.length > 0 ? exactStudioRules : generalRules;
  const matchScope =
    exactStudioRules.length > 0
      ? PRICING_RULE_STUDIO_MATCH_SCOPES.EXACT_STUDIO
      : generalRules.length > 0
        ? PRICING_RULE_STUDIO_MATCH_SCOPES.GENERAL_STUDIO
        : PRICING_RULE_STUDIO_MATCH_SCOPES.NONE;

  return Object.freeze({
    matchScope,
    rules: Object.freeze(selectedRules),
    studioId,
  });
}

export function resolvePricingRulePriority(value) {
  const input = requireRecord(value, 'pricingRuleResolution priority input');
  requireExactFields(
    input,
    priorityResolutionInputFieldNames,
    'pricingRuleResolution priority input',
  );

  const rules = requirePriorityCandidateSet(normalizeRules(input.rules));

  if (rules.length === 0) {
    return Object.freeze({
      highestPriority: null,
      rules: Object.freeze([]),
    });
  }

  const highestPriority = rules.reduce(
    (highest, rule) => Math.max(highest, rule.priority),
    rules[0].priority,
  );
  const highestPriorityRules = rules
    .filter((rule) => rule.priority === highestPriority)
    .sort((left, right) => left.id.localeCompare(right.id));

  return Object.freeze({
    highestPriority,
    rules: Object.freeze(highestPriorityRules),
  });
}

export function resolveUniquePricingRuleMatch(value) {
  const input = requireRecord(value, 'pricingRuleResolution match input');
  requireExactFields(
    input,
    ambiguityResolutionInputFieldNames,
    'pricingRuleResolution match input',
  );

  const rules = requireDistinctRuleIds(requirePriorityCandidateSet(normalizeRules(input.rules)));
  const highestPriority = normalizeResolvedHighestPriority(input.highestPriority, rules);

  if (rules.length === 0) {
    return Object.freeze({
      highestPriority,
      matchStatus: PRICING_RULE_MATCH_STATUSES.NONE,
      rule: null,
    });
  }

  if (rules.length > 1) {
    throw new PricingRuleAmbiguityError({
      highestPriority,
      ruleIds: rules.map((rule) => rule.id).sort((left, right) => left.localeCompare(right)),
    });
  }

  return Object.freeze({
    highestPriority,
    matchStatus: PRICING_RULE_MATCH_STATUSES.UNIQUE,
    rule: rules[0],
  });
}
