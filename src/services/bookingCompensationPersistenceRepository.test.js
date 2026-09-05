import { describe, expect, it } from 'vitest';

import { OPERATOR_TYPES } from '../features/settings/operators.js';
import {
  BOOKING_COMPENSATION_SNAPSHOT_VERSION,
  buildBookingCompensationProjection,
  COMMISSION_ENTRY_STATES,
} from '../features/commissions/bookingCompensation.js';
import {
  COMPENSATION_RULE_MODELS,
  COMPENSATION_RULE_STATUSES,
} from '../features/commissions/compensationRules.js';
import {
  BookingNotFoundError,
  CommissionEntryConflictError,
  CommissionEntryIdCollisionError,
  createBookingCompensationPersistenceRepository,
  deriveCommissionEntryDocumentId,
  ExistingBookingCompensationError,
  IncompleteBookingCompensationProjectionError,
} from './bookingCompensationPersistenceRepository.js';

function makeRule(overrides = {}) {
  return {
    compensationModel: COMPENSATION_RULE_MODELS.PER_SESSION,
    configuration: { amountIdr: 50_000 },
    effectiveFrom: null,
    effectiveUntil: null,
    id: 'rule-default',
    name: 'Default rule',
    operatorId: null,
    operatorType: OPERATOR_TYPES.STUDIO_OPERATOR,
    priority: 100,
    sessionTypeId: null,
    status: COMPENSATION_RULE_STATUSES.ACTIVE,
    studioId: null,
    ...overrides,
  };
}

function makeProjection(overrides = {}) {
  return buildBookingCompensationProjection({
    assignments: [
      {
        operatorId: 'operator-studio',
        operatorType: OPERATOR_TYPES.STUDIO_OPERATOR,
      },
    ],
    bookingId: 'booking-1',
    bookingNumber: 'ST37-2026-0001',
    durationMinutes: 120,
    effectiveAt: new Date('2026-09-07T10:00:00.000Z'),
    percentageBaseAmounts: {},
    rules: [makeRule()],
    sessionTypeId: 'rehearsal',
    studioId: 'studio-a',
    ...overrides,
  });
}

function createSnapshot(id, value) {
  return {
    data: () => value,
    exists: () => value !== undefined,
    id,
  };
}

function createHarness({ booking = { bookingNumber: 'ST37-2026-0001' }, entries = {} } = {}) {
  const documents = new Map();
  if (booking !== undefined) documents.set('bookings/booking-1', structuredClone(booking));
  for (const [id, value] of Object.entries(entries)) {
    documents.set(`commissionEntries/${id}`, structuredClone(value));
  }

  const writes = [];
  const adapter = {
    collection: (_db, name) => ({ path: name }),
    doc: (collectionReference, id) => ({ id, path: `${collectionReference.path}/${id}` }),
    runTransaction: async (_db, callback) => {
      const transaction = {
        get: async (reference) =>
          createSnapshot(reference.id, documents.get(reference.path)),
        set: (reference, value) => {
          writes.push({ operation: 'set', path: reference.path, value });
          documents.set(reference.path, structuredClone(value));
        },
        update: (reference, value) => {
          writes.push({ operation: 'update', path: reference.path, value });
          documents.set(reference.path, {
            ...documents.get(reference.path),
            ...structuredClone(value),
          });
        },
      };
      return callback(transaction);
    },
  };

  return { adapter, documents, writes };
}

function createRepository(harness, overrides = {}) {
  return createBookingCompensationPersistenceRepository({
    adapter: harness.adapter,
    db: { test: true },
    entryIdFactory: async () => 'commission-entry-1',
    timestampFactory: () => 'SERVER_TIMESTAMP',
    ...overrides,
  });
}

function persistedEntryFromDraft(draft, overrides = {}) {
  return {
    ...structuredClone(draft),
    createdAt: 'OLD_TIMESTAMP',
    createdByUid: 'owner-1',
    updatedAt: 'OLD_TIMESTAMP',
    updatedByUid: 'owner-1',
    ...overrides,
  };
}

