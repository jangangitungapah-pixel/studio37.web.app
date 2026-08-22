import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';

import {
  createOperatorAccountInvitationId,
  decodeOperatorAccountInvitationDocument,
  normalizeOperatorAccountInvitationHours,
  normalizeOperatorAccountInvitationId,
  OPERATOR_ACCOUNT_INVITATION_STATUSES,
} from './operatorAccountInvitation.js';

const INVITATION_ID = 'invite-12345678901234567890';

function createInvitation(overrides = {}) {
  return {
    acceptedAt: null,
    acceptedByUid: null,
    createdAt: Timestamp.fromDate(new Date('2026-08-22T01:00:00.000Z')),
    createdByUid: 'owner-1',
    displayName: 'Budi Operator',
    email: 'BUDI@studio37.id',
    expiresAt: Timestamp.fromDate(new Date('2026-08-29T01:00:00.000Z')),
    id: INVITATION_ID,
    operatorId: 'operator-budi',
    phone: '0812-3456-7890',
    status: OPERATOR_ACCOUNT_INVITATION_STATUSES.PENDING,
    updatedAt: Timestamp.fromDate(new Date('2026-08-22T01:00:00.000Z')),
    updatedByUid: 'owner-1',
    ...overrides,
  };
}

describe('operator account invitation model', () => {
  it('decodes and normalizes a canonical pending invitation', () => {
    const invitation = decodeOperatorAccountInvitationDocument(createInvitation());

    expect(invitation).toEqual({
      acceptedAt: null,
      acceptedByUid: null,
      createdAt: new Date('2026-08-22T01:00:00.000Z'),
      createdByUid: 'owner-1',
      displayName: 'Budi Operator',
      email: 'budi@studio37.id',
      expiresAt: new Date('2026-08-29T01:00:00.000Z'),
      id: INVITATION_ID,
      operatorId: 'operator-budi',
      phone: '+6281234567890',
      status: 'pending',
      updatedAt: new Date('2026-08-22T01:00:00.000Z'),
      updatedByUid: 'owner-1',
    });
    expect(Object.isFrozen(invitation)).toBe(true);
  });

  it('requires complete acceptance metadata for accepted invitations', () => {
    const acceptedAt = Timestamp.fromDate(new Date('2026-08-23T01:00:00.000Z'));
    const invitation = decodeOperatorAccountInvitationDocument(
      createInvitation({
        acceptedAt,
        acceptedByUid: 'user-budi',
        status: OPERATOR_ACCOUNT_INVITATION_STATUSES.ACCEPTED,
        updatedAt: acceptedAt,
        updatedByUid: 'user-budi',
      }),
    );

    expect(invitation.acceptedByUid).toBe('user-budi');
    expect(invitation.acceptedAt).toEqual(new Date('2026-08-23T01:00:00.000Z'));
    expect(() =>
      decodeOperatorAccountInvitationDocument(
        createInvitation({ status: OPERATOR_ACCOUNT_INVITATION_STATUSES.ACCEPTED }),
      ),
    ).toThrow(/metadata is incomplete/);
  });

  it('rejects malformed state, expiry, and unknown fields', () => {
    expect(() =>
      decodeOperatorAccountInvitationDocument(createInvitation({ status: 'expired' })),
    ).toThrow(/not supported/);
    expect(() =>
      decodeOperatorAccountInvitationDocument(
        createInvitation({ expiresAt: new Date('2026-08-22T01:00:00.000Z') }),
      ),
    ).toThrow(/must be later/);
    expect(() =>
      decodeOperatorAccountInvitationDocument(createInvitation({ role: 'owner' })),
    ).toThrow(/unsupported document shape/);
  });

  it('generates and validates secure single-segment invitation identifiers', () => {
    const id = createOperatorAccountInvitationId({
      randomUUID: () => '12345678-1234-4234-9234-123456789012',
    });

    expect(id).toBe('12345678-1234-4234-9234-123456789012');
    expect(normalizeOperatorAccountInvitationId(` ${INVITATION_ID} `)).toBe(INVITATION_ID);
    expect(() => normalizeOperatorAccountInvitationId('short')).toThrow(/secure/);
    expect(() => normalizeOperatorAccountInvitationId(`${INVITATION_ID}/nested`)).toThrow(/secure/);
  });

  it('bounds invitation expiry to the supported Spark-friendly window', () => {
    expect(normalizeOperatorAccountInvitationHours(168)).toBe(168);
    expect(() => normalizeOperatorAccountInvitationHours(0)).toThrow(/integer/);
    expect(() => normalizeOperatorAccountInvitationHours(721)).toThrow(/integer/);
  });
});
