import { Timestamp } from 'firebase/firestore';

export const DEFAULT_STUDIO_TIME_ZONE = 'Asia/Jakarta';

function cloneValidDate(value, label) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError(`${label} must resolve to a valid Date.`);
  }

  return new Date(value.getTime());
}

export function toJavaScriptDate(value, { allowNull = false, label = 'timestamp' } = {}) {
  if (value === null || value === undefined) {
    if (allowNull) {
      return null;
    }

    throw new TypeError(`${label} is required.`);
  }

  if (value instanceof Date) {
    return cloneValidDate(value, label);
  }

  if (typeof value === 'object' && typeof value.toDate === 'function') {
    return cloneValidDate(value.toDate(), label);
  }

  throw new TypeError(`${label} must be a Date or Firestore Timestamp.`);
}

export function toFirestoreTimestamp(value, options = {}) {
  const date = toJavaScriptDate(value, options);

  return date === null ? null : Timestamp.fromDate(date);
}

export function toIsoDateTime(value, options = {}) {
  const date = toJavaScriptDate(value, options);

  return date === null ? null : date.toISOString();
}

export function formatDateTimeInTimeZone(
  value,
  {
    dateStyle = 'medium',
    locale = 'id-ID',
    timeStyle = 'short',
    timeZone = DEFAULT_STUDIO_TIME_ZONE,
  } = {},
) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle,
    timeStyle,
    timeZone,
  }).format(toJavaScriptDate(value));
}

export function getDateTimePartsInTimeZone(value, { timeZone = DEFAULT_STUDIO_TIME_ZONE } = {}) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone,
    year: 'numeric',
  });
  const values = Object.fromEntries(
    formatter
      .formatToParts(toJavaScriptDate(value))
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value: partValue }) => [type, Number(partValue)]),
  );

  return Object.freeze({
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    month: values.month,
    second: values.second,
    year: values.year,
  });
}
