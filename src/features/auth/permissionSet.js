import { toJavaScriptDate } from '../../lib/datetime/timestamps.js';
import { normalizeDelegatedCapabilities } from './capabilities.js';

export const PERMISSION_SETS_COLLECTION_NAME = 'permissionSets';
export const PERMISSION_SET_LIST_LIMIT = 50;

export const PERMISSION_SET_STATUSES = Object.freeze({
  ACTIVE: 'active',
  DISABLED: 'disabled',
});

const mutableFieldNames = Object.freeze(['capabilities', 'name']);
const persistedFieldNames = Object.freeze([
  'capabilities',
  'createdAt',
  'id',
  'name',
  'status',
  'updatedAt',
]);
const supportedStatuses = new Set(Object.values(PERMISSION_SET_STATUSES));

function requireRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
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

function requireTrimmedString(value, label, { maxLength }) {
  if (typeof value !== 'string') {
    throw new TypeError(`${label} must be a string.`);
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }

  if (normalized.length > maxLength) {
    throw new RangeError(`${label} must be at most ${maxLength} characters.`);
  }

  return normalized;
}

export function normalizePermissionSetId(value) {
  const id = requireTrimmedString(value, 'permissionSetId', { maxLength: 128 });

  if (id.includes('/')) {
    throw new TypeError('permissionSetId must be a Firestore document id.');
  }

  return id;
}

export function normalizePermissionSetDetails(value) {
  const permissionSet = requireRecord(value, 'permissionSet');
  requireExactFields(permissionSet, mutableFieldNames, 'permissionSet');

  return Object.freeze({
    capabilities: normalizeDelegatedCapabilities(permissionSet.capabilities),
    name: requireTrimmedString(permissionSet.name, 'permissionSet.name', { maxLength: 120 }),
  });
}

export function normalizePermissionSetStatus(value) {
  if (typeof value !== 'string' || !supportedStatuses.has(value)) {
    throw new RangeError('permissionSet.status is not supported.');
  }

  return value;
}

export function decodePermissionSetDocument(value) {
  const permissionSet = requireRecord(value, 'permission set document');
  requireExactFields(permissionSet, persistedFieldNames, 'permission set document');

  const details = normalizePermissionSetDetails({
    capabilities: permissionSet.capabilities,
    name: permissionSet.name,
  });
  const createdAt = toJavaScriptDate(permissionSet.createdAt, {
    label: 'permissionSet.createdAt',
  });
  const updatedAt = toJavaScriptDate(permissionSet.updatedAt, {
    label: 'permissionSet.updatedAt',
  });

  if (updatedAt.getTime() < createdAt.getTime()) {
    throw new RangeError('permissionSet.updatedAt cannot be earlier than permissionSet.createdAt.');
  }

  return Object.freeze({
    ...details,
    createdAt,
    id: normalizePermissionSetId(permissionSet.id),
    status: normalizePermissionSetStatus(permissionSet.status),
    updatedAt,
  });
}

export function comparePermissionSets(left, right) {
  const nameDifference = left.name.localeCompare(right.name, 'id', { sensitivity: 'base' });
  if (nameDifference !== 0) return nameDifference;

  return left.id.localeCompare(right.id);
}
