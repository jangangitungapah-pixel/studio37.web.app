import { describe, expect, it, vi } from 'vitest';

import { CAPABILITIES } from '../features/auth/capabilities.js';
import {
  createPermissionAdministrationRepository,
  PERMISSION_ADMINISTRATION_ERROR_CODES,
} from './permissionAdministrationRepository.js';

function createStoredPermissionSet(overrides = {}) {
  return {
    capabilities: [CAPABILITIES.BOOKING_VIEW],
    createdAt: new Date('2026-08-22T01:00:00.000Z'),
    name: 'Front Desk',
    status: 'active',
    updatedAt: new Date('2026-08-22T02:00:00.000Z'),
    ...overrides,
  };
}

function createStoredUser(overrides = {}) {
  return {
    activationInviteId: 'invite-12345678901234567890',
    createdAt: new Date('2026-08-22T01:00:00.000Z'),
    displayName: 'Dina Studio',
    email: 'dina@studio37.id',
    operatorId: 'operator-dina',
    permissionSetId: null,
    phone: '+6281234567890',
    role: 'studio_operator',
    status: 'active',
    uid: 'user-dina',
    updatedAt: new Date('2026-08-22T02:00:00.000Z'),
    ...overrides,
  };
}

function createStoredOperator(overrides = {}) {
  return {
    createdAt: new Date('2026-08-22T01:00:00.000Z'),
    createdByUid: 'owner-1',
    displayName: 'Dina Studio',
    email: 'dina@studio37.id',
    linkedUserUid: 'user-dina',
    operatorTypes: ['studio_operator'],
    phone: '+6281234567890',
    status: 'active',
    updatedAt: new Date('2026-08-22T02:00:00.000Z'),
    updatedByUid: 'owner-1',
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

function createHarness({ documents, operator, permissionSet, user } = {}) {
  const collectionReference = { id: 'permissionSets', path: 'permissionSets' };
  const generatedReference = { id: 'generated-set', path: 'permissionSets/generated-set' };
  const writeTimestamp = { kind: 'server-timestamp' };
  const snapshots = new Map([
    [
      'users/user-dina',
      createSnapshot('user-dina', user === undefined ? createStoredUser() : user),
    ],
    [
      'operators/operator-dina',
      createSnapshot('operator-dina', operator === undefined ? createStoredOperator() : operator),
    ],
    [
      'permissionSets/front-desk',
      createSnapshot(
        'front-desk',
        permissionSet === undefined ? createStoredPermissionSet() : permissionSet,
      ),
    ],
  ]);
  const transaction = {
    get: vi.fn(async (reference) => snapshots.get(reference.path) ?? createSnapshot(reference.id)),
    update: vi.fn(),
  };
  const adapter = {
    collection: vi.fn(() => collectionReference),
    doc: vi.fn((parent, collectionName, documentId) => {
      if (parent === collectionReference && collectionName === undefined) return generatedReference;
      if (parent === collectionReference) {
        return { id: collectionName, path: `permissionSets/${collectionName}` };
      }

      return { id: documentId, path: `${collectionName}/${documentId}` };
    }),
    getDoc: vi.fn(
      async (reference) => snapshots.get(reference.path) ?? createSnapshot(reference.id),
    ),
    getDocs: vi.fn(async () => ({
      docs: documents ?? [
        {
          data: () => createStoredPermissionSet({ name: 'Studio Team' }),
          id: 'studio-team',
        },
        { data: () => createStoredPermissionSet(), id: 'front-desk' },
      ],
    })),
    limit: vi.fn((value) => ({ type: 'limit', value })),
    orderBy: vi.fn((field, direction) => ({ direction, field, type: 'orderBy' })),
    query: vi.fn((...constraints) => ({ constraints })),
    runTransaction: vi.fn(async (_db, operation) => operation(transaction)),
    setDoc: vi.fn(async () => undefined),
    updateDoc: vi.fn(async () => undefined),
  };
  const timestampFactory = vi.fn(() => writeTimestamp);
  const repository = createPermissionAdministrationRepository({
    adapter,
    db: { name: 'firestore' },
    timestampFactory,
  });

  return {
    adapter,
    generatedReference,
    repository,
    timestampFactory,
    transaction,
    writeTimestamp,
  };
}

describe('permissionAdministrationRepository', () => {
  it('lists permission sets through one name-ordered query capped at 50 documents', async () => {
    const { adapter, repository } = createHarness();

    await expect(repository.listPermissionSets()).resolves.toEqual([
      expect.objectContaining({ id: 'front-desk', name: 'Front Desk' }),
      expect.objectContaining({ id: 'studio-team', name: 'Studio Team' }),
    ]);
    expect(adapter.collection).toHaveBeenCalledWith({ name: 'firestore' }, 'permissionSets');
    expect(adapter.orderBy).toHaveBeenCalledWith('name', 'asc');
    expect(adapter.limit).toHaveBeenCalledWith(50);
    expect(adapter.getDocs).toHaveBeenCalledOnce();
    expect(repository).not.toHaveProperty('listAll');
    expect(repository).not.toHaveProperty('listUsers');
    expect(repository).not.toHaveProperty('deletePermissionSet');
  });

  it('creates, edits, and soft-disables a normalized permission set', async () => {
    const { adapter, generatedReference, repository, writeTimestamp } = createHarness();

    await expect(
      repository.createPermissionSet({
        capabilities: [CAPABILITIES.DASHBOARD_VIEW, CAPABILITIES.BOOKING_VIEW],
        name: '  Front Desk  ',
      }),
    ).resolves.toBe('generated-set');
    expect(adapter.setDoc).toHaveBeenCalledWith(generatedReference, {
      capabilities: [CAPABILITIES.BOOKING_VIEW, CAPABILITIES.DASHBOARD_VIEW],
      createdAt: writeTimestamp,
      name: 'Front Desk',
      status: 'active',
      updatedAt: writeTimestamp,
    });

    await repository.updatePermissionSet('front-desk', {
      capabilities: [CAPABILITIES.BOOKING_EDIT, CAPABILITIES.BOOKING_VIEW],
      name: 'Booking Desk',
    });
    expect(adapter.updateDoc).toHaveBeenNthCalledWith(
      1,
      { id: 'front-desk', path: 'permissionSets/front-desk' },
      {
        capabilities: [CAPABILITIES.BOOKING_EDIT, CAPABILITIES.BOOKING_VIEW],
        name: 'Booking Desk',
        updatedAt: writeTimestamp,
      },
    );

    await repository.setPermissionSetStatus('front-desk', 'disabled');
    expect(adapter.updateDoc).toHaveBeenNthCalledWith(
      2,
      { id: 'front-desk', path: 'permissionSets/front-desk' },
      { status: 'disabled', updatedAt: writeTimestamp },
    );
  });

  it('reads one exact assignment target without exposing a user collection query', async () => {
    const { adapter, repository } = createHarness();

    await expect(repository.getUserByUid(' user-dina ')).resolves.toEqual(
      expect.objectContaining({ permissionSetId: null, uid: 'user-dina' }),
    );
    expect(adapter.getDoc).toHaveBeenCalledOnce();
    expect(repository).not.toHaveProperty('listUsers');
  });

  it('assigns an active set only after checking exact reciprocal user and operator documents', async () => {
    const { repository, transaction, writeTimestamp } = createHarness();

    await expect(repository.assignPermissionSetToUser('user-dina', 'front-desk')).resolves.toEqual({
      changed: true,
      permissionSetId: 'front-desk',
      userUid: 'user-dina',
    });
    expect(transaction.get).toHaveBeenCalledTimes(3);
    expect(transaction.get.mock.calls.map(([reference]) => reference.path)).toEqual([
      'users/user-dina',
      'operators/operator-dina',
      'permissionSets/front-desk',
    ]);
    expect(transaction.update).toHaveBeenCalledWith(
      { id: 'user-dina', path: 'users/user-dina' },
      { permissionSetId: 'front-desk', updatedAt: writeTimestamp },
    );
  });

  it('clears an assignment without requiring a permission-set or operator collection read', async () => {
    const { repository, transaction, writeTimestamp } = createHarness({
      user: createStoredUser({ permissionSetId: 'front-desk', status: 'disabled' }),
    });

    await expect(repository.assignPermissionSetToUser('user-dina', null)).resolves.toEqual({
      changed: true,
      permissionSetId: null,
      userUid: 'user-dina',
    });
    expect(transaction.get).toHaveBeenCalledOnce();
    expect(transaction.update).toHaveBeenCalledWith(
      { id: 'user-dina', path: 'users/user-dina' },
      { permissionSetId: null, updatedAt: writeTimestamp },
    );
  });

  it('fails closed for missing, disabled, or ineligible assignment records', async () => {
    const missingSet = createHarness({ permissionSet: null });
    const disabledSet = createHarness({
      permissionSet: createStoredPermissionSet({ status: 'disabled' }),
    });
    const unlinkedUser = createHarness({ user: createStoredUser({ operatorId: null }) });
    const brokenOperator = createHarness({
      operator: createStoredOperator({ linkedUserUid: 'user-other' }),
    });

    await expect(
      missingSet.repository.assignPermissionSetToUser('user-dina', 'front-desk'),
    ).rejects.toMatchObject({
      code: PERMISSION_ADMINISTRATION_ERROR_CODES.PERMISSION_SET_NOT_FOUND,
    });
    await expect(
      disabledSet.repository.assignPermissionSetToUser('user-dina', 'front-desk'),
    ).rejects.toMatchObject({
      code: PERMISSION_ADMINISTRATION_ERROR_CODES.PERMISSION_SET_DISABLED,
    });
    await expect(
      unlinkedUser.repository.assignPermissionSetToUser('user-dina', 'front-desk'),
    ).rejects.toMatchObject({ code: PERMISSION_ADMINISTRATION_ERROR_CODES.USER_INELIGIBLE });
    await expect(
      brokenOperator.repository.assignPermissionSetToUser('user-dina', 'front-desk'),
    ).rejects.toMatchObject({
      code: PERMISSION_ADMINISTRATION_ERROR_CODES.OPERATOR_INELIGIBLE,
    });
  });

  it('rejects malformed inputs and unavailable Firestore before any write', async () => {
    const { adapter, repository } = createHarness();

    await expect(
      repository.createPermissionSet({
        capabilities: [CAPABILITIES.PERMISSIONS_MANAGE],
        name: 'Unsafe',
      }),
    ).rejects.toThrow(/cannot be delegated/);
    await expect(repository.updatePermissionSet('nested/id', {})).rejects.toThrow(/document id/);
    await expect(repository.getUserByUid('users/user-dina')).rejects.toThrow(/document id/);
    expect(adapter.setDoc).not.toHaveBeenCalled();
    expect(adapter.updateDoc).not.toHaveBeenCalled();
    expect(() => createPermissionAdministrationRepository({ db: null })).toThrow(
      expect.objectContaining({
        code: PERMISSION_ADMINISTRATION_ERROR_CODES.REPOSITORY_UNAVAILABLE,
      }),
    );
  });
});
