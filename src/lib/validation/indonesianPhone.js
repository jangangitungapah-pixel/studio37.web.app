const ALLOWED_PHONE_CHARACTERS = /^\+?[\d\s().-]+$/;
const MIN_NATIONAL_NUMBER_LENGTH = 7;
const MAX_NATIONAL_NUMBER_LENGTH = 13;

export function normalizeIndonesianPhone(value, { allowNull = false, label = 'phone' } = {}) {
  if (value === null || value === undefined) {
    if (allowNull) {
      return null;
    }

    throw new TypeError(`${label} is required.`);
  }

  if (typeof value !== 'string') {
    throw new TypeError(`${label} must be entered as text.`);
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    throw new TypeError(`${label} is required.`);
  }

  if (!ALLOWED_PHONE_CHARACTERS.test(trimmedValue)) {
    throw new TypeError(`${label} contains unsupported characters.`);
  }

  const digits = trimmedValue.replace(/[\s().+-]/g, '');
  let nationalNumber;

  if (digits.startsWith('62')) {
    nationalNumber = digits.slice(2);
  } else if (digits.startsWith('0')) {
    nationalNumber = digits.slice(1);
  } else if (digits.startsWith('8')) {
    nationalNumber = digits;
  } else {
    throw new RangeError(`${label} must use an Indonesian +62, 62, or 0 prefix.`);
  }

  if (nationalNumber.startsWith('0')) {
    nationalNumber = nationalNumber.slice(1);
  }

  const hasValidDigits = /^[1-9]\d+$/.test(nationalNumber);
  const hasValidLength =
    nationalNumber.length >= MIN_NATIONAL_NUMBER_LENGTH &&
    nationalNumber.length <= MAX_NATIONAL_NUMBER_LENGTH;

  if (!hasValidDigits || !hasValidLength) {
    throw new RangeError(`${label} is not a valid-length Indonesian phone number.`);
  }

  return `+62${nationalNumber}`;
}
