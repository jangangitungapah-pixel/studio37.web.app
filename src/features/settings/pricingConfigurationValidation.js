import {
  normalizePricingRuleDetails,
  PRICING_RULE_LIST_LIMIT,
  PRICING_RULE_STATUSES,
} from '../pricing/pricingRules.js';
import { SESSION_TYPE_STATUSES } from '../pricing/sessionTypes.js';
import { STUDIO_ROOM_STATUSES } from './studioRooms.js';
import { hasPricingRuleWriteCollision } from './pricingRuleCollision.js';

export const PRICING_CONFIGURATION_ISSUE_SEVERITIES = Object.freeze({
  ERROR: 'error',
  WARNING: 'warning',
});

export const PRICING_CONFIGURATION_ISSUE_CODES = Object.freeze({
  AMBIGUOUS_RULES: 'ambiguous_rules',
  INACTIVE_SESSION_REFERENCE: 'inactive_session_reference',
  INACTIVE_STUDIO_REFERENCE: 'inactive_studio_reference',
  INVALID_RULE: 'invalid_rule',
  MISSING_SESSION_REFERENCE: 'missing_session_reference',
  MISSING_STUDIO_REFERENCE: 'missing_studio_reference',
  SATURATED_RULE_SET: 'saturated_rule_set',
  UNVERIFIED_STUDIO_REFERENCE: 'unverified_studio_reference',
});

const DEFAULT_CANDIDATE_ID = '__pricing-rule-candidate__';
const supportedCandidateStatuses = new Set(Object.values(PRICING_RULE_STATUSES));

