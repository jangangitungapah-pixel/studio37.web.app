import { toJavaScriptDate } from '../../lib/datetime/timestamps.js';
import { normalizeIndonesianPhone } from '../../lib/validation/indonesianPhone.js';

export const CUSTOMERS_COLLECTION_NAME = 'customers';
export const CUSTOMER_PHONE_MATCH_LIMIT = 5;

const customerDetailFieldNames = Object.freeze(['displayPhone', 'email', 'name', 'notes']);
const persistedCustomerFieldNames = Object.freeze([
  'createdAt',
  'createdByUid',
  'displayPhone',
  'email',
  'id',
  'name',
  'normalizedPhone',
  'notes',
  'updatedAt',
  'updatedByUid',
]);
const snapshotFieldNames = Object.freeze([
  'customerId',
  'displayPhone',
  'email',
  'name',
  'normalizedPhone',
]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function requireTrimmedString(value, label, { allowEmpty = false, maxLength }) {
  if (typeof value !== 'string') {
    throw new TypeError(`${label} must be a string.`);
  }

  const normalized = value.trim();
  if (!allowEmpty && !normalized) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
  if (normalized.length > maxLength) {
    throw new RangeError(`${label} must be at most ${maxLength} characters.`);
  }

  return normalized;
}

function requireSingleSegmentId(value, label) {
  const id = requireTrimmedString(value, label, { maxLength: 128 });
  if (id.includes('/')) {
    throw new TypeError(`${label} must be a Firestore document id.`);
  }
  return id;
}

export function normalizeCustomerEmail(value) {
  if (value === null || value === undefined || value === '') return null;

  const email = requireTrimmedString(value, 'customer.email', { maxLength: 254 }).toLowerCase();
  if (!emailPattern.test(email)) {
    throw new TypeError('customer.email must be a valid email address.');
  }
  return email;
}

export function normalizeCustomerDetails(value) {
  const customer = requireRecord(value, 'customer');
  requireExactFields(customer, customerDetailFieldNames, 'customer');

  const displayPhone = requireTrimmedString(customer.displayPhone, 'customer.displayPhone', {
    maxLength: 40,
  });

  return Object.freeze({
    displayPhone,
    email: normalizeCustomerEmail(customer.email),
    name: requireTrimmedString(customer.name, 'customer.name', { maxLength: 120 }),
    normalizedPhone: normalizeIndonesianPhone(displayPhone, {
      label: 'customer.displayPhone',
    }),
    notes: requireTrimmedString(customer.notes, 'customer.notes', {
      allowEmpty: true,
      maxLength: 2000,
    }),
  });
}

export function normalizeCustomerActorUid(value) {
  return requireSingleSegmentId(value, 'actorUid');
}

export function normalizeCustomerId(value) {
  return requireSingleSegmentId(value, 'customerId');
}

export function normalizeCustomerPhoneMatch(value) {
  return normalizeIndonesianPhone(value, { label: 'customer phone match' });
}

export function decodeCustomerDocument(value) {
  const customer = requireRecord(value, 'customer document');
  requireExactFields(customer, persistedCustomerFieldNames, 'customer document');

  const details = normalizeCustomerDetails({
    displayPhone: customer.displayPhone,
    email: customer.email,
    name: customer.name,
    notes: customer.notes,
  });

  if (customer.normalizedPhone !== details.normalizedPhone) {
    throw new RangeError('customer.normalizedPhone does not match customer.displayPhone.');
  }

  const createdAt = toJavaScriptDate(customer.createdAt, { label: 'customer.createdAt' });
  const updatedAt = toJavaScriptDate(customer.updatedAt, { label: 'customer.updatedAt' });
  if (updatedAt.getTime() < createdAt.getTime()) {
    throw new RangeError('customer.updatedAt cannot be earlier than createdAt.');
  }

  return Object.freeze({
    ...details,
    createdAt,
    createdByUid: requireSingleSegmentId(customer.createdByUid, 'customer.createdByUid'),
    id: normalizeCustomerId(customer.id),
    updatedAt,
    updatedByUid: requireSingleSegmentId(customer.updatedByUid, 'customer.updatedByUid'),
  });
}

export function buildCustomerSnapshot(value) {
  const customer = requireRecord(value, 'customer snapshot source');
  const snapshot = {
    customerId: normalizeCustomerId(customer.id),
    displayPhone: requireTrimmedString(customer.displayPhone, 'customer.displayPhone', {
      maxLength: 40,
    }),
    email: normalizeCustomerEmail(customer.email),
    name: requireTrimmedString(customer.name, 'customer.name', { maxLength: 120 }),
    normalizedPhone: normalizeCustomerPhoneMatch(customer.displayPhone),
  };

  if (customer.normalizedPhone !== snapshot.normalizedPhone) {
    throw new RangeError('customer.normalizedPhone does not match customer.displayPhone.');
  }

  return Object.freeze(snapshot);
}

export function decodeCustomerSnapshot(value) {
  const snapshot = requireRecord(value, 'customer snapshot');
  requireExactFields(snapshot, snapshotFieldNames, 'customer snapshot');

  const normalized = buildCustomerSnapshot({
    displayPhone: snapshot.displayPhone,
    email: snapshot.email,
    id: snapshot.customerId,
    name: snapshot.name,
    normalizedPhone: snapshot.normalizedPhone,
  });

  return normalized;
}

export function customerMatchesPhone(customer, phone) {
  const source = requireRecord(customer, 'customer');
  return source.normalizedPhone === normalizeCustomerPhoneMatch(phone);
}
