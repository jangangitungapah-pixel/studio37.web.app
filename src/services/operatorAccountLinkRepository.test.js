import { describe, expect, it, vi } from 'vitest';

import { OPERATOR_TYPES } from '../features/settings/operators.js';
import {
  createOperatorAccountLinkRepository,
  OPERATOR_ACCOUNT_LINK_ERROR_CODES,
} from './operatorAccountLinkRepository.js';

function createStoredOperator(overrides = {}) {
  return {
    createdAt: new Date('2026-08-22T01:00:00.000Z'),
    createdByUid: 'owner-1',
    displayName: 'Budi Engineer',
    email: 'budi@studio37.id',
    linkedUserUid: null,
    operatorTypes: [OPERATOR_TYPES.RECORDING_ENGINEER],
    phone: '+6281234567890',
    status: 'active',
    updatedAt: new Date('2026-08-22T02:00:00.000Z'),
    updatedByUid: 'owner-1',
    ...overrides,
  };
}

function createStoredUser(overrides = {}) {
  return {
    createdAt: new Date('2026-08-22T01:00:00.000Z'),
    displayName: 'Budi Engineer',
    email: 'budi@studio37.id',
    operatorId: null,
    permissionSetId: null,
    phone: '+6281234567890',
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

function createHarness({ operator, user } = {}) {
  const writeTimestamp = { kind: 'server-timestamp' };
  const snapshots = new Map([
    [
      'operators/operator-budi',
      createSnapshot('operator-budi', operator === undefined ? createStoredOperator() : operator),
    ],
    [
      'users/user-budi',
      createSnapshot('user-budi', user === undefined ? createStoredUser() : user),
    ],
  ]);
  const transaction = {
    get: vi.fn(async (reference) => snapshots.get(reference.path) ?? createSnapshot(reference.id)),
    update: vi.fn(),
  };
  const adapter = {
    doc: vi.fn((_db, collectionName, documentId) => ({
      id: documentId,
      path: `${collectionName}/${documentId}`,
    })),
    getDoc: vi.fn(
      async (reference) => snapshots.get(reference.path) ?? createSnapshot(reference.id),
    ),
    runTransaction: vi.fn(async (_db, operation) => operation(transaction)),
  };
  const timestampFactory = vi.fn(() => writeTimestamp);
  const repository = createOperatorAccountLinkRepository({
    adapter,
    db: { name: 'firestore' },
    timestampFactory,
  });

  return { adapter, repository, timestampFactory, transaction, writeTimestamp };
}

describe('operatorAccountLinkRepository', () => {
  it('looks up one exact user profile without exposing a collection list', async () => {
    const { adapter, repository } = createHarness();

    await expect(repository.getUserByUid(' user-budi ')).resolves.toEqual(
      expect.objectContaining({ uid: 'user-budi', operatorId: null }),
    );
    expect(adapter.doc).toHaveBeenCalledWith({ name: 'firestore' }, 'users', 'user-budi');
    expect(adapter.getDoc).toHaveBeenCalledOnce();
    expect(repository).not.toHaveProperty('listUsers');
    expect(repository).not.toHaveProperty('createAuthenticationUser');
  });

  it('returns null when the exact user profile does not exist', async () => {
    const { repository } = createHarness();

    await expect(repository.getUserByUid('missing-user')).resolves.toBeNull();
  });

  it('links an unlinked operator and user in one reciprocal transaction', async () => {
    const { adapter, repository, timestampFactory, transaction, writeTimestamp } = createHarness();

    await expect(
      repository.linkOperatorToUser('operator-budi', 'user-budi', { actorUid: 'owner-1' }),
    ).resolves.toEqual({ operatorId: 'operator-budi', userUid: 'user-budi' });

    expect(adapter.runTransaction).toHaveBeenCalledOnce();
    expect(transaction.get).toHaveBeenCalledTimes(2);
    expect(timestampFactory).toHaveBeenCalledOnce();
    expect(transaction.update).toHaveBeenNthCalledWith(
      1,
      { id: 'operator-budi', path: 'operators/operator-budi' },
      {
        linkedUserUid: 'user-budi',
        updatedAt: writeTimestamp,
        updatedByUid: 'owner-1',
      },
    );
    expect(transaction.update).toHaveBeenNthCalledWith(
      2,
      { id: 'user-budi', path: 'users/user-budi' },
      { operatorId: 'operator-budi', updatedAt: writeTimestamp },
    );
  });

  it('rejects links when either side already belongs to another profile', async () => {
    const linkedOperator = createHarness({
      operator: createStoredOperator({ linkedUserUid: 'user-other' }),
    });
    const linkedUser = createHarness({
      user: createStoredUser({ operatorId: 'operator-other' }),
    });

    await expect(
      linkedOperator.repository.linkOperatorToUser('operator-budi', 'user-budi', {
        actorUid: 'owner-1',
      }),
    ).rejects.toMatchObject({ code: OPERATOR_ACCOUNT_LINK_ERROR_CODES.OPERATOR_ALREADY_LINKED });
    await expect(
      linkedUser.repository.linkOperatorToUser('operator-budi', 'user-budi', {
        actorUid: 'owner-1',
      }),
    ).rejects.toMatchObject({ code: OPERATOR_ACCOUNT_LINK_ERROR_CODES.USER_ALREADY_LINKED });
    expect(linkedOperator.transaction.update).not.toHaveBeenCalled();
    expect(linkedUser.transaction.update).not.toHaveBeenCalled();
  });

  it('unlinks only a valid reciprocal relationship in one transaction', async () => {
    const { repository, transaction, writeTimestamp } = createHarness({
      operator: createStoredOperator({ linkedUserUid: 'user-budi' }),
      user: createStoredUser({ operatorId: 'operator-budi' }),
    });

    await expect(
      repository.unlinkOperatorFromUser('operator-budi', { actorUid: 'owner-1' }),
    ).resolves.toEqual({ operatorId: 'operator-budi', userUid: 'user-budi' });
    expect(transaction.update).toHaveBeenNthCalledWith(
      1,
      { id: 'operator-budi', path: 'operators/operator-budi' },
      { linkedUserUid: null, updatedAt: writeTimestamp, updatedByUid: 'owner-1' },
    );
    expect(transaction.update).toHaveBeenNthCalledWith(
      2,
      { id: 'user-budi', path: 'users/user-budi' },
      { operatorId: null, updatedAt: writeTimestamp },
    );
  });

  it('fails closed for missing records, malformed identifiers, and broken backlinks', async () => {
    const missingOperator = createHarness({ operator: null });
    const unlinkedOperator = createHarness({ operator: createStoredOperator() });
    const brokenLink = createHarness({
      operator: createStoredOperator({ linkedUserUid: 'user-budi' }),
      user: createStoredUser({ operatorId: 'operator-other' }),
    });

    await expect(
      missingOperator.repository.linkOperatorToUser('operator-budi', 'user-budi', {
        actorUid: 'owner-1',
      }),
    ).rejects.toMatchObject({ code: OPERATOR_ACCOUNT_LINK_ERROR_CODES.OPERATOR_NOT_FOUND });
    await expect(
      unlinkedOperator.repository.unlinkOperatorFromUser('operator-budi', { actorUid: 'owner-1' }),
    ).rejects.toMatchObject({ code: OPERATOR_ACCOUNT_LINK_ERROR_CODES.OPERATOR_NOT_LINKED });
    await expect(
      brokenLink.repository.unlinkOperatorFromUser('operator-budi', { actorUid: 'owner-1' }),
    ).rejects.toMatchObject({ code: OPERATOR_ACCOUNT_LINK_ERROR_CODES.INVARIANT_BROKEN });
    await expect(brokenLink.repository.getUserByUid('users/user-budi')).rejects.toThrow(
      /document id/,
    );
    await expect(brokenLink.repository.getUserByUid(null)).rejects.toThrow(/userUid/);
    expect(() => createOperatorAccountLinkRepository({ db: null })).toThrow(
      expect.objectContaining({
        code: OPERATOR_ACCOUNT_LINK_ERROR_CODES.REPOSITORY_UNAVAILABLE,
      }),
    );
  });
});
