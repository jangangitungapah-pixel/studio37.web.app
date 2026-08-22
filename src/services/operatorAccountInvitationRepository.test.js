import { describe, expect, it, vi } from 'vitest';

import { OPERATOR_ACCOUNT_INVITATION_STATUSES } from '../features/auth/operatorAccountInvitation.js';
import { OPERATOR_TYPES } from '../features/settings/operators.js';
import {
  createOperatorAccountInvitationRepository,
  OPERATOR_ACCOUNT_INVITATION_ERROR_CODES,
} from './operatorAccountInvitationRepository.js';

const INVITATION_ID = 'invite-12345678901234567890';
const NOW = new Date('2026-08-22T10:00:00.000Z');

function createStoredOperator(overrides = {}) {
  return {
    createdAt: new Date('2026-08-22T01:00:00.000Z'),
    createdByUid: 'owner-1',
    displayName: 'Budi Operator',
    email: 'BUDI@Studio37.ID',
    linkedUserUid: null,
    operatorTypes: [OPERATOR_TYPES.STUDIO_OPERATOR],
    phone: '+6281234567890',
    status: 'active',
    updatedAt: new Date('2026-08-22T02:00:00.000Z'),
    updatedByUid: 'owner-1',
    ...overrides,
  };
}

function createStoredInvitation(overrides = {}) {
  return {
    acceptedAt: null,
    acceptedByUid: null,
    createdAt: new Date('2026-08-22T09:00:00.000Z'),
    createdByUid: 'owner-1',
    displayName: 'Budi Operator',
    email: 'budi@studio37.id',
    expiresAt: new Date('2026-08-29T09:00:00.000Z'),
    operatorId: 'operator-budi',
    phone: '+6281234567890',
    status: OPERATOR_ACCOUNT_INVITATION_STATUSES.PENDING,
    updatedAt: new Date('2026-08-22T09:00:00.000Z'),
    updatedByUid: 'owner-1',
    ...overrides,
  };
}

function createStoredUser(overrides = {}) {
  return {
    createdAt: new Date('2026-08-22T01:00:00.000Z'),
    displayName: 'Existing Budi',
    email: 'BUDI@Studio37.ID',
    operatorId: null,
    permissionSetId: 'front-desk',
    phone: null,
    role: 'studio_operator',
    status: 'active',
    uid: 'user-budi',
    updatedAt: new Date('2026-08-22T02:00:00.000Z'),
    ...overrides,
  };
}

function createSnapshot(id, value = null) {
  return {
    data: () => value,
    exists: () => value !== null,
    id,
  };
}

function createHarness({ invitation, operator, user } = {}) {
  const invitationPath = `operators/operator-budi/accountInvites/${INVITATION_ID}`;
  const snapshots = new Map([
    [
      'operators/operator-budi',
      createSnapshot('operator-budi', operator === undefined ? createStoredOperator() : operator),
    ],
    [
      invitationPath,
      createSnapshot(
        INVITATION_ID,
        invitation === undefined ? createStoredInvitation() : invitation,
      ),
    ],
    ['users/user-budi', createSnapshot('user-budi', user === undefined ? null : user)],
  ]);
  const writeTimestamp = { kind: 'server-timestamp' };
  const transaction = {
    get: vi.fn(async (reference) => snapshots.get(reference.path) ?? createSnapshot(reference.id)),
    set: vi.fn(),
    update: vi.fn(),
  };
  const batch = {
    commit: vi.fn(async () => undefined),
    set: vi.fn(),
    update: vi.fn(),
  };
  const adapter = {
    doc: vi.fn((_db, ...segments) => ({
      id: segments.at(-1),
      path: segments.join('/'),
    })),
    getDoc: vi.fn(
      async (reference) => snapshots.get(reference.path) ?? createSnapshot(reference.id),
    ),
    runTransaction: vi.fn(async (_db, operation) => operation(transaction)),
    writeBatch: vi.fn(() => batch),
  };
  const expirationTimestampFactory = vi.fn((milliseconds) => ({ milliseconds }));
  const invitationIdFactory = vi.fn(() => INVITATION_ID);
  const nowFactory = vi.fn(() => new Date(NOW));
  const timestampFactory = vi.fn(() => writeTimestamp);
  const repository = createOperatorAccountInvitationRepository({
    adapter,
    db: { name: 'firestore' },
    expirationTimestampFactory,
    invitationIdFactory,
    nowFactory,
    timestampFactory,
  });

  return {
    adapter,
    batch,
    expirationTimestampFactory,
    invitationPath,
    repository,
    timestampFactory,
    transaction,
    writeTimestamp,
  };
}

