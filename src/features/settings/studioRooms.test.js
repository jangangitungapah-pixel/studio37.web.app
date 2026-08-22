import { describe, expect, it } from 'vitest';

import {
  compareStudioRooms,
  decodeStudioRoomDocument,
  normalizeStudioRoomDetails,
  normalizeStudioRoomStatus,
  STUDIO_ROOM_LIST_LIMIT,
  toStudioRoomFormValues,
  validateStudioRoomForm,
} from './studioRooms.js';

function createDetails(overrides = {}) {
  return {
    code: 'ST-A',
    description: 'Ruang latihan utama',
    displayOrder: 1,
    name: 'Studio A',
    ...overrides,
  };
}

function createDocument(overrides = {}) {
  return {
    ...createDetails(),
    createdAt: new Date('2026-08-22T01:00:00.000Z'),
    createdByUid: 'owner-1',
    id: 'room-a',
    status: 'active',
    updatedAt: new Date('2026-08-22T02:00:00.000Z'),
    updatedByUid: 'owner-1',
    ...overrides,
  };
}

describe('studio room domain contract', () => {
  it('normalizes mutable room details and canonicalizes the room code', () => {
    expect(
      normalizeStudioRoomDetails(
        createDetails({ code: ' st-a ', description: '  Ruang latihan utama  ' }),
      ),
    ).toEqual(createDetails());
    expect(STUDIO_ROOM_LIST_LIMIT).toBe(50);
  });

  it('rejects unsupported codes, display orders, statuses, and extra mutable fields', () => {
    expect(() => normalizeStudioRoomDetails(createDetails({ code: 'Studio A' }))).toThrow(/code/);
    expect(() => normalizeStudioRoomDetails(createDetails({ displayOrder: 0 }))).toThrow(
      /displayOrder/,
    );
    expect(() => normalizeStudioRoomStatus('archived')).toThrow(/status/);
    expect(() => normalizeStudioRoomDetails({ ...createDetails(), capacity: 10 })).toThrow(
      /unsupported document shape/,
    );
  });

  it('decodes strict persisted metadata and clones timestamps', () => {
    const source = createDocument();
    const decoded = decodeStudioRoomDocument(source);

    expect(decoded).toEqual(source);
    expect(decoded.createdAt).not.toBe(source.createdAt);
    expect(decoded.updatedAt).not.toBe(source.updatedAt);
  });

  it('fails closed for unknown fields, invalid ids, and non-monotonic timestamps', () => {
    expect(() => decodeStudioRoomDocument({ ...createDocument(), equipment: [] })).toThrow(
      /unsupported document shape/,
    );
    expect(() => decodeStudioRoomDocument(createDocument({ id: 'studios/room-a' }))).toThrow(
      /document id/,
    );
    expect(() =>
      decodeStudioRoomDocument(createDocument({ updatedAt: new Date('2026-08-21T23:00:00.000Z') })),
    ).toThrow(/earlier than createdAt/);
  });

  it('validates form values without discarding the attempted input', () => {
    const valid = validateStudioRoomForm({
      code: 'st-b',
      description: '',
      displayOrder: '2',
      name: 'Studio B',
    });
    const invalid = validateStudioRoomForm({
      code: '',
      description: '',
      displayOrder: '1000',
      name: '',
    });

    expect(valid.errors).toEqual({});
    expect(valid.value).toEqual({
      code: 'ST-B',
      description: '',
      displayOrder: 2,
      name: 'Studio B',
    });
    expect(invalid.value).toBeNull();
    expect(invalid.errors).toEqual(
      expect.objectContaining({
        code: expect.any(String),
        displayOrder: expect.any(String),
        name: expect.any(String),
      }),
    );
  });

  it('creates form values and sorts duplicate display orders deterministically', () => {
    expect(toStudioRoomFormValues(createDocument())).toEqual({
      code: 'ST-A',
      description: 'Ruang latihan utama',
      displayOrder: '1',
      name: 'Studio A',
    });

    const rooms = [
      createDocument({ id: 'room-c', name: 'Studio C', displayOrder: 2 }),
      createDocument({ id: 'room-b', name: 'Studio B', displayOrder: 1 }),
      createDocument({ id: 'room-a', name: 'Studio A', displayOrder: 1 }),
    ];

    expect([...rooms].sort(compareStudioRooms).map(({ id }) => id)).toEqual([
      'room-a',
      'room-b',
      'room-c',
    ]);
  });
});
