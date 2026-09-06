import { httpsCallable } from 'firebase/functions';

import { firebaseFunctions } from '../lib/firebase/client.js';

export const BOOKING_COMPENSATION_CALLABLE_NAME = 'initializeBookingCompensation';
export const BOOKING_COMPENSATION_FUNCTION_REGION = 'asia-southeast2';

const SAFE_RECEIPT_KEYS = Object.freeze([
  'bookingId',
  'createdEntryCount',
  'existingEntryCount',
  'initializedBookingSnapshot',
]);

const PROTECTED_RECEIPT_KEYS = new Set([
  'amountIdr',
  'assignment',
  'assignments',
  'calculationSnapshot',
  'compensationModel',
  'compensationRules',
  'configuration',
  'durationMinutes',
  'effectiveAt',
  'entryId',
  'entryIds',
  'percentageBaseAmounts',
  'ruleId',
  'ruleIds',
  'sourceKey',
  'sourceKeys',
]);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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
    throw new TypeError(`${label} must be a single Firestore document id.`);
  }
  return normalized;
}

function requireNonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer.`);
  }
  return value;
}

function normalizeClientRequest(value) {
  if (!isRecord(value)) {
    throw new TypeError('Booking compensation request must be an object.');
  }

  const keys = Object.keys(value);
  if (keys.length !== 1 || keys[0] !== 'bookingId') {
    throw new TypeError('Booking compensation request must contain only bookingId.');
  }

  return Object.freeze({ bookingId: requireSingleSegmentId(value.bookingId, 'bookingId') });
}

function normalizeSafeReceipt(value, expectedBookingId) {
  if (!isRecord(value)) {
    throw new BookingCompensationClientContractError(
      'invalid-receipt',
      'Trusted compensation response has an invalid shape.',
    );
  }

  const keys = Object.keys(value);
  const protectedKey = keys.find((key) => PROTECTED_RECEIPT_KEYS.has(key));
  if (protectedKey) {
    throw new BookingCompensationClientContractError(
      'protected-field-exposed',
      'Trusted compensation response exposed protected evidence.',
    );
  }

  if (
    keys.length !== SAFE_RECEIPT_KEYS.length ||
    keys.some((key) => !SAFE_RECEIPT_KEYS.includes(key)) ||
    SAFE_RECEIPT_KEYS.some((key) => !Object.prototype.hasOwnProperty.call(value, key))
  ) {
    throw new BookingCompensationClientContractError(
      'unexpected-receipt-shape',
      'Trusted compensation response does not match the safe receipt contract.',
    );
  }

  const bookingId = requireSingleSegmentId(value.bookingId, 'receipt.bookingId');
  if (bookingId !== expectedBookingId) {
    throw new BookingCompensationClientContractError(
      'booking-mismatch',
      'Trusted compensation response referenced a different booking.',
    );
  }

  if (typeof value.initializedBookingSnapshot !== 'boolean') {
    throw new BookingCompensationClientContractError(
      'invalid-receipt',
      'Trusted compensation response has an invalid initialization flag.',
    );
  }

  return Object.freeze({
    bookingId,
    createdEntryCount: requireNonNegativeInteger(
      value.createdEntryCount,
      'receipt.createdEntryCount',
    ),
    existingEntryCount: requireNonNegativeInteger(
      value.existingEntryCount,
      'receipt.existingEntryCount',
    ),
    initializedBookingSnapshot: value.initializedBookingSnapshot,
  });
}

function getFirebaseFunctionsCode(error) {
  if (!error || typeof error !== 'object' || typeof error.code !== 'string') {
    return null;
  }

  return error.code.startsWith('functions/') ? error.code.slice('functions/'.length) : error.code;
}

function mapCallableError(error) {
  const code = getFirebaseFunctionsCode(error);
  const mappings = {
    aborted: 'Existing compensation evidence changed. Retry from the current booking state.',
    'failed-precondition': 'Booking compensation is not ready to initialize.',
    'invalid-argument': 'Booking compensation request is invalid.',
    'not-found': 'Booking was not found.',
    'permission-denied': 'You are not authorized to initialize booking compensation.',
    unauthenticated: 'Authentication is required to initialize booking compensation.',
    unavailable: 'Booking compensation service is temporarily unavailable.',
  };

  if (code && mappings[code]) {
    return new BookingCompensationClientError(code, mappings[code]);
  }

  return new BookingCompensationClientError(
    'internal',
    'Booking compensation initialization failed safely.',
  );
}

export class BookingCompensationClientError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'BookingCompensationClientError';
    this.code = code;
  }
}

export class BookingCompensationClientContractError extends BookingCompensationClientError {
  constructor(code, message) {
    super(code, message);
    this.name = 'BookingCompensationClientContractError';
  }
}

export function createBookingCompensationCallableClient({ invokeCallable } = {}) {
  let callableInvoker = invokeCallable;

  if (callableInvoker === undefined) {
    if (!firebaseFunctions) {
      callableInvoker = async () => {
        throw new BookingCompensationClientError(
          'unavailable',
          'Firebase Functions client is not initialized.',
        );
      };
    } else {
      const callable = httpsCallable(firebaseFunctions, BOOKING_COMPENSATION_CALLABLE_NAME);
      callableInvoker = (payload) => callable(payload);
    }
  }

  if (typeof callableInvoker !== 'function') {
    throw new TypeError('invokeCallable must be a function.');
  }

  return Object.freeze({
    async initialize(request) {
      let normalizedRequest;
      try {
        normalizedRequest = normalizeClientRequest(request);
      } catch {
        throw new BookingCompensationClientError(
          'invalid-argument',
          'Booking compensation request must contain only a valid bookingId.',
        );
      }

      try {
        const callableResult = await callableInvoker({ bookingId: normalizedRequest.bookingId });
        const responseData = isRecord(callableResult) && 'data' in callableResult
          ? callableResult.data
          : callableResult;
        return normalizeSafeReceipt(responseData, normalizedRequest.bookingId);
      } catch (error) {
        if (error instanceof BookingCompensationClientError) {
          throw error;
        }
        if (error instanceof TypeError || error instanceof RangeError) {
          throw new BookingCompensationClientContractError(
            'invalid-receipt',
            'Trusted compensation response has invalid values.',
          );
        }
        throw mapCallableError(error);
      }
    },
  });
}

export const bookingCompensationCallableClient = createBookingCompensationCallableClient();
