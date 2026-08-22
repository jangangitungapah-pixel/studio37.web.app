import { DEFAULT_STUDIO_TIME_ZONE, toJavaScriptDate } from '../../lib/datetime/timestamps.js';

export const STUDIO_SETTINGS_COLLECTION_NAME = 'appSettings';
export const STUDIO_SETTINGS_DOCUMENT_ID = 'studio';

export const STUDIO_BOOKING_INTERVALS = Object.freeze([15, 30, 60]);

export const STUDIO_TIME_ZONE_OPTIONS = Object.freeze([
  Object.freeze({ label: 'WIB — Asia/Jakarta', value: 'Asia/Jakarta' }),
  Object.freeze({ label: 'WITA — Asia/Makassar', value: 'Asia/Makassar' }),
  Object.freeze({ label: 'WIT — Asia/Jayapura', value: 'Asia/Jayapura' }),
]);

export const DEFAULT_STUDIO_SETTINGS_FORM_VALUES = Object.freeze({
  bookingIntervalMinutes: '30',
  businessName: 'Studio37',
  closesAt: '22:00',
  opensAt: '10:00',
  timeZone: DEFAULT_STUDIO_TIME_ZONE,
});

const supportedBookingIntervals = new Set(STUDIO_BOOKING_INTERVALS);
const supportedTimeZones = new Set(STUDIO_TIME_ZONE_OPTIONS.map(({ value }) => value));
const persistedFieldNames = Object.freeze([
  'bookingIntervalMinutes',
  'businessName',
  'createdAt',
  'createdByUid',
  'id',
  'operatingHours',
  'timeZone',
  'updatedAt',
  'updatedByUid',
]);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireRecord(value, label) {
  if (!isRecord(value)) {
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
    throw new TypeError(`${label} has an unsupported document shape.`);
  }
}

function requireTrimmedString(value, label, { maxLength = 120 } = {}) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }

  const normalized = value.trim();

  if (normalized.length > maxLength) {
    throw new RangeError(`${label} must be at most ${maxLength} characters.`);
  }

  return normalized;
}

function requireActorUid(value, label) {
  const uid = requireTrimmedString(value, label, { maxLength: 128 });

  if (uid.includes('/')) {
    throw new TypeError(`${label} must be a Firestore document id.`);
  }

  return uid;
}

function requireMinuteOfDay(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 1439) {
    throw new RangeError(`${label} must be an integer minute between 0 and 1439.`);
  }

  return value;
}

function requireBookingInterval(value) {
  if (!Number.isInteger(value) || !supportedBookingIntervals.has(value)) {
    throw new RangeError('studioSettings.bookingIntervalMinutes is not supported.');
  }

  return value;
}

function requireTimeZone(value) {
  if (typeof value !== 'string' || !supportedTimeZones.has(value)) {
    throw new RangeError('studioSettings.timeZone is not supported.');
  }

  return value;
}

function normalizeOperatingHours(value, bookingIntervalMinutes) {
  const hours = requireRecord(value, 'studioSettings.operatingHours');
  requireExactFields(hours, ['closesAtMinutes', 'opensAtMinutes'], 'studioSettings.operatingHours');

  const opensAtMinutes = requireMinuteOfDay(
    hours.opensAtMinutes,
    'studioSettings.operatingHours.opensAtMinutes',
  );
  const closesAtMinutes = requireMinuteOfDay(
    hours.closesAtMinutes,
    'studioSettings.operatingHours.closesAtMinutes',
  );

  if (opensAtMinutes >= closesAtMinutes) {
    throw new RangeError('Studio closing time must be later than opening time.');
  }

  if (
    opensAtMinutes % bookingIntervalMinutes !== 0 ||
    closesAtMinutes % bookingIntervalMinutes !== 0
  ) {
    throw new RangeError('Operating hours must align with the booking interval.');
  }

  if (closesAtMinutes - opensAtMinutes < bookingIntervalMinutes) {
    throw new RangeError('Operating hours must contain at least one booking interval.');
  }

  return Object.freeze({ closesAtMinutes, opensAtMinutes });
}

export function normalizeStudioSettings(value) {
  const settings = requireRecord(value, 'studioSettings');
  const bookingIntervalMinutes = requireBookingInterval(settings.bookingIntervalMinutes);

  return Object.freeze({
    bookingIntervalMinutes,
    businessName: requireTrimmedString(settings.businessName, 'studioSettings.businessName'),
    operatingHours: normalizeOperatingHours(settings.operatingHours, bookingIntervalMinutes),
    timeZone: requireTimeZone(settings.timeZone),
  });
}