describe('operatorAccountInvitationRepository', () => {
  it('creates a pending exact-path invitation from an eligible operator snapshot', async () => {
    const { expirationTimestampFactory, repository, transaction, writeTimestamp } = createHarness({
      invitation: null,
    });

    await expect(
      repository.createInvitation('operator-budi', { actorUid: 'owner-1' }),
    ).resolves.toEqual({ invitationId: INVITATION_ID, operatorId: 'operator-budi' });

    expect(transaction.get).toHaveBeenCalledTimes(2);
    expect(expirationTimestampFactory).toHaveBeenCalledWith(NOW.getTime() + 168 * 60 * 60 * 1000);
    expect(transaction.set).toHaveBeenCalledWith(
      { id: INVITATION_ID, path: `operators/operator-budi/accountInvites/${INVITATION_ID}` },
      {
        acceptedAt: null,
        acceptedByUid: null,
        createdAt: writeTimestamp,
        createdByUid: 'owner-1',
        displayName: 'Budi Operator',
        email: 'budi@studio37.id',
        expiresAt: { milliseconds: NOW.getTime() + 168 * 60 * 60 * 1000 },
        operatorId: 'operator-budi',
        phone: '+6281234567890',
        status: 'pending',
        updatedAt: writeTimestamp,
        updatedByUid: 'owner-1',
      },
    );
    expect(repository).not.toHaveProperty('listAll');
    expect(repository).not.toHaveProperty('createAuthenticationUser');
  });

  it('rejects invitation creation for ineligible operators and identifier collisions', async () => {
    for (const [operator, code] of [
      [
        createStoredOperator({ email: null }),
        OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.EMAIL_REQUIRED,
      ],
      [
        createStoredOperator({ operatorTypes: [OPERATOR_TYPES.RECORDING_ENGINEER] }),
        OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.OPERATOR_TYPE_REQUIRED,
      ],
      [
        createStoredOperator({ linkedUserUid: 'other-user' }),
        OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.OPERATOR_ALREADY_LINKED,
      ],
      [
        createStoredOperator({ status: 'disabled' }),
        OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.OPERATOR_INACTIVE,
      ],
    ]) {
      const { repository, transaction } = createHarness({ invitation: null, operator });
      await expect(
        repository.createInvitation('operator-budi', { actorUid: 'owner-1' }),
      ).rejects.toMatchObject({ code });
      expect(transaction.set).not.toHaveBeenCalled();
    }

    const collision = createHarness();
    await expect(
      collision.repository.createInvitation('operator-budi', { actorUid: 'owner-1' }),
    ).rejects.toMatchObject({
      code: OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.INVITATION_ALREADY_EXISTS,
    });
  });

  it('loads and revokes one exact pending invitation without a collection read', async () => {
    const { adapter, repository, transaction, writeTimestamp } = createHarness();

    await expect(repository.getInvitation('operator-budi', INVITATION_ID)).resolves.toEqual(
      expect.objectContaining({
        id: INVITATION_ID,
        operatorId: 'operator-budi',
        status: 'pending',
      }),
    );
    await expect(
      repository.revokeInvitation('operator-budi', INVITATION_ID, { actorUid: 'owner-1' }),
    ).resolves.toEqual({ invitationId: INVITATION_ID, operatorId: 'operator-budi' });

    expect(adapter.getDoc).toHaveBeenCalledOnce();
    expect(transaction.update).toHaveBeenCalledWith(
      { id: INVITATION_ID, path: `operators/operator-budi/accountInvites/${INVITATION_ID}` },
      { status: 'revoked', updatedAt: writeTimestamp, updatedByUid: 'owner-1' },
    );
  });

  it('redeems a verified invitation into a zero-permission user and reciprocal link batch', async () => {
    const { batch, repository, writeTimestamp } = createHarness();

    await expect(
      repository.redeemInvitation('operator-budi', INVITATION_ID, {
        email: ' BUDI@Studio37.ID ',
        emailVerified: true,
        userUid: 'user-budi',
      }),
    ).resolves.toEqual({
      invitationId: INVITATION_ID,
      operatorId: 'operator-budi',
      userUid: 'user-budi',
    });

    expect(batch.set).toHaveBeenCalledWith(
      { id: 'user-budi', path: 'users/user-budi' },
      {
        activationInviteId: INVITATION_ID,
        createdAt: writeTimestamp,
        displayName: 'Budi Operator',
        email: 'budi@studio37.id',
        operatorId: 'operator-budi',
        permissionSetId: null,
        phone: '+6281234567890',
        role: 'studio_operator',
        status: 'active',
        uid: 'user-budi',
        updatedAt: writeTimestamp,
      },
    );
    expect(batch.update).toHaveBeenNthCalledWith(
      1,
      { id: 'operator-budi', path: 'operators/operator-budi' },
      { linkedUserUid: 'user-budi', updatedAt: writeTimestamp, updatedByUid: 'user-budi' },
    );
    expect(batch.update).toHaveBeenNthCalledWith(
      2,
      { id: INVITATION_ID, path: `operators/operator-budi/accountInvites/${INVITATION_ID}` },
      {
        acceptedAt: writeTimestamp,
        acceptedByUid: 'user-budi',
        status: 'accepted',
        updatedAt: writeTimestamp,
        updatedByUid: 'user-budi',
      },
    );
    expect(batch.commit).toHaveBeenCalledOnce();
  });

  it('links an eligible existing profile without changing its assigned permission set', async () => {
    const { batch, repository } = createHarness({ user: createStoredUser() });

    await repository.redeemInvitation('operator-budi', INVITATION_ID, {
      email: 'budi@studio37.id',
      emailVerified: true,
      userUid: 'user-budi',
    });

    expect(batch.set).not.toHaveBeenCalled();
    expect(batch.update).toHaveBeenNthCalledWith(
      1,
      { id: 'user-budi', path: 'users/user-budi' },
      expect.objectContaining({
        activationInviteId: INVITATION_ID,
        operatorId: 'operator-budi',
      }),
    );
    expect(batch.update.mock.calls[0][1]).not.toHaveProperty('permissionSetId');
    expect(batch.update.mock.calls[0][1]).not.toHaveProperty('role');
  });

  it('fails closed for unverified, mismatched, expired, and already-linked redemptions', async () => {
    const unverified = createHarness();
    await expect(
      unverified.repository.redeemInvitation('operator-budi', INVITATION_ID, {
        email: 'budi@studio37.id',
        emailVerified: false,
        userUid: 'user-budi',
      }),
    ).rejects.toMatchObject({
      code: OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.VERIFIED_EMAIL_REQUIRED,
    });

    const mismatched = createHarness();
    await expect(
      mismatched.repository.redeemInvitation('operator-budi', INVITATION_ID, {
        email: 'other@studio37.id',
        emailVerified: true,
        userUid: 'user-budi',
      }),
    ).rejects.toMatchObject({
      code: OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.AUTH_EMAIL_MISMATCH,
    });

    const expired = createHarness({
      invitation: createStoredInvitation({ expiresAt: new Date('2026-08-22T09:59:59.000Z') }),
    });
    await expect(
      expired.repository.redeemInvitation('operator-budi', INVITATION_ID, {
        email: 'budi@studio37.id',
        emailVerified: true,
        userUid: 'user-budi',
      }),
    ).rejects.toMatchObject({ code: OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.EXPIRED });

    const linked = createHarness({
      user: createStoredUser({ operatorId: 'operator-other' }),
    });
    await expect(
      linked.repository.redeemInvitation('operator-budi', INVITATION_ID, {
        email: 'budi@studio37.id',
        emailVerified: true,
        userUid: 'user-budi',
      }),
    ).rejects.toMatchObject({
      code: OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.USER_ALREADY_LINKED,
    });
  });

  it('rejects malformed paths, broken invitation ownership, and unavailable Firestore', async () => {
    const broken = createHarness({
      invitation: createStoredInvitation({ operatorId: 'operator-other' }),
    });

    await expect(
      broken.repository.getInvitation('operator-budi', INVITATION_ID),
    ).rejects.toMatchObject({ code: OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.INVARIANT_BROKEN });
    await expect(broken.repository.getInvitation('operator/budi', INVITATION_ID)).rejects.toThrow(
      /document id/,
    );
    expect(() => createOperatorAccountInvitationRepository({ db: null })).toThrow(
      expect.objectContaining({
        code: OPERATOR_ACCOUNT_INVITATION_ERROR_CODES.REPOSITORY_UNAVAILABLE,
      }),
    );
  });
});
