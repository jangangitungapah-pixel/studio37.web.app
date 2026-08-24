import { describe, expect, it, vi } from 'vitest';

import { SESSION_TYPE_LIST_LIMIT } from '../features/pricing/sessionTypes.js';
import { createSessionTypeRepository } from './sessionTypeRepository.js';

function createStoredSessionType(overrides = {}) {
  return {
    code: 'REHEARSAL',
    createdAt: new Date('2026-08-24T01:00:00.000Z'),
    createdByUid: 'owner-1',
    defaultDurationMinutes: 120,
    description: 'Latihan band dengan reservasi studio.',
    displayOrder: 1,
    minimumDurationMinutes: 60,
    name: 'Rehearsal',
    requiresStudioReservation: true,
    status: 'active',
    updatedAt: new Date('2026-08-24T02:00:00.000Z'),
    updatedByUid: 'owner-1',
    ...overrides,
  };
}

function createDetails(overrides = {}) {
  return {
    code: 'REHEARSAL',
    defaultDurationMinutes: 120,
    description: 'Latihan band dengan reservasi studio.',
    displayOrder: 1,
    minimumDurationMinutes: 60,
    name: 'Rehearsal',
    requiresStudioReservation: true,
    ...overrides,
  };
}

function createHarness({ documents } = {}) {
  const collectionReference = { path: 'sessionTypes' };
  const generatedReference = {
    id: 'generated-session-type',
    path: 'sessionTypes/generated-session-type',
  };
  const writeTimestamp = { kind: 'server-timestamp' };
  const adapter = {
    collection: vi.fn(() => collectionReference),
    doc: vi.fn((_collectionReference, sessionTypeId) =>
      sessionTypeId
        ? { id: sessionTypeId, path: `sessionTypes/${sessionTypeId}` }
        : generatedReference,
    ),
    getDocs: vi.fn(async () => ({
      docs: documents ?? [
        {
          data: () => createStoredSessionType({ displayOrder: 2, name: 'Recording' }),
          id: 'recording',
        },
        { data: () => createStoredSessionType(), id: 'rehearsal' },
      ],
    })),
    limit: vi.fn((value) => ({ type: 'limit', value })),
    orderBy: vi.fn((field, direction) => ({ direction, field, type: 'orderBy' })),
    query: vi.fn((...constraints) => ({ constraints })),
    setDoc: vi.fn(async () => undefined),
    updateDoc: vi.fn(async () => undefined),
  };
  const timestampFactory = vi.fn(() => writeTimestamp);
  const repository = createSessionTypeRepository({
    adapter,
    db: { name: 'firestore' },
    timestampFactory,
  });

  return { adapter, generatedReference, repository, timestampFactory, writeTimestamp };
}

describe('sessionTypeRepository', () => {
  it('lists session types with one ordered query capped at 100 documents', async () => {
    const { adapter, repository } = createHarness();

    const sessionTypes = await repository.listSessionTypes();

    expect(adapter.collection).toHaveBeenCalledWith({ name: 'firestore' }, 'sessionTypes');
    expect(adapter.orderBy).toHaveBeenCalledWith('displayOrder', 'asc');
    expect(adapter.limit).toHaveBeenCalledWith(SESSION_TYPE_LIST_LIMIT);
    expect(adapter.getDocs).toHaveBeenCalledOnce();
    expect(sessionTypes.map(({ id }) => id)).toEqual(['rehearsal', 'recording']);
    expect(repository).not.toHaveProperty('listAll');
    expect(repository).not.toHaveProperty('deleteSessionType');
  });

  it('creates an active session type with an auto id and server-owned metadata', async () => {
    const { adapter, generatedReference, repository, timestampFactory, writeTimestamp } =
      createHarness();

    await expect(
      repository.createSessionType(createDetails({ code: ' rehearsal ' }), {
        actorUid: 'owner-1',
      }),
    ).resolves.toBe('generated-session-type');

    expect(timestampFactory).toHaveBeenCalledOnce();
    expect(adapter.setDoc).toHaveBeenCalledWith(generatedReference, {
      ...createDetails(),
      createdAt: writeTimestamp,
      createdByUid: 'owner-1',
      status: 'active',
      updatedAt: writeTimestamp,
      updatedByUid: 'owner-1',
    });
  });

  it('updates only editable fields plus server update metadata', async () => {
    const { adapter, repository, writeTimestamp } = createHarness();

    await expect(
      repository.updateSessionType('rehearsal', createDetails({ name: 'Band Rehearsal' }), {
        actorUid: 'owner-1',
      }),
    ).resolves.toBe('rehearsal');

    expect(adapter.updateDoc).toHaveBeenCalledWith(
      { id: 'rehearsal', path: 'sessionTypes/rehearsal' },
      {
        ...createDetails({ name: 'Band Rehearsal' }),
        updatedAt: writeTimestamp,
        updatedByUid: 'owner-1',
      },
    );
    expect(adapter.updateDoc.mock.calls[0][1]).not.toHaveProperty('createdAt');
    expect(adapter.updateDoc.mock.calls[0][1]).not.toHaveProperty('status');
  });

  it('soft-disables session types without exposing hard delete', async () => {
    const { adapter, repository, writeTimestamp } = createHarness();

    await expect(
      repository.setSessionTypeStatus('rehearsal', 'disabled', { actorUid: 'owner-1' }),
    ).resolves.toBe('rehearsal');

    expect(adapter.updateDoc).toHaveBeenCalledWith(
      { id: 'rehearsal', path: 'sessionTypes/rehearsal' },
      {
        status: 'disabled',
        updatedAt: writeTimestamp,
        updatedByUid: 'owner-1',
      },
    );
    expect(repository.deleteSessionType).toBeUndefined();
  });

  it('rejects malformed values and stored documents before returning or writing', async () => {
    const { adapter, repository } = createHarness();

    await expect(
      repository.createSessionType(createDetails({ minimumDurationMinutes: 180 }), {
        actorUid: 'owner-1',
      }),
    ).rejects.toThrow(/cannot exceed/);
    await expect(
      repository.updateSessionType('sessionTypes/rehearsal', createDetails(), {
        actorUid: 'owner-1',
      }),
    ).rejects.toThrow(/document id/);
    await expect(
      repository.setSessionTypeStatus('rehearsal', 'archived', { actorUid: 'owner-1' }),
    ).rejects.toThrow(/status/);
    expect(adapter.setDoc).not.toHaveBeenCalled();
    expect(adapter.updateDoc).not.toHaveBeenCalled();

    const malformed = createHarness({
      documents: [
        { data: () => createStoredSessionType({ pricingModel: 'hourly' }), id: 'rehearsal' },
      ],
    });
    await expect(malformed.repository.listSessionTypes()).rejects.toThrow(
      /unsupported document shape/,
    );
  });
});