describe('booking compensation persistence repository', () => {
  it('derives stable SHA-256 document ids from source keys', async () => {
    const first = await deriveCommissionEntryDocumentId('booking|operator|rule|event');
    const second = await deriveCommissionEntryDocumentId('booking|operator|rule|event');
    const changed = await deriveCommissionEntryDocumentId('booking|operator|rule-2|event');

    expect(first).toBe(second);
    expect(first).toMatch(/^booking-comp-[0-9a-f]{64}$/);
    expect(first).not.toBe(changed);
  });

  it('initializes booking snapshot and pending entries in one transaction', async () => {
    const harness = createHarness();
    const repository = createRepository(harness);
    const projection = makeProjection();

    const result = await repository.initializeBookingCompensation('booking-1', projection, {
      actorUid: 'owner-1',
    });

    expect(result).toEqual({
      bookingId: 'booking-1',
      createdEntryIds: ['commission-entry-1'],
      existingEntryIds: [],
      initializedBookingSnapshot: true,
    });
    expect(harness.writes).toHaveLength(2);
    expect(harness.writes[0]).toMatchObject({
      operation: 'update',
      path: 'bookings/booking-1',
      value: {
        compensationSnapshot: projection.bookingSnapshot,
        compensationSummary: projection.bookingSnapshot.summary,
        updatedAt: 'SERVER_TIMESTAMP',
        updatedByUid: 'owner-1',
      },
    });
    expect(harness.writes[1]).toMatchObject({
      operation: 'set',
      path: 'commissionEntries/commission-entry-1',
      value: {
        amountIdr: 50_000,
        bookingId: 'booking-1',
        createdAt: 'SERVER_TIMESTAMP',
        createdByUid: 'owner-1',
        state: COMMISSION_ENTRY_STATES.PENDING,
        updatedAt: 'SERVER_TIMESTAMP',
        updatedByUid: 'owner-1',
      },
    });
  });

  it('treats an exact retry as idempotent and never rewrites an advanced entry state', async () => {
    const projection = makeProjection();
    const existingEntry = persistedEntryFromDraft(projection.commissionEntryDrafts[0], {
      payoutId: 'payout-1',
      state: COMMISSION_ENTRY_STATES.PAID,
      updatedAt: 'PAID_TIMESTAMP',
    });
    const harness = createHarness({
      booking: {
        bookingNumber: 'ST37-2026-0001',
        compensationSnapshot: structuredClone(projection.bookingSnapshot),
        compensationSummary: structuredClone(projection.bookingSnapshot.summary),
      },
      entries: { 'commission-entry-1': existingEntry },
    });
    const repository = createRepository(harness);

    const result = await repository.initializeBookingCompensation('booking-1', projection, {
      actorUid: 'owner-1',
    });

    expect(result).toEqual({
      bookingId: 'booking-1',
      createdEntryIds: [],
      existingEntryIds: ['commission-entry-1'],
      initializedBookingSnapshot: false,
    });
    expect(harness.writes).toEqual([]);
    expect(harness.documents.get('commissionEntries/commission-entry-1').state).toBe(
      COMMISSION_ENTRY_STATES.PAID,
    );
  });

  it('fails closed when the source booking does not exist', async () => {
    const harness = createHarness({ booking: undefined });
    const repository = createRepository(harness);

    await expect(
      repository.initializeBookingCompensation('booking-1', makeProjection(), {
        actorUid: 'owner-1',
      }),
    ).rejects.toBeInstanceOf(BookingNotFoundError);
    expect(harness.writes).toEqual([]);
  });

  it('refuses to overwrite different historical booking compensation evidence', async () => {
    const projection = makeProjection();
    const harness = createHarness({
      booking: {
        compensationSnapshot: {
          ...structuredClone(projection.bookingSnapshot),
          schemaVersion: BOOKING_COMPENSATION_SNAPSHOT_VERSION + 1,
        },
        compensationSummary: structuredClone(projection.bookingSnapshot.summary),
      },
    });
    const repository = createRepository(harness);

    await expect(
      repository.initializeBookingCompensation('booking-1', projection, { actorUid: 'owner-1' }),
    ).rejects.toBeInstanceOf(ExistingBookingCompensationError);
    expect(harness.writes).toEqual([]);
  });

  it('refuses an existing deterministic entry whose immutable evidence conflicts', async () => {
    const projection = makeProjection();
    const conflictingEntry = persistedEntryFromDraft(projection.commissionEntryDrafts[0], {
      amountIdr: 99_999,
    });
    const harness = createHarness({ entries: { 'commission-entry-1': conflictingEntry } });
    const repository = createRepository(harness);

    await expect(
      repository.initializeBookingCompensation('booking-1', projection, { actorUid: 'owner-1' }),
    ).rejects.toBeInstanceOf(CommissionEntryConflictError);
    expect(harness.writes).toEqual([]);
  });

  it('refuses unresolved no-match diagnostics instead of persisting a partial projection', async () => {
    const projection = makeProjection({
      rules: [makeRule({ operatorType: OPERATOR_TYPES.RECORDING_ENGINEER })],
    });
    const harness = createHarness();
    const repository = createRepository(harness);

    await expect(
      repository.initializeBookingCompensation('booking-1', projection, { actorUid: 'owner-1' }),
    ).rejects.toBeInstanceOf(IncompleteBookingCompensationProjectionError);
    expect(harness.writes).toEqual([]);
  });

  it('detects deterministic document-id collisions before opening the transaction', async () => {
    const projection = makeProjection({
      assignments: [
        { operatorId: 'operator-studio', operatorType: OPERATOR_TYPES.STUDIO_OPERATOR },
        { operatorId: 'operator-recording', operatorType: OPERATOR_TYPES.RECORDING_ENGINEER },
      ],
      rules: [
        makeRule(),
        makeRule({
          compensationModel: COMPENSATION_RULE_MODELS.FIXED,
          configuration: { amountIdr: 150_000 },
          id: 'rule-recording',
          operatorType: OPERATOR_TYPES.RECORDING_ENGINEER,
        }),
      ],
    });
    const harness = createHarness();
    const repository = createRepository(harness, {
      entryIdFactory: async () => 'forced-collision',
    });

    await expect(
      repository.initializeBookingCompensation('booking-1', projection, { actorUid: 'owner-1' }),
    ).rejects.toBeInstanceOf(CommissionEntryIdCollisionError);
    expect(harness.writes).toEqual([]);
  });
});
