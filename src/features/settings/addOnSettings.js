import { formatIntegerIdr } from '../../lib/money/idr.js';
import { ADD_ON_PRICING_TYPES } from '../pricing/addOnPricing.js';
import { normalizeAddOnDetails } from '../pricing/addOns.js';
import {
  PRICING_RULE_DURATION_STEP_MINUTES,
  PRICING_RULE_MAX_DURATION_MINUTES,
  PRICING_RULE_ROUNDING_MODES,
} from '../pricing/pricingRules.js';

export const ADD_ON_PRICING_TYPE_OPTIONS = Object.freeze([
  Object.freeze({ label: 'Harga tetap', value: ADD_ON_PRICING_TYPES.FIXED }),
  Object.freeze({ label: 'Per jumlah / unit', value: ADD_ON_PRICING_TYPES.QUANTITY }),
  Object.freeze({ label: 'Per waktu / increment', value: ADD_ON_PRICING_TYPES.TIME }),
]);

export const ADD_ON_ROUNDING_OPTIONS = Object.freeze([
  Object.freeze({ label: 'Harus pas dengan increment', value: PRICING_RULE_ROUNDING_MODES.EXACT }),
  Object.freeze({ label: 'Bulatkan ke atas', value: PRICING_RULE_ROUNDING_MODES.ROUND_UP }),
]);

export const DEFAULT_ADD_ON_FORM_VALUES = Object.freeze({
  amountIdr: '',
  amountPerIncrementIdr: '',
  amountPerUnitIdr: '',
  description: '',
  displayOrder: '1',
  incrementMinutes: '60',
  name: '',
  pricingType: '',
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

function normalizeSessionTypeId(value, errors) {
  const sessionTypeId = String(value ?? '').trim();
  if (!sessionTypeId) return null;
  if (sessionTypeId.length > 128 || sessionTypeId.includes('/')) {
    errors.sessionTypeId = true;
    return null;
  }
  return sessionTypeId;
}

function buildConfiguration(formValues, errors) {
  if (formValues.pricingType === ADD_ON_PRICING_TYPES.FIXED) {
    return { amountIdr: parseSafeInteger(formValues.amountIdr, 'amountIdr', errors) };
  }

  if (formValues.pricingType === ADD_ON_PRICING_TYPES.QUANTITY) {
    return {
      amountPerUnitIdr: parseSafeInteger(formValues.amountPerUnitIdr, 'amountPerUnitIdr', errors),
    };
  }

  if (formValues.pricingType === ADD_ON_PRICING_TYPES.TIME) {
    return {
      amountPerIncrementIdr: parseSafeInteger(
        formValues.amountPerIncrementIdr,
        'amountPerIncrementIdr',
        errors,
      ),
      incrementMinutes: parseDuration(formValues.incrementMinutes, 'incrementMinutes', errors),
      roundingMode: formValues.roundingMode,
    };
  }

  errors.pricingType = true;
  return null;
}

export function validateAddOnForm(formValues) {
  const errors = {};
  const name = String(formValues.name ?? '').trim();
  const description = String(formValues.description ?? '').trim();
  const sessionTypeId = normalizeSessionTypeId(formValues.sessionTypeId, errors);
  const displayOrder = parseSafeInteger(formValues.displayOrder, 'displayOrder', errors, {
    min: 1,
    max: 999,
  });

  if (!name || name.length > 100) errors.name = true;
  if (description.length > 240) errors.description = true;

  const configuration = buildConfiguration(formValues, errors);
  if (Object.keys(errors).length || configuration === null || displayOrder === null) {
    return Object.freeze({ errors: Object.freeze(errors), value: null });
  }

  try {
    const value = normalizeAddOnDetails({
      configuration,
      description,
      displayOrder,
      name,
      pricingType: formValues.pricingType,
      sessionTypeId,
    });
    return Object.freeze({ errors: Object.freeze({}), value });
  } catch {
    return Object.freeze({ errors: Object.freeze({ form: true }), value: null });
  }
}

export function toAddOnFormValues(addOn) {
  const values = {
    ...DEFAULT_ADD_ON_FORM_VALUES,
    description: addOn.description,
    displayOrder: String(addOn.displayOrder),
    name: addOn.name,
    pricingType: addOn.pricingType,
    sessionTypeId: addOn.sessionTypeId ?? '',
  };

  if (addOn.pricingType === ADD_ON_PRICING_TYPES.FIXED) {
    return { ...values, amountIdr: String(addOn.configuration.amountIdr) };
  }

  if (addOn.pricingType === ADD_ON_PRICING_TYPES.QUANTITY) {
    return { ...values, amountPerUnitIdr: String(addOn.configuration.amountPerUnitIdr) };
  }

  return {
    ...values,
    amountPerIncrementIdr: String(addOn.configuration.amountPerIncrementIdr),
    incrementMinutes: String(addOn.configuration.incrementMinutes),
    roundingMode: addOn.configuration.roundingMode,
  };
}

export function getAddOnPricingTypeLabel(pricingType) {
  return ADD_ON_PRICING_TYPE_OPTIONS.find((option) => option.value === pricingType)?.label ?? pricingType;
}

export function formatAddOnPricingSummary(addOn) {
  if (addOn.pricingType === ADD_ON_PRICING_TYPES.FIXED) {
    return `${formatIntegerIdr(addOn.configuration.amountIdr)} sekali pilih`;
  }

  if (addOn.pricingType === ADD_ON_PRICING_TYPES.QUANTITY) {
    return `${formatIntegerIdr(addOn.configuration.amountPerUnitIdr)} / unit`;
  }

  const rounding =
    addOn.configuration.roundingMode === PRICING_RULE_ROUNDING_MODES.ROUND_UP
      ? 'bulatkan ke atas'
      : 'harus pas';
  return `${formatIntegerIdr(addOn.configuration.amountPerIncrementIdr)} / ${addOn.configuration.incrementMinutes} mnt · ${rounding}`;
}
