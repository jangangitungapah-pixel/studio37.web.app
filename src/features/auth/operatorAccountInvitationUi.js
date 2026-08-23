import {
  normalizeOperatorAccountInvitationEmail,
  normalizeOperatorAccountInvitationId,
} from './operatorAccountInvitation.js';
import { normalizeOperatorId, OPERATOR_STATUSES, OPERATOR_TYPES } from '../settings/operators.js';

export const OPERATOR_ACCOUNT_INVITATION_AUTH_MODES = Object.freeze({
  SIGN_IN: 'sign-in',
  SIGN_UP: 'sign-up',
});

export function buildOperatorAccountInvitationUrl(origin, operatorId, invitationId) {
  const resolvedOperatorId = normalizeOperatorId(operatorId);
  const resolvedInvitationId = normalizeOperatorAccountInvitationId(invitationId);
  const baseUrl = new URL(origin);

  if (!['http:', 'https:'].includes(baseUrl.protocol)) {
    throw new TypeError('Invitation URL origin must use HTTP or HTTPS.');
  }

  return new URL(
    `/invite/${encodeURIComponent(resolvedOperatorId)}/${encodeURIComponent(resolvedInvitationId)}`,
    baseUrl.origin,
  ).toString();
}

export function isOperatorAccountInvitationEligible(operator) {
  return Boolean(
    operator &&
    operator.status === OPERATOR_STATUSES.ACTIVE &&
    operator.linkedUserUid === null &&
    operator.email &&
    operator.operatorTypes?.includes(OPERATOR_TYPES.STUDIO_OPERATOR),
  );
}

export function validateOperatorAccountInvitationAuthForm(
  { email, password, passwordConfirmation },
  mode,
) {
  const errors = {};
  let normalizedEmail = '';

  try {
    normalizedEmail = normalizeOperatorAccountInvitationEmail(email);
  } catch {
    errors.email = 'Masukkan alamat email undangan yang valid.';
  }

  if (typeof password !== 'string' || !password) {
    errors.password = 'Password wajib diisi.';
  } else if (mode === OPERATOR_ACCOUNT_INVITATION_AUTH_MODES.SIGN_UP && password.length < 6) {
    errors.password = 'Gunakan minimal 6 karakter.';
  }

  if (mode === OPERATOR_ACCOUNT_INVITATION_AUTH_MODES.SIGN_UP) {
    if (!passwordConfirmation) {
      errors.passwordConfirmation = 'Konfirmasi password wajib diisi.';
    } else if (passwordConfirmation !== password) {
      errors.passwordConfirmation = 'Konfirmasi password belum sama.';
    }
  }

  if (Object.keys(errors).length) return Object.freeze({ errors, value: null });

  return Object.freeze({
    errors,
    value: Object.freeze({ email: normalizedEmail, password }),
  });
}
