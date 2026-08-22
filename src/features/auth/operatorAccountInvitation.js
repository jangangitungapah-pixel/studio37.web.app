import { toJavaScriptDate } from '../../lib/datetime/timestamps.js';
import { normalizeIndonesianPhone } from '../../lib/validation/indonesianPhone.js';

export const OPERATOR_ACCOUNT_INVITATIONS_COLLECTION_NAME = 'accountInvites';
export const OPERATOR_ACCOUNT_INVITATION_DEFAULT_HOURS = 7 * 24;
export const OPERATOR_ACCOUNT_INVITATION_MAX_HOURS = 30 * 24;

export const OPERATOR_ACCOUNT_INVITATION_STATUSES = Object.freeze({
  ACCEPTED: 'accepted',
  PENDING: 'pending',
  REVOKED: 'revoked',
});

const persistedFieldNames = Object.freeze([
  'acceptedAt',
  'acceptedByUid',
  'createdAt',
  'createdByUid',
  'displayName',
  'email',
  'expiresAt',
  'id',
  'operatorId',
  'phone',
  'status',
  'updatedAt',
  'updatedByUid',
]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const invitationIdPattern = /^[A-Za-z0-9_-]+$/;
const supportedStatuses = new Set(Object.values(OPERATOR_ACCOUNT_INVITATION_STATUSES));

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

export function normalizeOperatorAccountInvitationId(value) {
  const invitationId = requireTrimmedString(value, 'invitationId', { maxLength: 128 });

  if (invitationId.length < 20 || !invitationIdPattern.test(invitationId)) {
    throw new TypeError('invitationId must be a secure single-segment identifier.');
  }

  return invitationId;
}

export function createOperatorAccountInvitationId(cryptoObject = globalThis.crypto) {
  if (!cryptoObject || typeof cryptoObject.randomUUID !== 'function') {
    throw new Error('A secure random UUID generator is required for account invitations.');
  }

  return normalizeOperatorAccountInvitationId(cryptoObject.randomUUID());
}

export function normalizeOperatorAccountInvitationEmail(value) {
  const email = requireTrimmedString(value, 'invitation.email', { maxLength: 254 }).toLowerCase();

  if (!emailPattern.test(email)) {
    throw new TypeError('invitation.email must be a valid email address.');
  }

  return email;
}

export function normalizeOperatorAccountInvitationHours(value) {
  if (!Number.isInteger(value) || value < 1 || value > OPERATOR_ACCOUNT_INVITATION_MAX_HOURS) {
    throw new RangeError(
      `invitation expiry must be an integer from 1 to ${OPERATOR_ACCOUNT_INVITATION_MAX_HOURS} hours.`,
    );
  }

  return value;
}

function normalizeSingleSegmentId(value, label) {
  const id = requireTrimmedString(value, label, { maxLength: 128 });

  if (id.includes('/')) {
    throw new TypeError(`${label} must be a Firestore document id.`);
  }

  return id;
}

function normalizeNullableSingleSegmentId(value, label) {
  if (value === null || value === undefined) return null;
  return normalizeSingleSegmentId(value, label);
}

function normalizeNullableDate(value, label) {
  if (value === null || value === undefined) return null;
  return toJavaScriptDate(value, { label });
}

export function decodeOperatorAccountInvitationDocument(value) {
  const invitation = requireRecord(value, 'operator account invitation document');
  requireExactFields(invitation, persistedFieldNames, 'operator account invitation document');

  const status = requireTrimmedString(invitation.status, 'invitation.status', { maxLength: 20 });
  if (!supportedStatuses.has(status)) {
    throw new RangeError('invitation.status is not supported.');
  }

  const createdAt = toJavaScriptDate(invitation.createdAt, { label: 'invitation.createdAt' });
  const updatedAt = toJavaScriptDate(invitation.updatedAt, { label: 'invitation.updatedAt' });
  const expiresAt = toJavaScriptDate(invitation.expiresAt, { label: 'invitation.expiresAt' });
  const acceptedAt = normalizeNullableDate(invitation.acceptedAt, 'invitation.acceptedAt');
  const acceptedByUid = normalizeNullableSingleSegmentId(
    invitation.acceptedByUid,
    'invitation.acceptedByUid',
  );

  if (updatedAt.getTime() < createdAt.getTime()) {
    throw new RangeError('invitation.updatedAt cannot be earlier than invitation.createdAt.');
  }

  if (expiresAt.getTime() <= createdAt.getTime()) {
    throw new RangeError('invitation.expiresAt must be later than invitation.createdAt.');
  }

  if (status === OPERATOR_ACCOUNT_INVITATION_STATUSES.ACCEPTED) {
    if (!acceptedAt || !acceptedByUid || acceptedAt.getTime() !== updatedAt.getTime()) {
      throw new TypeError('accepted invitation metadata is incomplete.');
    }
  } else if (acceptedAt !== null || acceptedByUid !== null) {
    throw new TypeError('non-accepted invitation cannot contain acceptance metadata.');
  }

  return Object.freeze({
    acceptedAt,
    acceptedByUid,
    createdAt,
    createdByUid: normalizeSingleSegmentId(invitation.createdByUid, 'invitation.createdByUid'),
    displayName: requireTrimmedString(invitation.displayName, 'invitation.displayName', {
      maxLength: 100,
    }),
    email: normalizeOperatorAccountInvitationEmail(invitation.email),
    expiresAt,
    id: normalizeOperatorAccountInvitationId(invitation.id),
    operatorId: normalizeSingleSegmentId(invitation.operatorId, 'invitation.operatorId'),
    phone: normalizeIndonesianPhone(invitation.phone, {
      allowNull: true,
      label: 'invitation.phone',
    }),
    status,
    updatedAt,
    updatedByUid: normalizeSingleSegmentId(invitation.updatedByUid, 'invitation.updatedByUid'),
  });
}
