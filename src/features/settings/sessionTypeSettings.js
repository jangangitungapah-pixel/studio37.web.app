import {
  normalizeSessionTypeDetails,
  SESSION_TYPE_DURATION_STEP_MINUTES,
  SESSION_TYPE_MAX_DURATION_MINUTES,
} from '../pricing/sessionTypes.js';

export const DEFAULT_SESSION_TYPE_FORM_VALUES = Object.freeze({
  code: '',
  defaultDurationMinutes: '60',
  description: '',
  displayOrder: '1',
  minimumDurationMinutes: '60',
  name: '',
  requiresStudioReservation: true,
  useDurationConfiguration: true,
});

const sessionTypeCodePattern = /^[A-Z0-9][A-Z0-9-]{0,23}$/;

function parseInteger(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string' || !value.trim()) return Number.NaN;
  return Number(value);
}

function validateDuration(value, fieldName, errors) {
  const parsed = parseInteger(value);

  if (
    !Number.isInteger(parsed) ||
    parsed < SESSION_TYPE_DURATION_STEP_MINUTES ||
    parsed > SESSION_TYPE_MAX_DURATION_MINUTES ||
    parsed % SESSION_TYPE_DURATION_STEP_MINUTES !== 0
  ) {
    errors[fieldName] = true;
    return null;
  }

  return parsed;
}

export function getNextSessionTypeDisplayOrder(sessionTypes) {
  if (!sessionTypes.length) return 1;
  return Math.min(999, Math.max(...sessionTypes.map(({ displayOrder }) => displayOrder)) + 1);
}

export function toSessionTypeFormValues(sessionType) {
  if (!sessionType) return { ...DEFAULT_SESSION_TYPE_FORM_VALUES };

  const hasDurationConfiguration =
    sessionType.defaultDurationMinutes !== null && sessionType.minimumDurationMinutes !== null;

  return {
    code: sessionType.code,
    defaultDurationMinutes:
      sessionType.defaultDurationMinutes === null ? '' : String(sessionType.defaultDurationMinutes),
    description: sessionType.description,
    displayOrder: String(sessionType.displayOrder),
    minimumDurationMinutes:
      sessionType.minimumDurationMinutes === null ? '' : String(sessionType.minimumDurationMinutes),
    name: sessionType.name,
    requiresStudioReservation: sessionType.requiresStudioReservation,
    useDurationConfiguration: sessionType.requiresStudioReservation || hasDurationConfiguration,
  };
}

export function validateSessionTypeForm(value) {
  const errors = {};
  const name = typeof value?.name === 'string' ? value.name.trim() : '';
  const code = typeof value?.code === 'string' ? value.code.trim().toUpperCase() : '';
  const description = typeof value?.description === 'string' ? value.description.trim() : '';
  const displayOrder = parseInteger(value?.displayOrder);
  const requiresStudioReservation = value?.requiresStudioReservation === true;
  const useDurationConfiguration = requiresStudioReservation || value?.useDurationConfiguration === true;

  if (!name || name.length > 80) errors.name = true;
  if (!sessionTypeCodePattern.test(code)) errors.code = true;
  if (description.length > 240) errors.description = true;
  if (!Number.isInteger(displayOrder) || displayOrder < 1 || displayOrder > 999) {
    errors.displayOrder = true;
  }

  let defaultDurationMinutes = null;
  let minimumDurationMinutes = null;

  if (useDurationConfiguration) {
    defaultDurationMinutes = validateDuration(
      value?.defaultDurationMinutes,
      'defaultDurationMinutes',
      errors,
    );
    minimumDurationMinutes = validateDuration(
      value?.minimumDurationMinutes,
      'minimumDurationMinutes',
      errors,
    );

    if (
      defaultDurationMinutes !== null &&
      minimumDurationMinutes !== null &&
      minimumDurationMinutes > defaultDurationMinutes
    ) {
      errors.minimumDurationMinutes = true;
    }
  }

  if (Object.keys(errors).length > 0) {
    return Object.freeze({ errors: Object.freeze(errors), value: null });
  }

  const normalized = normalizeSessionTypeDetails({
    code,
    defaultDurationMinutes,
    description,
    displayOrder,
    minimumDurationMinutes,
    name,
    requiresStudioReservation,
  });

  return Object.freeze({ errors: Object.freeze({}), value: normalized });
}
