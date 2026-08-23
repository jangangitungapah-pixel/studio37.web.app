import {
  Timestamp,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';

import {
  createOperatorAccountInvitationId,
  decodeOperatorAccountInvitationDocument,
  normalizeOperatorAccountInvitationEmail,
  normalizeOperatorAccountInvitationHours,
  normalizeOperatorAccountInvitationId,
  OPERATOR_ACCOUNT_INVITATION_DEFAULT_HOURS,
  OPERATOR_ACCOUNT_INVITATIONS_COLLECTION_NAME,
  OPERATOR_ACCOUNT_INVITATION_STATUSES,
} from '../features/auth/operatorAccountInvitation.js';
import {
  decodeUserProfileDocument,
  USER_PROFILE_ROLES,
  USER_PROFILE_STATUSES,
} from '../features/auth/userProfile.js';
import {
  decodeOperatorDocument,
  normalizeOperatorActorUid,
  normalizeOperatorId,
  OPERATOR_STATUSES,
  OPERATOR_TYPES,
} from '../features/settings/operators.js';
import { firestoreDb } from '../lib/firebase/client.js';

export const OPERATOR_ACCOUNT_INVITATION_ERROR_CODES = Object.freeze({
  AUTH_EMAIL_MISMATCH: 'studio37/account-invitation-auth-email-mismatch',
  EMAIL_REQUIRED: 'studio37/account-invitation-email-required',
  EXPIRED: 'studio37/account-invitation-expired',
  INVARIANT_BROKEN: 'studio37/account-invitation-invariant-broken',
  INVITATION_ALREADY_EXISTS: 'studio37/account-invitation-already-exists',
  INVITATION_NOT_FOUND: 'studio37/account-invitation-not-found',
  INVALID_STATE: 'studio37/account-invitation-invalid-state',
  OPERATOR_ALREADY_LINKED: 'studio37/account-invitation-operator-already-linked',
  OPERATOR_INACTIVE: 'studio37/account-invitation-operator-inactive',
  OPERATOR_NOT_FOUND: 'studio37/account-invitation-operator-not-found',
  OPERATOR_TYPE_REQUIRED: 'studio37/account-invitation-studio-operator-type-required',
  REPOSITORY_UNAVAILABLE: 'studio37/account-invitation-repository-unavailable',
  USER_ALREADY_LINKED: 'studio37/account-invitation-user-already-linked',
  USER_INELIGIBLE: 'studio37/account-invitation-user-ineligible',
  VERIFIED_EMAIL_REQUIRED: 'studio37/account-invitation-verified-email-required',
});

const HOUR_IN_MILLISECONDS = 60 * 60 * 1000;
const defaultFirestoreAdapter = Object.freeze({ doc, getDoc, runTransaction, writeBatch });

function createRepositoryError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function requireFirestore(value) {
  if (value) return value;

  throw createRepositoryError(
    OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.REPOSITORY_UNAVAILABLE,
    'Firestore is unavailable for the operator account-invitation repository.',
  );
}

function requireFunction(value, label) {
  if (typeof value !== 'function') {
    throw new TypeError(`${label} must be a function.`);
  }

  return value;
}

function normalizeUserUid(value) {
  if (typeof value !== 'string') {
    throw new TypeError('userUid must be a non-empty Firebase document id.');
  }

  const userUid = value.trim();
  if (!userUid || userUid.length > 128 || userUid.includes('/')) {
    throw new TypeError('userUid must be a non-empty Firebase document id.');
  }

  return userUid;
}

function requireCurrentDate(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError('nowFactory must return a valid Date.');
  }

  return value;
}

function decodeOperatorSnapshot(snapshot, operatorId) {
  if (!snapshot.exists()) {
    throw createRepositoryError(
      OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.OPERATOR_NOT_FOUND,
      `Operator ${operatorId} does not exist.`,
    );
  }

  return decodeOperatorDocument({ ...snapshot.data(), id: snapshot.id });
}

