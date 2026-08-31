import { formatIntegerIdr } from '../../lib/money/idr.js';
import {
  normalizePricingRuleDetails,
  PRICING_RULE_DURATION_STEP_MINUTES,
  PRICING_RULE_MAX_DURATION_MINUTES,
  PRICING_RULE_MODELS,
  PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES,
  PRICING_RULE_ROUNDING_MODES,
} from '../pricing/pricingRules.js';

const supportedExtraTimePolicies = new Set(Object.values(PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES));
const supportedRoundingModes = new Set(Object.values(PRICING_RULE_ROUNDING_MODES));
const nameCollator = new Intl.Collator('id-ID', { sensitivity: 'base' });

export const DEFAULT_DURATION_PACKAGE_FORM_VALUES = Object.freeze({
  additionalAmountPerIncrementIdr: '',
  additionalIncrementMinutes: '60',
  amountIdr: '',
  durationMinutes: '180',
  extraTimePolicy: PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.BLOCKED,
  name: '',
  roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT,
  sessionTypeId: '',
  studioId: '',
});

function parseSafeInteger(value, label, errors, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const normalized = String(value ?? '').trim();

  if (!/^\d+$/.test(normalized)) {
    errors[label] = true;
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    errors[label] = true;
    return null;
  }

  return parsed;
}

function parseOptionalReference(value, label, errors) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;

  if (normalized.length > 128 || normalized.includes('/')) {
    errors[label] = true;
    return null;
  }

  return normalized;
}

function parseDuration(value, label, errors) {
  const parsed = parseSafeInteger(value, label, errors, {
    min: PRICING_RULE_DURATION_STEP_MINUTES,
    max: PRICING_RULE_MAX_DURATION_MINUTES,
  });

  if (parsed !== null && parsed % PRICING_RULE_DURATION_STEP_MINUTES !== 0) {
    errors[label] = true;
    return null;
  }

  return parsed;
}

function requireDurationPackageEnvelopeSource(rule, label) {
  if (rule && rule.pricingModel !== PRICING_RULE_MODELS.DURATION_PACKAGE) {
    throw new TypeError(`${label} must be a duration-package pricing rule.`);
  }

  return rule;
}

function getEnvelope(editingRule, templateRule, sessionTypeId, studioId) {
  const source =
    requireDurationPackageEnvelopeSource(editingRule, 'editingRule') ??
    requireDurationPackageEnvelopeSource(templateRule, 'templateRule');

  if (!source) {
    return {
      effectiveFrom: null,
      effectiveUntil: null,
      priority: 100,
      sessionTypeId,
      studioId,
    };
  }

  return {
    effectiveFrom: source.effectiveFrom,
    effectiveUntil: source.effectiveUntil,
    priority: source.priority,
    sessionTypeId: source.sessionTypeId,
    studioId: source.studioId,
  };
}

function timestampKey(value) {
  if (value === null) return 'none';
  if (value instanceof Date) return String(value.getTime());
  if (typeof value?.toDate === 'function') return String(value.toDate().getTime());
  return String(value);
}

function packageGroupKey(rule) {
  return [
    rule.sessionTypeId,
    rule.studioId ?? '*',
    rule.priority,
    timestampKey(rule.effectiveFrom),
    timestampKey(rule.effectiveUntil),
  ].join('::');
}

export function toDurationPackageFormValues(rule) {
  requireDurationPackageEnvelopeSource(rule, 'rule');
  const configuration = rule.configuration;

  return {
    ...DEFAULT_DURATION_PACKAGE_FORM_VALUES,
    additionalAmountPerIncrementIdr:
      configuration.additionalAmountPerIncrementIdr === null
        ? ''
        : String(configuration.additionalAmountPerIncrementIdr),
    additionalIncrementMinutes:
      configuration.additionalIncrementMinutes === null
        ? '60'
        : String(configuration.additionalIncrementMinutes),
    amountIdr: String(configuration.amountIdr),
    durationMinutes: String(configuration.durationMinutes),
    extraTimePolicy: configuration.extraTimePolicy,
    name: rule.name,
    roundingMode: configuration.roundingMode ?? PRICING_RULE_ROUNDING_MODES.EXACT,
    sessionTypeId: rule.sessionTypeId,
    studioId: rule.studioId ?? '',
  };
}

