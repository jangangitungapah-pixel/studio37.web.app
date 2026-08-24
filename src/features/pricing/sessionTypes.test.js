import { describe, expect, it } from 'vitest';

import {
  compareSessionTypes,
  decodeSessionTypeDocument,
  normalizeSessionTypeDetails,
  normalizeSessionTypeStatus,
  SESSION_TYPE_LIST_LIMIT,
} from './sessionTypes.js';

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

function createDocument(overrides = {}) {
  return {
    ...createDetails(),
    createdAt: new Date('2026-08-24T01:00:00.000Z'),
    createdByUid: 'owner-1',
    id: 'session-rehearsal',
    status: 'active',
    updatedAt: new Date('2026-08-24T02:00:00.000Z'),
    updatedByUid: 'owner-1',
    ...overrides,
  };
}

describe('session type domain contract', () => {
  it('normalizes canonical details without hardcoding service names', () => {
    expect(
      normalizeSessionTypeDetails(
        createDetails({
          code: ' rehearsal ',
          description: '  Latihan band dengan reservasi studio.  ',
          name: ' Rehearsal ',
        }),
      ),
    ).toEqual(createDetails());
    expect(SESSION_TYPE_LIST_LIMIT).toBe(100);
  });

  it('supports non-reserving services without calendar durations', () => {
    expect(
      normalizeSessionTypeDetails(
        createDetails({
          code: 'MIXING',
          defaultDurationMinutes: null,
          minimumDurationMinutes: null,
          name: 'Mixing',
          requiresStudioReservation: false,
        }),
      ),
    ).toEqual(
      createDetails({
        code: 'MIXING',
        defaultDurationMinutes: null,
        minimumDurationMinutes: null,
        name: 'Mixing',
        requiresStudioReservation: false,
      }),
    );
  });

  it('rejects malformed durations, reservation behavior, status, and extra fields', () => {
    expect(() =>
      normalizeSessionTypeDetails(createDetails({ defaultDurationMinutes: 125 })),
    ).toThrow(/defaultDurationMinutes/);
    expect(() =>
      normalizeSessionTypeDetails(createDetails({ minimumDurationMinutes: 180 })),
    ).toThrow(/cannot exceed/);
    expect(() =>
      normalizeSessionTypeDetails(
        createDetails({ defaultDurationMinutes: null, minimumDurationMinutes: null }),
      ),
    ).toThrow(/studio-reserving/);
    expect(() => normalizeSessionTypeStatus('archived')).toThrow(/status/);
    expect(() => normalizeSessionTypeDetails({ ...createDetails(), packages: [] })).toThrow(
      /unsupported document shape/,
    );
  });

  it('decodes strict persisted metadata and clones timestamps', () => {
    const source = createDocument();
    const decoded = decodeSessionTypeDocument(source);

    expect(decoded).toEqual(source);
    expect(decoded.createdAt).not.toBe(source.createdAt);
    expect(decoded.updatedAt).not.toBe(source.updatedAt);
  });

  it('fails closed for unknown fields, invalid ids, and non-monotonic timestamps', () => {
    expect(() =>
      decodeSessionTypeDocument({ ...createDocument(), pricingModel: 'hourly' }),
    ).toThrow(/unsupported document shape/);
    expect(() =>
      decodeSessionTypeDocument(createDocument({ id: 'sessionTypes/rehearsal' })),
    ).toThrow(/document id/);
    expect(() =>
      decodeSessionTypeDocument(
        createDocument({ updatedAt: new Date('2026-08-23T23:00:00.000Z') }),
      ),
    ).toThrow(/earlier than createdAt/);
  });

  it('sorts duplicate display orders deterministically', () => {
    const sessionTypes = [
      createDocument({ id: 'session-c', name: 'Recording', displayOrder: 2 }),
      createDocument({ id: 'session-b', name: 'Podcast', displayOrder: 1 }),
      createDocument({ id: 'session-a', name: 'Mixing', displayOrder: 1 }),
    ];

    expect([...sessionTypes].sort(compareSessionTypes).map(({ id }) => id)).toEqual([
      'session-a',
      'session-b',
      'session-c',
    ]);
  });
});