function requireArray(value, label) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array.`);
  }

  return value;
}

function createIssue({ code, message, ruleIds = [], severity }) {
  return Object.freeze({
    code,
    message,
    ruleIds: Object.freeze([...ruleIds]),
    severity,
  });
}

function createValidationResult(issues, { complete }) {
  const frozenIssues = Object.freeze([...issues]);
  const errors = Object.freeze(
    frozenIssues.filter(
      (issue) => issue.severity === PRICING_CONFIGURATION_ISSUE_SEVERITIES.ERROR,
    ),
  );
  const warnings = Object.freeze(
    frozenIssues.filter(
      (issue) => issue.severity === PRICING_CONFIGURATION_ISSUE_SEVERITIES.WARNING,
    ),
  );

  return Object.freeze({
    blocking: errors.length > 0,
    complete,
    errors,
    issues: frozenIssues,
    warnings,
  });
}

function getRuleLabel(rule) {
  const name = typeof rule?.name === 'string' ? rule.name.trim() : '';
  const id = typeof rule?.id === 'string' ? rule.id.trim() : '';
  return name || id || 'Pricing rule tanpa identitas';
}

function toMutableRuleDetails(rule) {
  return {
    configuration: rule.configuration,
    effectiveFrom: rule.effectiveFrom ?? null,
    effectiveUntil: rule.effectiveUntil ?? null,
    name: rule.name,
    pricingModel: rule.pricingModel,
    priority: rule.priority,
    sessionTypeId: rule.sessionTypeId,
    studioId: rule.studioId ?? null,
  };
}

function validateRuleShape(rule, issues) {
  try {
    normalizePricingRuleDetails(toMutableRuleDetails(rule));
    return true;
  } catch {
    issues.push(
      createIssue({
        code: PRICING_CONFIGURATION_ISSUE_CODES.INVALID_RULE,
        message: `${getRuleLabel(rule)} memiliki konfigurasi harga/durasi yang tidak valid.`,
        ruleIds: rule?.id ? [rule.id] : [],
        severity: PRICING_CONFIGURATION_ISSUE_SEVERITIES.ERROR,
      }),
    );
    return false;
  }
}

function validateActiveReferences({
  issues,
  rule,
  sessionTypeById,
  studioById,
  studioReferencesAvailable,
}) {
  const sessionType = sessionTypeById.get(rule.sessionTypeId);
  if (!sessionType) {
    issues.push(
      createIssue({
        code: PRICING_CONFIGURATION_ISSUE_CODES.MISSING_SESSION_REFERENCE,
        message: `${getRuleLabel(rule)} mengarah ke session type yang tidak ditemukan.`,
        ruleIds: [rule.id],
        severity: PRICING_CONFIGURATION_ISSUE_SEVERITIES.ERROR,
      }),
    );
  } else if (sessionType.status !== SESSION_TYPE_STATUSES.ACTIVE) {
    issues.push(
      createIssue({
        code: PRICING_CONFIGURATION_ISSUE_CODES.INACTIVE_SESSION_REFERENCE,
        message: `${getRuleLabel(rule)} masih aktif tetapi session type referensinya nonaktif.`,
        ruleIds: [rule.id],
        severity: PRICING_CONFIGURATION_ISSUE_SEVERITIES.WARNING,
      }),
    );
  }

  if (rule.studioId === null || rule.studioId === undefined) return;

  if (!studioReferencesAvailable) {
    issues.push(
      createIssue({
        code: PRICING_CONFIGURATION_ISSUE_CODES.UNVERIFIED_STUDIO_REFERENCE,
        message: `${getRuleLabel(rule)} memakai exact studio scope yang belum dapat diverifikasi oleh sesi ini.`,
        ruleIds: [rule.id],
        severity: PRICING_CONFIGURATION_ISSUE_SEVERITIES.WARNING,
      }),
    );
    return;
  }

  const studio = studioById.get(rule.studioId);
  if (!studio) {
    issues.push(
      createIssue({
        code: PRICING_CONFIGURATION_ISSUE_CODES.MISSING_STUDIO_REFERENCE,
        message: `${getRuleLabel(rule)} mengarah ke studio yang tidak ditemukan.`,
        ruleIds: [rule.id],
        severity: PRICING_CONFIGURATION_ISSUE_SEVERITIES.ERROR,
      }),
    );
  } else if (studio.status !== STUDIO_ROOM_STATUSES.ACTIVE) {
    issues.push(
      createIssue({
        code: PRICING_CONFIGURATION_ISSUE_CODES.INACTIVE_STUDIO_REFERENCE,
        message: `${getRuleLabel(rule)} masih aktif tetapi studio referensinya nonaktif.`,
        ruleIds: [rule.id],
        severity: PRICING_CONFIGURATION_ISSUE_SEVERITIES.WARNING,
      }),
    );
  }
}

function collectAmbiguityIssues(validActiveRules, issues) {
  for (let index = 0; index < validActiveRules.length; index += 1) {
    const leftRule = validActiveRules[index];

    for (let otherIndex = index + 1; otherIndex < validActiveRules.length; otherIndex += 1) {
      const rightRule = validActiveRules[otherIndex];
      if (!hasPricingRuleWriteCollision([rightRule], leftRule)) continue;

      issues.push(
        createIssue({
          code: PRICING_CONFIGURATION_ISSUE_CODES.AMBIGUOUS_RULES,
          message: `${getRuleLabel(leftRule)} dan ${getRuleLabel(rightRule)} overlap pada session, studio scope, priority, dan effective window yang sama.`,
          ruleIds: [leftRule.id, rightRule.id],
          severity: PRICING_CONFIGURATION_ISSUE_SEVERITIES.ERROR,
        }),
      );
    }
  }
}

export function validatePricingConfiguration({
  limitReached = false,
  pricingRules,
  sessionTypes,
  studioReferencesAvailable = true,
  studioRooms = [],
}) {
  requireArray(pricingRules, 'pricingRules');
  requireArray(sessionTypes, 'sessionTypes');
  requireArray(studioRooms, 'studioRooms');

  const issues = [];
  const sessionTypeById = new Map(sessionTypes.map((sessionType) => [sessionType.id, sessionType]));
  const studioById = new Map(studioRooms.map((studio) => [studio.id, studio]));
  const validationIncomplete =
    limitReached || (!studioReferencesAvailable && pricingRules.some((rule) => rule.studioId));

  if (limitReached || pricingRules.length >= PRICING_RULE_LIST_LIMIT) {
    issues.push(
      createIssue({
        code: PRICING_CONFIGURATION_ISSUE_CODES.SATURATED_RULE_SET,
        message: `Validasi ambiguity tidak lengkap karena daftar pricing rule mencapai batas ${PRICING_RULE_LIST_LIMIT} dokumen. Create/edit/reactivate harus tetap diblok sampai candidate set lengkap.`,
        severity: PRICING_CONFIGURATION_ISSUE_SEVERITIES.ERROR,
      }),
    );
  }

  const validActiveRules = [];

  pricingRules.forEach((rule) => {
    const shapeIsValid = validateRuleShape(rule, issues);
    if (!shapeIsValid || rule.status !== PRICING_RULE_STATUSES.ACTIVE) return;

    validActiveRules.push(rule);
    validateActiveReferences({
      issues,
      rule,
      sessionTypeById,
      studioById,
      studioReferencesAvailable,
    });
  });

  collectAmbiguityIssues(validActiveRules, issues);

  return createValidationResult(issues, { complete: !validationIncomplete });
}

export function validatePricingRuleCandidate({
  candidateDetails,
  candidateId = DEFAULT_CANDIDATE_ID,
  candidateStatus = PRICING_RULE_STATUSES.ACTIVE,
  limitReached = false,
  pricingRules,
  sessionTypes,
  studioReferencesAvailable = true,
  studioRooms = [],
}) {
  requireArray(pricingRules, 'pricingRules');
  requireArray(sessionTypes, 'sessionTypes');
  requireArray(studioRooms, 'studioRooms');

  if (!candidateDetails || typeof candidateDetails !== 'object' || Array.isArray(candidateDetails)) {
    throw new TypeError('candidateDetails must be an object.');
  }

  if (typeof candidateId !== 'string' || !candidateId.trim()) {
    throw new TypeError('candidateId must be a non-empty string.');
  }

  if (!supportedCandidateStatuses.has(candidateStatus)) {
    throw new RangeError('candidateStatus is not supported.');
  }

  const normalizedCandidateId = candidateId.trim();
  const candidateRule = {
    ...candidateDetails,
    id: normalizedCandidateId,
    status: candidateStatus,
  };
  const nextPricingRules = pricingRules.filter((rule) => rule.id !== normalizedCandidateId);
  nextPricingRules.push(candidateRule);

  const fullValidation = validatePricingConfiguration({
    limitReached,
    pricingRules: nextPricingRules,
    sessionTypes,
    studioReferencesAvailable,
    studioRooms,
  });
  const candidateIssues = fullValidation.issues.filter(
    (issue) =>
      issue.code === PRICING_CONFIGURATION_ISSUE_CODES.SATURATED_RULE_SET ||
      issue.ruleIds.includes(normalizedCandidateId),
  );
  const candidateValidationIncomplete = candidateIssues.some(
    (issue) =>
      issue.code === PRICING_CONFIGURATION_ISSUE_CODES.SATURATED_RULE_SET ||
      issue.code === PRICING_CONFIGURATION_ISSUE_CODES.UNVERIFIED_STUDIO_REFERENCE,
  );

  return createValidationResult(candidateIssues, { complete: !candidateValidationIncomplete });
}
