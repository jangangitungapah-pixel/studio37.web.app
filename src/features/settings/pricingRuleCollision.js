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

export function hasPricingRuleWriteCollision(pricingRules, details, { excludeId = null } = {}) {
  if (!Array.isArray(pricingRules)) {
    throw new TypeError('pricingRules must be an array.');
  }

  return pricingRules.some((rule) => {
    if (rule.id === excludeId || rule.status !== PRICING_RULE_STATUSES.ACTIVE) return false;
    if (!isSameResolutionEnvelope(rule, details)) return false;

    return !areDistinctDurationPackages(rule, details);
  });
}
