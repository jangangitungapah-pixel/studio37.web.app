import { PRICING_RULE_MODELS, PRICING_RULE_STATUSES } from '../pricing/pricingRules.js';

function isSameResolutionEnvelope(rule, details) {
  return (
    rule.sessionTypeId === details.sessionTypeId &&
    rule.studioId === details.studioId &&
    rule.priority === details.priority
  );
}

function areDistinctDurationPackages(rule, details) {
  return (
    rule.pricingModel === PRICING_RULE_MODELS.DURATION_PACKAGE &&
    details.pricingModel === PRICING_RULE_MODELS.DURATION_PACKAGE &&
    rule.configuration.durationMinutes !== details.configuration.durationMinutes
  );
}

function getWindowBoundary(value, fallback, label) {
  if (value === null || value === undefined) return fallback;

  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  if (!Number.isFinite(time)) {
    throw new TypeError(`${label} must be a valid date or null.`);
  }

  return time;
}

export function doPricingRuleEffectiveWindowsOverlap(leftRule, rightRule) {
  const leftStart = getWindowBoundary(
    leftRule.effectiveFrom,
    Number.NEGATIVE_INFINITY,
    'leftRule.effectiveFrom',
  );
  const leftEnd = getWindowBoundary(
    leftRule.effectiveUntil,
    Number.POSITIVE_INFINITY,
    'leftRule.effectiveUntil',
  );
  const rightStart = getWindowBoundary(
    rightRule.effectiveFrom,
    Number.NEGATIVE_INFINITY,
    'rightRule.effectiveFrom',
  );
  const rightEnd = getWindowBoundary(
    rightRule.effectiveUntil,
    Number.POSITIVE_INFINITY,
    'rightRule.effectiveUntil',
  );

  return leftStart < rightEnd && rightStart < leftEnd;
}

export function hasPricingRuleWriteCollision(pricingRules, details, { excludeId = null } = {}) {
  if (!Array.isArray(pricingRules)) {
    throw new TypeError('pricingRules must be an array.');
  }

  return pricingRules.some((rule) => {
    if (rule.id === excludeId || rule.status !== PRICING_RULE_STATUSES.ACTIVE) return false;
    if (!isSameResolutionEnvelope(rule, details)) return false;
    if (!doPricingRuleEffectiveWindowsOverlap(rule, details)) return false;

    return !areDistinctDurationPackages(rule, details);
  });
}