export function decodeStudioSettingsDocument(value) {
  const settings = requireRecord(value, 'studioSettings document');
  requireExactFields(settings, persistedFieldNames, 'studioSettings document');

  if (settings.id !== STUDIO_SETTINGS_DOCUMENT_ID) {
    throw new TypeError('studioSettings document id must be "studio".');
  }

  const normalized = normalizeStudioSettings(settings);
  const createdAt = toJavaScriptDate(settings.createdAt, {
    label: 'studioSettings.createdAt',
  });
  const updatedAt = toJavaScriptDate(settings.updatedAt, {
    label: 'studioSettings.updatedAt',
  });

  if (updatedAt.getTime() < createdAt.getTime()) {
    throw new RangeError('studioSettings.updatedAt cannot be earlier than createdAt.');
  }

  return Object.freeze({
    ...normalized,
    createdAt,
    createdByUid: requireActorUid(settings.createdByUid, 'studioSettings.createdByUid'),
    id: STUDIO_SETTINGS_DOCUMENT_ID,
    updatedAt,
    updatedByUid: requireActorUid(settings.updatedByUid, 'studioSettings.updatedByUid'),
  });
}

export function normalizeStudioSettingsActorUid(value) {
  return requireActorUid(value, 'actorUid');
}

export function parseClockTimeToMinutes(value) {
  if (typeof value !== 'string') {
    throw new TypeError('Clock time must use HH:mm format.');
  }

  const match = /^(?<hour>[01]\d|2[0-3]):(?<minute>[0-5]\d)$/.exec(value);

  if (!match?.groups) {
    throw new TypeError('Clock time must use HH:mm format.');
  }

  return Number(match.groups.hour) * 60 + Number(match.groups.minute);
}

export function formatMinutesAsClockTime(value) {
  const minutes = requireMinuteOfDay(value, 'minutes');
  const hourPart = String(Math.floor(minutes / 60)).padStart(2, '0');
  const minutePart = String(minutes % 60).padStart(2, '0');

  return `${hourPart}:${minutePart}`;
}

export function toStudioSettingsFormValues(settings = null) {
  if (!settings) {
    return { ...DEFAULT_STUDIO_SETTINGS_FORM_VALUES };
  }

  const normalized = normalizeStudioSettings(settings);

  return {
    bookingIntervalMinutes: String(normalized.bookingIntervalMinutes),
    businessName: normalized.businessName,
    closesAt: formatMinutesAsClockTime(normalized.operatingHours.closesAtMinutes),
    opensAt: formatMinutesAsClockTime(normalized.operatingHours.opensAtMinutes),
    timeZone: normalized.timeZone,
  };
}

export function validateStudioSettingsForm(value) {
  const form = requireRecord(value, 'studioSettings form');
  const errors = {};
  let bookingIntervalMinutes;
  let businessName;
  let closesAtMinutes;
  let opensAtMinutes;
  let timeZone;

  try {
    businessName = requireTrimmedString(form.businessName, 'studioSettings.businessName');
  } catch (error) {
    errors.businessName = error.message;
  }

  try {
    timeZone = requireTimeZone(form.timeZone);
  } catch (error) {
    errors.timeZone = error.message;
  }

  try {
    bookingIntervalMinutes = requireBookingInterval(Number(form.bookingIntervalMinutes));
  } catch (error) {
    errors.bookingIntervalMinutes = error.message;
  }

  try {
    opensAtMinutes = parseClockTimeToMinutes(form.opensAt);
  } catch (error) {
    errors.opensAt = error.message;
  }

  try {
    closesAtMinutes = parseClockTimeToMinutes(form.closesAt);
  } catch (error) {
    errors.closesAt = error.message;
  }

  if (
    Number.isInteger(bookingIntervalMinutes) &&
    Number.isInteger(opensAtMinutes) &&
    Number.isInteger(closesAtMinutes)
  ) {
    try {
      normalizeOperatingHours({ closesAtMinutes, opensAtMinutes }, bookingIntervalMinutes);
    } catch (error) {
      errors.closesAt = error.message;
    }
  }

  const hasErrors = Object.keys(errors).length > 0;

  return Object.freeze({
    errors: Object.freeze(errors),
    value: hasErrors
      ? null
      : normalizeStudioSettings({
          bookingIntervalMinutes,
          businessName,
          operatingHours: { closesAtMinutes, opensAtMinutes },
          timeZone,
        }),
  });
}
