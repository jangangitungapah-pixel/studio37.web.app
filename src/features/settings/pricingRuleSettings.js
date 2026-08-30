import { formatIntegerIdr } from '../../lib/money/idr.js';
import {
  normalizePricingRuleDetails,
  PRICING_RULE_DURATION_STEP_MINUTES,
  PRICING_RULE_MAX_DURATION_MINUTES,
  PRICING_RULE_MODELS,
  PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES,
  PRICING_RULE_ROUNDING_MODES,
} from '../pricing/pricingRules.js';

export const PRICING_RULE_MODEL_OPTIONS = Object.freeze([
  Object.freeze({ label: 'Per jam / increment', value: PRICING_RULE_MODELS.HOURLY }),
  Object.freeze({ label: 'Harga tetap per session', value: PRICING_RULE_MODELS.FIXED_SESSION }),
  Object.freeze({ label: 'Paket durasi', value: PRICING_RULE_MODELS.DURATION_PACKAGE }),
  Object.freeze({
    label: 'Harga dasar + waktu tambahan',
    value: PRICING_RULE_MODELS.BASE_PLUS_ADDITIONAL,
  }),
]);

export const PRICING_RULE_ROUNDING_OPTIONS = Object.freeze([
  Object.freeze({ label: 'Harus pas dengan increment', value: PRICING_RULE_ROUNDING_MODES.EXACT }),
  Object.freeze({ label: 'Bulatkan ke atas', value: PRICING_RULE_ROUNDING_MODES.ROUND_UP }),
]);

export const PRICING_RULE_PACKAGE_EXTRA_TIME_OPTIONS = Object.freeze([
  Object.freeze({
    label: 'Blokir waktu tambahan',
    value: PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.BLOCKED,
  }),
  Object.freeze({
    label: 'Tagih waktu tambahan',
    value: PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.ADDITIONAL,
  }),
  Object.freeze({
    label: 'Harus pilih paket lain',
    value: PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.ANOTHER_PACKAGE,
  }),
]);