function decodeInvitationSnapshot(snapshot, invitationId, operatorId) {
  if (!snapshot.exists()) {
    throw createRepositoryError(
      OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.INVITATION_NOT_FOUND,
      `Account invitation ${invitationId} does not exist.`,
    );
  }

  const invitation = decodeOperatorAccountInvitationDocument({
    ...snapshot.data(),
    id: snapshot.id,
  });

  if (invitation.operatorId !== operatorId) {
    throw createRepositoryError(
      OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.INVARIANT_BROKEN,
      'The account invitation does not belong to the requested operator.',
    );
  }

  return invitation;
}

function requireInvitableOperator(operator) {
  if (operator.status !== OPERATOR_STATUSES.ACTIVE) {
    throw createRepositoryError(
      OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.OPERATOR_INACTIVE,
      `${operator.displayName} must be active before account access can be invited.`,
    );
  }

  if (operator.linkedUserUid !== null) {
    throw createRepositoryError(
      OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.OPERATOR_ALREADY_LINKED,
      `${operator.displayName} is already linked to a user account.`,
    );
  }

  if (!operator.operatorTypes.includes(OPERATOR_TYPES.STUDIO_OPERATOR)) {
    throw createRepositoryError(
      OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.OPERATOR_TYPE_REQUIRED,
      `${operator.displayName} must have the Studio Operator type before login can be invited.`,
    );
  }

  if (!operator.email) {
    throw createRepositoryError(
      OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.EMAIL_REQUIRED,
      `${operator.displayName} needs an email address before login can be invited.`,
    );
  }
}

function requireRedeemableInvitation(invitation, { email, now }) {
  if (invitation.status !== OPERATOR_ACCOUNT_INVITATION_STATUSES.PENDING) {
    throw createRepositoryError(
      OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.INVALID_STATE,
      'This account invitation is no longer pending.',
    );
  }

  if (invitation.expiresAt.getTime() <= now.getTime()) {
    throw createRepositoryError(
      OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.EXPIRED,
      'This account invitation has expired.',
    );
  }

  if (invitation.email !== email) {
    throw createRepositoryError(
      OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.AUTH_EMAIL_MISMATCH,
      'The authenticated email does not match this account invitation.',
    );
  }
}

function requireEligibleExistingUser(snapshot, { email, operatorId }) {
  if (!snapshot.exists()) return null;

  const user = decodeUserProfileDocument({ ...snapshot.data(), id: snapshot.id });
  if (
    user.role !== USER_PROFILE_ROLES.STUDIO_OPERATOR ||
    user.status !== USER_PROFILE_STATUSES.ACTIVE ||
    user.email !== email
  ) {
    throw createRepositoryError(
      OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.USER_INELIGIBLE,
      'The existing Studio37 user profile is not eligible for this invitation.',
    );
  }

  if (user.operatorId !== null && user.operatorId !== operatorId) {
    throw createRepositoryError(
      OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.USER_ALREADY_LINKED,
      'The existing Studio37 user profile is already linked to another operator.',
    );
  }

  if (user.operatorId === operatorId) {
    throw createRepositoryError(
      OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.INVALID_STATE,
      'The existing Studio37 user profile is already linked to this operator.',
    );
  }

  return user;
}

