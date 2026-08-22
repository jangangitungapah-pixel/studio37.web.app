import { describe, expect, it, vi } from 'vitest';

import { OPERATOR_LIST_LIMIT, OPERATOR_TYPES } from '../features/settings/operators.js';
import { createOperatorRepository } from './operatorRepository.js';

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

function createDetails(overrides = {}) {
  return {
    displayName: 'Budi Engineer',
    email: 'budi@studio37.id',
    operatorTypes: [OPERATOR_TYPES.RECORDING_ENGINEER],
    phone: '+6281234567890',
    ...overrides,
  };
}

function createHarness({ documents } = {}) {
  const collectionReference = { path: 'operators' };
  const generatedReference = { id: 'generated-operator', path: 'operators/generated-operator' };
  const writeTimestamp = { kind: 'server-timestamp' };
  const adapter = {
    collection: vi.fn(() => collectionReference),
    doc: vi.fn((_collectionReference, operatorId) =>
      operatorId ? { id: operatorId, path: `operators/${operatorId}` } : generatedReference,
    ),
    getDocs: vi.fn(async () => ({
      docs: documents ?? [
        { data: () => createStoredOperator({ displayName: 'Citra' }), id: 'operator-c' },
        { data: () => createStoredOperator({ displayName: 'Andi' }), id: 'operator-a' },
      ],
    })),
    limit: vi.fn((value) => ({ type: 'limit', value })),
    orderBy: vi.fn((field, direction) => ({ direction, field, type: 'orderBy' })),
    query: vi.fn((...constraints) => ({ constraints })),
    setDoc: vi.fn(async () => undefined),
    updateDoc: vi.fn(async () => undefined),
  };
  const timestampFactory = vi.fn(() => writeTimestamp);
  const repository = createOperatorRepository({
    adapter,
    db: { name: 'firestore' },
    timestampFactory,
  });

  return { adapter, generatedReference, repository, timestampFactory, writeTimestamp };
}

describe('operatorRepository', () => {
  it('lists operators with one explicit name-ordered query capped at 100 documents', async () => {
    const { adapter, repository } = createHarness();

    const operators = await repository.listOperators();

    expect(adapter.collection).toHaveBeenCalledWith({ name: 'firestore' }, 'operators');
    expect(adapter.orderBy).toHaveBeenCalledWith('displayName', 'asc');
    expect(adapter.limit).toHaveBeenCalledWith(OPERATOR_LIST_LIMIT);
    expect(adapter.getDocs).toHaveBeenCalledOnce();
    expect(operators.map(({ id }) => id)).toEqual(['operator-a', 'operator-c']);
    expect(repository).not.toHaveProperty('listAll');
    expect(repository).not.toHaveProperty('deleteOperator');
    expect(repository).not.toHaveProperty('linkUserAccount');
  });

  it('creates an active unlinked operator with an auto id and server metadata', async () => {
    const { adapter, generatedReference, repository, timestampFactory, writeTimestamp } =
      createHarness();

    await expect(
      repository.createOperator(createDetails({ email: ' BUDI@Studio37.ID ' }), {
        actorUid: 'owner-1',
      }),
    ).resolves.toBe('generated-operator');

    expect(timestampFactory).toHaveBeenCalledOnce();
    expect(adapter.setDoc).toHaveBeenCalledWith(generatedReference, {
      ...createDetails(),
      createdAt: writeTimestamp,
      createdByUid: 'owner-1',
      linkedUserUid: null,
      status: 'active',
      updatedAt: writeTimestamp,
      updatedByUid: 'owner-1',
    });
  });

  it('updates only editable details plus server update metadata', async () => {
    const { adapter, repository, writeTimestamp } = createHarness();

    await expect(
      repository.updateOperator('operator-budi', createDetails({ displayName: 'Budi Utama' }), {
        actorUid: 'owner-1',
      }),
    ).resolves.toBe('operator-budi');

    expect(adapter.updateDoc).toHaveBeenCalledWith(
      { id: 'operator-budi', path: 'operators/operator-budi' },
      {
        ...createDetails({ displayName: 'Budi Utama' }),
        updatedAt: writeTimestamp,
        updatedByUid: 'owner-1',
      },
    );
    expect(adapter.updateDoc.mock.calls[0][1]).not.toHaveProperty('createdAt');
    expect(adapter.updateDoc.mock.calls[0][1]).not.toHaveProperty('linkedUserUid');
    expect(adapter.updateDoc.mock.calls[0][1]).not.toHaveProperty('status');
  });

  it('soft-disables operators without exposing delete or account-link operations', async () => {
    const { adapter, repository, writeTimestamp } = createHarness();

    await expect(
      repository.setOperatorStatus('operator-budi', 'disabled', { actorUid: 'owner-1' }),
    ).resolves.toBe('operator-budi');

    expect(adapter.updateDoc).toHaveBeenCalledWith(
      { id: 'operator-budi', path: 'operators/operator-budi' },
      {
        status: 'disabled',
        updatedAt: writeTimestamp,
        updatedByUid: 'owner-1',
      },
    );
    expect(repository.deleteOperator).toBeUndefined();
    expect(repository.linkUserAccount).toBeUndefined();
  });

  it('rejects malformed values and identifiers before writing', async () => {
    const { adapter, repository } = createHarness();

    await expect(
      repository.createOperator(createDetails({ operatorTypes: [] }), { actorUid: 'owner-1' }),
    ).rejects.toThrow(/one or two/);
    await expect(
      repository.updateOperator('operators/operator-budi', createDetails(), {
        actorUid: 'owner-1',
      }),
    ).rejects.toThrow(/document id/);
    await expect(
      repository.setOperatorStatus('operator-budi', 'archived', { actorUid: 'owner-1' }),
    ).rejects.toThrow(/status/);
    expect(adapter.setDoc).not.toHaveBeenCalled();
    expect(adapter.updateDoc).not.toHaveBeenCalled();
  });

  it('fails closed when a stored operator has an unsupported shape', async () => {
    const { repository } = createHarness({
      documents: [
        {
          data: () => createStoredOperator({ permissionSetId: 'privileged' }),
          id: 'operator-budi',
        },
      ],
    });

    await expect(repository.listOperators()).rejects.toThrow(/unsupported document shape/);
  });
});
