import { toJavaScriptDate } from '../../lib/datetime/timestamps.js';
import { normalizeIndonesianPhone } from '../../lib/validation/indonesianPhone.js';

export const USER_PROFILE_ROLES = Object.freeze({
  OWNER: 'owner',
  STUDIO_OPERATOR: 'studio_operator',
});

export const USER_PROFILE_STATUSES = Object.freeze({
  ACTIVE: 'active',
  DISABLED: 'disabled',
});

const supportedRoles = new Set(Object.values(USER_PROFILE_ROLES));
const supportedStatuses = new Set(Object.values(USER_PROFILE_STATUSES));
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }

  return value.trim();
}

function normalizeEmail(value) {
  const email = requireNonEmptyString(value, 'user.email').toLowerCase();

  if (!emailPattern.test(email)) {
    throw new TypeError('user.email must be a valid email address.');
  }

  return email;
}

function normalizeOptionalReference(value, label) {
  if (value === null || value === undefined) return null;
  return requireNonEmptyString(value, label);
}

function requireSupportedValue(value, supportedValues, label) {
  if (!supportedValues.has(value)) {
    throw new RangeError(`${label} is not supported.`);
  }

  return value;
}

export function decodeUserProfileDocument(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('user profile document must be an object.');
  }

  const id = requireNonEmptyString(value.id, 'user document id');
  const uid = requireNonEmptyString(value.uid, 'user.uid');

  if (id !== uid) {
    throw new RangeError('user.uid must match the Firestore document id.');
  }

  const createdAt = toJavaScriptDate(value.createdAt, { label: 'user.createdAt' });
  const updatedAt = toJavaScriptDate(value.updatedAt, { label: 'user.updatedAt' });

  if (updatedAt.getTime() < createdAt.getTime()) {
    throw new RangeError('user.updatedAt cannot be earlier than user.createdAt.');
  }

  return Object.freeze({
    id,
    uid,
    activationInviteId: normalizeOptionalReference(
      value.activationInviteId,
      'user.activationInviteId',
    ),
    displayName: requireNonEmptyString(value.displayName, 'user.displayName'),
    email: normalizeEmail(value.email),
    phone: normalizeIndonesianPhone(value.phone, { allowNull: true, label: 'user.phone' }),
    role: requireSupportedValue(value.role, supportedRoles, 'user.role'),
    status: requireSupportedValue(value.status, supportedStatuses, 'user.status'),
    permissionSetId: normalizeOptionalReference(value.permissionSetId, 'user.permissionSetId'),
    operatorId: normalizeOptionalReference(value.operatorId, 'user.operatorId'),
    createdAt,
    updatedAt,
  });
}
