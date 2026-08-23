import { describe, expect, it } from 'vitest';

import { OPERATOR_TYPES } from '../settings/operators.js';
import {
  buildOperatorAccountInvitationUrl,
  isOperatorAccountInvitationEligible,
  OPERATOR_ACCOUNT_INVITATION_AUTH_MODES,
  validateOperatorAccountInvitationAuthForm,
} from './operatorAccountInvitationUi.js';

const invitationId = 'invite-12345678901234567890';

describe('operator account invitation UI contracts', () => {
  it('builds an exact opaque invitation URL without email or role query parameters', () => {
    const url = buildOperatorAccountInvitationUrl(
      'http://localhost:5173/settings/operators?ignored=true',
      'operator #1',
      invitationId,
    );

    expect(url).toBe('http://localhost:5173/invite/operator%20%231/invite-12345678901234567890');
    expect(url).not.toContain('email');
    expect(url).not.toContain('role');
  });

  it('requires active, unlinked, emailed Studio Operators before rendering the invite action', () => {
    const eligible = {
      email: 'operator@studio37.id',
      linkedUserUid: null,
      operatorTypes: [OPERATOR_TYPES.STUDIO_OPERATOR],
      status: 'active',
    };

    expect(isOperatorAccountInvitationEligible(eligible)).toBe(true);
    expect(isOperatorAccountInvitationEligible({ ...eligible, email: null })).toBe(false);
    expect(isOperatorAccountInvitationEligible({ ...eligible, linkedUserUid: 'user-1' })).toBe(
      false,
    );
    expect(
      isOperatorAccountInvitationEligible({
        ...eligible,
        operatorTypes: [OPERATOR_TYPES.RECORDING_ENGINEER],
      }),
    ).toBe(false);
  });

  it('normalizes invitation email and validates signup confirmation without weakening login', () => {
    expect(
      validateOperatorAccountInvitationAuthForm(
        {
          email: ' Operator@Studio37.ID ',
          password: 'secret-password',
          passwordConfirmation: 'secret-password',
        },
        OPERATOR_ACCOUNT_INVITATION_AUTH_MODES.SIGN_UP,
      ),
    ).toEqual({
      errors: {},
      value: { email: 'operator@studio37.id', password: 'secret-password' },
    });

    expect(
      validateOperatorAccountInvitationAuthForm(
        { email: 'operator@studio37.id', password: 'short', passwordConfirmation: 'different' },
        OPERATOR_ACCOUNT_INVITATION_AUTH_MODES.SIGN_UP,
      ).errors,
    ).toEqual({
      password: 'Gunakan minimal 6 karakter.',
      passwordConfirmation: 'Konfirmasi password belum sama.',
    });
  });
});