export const DEFAULT_PRICING_RULE_FORM_VALUES = Object.freeze({
  additionalAmountPerIncrementIdr: '',
  additionalIncrementMinutes: '60',
  amountIdr: '',
  amountPerIncrementIdr: '',
  baseAmountIdr: '',
  baseDurationMinutes: '120',
  durationMinutes: '180',
  extraTimePolicy: PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.BLOCKED,
  incrementMinutes: '60',
  minimumDurationMinutes: '60',
  name: '',
  pricingModel: '',
  priority: '100',
  roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT,
  sessionTypeId: '',
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

function buildConfiguration(formValues, errors) {
  switch (formValues.pricingModel) {
    case PRICING_RULE_MODELS.HOURLY:
      return {
        amountPerIncrementIdr: parseSafeInteger(
          formValues.amountPerIncrementIdr,
          'amountPerIncrementIdr',
          errors,
        ),
        incrementMinutes: parseDuration(formValues.incrementMinutes, 'incrementMinutes', errors),
        minimumDurationMinutes: parseDuration(
          formValues.minimumDurationMinutes,
          'minimumDurationMinutes',
          errors,
        ),
        roundingMode: formValues.roundingMode,
      };

    case PRICING_RULE_MODELS.FIXED_SESSION:
      return {
        amountIdr: parseSafeInteger(formValues.amountIdr, 'amountIdr', errors),
      };

    case PRICING_RULE_MODELS.DURATION_PACKAGE: {
      const usesAdditional =
        formValues.extraTimePolicy === PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.ADDITIONAL;

      return {
        additionalAmountPerIncrementIdr: usesAdditional
          ? parseSafeInteger(
              formValues.additionalAmountPerIncrementIdr,
              'additionalAmountPerIncrementIdr',
              errors,
            )
          : null,
        additionalIncrementMinutes: usesAdditional
          ? parseDuration(
              formValues.additionalIncrementMinutes,
              'additionalIncrementMinutes',
              errors,
            )
          : null,
        amountIdr: parseSafeInteger(formValues.amountIdr, 'amountIdr', errors),
        durationMinutes: parseDuration(formValues.durationMinutes, 'durationMinutes', errors),
        extraTimePolicy: formValues.extraTimePolicy,
        roundingMode: usesAdditional ? formValues.roundingMode : null,
      };
    }

    case PRICING_RULE_MODELS.BASE_PLUS_ADDITIONAL:
      return {
        additionalAmountPerIncrementIdr: parseSafeInteger(
          formValues.additionalAmountPerIncrementIdr,
          'additionalAmountPerIncrementIdr',
          errors,
        ),
        additionalIncrementMinutes: parseDuration(
          formValues.additionalIncrementMinutes,
          'additionalIncrementMinutes',
          errors,
        ),
        baseAmountIdr: parseSafeInteger(formValues.baseAmountIdr, 'baseAmountIdr', errors),
        baseDurationMinutes: parseDuration(
          formValues.baseDurationMinutes,
          'baseDurationMinutes',
          errors,
        ),
        roundingMode: formValues.roundingMode,
      };

    default:
      errors.pricingModel = true;
      return null;
  }
}

export function toPricingRuleFormValues(pricingRule) {
  const values = {
    ...DEFAULT_PRICING_RULE_FORM_VALUES,
    name: pricingRule.name,
    pricingModel: pricingRule.pricingModel,
    priority: String(pricingRule.priority),
    sessionTypeId: pricingRule.sessionTypeId,
  };
  const configuration = pricingRule.configuration;

  switch (pricingRule.pricingModel) {
    case PRICING_RULE_MODELS.HOURLY:
      return {
        ...values,
        amountPerIncrementIdr: String(configuration.amountPerIncrementIdr),
        incrementMinutes: String(configuration.incrementMinutes),
        minimumDurationMinutes: String(configuration.minimumDurationMinutes),
        roundingMode: configuration.roundingMode,
      };

    case PRICING_RULE_MODELS.FIXED_SESSION:
      return { ...values, amountIdr: String(configuration.amountIdr) };

    case PRICING_RULE_MODELS.DURATION_PACKAGE:
      return {
        ...values,
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
        roundingMode: configuration.roundingMode ?? PRICING_RULE_ROUNDING_MODES.EXACT,
      };

    case PRICING_RULE_MODELS.BASE_PLUS_ADDITIONAL:
      return {
        ...values,
        additionalAmountPerIncrementIdr: String(configuration.additionalAmountPerIncrementIdr),
        additionalIncrementMinutes: String(configuration.additionalIncrementMinutes),
        baseAmountIdr: String(configuration.baseAmountIdr),
        baseDurationMinutes: String(configuration.baseDurationMinutes),
        roundingMode: configuration.roundingMode,
      };

    default:
      return values;
  }
}

export function validatePricingRuleForm(formValues, { editingRule = null } = {}) {
  const errors = {};
  const name = String(formValues.name ?? '').trim();
  const sessionTypeId = String(formValues.sessionTypeId ?? '').trim();
  const priority = parseSafeInteger(formValues.priority, 'priority', errors, { min: 1, max: 999 });

  if (!name || name.length > 100) errors.name = true;
  if (!sessionTypeId || sessionTypeId.length > 128 || sessionTypeId.includes('/')) {
    errors.sessionTypeId = true;
  }

  const configuration = buildConfiguration(formValues, errors);
  if (Object.keys(errors).length || configuration === null || priority === null) {
    return Object.freeze({ errors: Object.freeze(errors), value: null });
  }

  try {
    const value = normalizePricingRuleDetails({
      configuration,
      effectiveFrom: editingRule?.effectiveFrom ?? null,
      effectiveUntil: editingRule?.effectiveUntil ?? null,
      name,
      pricingModel: formValues.pricingModel,
      priority,
      sessionTypeId,
      studioId: editingRule?.studioId ?? null,
    });

    return Object.freeze({ errors: Object.freeze({}), value });
  } catch {
    return Object.freeze({
      errors: Object.freeze({ form: true }),
      value: null,
    });
  }
}

export function getPricingRuleModelLabel(model) {
  return PRICING_RULE_MODEL_OPTIONS.find((option) => option.value === model)?.label ?? model;
}

function getRoundingLabel(roundingMode) {
  return roundingMode === PRICING_RULE_ROUNDING_MODES.ROUND_UP ? 'bulatkan ke atas' : 'harus pas';
}

export function formatPricingRuleConfigurationSummary(pricingRule) {
  const configuration = pricingRule.configuration;

  switch (pricingRule.pricingModel) {
    case PRICING_RULE_MODELS.HOURLY:
      return `${formatIntegerIdr(configuration.amountPerIncrementIdr)} / ${configuration.incrementMinutes} mnt · min ${configuration.minimumDurationMinutes} mnt · ${getRoundingLabel(configuration.roundingMode)}`;

    case PRICING_RULE_MODELS.FIXED_SESSION:
      return `${formatIntegerIdr(configuration.amountIdr)} / session`;

    case PRICING_RULE_MODELS.DURATION_PACKAGE: {
      const base = `${configuration.durationMinutes} mnt · ${formatIntegerIdr(configuration.amountIdr)}`;
      if (configuration.extraTimePolicy === PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.BLOCKED) {
        return `${base} · ekstra diblokir`;
      }
      if (
        configuration.extraTimePolicy === PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.ANOTHER_PACKAGE
      ) {
        return `${base} · ekstra wajib paket lain`;
      }
      return `${base} · + ${formatIntegerIdr(configuration.additionalAmountPerIncrementIdr)} / ${configuration.additionalIncrementMinutes} mnt`;
    }

    case PRICING_RULE_MODELS.BASE_PLUS_ADDITIONAL:
      return `${configuration.baseDurationMinutes} mnt awal ${formatIntegerIdr(configuration.baseAmountIdr)} · + ${formatIntegerIdr(configuration.additionalAmountPerIncrementIdr)} / ${configuration.additionalIncrementMinutes} mnt`;

    default:
      return 'Konfigurasi harga tidak dikenali.';
  }
}