export function validateDurationPackageForm(
  formValues,
  { editingRule = null, templateRule = null } = {},
) {
  const errors = {};
  const name = String(formValues.name ?? '').trim();
  const requestedSessionTypeId = String(formValues.sessionTypeId ?? '').trim();
  const requestedStudioId = parseOptionalReference(formValues.studioId, 'studioId', errors);
  const envelopeSource = editingRule ?? templateRule;
  const sessionTypeId = envelopeSource?.sessionTypeId ?? requestedSessionTypeId;
  const studioId = envelopeSource?.studioId ?? requestedStudioId;

  if (!name || name.length > 100) errors.name = true;
  if (!sessionTypeId || sessionTypeId.length > 128 || sessionTypeId.includes('/')) {
    errors.sessionTypeId = true;
  }

  const durationMinutes = parseDuration(formValues.durationMinutes, 'durationMinutes', errors);
  const amountIdr = parseSafeInteger(formValues.amountIdr, 'amountIdr', errors);
  const extraTimePolicy = formValues.extraTimePolicy;

  if (!supportedExtraTimePolicies.has(extraTimePolicy)) {
    errors.extraTimePolicy = true;
  }

  const usesAdditional = extraTimePolicy === PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.ADDITIONAL;
  const additionalAmountPerIncrementIdr = usesAdditional
    ? parseSafeInteger(
        formValues.additionalAmountPerIncrementIdr,
        'additionalAmountPerIncrementIdr',
        errors,
      )
    : null;
  const additionalIncrementMinutes = usesAdditional
    ? parseDuration(formValues.additionalIncrementMinutes, 'additionalIncrementMinutes', errors)
    : null;
  const roundingMode = usesAdditional ? formValues.roundingMode : null;

  if (usesAdditional && !supportedRoundingModes.has(roundingMode)) {
    errors.roundingMode = true;
  }

  if (Object.keys(errors).length) {
    return Object.freeze({ errors: Object.freeze(errors), value: null });
  }

  try {
    const envelope = getEnvelope(editingRule, templateRule, sessionTypeId, studioId);
    const value = normalizePricingRuleDetails({
      configuration: {
        additionalAmountPerIncrementIdr,
        additionalIncrementMinutes,
        amountIdr,
        durationMinutes,
        extraTimePolicy,
        roundingMode,
      },
      effectiveFrom: envelope.effectiveFrom,
      effectiveUntil: envelope.effectiveUntil,
      name,
      pricingModel: PRICING_RULE_MODELS.DURATION_PACKAGE,
      priority: envelope.priority,
      sessionTypeId: envelope.sessionTypeId,
      studioId: envelope.studioId,
    });

    return Object.freeze({ errors: Object.freeze({}), value });
  } catch {
    return Object.freeze({ errors: Object.freeze({ form: true }), value: null });
  }
}

export function groupDurationPackageRules(pricingRules) {
  if (!Array.isArray(pricingRules)) {
    throw new TypeError('pricingRules must be an array.');
  }

  const groups = new Map();

  pricingRules
    .filter((rule) => rule.pricingModel === PRICING_RULE_MODELS.DURATION_PACKAGE)
    .forEach((rule) => {
      const key = packageGroupKey(rule);
      const current = groups.get(key);

      if (current) {
        current.rules.push(rule);
        return;
      }

      groups.set(key, {
        effectiveFrom: rule.effectiveFrom,
        effectiveUntil: rule.effectiveUntil,
        key,
        priority: rule.priority,
        rules: [rule],
        sessionTypeId: rule.sessionTypeId,
        studioId: rule.studioId,
      });
    });

  const normalizedGroups = [...groups.values()].map((group) => {
    const rules = [...group.rules].sort((left, right) => {
      const durationDifference =
        left.configuration.durationMinutes - right.configuration.durationMinutes;
      if (durationDifference !== 0) return durationDifference;

      const nameDifference = nameCollator.compare(left.name, right.name);
      if (nameDifference !== 0) return nameDifference;
      return left.id.localeCompare(right.id);
    });

    return Object.freeze({ ...group, rules: Object.freeze(rules) });
  });

  normalizedGroups.sort((left, right) => {
    const sessionDifference = left.sessionTypeId.localeCompare(right.sessionTypeId);
    if (sessionDifference !== 0) return sessionDifference;

    const studioDifference = (left.studioId ?? '').localeCompare(right.studioId ?? '');
    if (studioDifference !== 0) return studioDifference;

    const priorityDifference = right.priority - left.priority;
    if (priorityDifference !== 0) return priorityDifference;

    return left.key.localeCompare(right.key);
  });

  return Object.freeze(normalizedGroups);
}

export function formatDurationPackageExtraTime(rule) {
  requireDurationPackageEnvelopeSource(rule, 'rule');
  const configuration = rule.configuration;

  if (configuration.extraTimePolicy === PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.BLOCKED) {
    return 'Extra time diblokir';
  }

  if (configuration.extraTimePolicy === PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.ANOTHER_PACKAGE) {
    return 'Extra time wajib pilih paket lain';
  }

  const rounding =
    configuration.roundingMode === PRICING_RULE_ROUNDING_MODES.ROUND_UP
      ? 'bulatkan ke atas'
      : 'harus pas';

  return `+ ${formatIntegerIdr(configuration.additionalAmountPerIncrementIdr)} / ${configuration.additionalIncrementMinutes} mnt · ${rounding}`;
}