export function createOperatorAccountInvitationRepository({
  adapter = defaultFirestoreAdapter,
  db = firestoreDb,
  expirationTimestampFactory = Timestamp.fromMillis,
  invitationIdFactory = createOperatorAccountInvitationId,
  nowFactory = () => new Date(),
  timestampFactory = serverTimestamp,
} = {}) {
  const resolvedDb = requireFirestore(db);
  const createExpirationTimestamp = requireFunction(
    expirationTimestampFactory,
    'expirationTimestampFactory',
  );
  const createInvitationId = requireFunction(invitationIdFactory, 'invitationIdFactory');
  const createNow = requireFunction(nowFactory, 'nowFactory');
  const createWriteTimestamp = requireFunction(timestampFactory, 'timestampFactory');
  const getOperatorReference = (operatorId) =>
    adapter.doc(resolvedDb, 'operators', normalizeOperatorId(operatorId));
  const getInvitationReference = (operatorId, invitationId) =>
    adapter.doc(
      resolvedDb,
      'operators',
      normalizeOperatorId(operatorId),
      OPERATOR_ACCOUNT_INVITATIONS_COLLECTION_NAME,
      normalizeOperatorAccountInvitationId(invitationId),
    );
  const getUserReference = (userUid) => adapter.doc(resolvedDb, 'users', normalizeUserUid(userUid));

  return Object.freeze({
    async createInvitation(
      operatorId,
      {
        actorUid,
        expiresInHours = OPERATOR_ACCOUNT_INVITATION_DEFAULT_HOURS,
        invitationId = createInvitationId(),
      } = {},
    ) {
      const resolvedOperatorId = normalizeOperatorId(operatorId);
      const resolvedActorUid = normalizeOperatorActorUid(actorUid);
      const resolvedInvitationId = normalizeOperatorAccountInvitationId(invitationId);
      const resolvedExpiryHours = normalizeOperatorAccountInvitationHours(expiresInHours);
      const now = requireCurrentDate(createNow());
      const expiresAt = createExpirationTimestamp(
        now.getTime() + resolvedExpiryHours * HOUR_IN_MILLISECONDS,
      );
      const operatorReference = getOperatorReference(resolvedOperatorId);
      const invitationReference = getInvitationReference(resolvedOperatorId, resolvedInvitationId);

      await adapter.runTransaction(resolvedDb, async (transaction) => {
        const operatorSnapshot = await transaction.get(operatorReference);
        const invitationSnapshot = await transaction.get(invitationReference);
        const operator = decodeOperatorSnapshot(operatorSnapshot, resolvedOperatorId);
        requireInvitableOperator(operator);

        if (invitationSnapshot.exists()) {
          throw createRepositoryError(
            OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.INVITATION_ALREADY_EXISTS,
            'An account invitation with this identifier already exists.',
          );
        }

        const writeTimestamp = createWriteTimestamp();
        transaction.set(invitationReference, {
          acceptedAt: null,
          acceptedByUid: null,
          createdAt: writeTimestamp,
          createdByUid: resolvedActorUid,
          displayName: operator.displayName,
          email: operator.email,
          expiresAt,
          operatorId: resolvedOperatorId,
          phone: operator.phone,
          status: OPERATOR_ACCOUNT_INVITATION_STATUSES.PENDING,
          updatedAt: writeTimestamp,
          updatedByUid: resolvedActorUid,
        });
      });

      return Object.freeze({
        invitationId: resolvedInvitationId,
        operatorId: resolvedOperatorId,
      });
    },

    async getInvitation(operatorId, invitationId) {
      const resolvedOperatorId = normalizeOperatorId(operatorId);
      const resolvedInvitationId = normalizeOperatorAccountInvitationId(invitationId);
      const snapshot = await adapter.getDoc(
        getInvitationReference(resolvedOperatorId, resolvedInvitationId),
      );

      if (!snapshot.exists()) return null;
      return decodeInvitationSnapshot(snapshot, resolvedInvitationId, resolvedOperatorId);
    },

    async revokeInvitation(operatorId, invitationId, { actorUid } = {}) {
      const resolvedOperatorId = normalizeOperatorId(operatorId);
      const resolvedInvitationId = normalizeOperatorAccountInvitationId(invitationId);
      const resolvedActorUid = normalizeOperatorActorUid(actorUid);
      const invitationReference = getInvitationReference(resolvedOperatorId, resolvedInvitationId);

      await adapter.runTransaction(resolvedDb, async (transaction) => {
        const invitationSnapshot = await transaction.get(invitationReference);
        const invitation = decodeInvitationSnapshot(
          invitationSnapshot,
          resolvedInvitationId,
          resolvedOperatorId,
        );

        if (invitation.status !== OPERATOR_ACCOUNT_INVITATION_STATUSES.PENDING) {
          throw createRepositoryError(
            OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.INVALID_STATE,
            'Only a pending account invitation can be revoked.',
          );
        }

        transaction.update(invitationReference, {
          status: OPERATOR_ACCOUNT_INVITATION_STATUSES.REVOKED,
          updatedAt: createWriteTimestamp(),
          updatedByUid: resolvedActorUid,
        });
      });

      return Object.freeze({
        invitationId: resolvedInvitationId,
        operatorId: resolvedOperatorId,
      });
    },

    async redeemInvitation(operatorId, invitationId, { email, emailVerified, userUid } = {}) {
      if (emailVerified !== true) {
        throw createRepositoryError(
          OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.VERIFIED_EMAIL_REQUIRED,
          'A verified Firebase Authentication email is required to accept this invitation.',
        );
      }

      const resolvedOperatorId = normalizeOperatorId(operatorId);
      const resolvedInvitationId = normalizeOperatorAccountInvitationId(invitationId);
      const resolvedUserUid = normalizeUserUid(userUid);
      const resolvedEmail = normalizeOperatorAccountInvitationEmail(email);
      const now = requireCurrentDate(createNow());
      const invitationReference = getInvitationReference(resolvedOperatorId, resolvedInvitationId);
      const operatorReference = getOperatorReference(resolvedOperatorId);
      const userReference = getUserReference(resolvedUserUid);
      const [invitationSnapshot, userSnapshot] = await Promise.all([
        adapter.getDoc(invitationReference),
        adapter.getDoc(userReference),
      ]);
      const invitation = decodeInvitationSnapshot(
        invitationSnapshot,
        resolvedInvitationId,
        resolvedOperatorId,
      );

      requireRedeemableInvitation(invitation, { email: resolvedEmail, now });
      const existingUser = requireEligibleExistingUser(userSnapshot, {
        email: resolvedEmail,
        operatorId: resolvedOperatorId,
      });
      const writeTimestamp = createWriteTimestamp();
      const batch = adapter.writeBatch(resolvedDb);

      if (existingUser) {
        batch.update(userReference, {
          activationInviteId: resolvedInvitationId,
          operatorId: resolvedOperatorId,
          updatedAt: writeTimestamp,
        });
      } else {
        batch.set(userReference, {
          activationInviteId: resolvedInvitationId,
          createdAt: writeTimestamp,
          displayName: invitation.displayName,
          email: invitation.email,
          operatorId: resolvedOperatorId,
          permissionSetId: null,
          phone: invitation.phone,
          role: USER_PROFILE_ROLES.STUDIO_OPERATOR,
          status: USER_PROFILE_STATUSES.ACTIVE,
          uid: resolvedUserUid,
          updatedAt: writeTimestamp,
        });
      }

      batch.update(operatorReference, {
        linkedUserUid: resolvedUserUid,
        updatedAt: writeTimestamp,
        updatedByUid: resolvedUserUid,
      });
      batch.update(invitationReference, {
        acceptedAt: writeTimestamp,
        acceptedByUid: resolvedUserUid,
        status: OPERATOR_ACCOUNT_INVITATION_STATUSES.ACCEPTED,
        updatedAt: writeTimestamp,
        updatedByUid: resolvedUserUid,
      });
      await batch.commit();

      return Object.freeze({
        invitationId: resolvedInvitationId,
        operatorId: resolvedOperatorId,
        userUid: resolvedUserUid,
      });
    },
  });
}

export const operatorAccountInvitationRepository = createOperatorAccountInvitationRepository();
