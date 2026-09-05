import { toJavaScriptDate } from '../../lib/datetime/timestamps.js';
import { requireIntegerIdr } from '../../lib/money/idr.js';
import { OPERATOR_TYPES } from '../settings/operators.js';
import {
  COMPENSATION_PERCENTAGE_BASES,
  COMPENSATION_RULE_MAX_DURATION_MINUTES,
  COMPENSATION_RULE_MODELS,
  COMPENSATION_RULE_STATUSES,
} from './compensationRules.js';

const supportedOperatorTypes = new Set(Object.values(OPERATOR_TYPES));
const supportedPercentageBases = new Set(Object.values(COMPENSATION_PERCENTAGE_BASES));
const maxSafeIntegerBigInt = BigInt(Number.MAX_SAFE_INTEGER);

function requireRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value;
}

function requireSingleSegmentId(value, label) {
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

function normalizeOptionalReference(value, label) {
  return value === null ? null : requireSingleSegmentId(value, label);
}

function normalizeDurationMinutes(value) {
  if (
    !Number.isSafeInteger(value) ||
    value <= 0 ||
    value > COMPENSATION_RULE_MAX_DURATION_MINUTES
  ) {
    throw new RangeError(
      `context.durationMinutes must be a positive integer up to ${COMPENSATION_RULE_MAX_DURATION_MINUTES}.`,
    );
  }
  return value;
}

function normalizePercentageBaseAmounts(value = {}) {
  const amounts = requireRecord(value, 'context.percentageBaseAmounts');
  const normalized = {};

  for (const [base, amount] of Object.entries(amounts)) {
    if (!supportedPercentageBases.has(base)) {
      throw new RangeError(`context.percentageBaseAmounts.${base} is not a supported base.`);
    }
    normalized[base] = requireIntegerIdr(amount, {
      label: `context.percentageBaseAmounts.${base}`,
    });
  }

  return Object.freeze(normalized);
}

export function normalizeCompensationCalculationContext(value) {
  const context = requireRecord(value, 'context');

  if (typeof context.operatorType !== 'string' || !supportedOperatorTypes.has(context.operatorType)) {
    throw new RangeError('context.operatorType is not supported.');
  }

  return Object.freeze({
    durationMinutes: normalizeDurationMinutes(context.durationMinutes),
    effectiveAt: toJavaScriptDate(context.effectiveAt, { label: 'context.effectiveAt' }),
    operatorId: requireSingleSegmentId(context.operatorId, 'context.operatorId'),
    operatorType: context.operatorType,
    percentageBaseAmounts: normalizePercentageBaseAmounts(context.percentageBaseAmounts),
    sessionTypeId: normalizeOptionalReference(context.sessionTypeId, 'context.sessionTypeId'),
    studioId: normalizeOptionalReference(context.studioId, 'context.studioId'),
  });
}

function matchesReference(ruleValue, contextValue) {
  return ruleValue === null || ruleValue === contextValue;
}

function matchesEffectiveWindow(rule, effectiveAt) {
  const instant = effectiveAt.getTime();
  const startsAt = rule.effectiveFrom === null ? null : rule.effectiveFrom.getTime();
  const endsAt = rule.effectiveUntil === null ? null : rule.effectiveUntil.getTime();

  if (startsAt !== null && instant < startsAt) return false;
  if (endsAt !== null && instant >= endsAt) return false;
  return true;
}

function matchesRule(rule, context) {
  if (rule.status !== COMPENSATION_RULE_STATUSES.ACTIVE) return false;
  if (rule.operatorType !== context.operatorType) return false;
  if (!matchesReference(rule.operatorId, context.operatorId)) return false;
  if (!matchesReference(rule.sessionTypeId, context.sessionTypeId)) return false;
  if (!matchesReference(rule.studioId, context.studioId)) return false;
  if (!matchesEffectiveWindow(rule, context.effectiveAt)) return false;

  if (
    rule.compensationModel === COMPENSATION_RULE_MODELS.PACKAGE &&
    rule.configuration.durationMinutes !== context.durationMinutes
  ) {
    return false;
  }

  return true;
}

export function getCompensationRuleSpecificity(rule) {
  let specificity = 0;
  if (rule.operatorId !== null) specificity += 1;
  if (rule.sessionTypeId !== null) specificity += 1;
  if (rule.studioId !== null) specificity += 1;
  if (rule.compensationModel === COMPENSATION_RULE_MODELS.PACKAGE) specificity += 1;
  return specificity;
}

export class CompensationRuleAmbiguityError extends Error {
  constructor(ruleIds) {
    super(`Ambiguous compensation rules: ${ruleIds.join(', ')}.`);
    this.name = 'CompensationRuleAmbiguityError';
    this.ruleIds = Object.freeze([...ruleIds]);
  }
}

export function resolveCompensationRule(rules, contextValue) {
  if (!Array.isArray(rules)) {
    throw new TypeError('rules must be an array.');
  }

  const context = normalizeCompensationCalculationContext(contextValue);
  const candidates = rules
    .filter((rule) => matchesRule(rule, context))
    .map((rule) => ({
      priority: rule.priority,
      rule,
      specificity: getCompensationRuleSpecificity(rule),
    }));

  if (candidates.length === 0) return null;

  const highestSpecificity = Math.max(...candidates.map((candidate) => candidate.specificity));
  const mostSpecific = candidates.filter(
    (candidate) => candidate.specificity === highestSpecificity,
  );
  const highestPriority = Math.max(...mostSpecific.map((candidate) => candidate.priority));
  const winners = mostSpecific.filter((candidate) => candidate.priority === highestPriority);

  if (winners.length > 1) {
    throw new CompensationRuleAmbiguityError(
      winners.map((candidate) => candidate.rule.id).sort(),
    );
  }

  return winners[0].rule;
}

function roundNonNegativeProductRatio(amount, multiplier, divisor, label) {
  const normalizedAmount = requireIntegerIdr(amount, { label });
  if (!Number.isSafeInteger(multiplier) || multiplier < 0) {
    throw new RangeError(`${label} multiplier must be a non-negative safe integer.`);
  }
  if (!Number.isSafeInteger(divisor) || divisor <= 0) {
    throw new RangeError(`${label} divisor must be a positive safe integer.`);
  }

  const numerator = BigInt(normalizedAmount) * BigInt(multiplier);
  const denominator = BigInt(divisor);
  let quotient = numerator / denominator;
  const remainder = numerator % denominator;

  if (remainder * 2n >= denominator) quotient += 1n;
  if (quotient > maxSafeIntegerBigInt) {
    throw new RangeError(`${label} result exceeds the safe integer IDR range.`);
  }

  return Number(quotient);
}

function requireRuleConfiguration(rule) {
  return requireRecord(rule.configuration, 'rule.configuration');
}

export function calculateCompensationAmount(rule, contextValue) {
  const context = normalizeCompensationCalculationContext(contextValue);
  const configuration = requireRuleConfiguration(rule);

  switch (rule.compensationModel) {
    case COMPENSATION_RULE_MODELS.PER_HOUR:
      return roundNonNegativeProductRatio(
        configuration.amountPerHourIdr,
        context.durationMinutes,
        60,
        'rule.configuration.amountPerHourIdr',
      );

    case COMPENSATION_RULE_MODELS.PER_SESSION:
    case COMPENSATION_RULE_MODELS.FIXED:
      return requireIntegerIdr(configuration.amountIdr, {
        label: 'rule.configuration.amountIdr',
      });

    case COMPENSATION_RULE_MODELS.PACKAGE:
      if (configuration.durationMinutes !== context.durationMinutes) {
        throw new RangeError('Package compensation requires an exact duration match.');
      }
      return requireIntegerIdr(configuration.amountIdr, {
        label: 'rule.configuration.amountIdr',
      });

    case COMPENSATION_RULE_MODELS.PERCENTAGE: {
      if (
        !Number.isInteger(configuration.basisPoints) ||
        configuration.basisPoints < 0 ||
        configuration.basisPoints > 10000
      ) {
        throw new RangeError('rule.configuration.basisPoints must be between 0 and 10000.');
      }
      if (!supportedPercentageBases.has(configuration.base)) {
        throw new RangeError('rule.configuration.base is not supported.');
      }

      const baseAmount = context.percentageBaseAmounts[configuration.base];
      if (baseAmount === undefined) {
        throw new RangeError(
          `Missing percentage base amount for ${configuration.base}.`,
        );
      }

      return roundNonNegativeProductRatio(
        baseAmount,
        configuration.basisPoints,
        10000,
        `context.percentageBaseAmounts.${configuration.base}`,
      );
    }

    default:
      throw new RangeError('rule.compensationModel is not supported.');
  }
}

function cloneConfiguration(configuration) {
  return Object.freeze({ ...configuration });
}

export function resolveAndCalculateCompensation(rules, contextValue) {
  const context = normalizeCompensationCalculationContext(contextValue);
  const rule = resolveCompensationRule(rules, context);
  if (rule === null) return null;

  const expectedAmountIdr = calculateCompensationAmount(rule, context);
  const percentageBase =
    rule.compensationModel === COMPENSATION_RULE_MODELS.PERCENTAGE
      ? Object.freeze({
          amountIdr: context.percentageBaseAmounts[rule.configuration.base],
          base: rule.configuration.base,
        })
      : null;

  return Object.freeze({
    expectedAmountIdr,
    rule,
    snapshot: Object.freeze({
      compensationModel: rule.compensationModel,
      configuration: cloneConfiguration(rule.configuration),
      durationMinutes: context.durationMinutes,
      effectiveAtIso: context.effectiveAt.toISOString(),
      expectedAmountIdr,
      operatorId: context.operatorId,
      operatorType: context.operatorType,
      percentageBase,
      ruleId: rule.id,
      sessionTypeId: context.sessionTypeId,
      studioId: context.studioId,
    }),
  });
}
