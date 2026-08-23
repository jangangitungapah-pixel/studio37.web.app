import { describe, expect, it, vi } from 'vitest';

import { STUDIO_ROOM_LIST_LIMIT } from '../features/settings/studioRooms.js';
import { createStudioRoomRepository } from './studioRoomRepository.js';

function createStoredRoom(overrides = {}) {
  return {
    code: 'ST-A',
    createdAt: new Date('2026-08-22T01:00:00.000Z'),
    createdByUid: 'owner-1',
    description: 'Ruang latihan utama',
    displayOrder: 1,
    name: 'Studio A',
    status: 'active',
    updatedAt: new Date('2026-08-22T02:00:00.000Z'),
    updatedByUid: 'owner-1',
    ...overrides,
  };
}

function createDetails(overrides = {}) {
  return {
    code: 'ST-A',
    description: 'Ruang latihan utama',
    displayOrder: 1,
    name: 'Studio A',
    ...overrides,
  };
}

function createHarness({ documents } = {}) {
  const collectionReference = { path: 'studios' };
  const generatedReference = { id: 'generated-room', path: 'studios/generated-room' };
  const writeTimestamp = { kind: 'server-timestamp' };
  const adapter = {
    collection: vi.fn(() => collectionReference),
    doc: vi.fn((_collectionReference, roomId) =>
      roomId ? { id: roomId, path: `studios/${roomId}` } : generatedReference,
    ),
    getDocs: vi.fn(async () => ({
      docs: documents ?? [
        { data: () => createStoredRoom({ displayOrder: 2, name: 'Studio B' }), id: 'room-b' },
        { data: () => createStoredRoom(), id: 'room-a' },
      ],
    })),
    limit: vi.fn((value) => ({ type: 'limit', value })),
    orderBy: vi.fn((field, direction) => ({ direction, field, type: 'orderBy' })),
    query: vi.fn((...constraints) => ({ constraints })),
    setDoc: vi.fn(async () => undefined),
    updateDoc: vi.fn(async () => undefined),
  };
  const timestampFactory = vi.fn(() => writeTimestamp);
  const repository = createStudioRoomRepository({
    adapter,
    db: { name: 'firestore' },
    timestampFactory,
  });

  return { adapter, generatedReference, repository, timestampFactory, writeTimestamp };
}

describe('studioRoomRepository', () => {
  it('lists rooms with one explicit ordered query capped at 50 documents', async () => {
    const { adapter, repository } = createHarness();

    const rooms = await repository.listStudioRooms();

    expect(adapter.collection).toHaveBeenCalledWith({ name: 'firestore' }, 'studios');
    expect(adapter.orderBy).toHaveBeenCalledWith('displayOrder', 'asc');
    expect(adapter.limit).toHaveBeenCalledWith(STUDIO_ROOM_LIST_LIMIT);
    expect(adapter.getDocs).toHaveBeenCalledOnce();
    expect(rooms.map(({ id }) => id)).toEqual(['room-a', 'room-b']);
    expect(repository).not.toHaveProperty('listAll');
    expect(repository).not.toHaveProperty('deleteStudioRoom');
  });

  it('creates an active room with an auto id, server timestamps, and actor metadata', async () => {
    const { adapter, generatedReference, repository, timestampFactory, writeTimestamp } =
      createHarness();

    await expect(
      repository.createStudioRoom(createDetails({ code: ' st-a ' }), { actorUid: 'owner-1' }),
    ).resolves.toBe('generated-room');

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

  it('updates only editable room fields plus server update metadata', async () => {
    const { adapter, repository, writeTimestamp } = createHarness();

    await expect(
      repository.updateStudioRoom('room-a', createDetails({ name: 'Studio Utama' }), {
        actorUid: 'owner-1',
      }),
    ).resolves.toBe('room-a');

    expect(adapter.updateDoc).toHaveBeenCalledWith(
      { id: 'room-a', path: 'studios/room-a' },
      {
        ...createDetails({ name: 'Studio Utama' }),
        updatedAt: writeTimestamp,
        updatedByUid: 'owner-1',
      },
    );
    expect(adapter.updateDoc.mock.calls[0][1]).not.toHaveProperty('createdAt');
    expect(adapter.updateDoc.mock.calls[0][1]).not.toHaveProperty('status');
  });

  it('soft-disables rooms without exposing a delete operation', async () => {
    const { adapter, repository, writeTimestamp } = createHarness();

    await expect(
      repository.setStudioRoomStatus('room-a', 'disabled', { actorUid: 'owner-1' }),
    ).resolves.toBe('room-a');

    expect(adapter.updateDoc).toHaveBeenCalledWith(
      { id: 'room-a', path: 'studios/room-a' },
      {
        status: 'disabled',
        updatedAt: writeTimestamp,
        updatedByUid: 'owner-1',
      },
    );
    expect(repository.deleteStudioRoom).toBeUndefined();
  });

  it('rejects malformed values and identifiers before writing', async () => {
    const { adapter, repository } = createHarness();

    await expect(
      repository.createStudioRoom(createDetails({ displayOrder: 0 }), { actorUid: 'owner-1' }),
    ).rejects.toThrow(/displayOrder/);
    await expect(
      repository.updateStudioRoom('studios/room-a', createDetails(), { actorUid: 'owner-1' }),
    ).rejects.toThrow(/document id/);
    await expect(
      repository.setStudioRoomStatus('room-a', 'archived', { actorUid: 'owner-1' }),
    ).rejects.toThrow(/status/);
    expect(adapter.setDoc).not.toHaveBeenCalled();
    expect(adapter.updateDoc).not.toHaveBeenCalled();
  });

  it('fails closed when a stored room has an unsupported shape', async () => {
    const { repository } = createHarness({
      documents: [{ data: () => createStoredRoom({ capacity: 10 }), id: 'room-a' }],
    });

    await expect(repository.listStudioRooms()).rejects.toThrow(/unsupported document shape/);
  });
});
