import { toJavaScriptDate } from '../../lib/datetime/timestamps.js';
import { normalizeDelegatedCapabilities } from './capabilities.js';

export const PERMISSION_SET_STATUSES = Object.freeze({
  ACTIVE: 'active',
  DISABLED: 'disabled',
});

const supportedStatuses = new Set(Object.values(PERMISSION_SET_STATUSES));

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }

  return value.trim();
}

export function decodePermissionSetDocument(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('permission set document must be an object.');
  }

  const createdAt = toJavaScriptDate(value.createdAt, { label: 'permissionSet.createdAt' });
  const updatedAt = toJavaScriptDate(value.updatedAt, { label: 'permissionSet.updatedAt' });

  if (updatedAt.getTime() < createdAt.getTime()) {
    throw new RangeError('permissionSet.updatedAt cannot be earlier than permissionSet.createdAt.');
  }

  const status = requireNonEmptyString(value.status, 'permissionSet.status');

  if (!supportedStatuses.has(status)) {
    throw new RangeError('permissionSet.status is not supported.');
  }

  return Object.freeze({
    id: requireNonEmptyString(value.id, 'permission set document id'),
    name: requireNonEmptyString(value.name, 'permissionSet.name'),
    status,
    capabilities: normalizeDelegatedCapabilities(value.capabilities),
    createdAt,
    updatedAt,
  });
}
