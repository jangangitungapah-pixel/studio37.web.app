import { describe, expect, it } from 'vitest';

import {
  createTrustedBookingCompensationFirestoreGateway,
  TrustedPersistenceConflictError,
} from './trustedBookingCompensationFirestoreGateway.js';

function snapshotFor(value) {
  return {
    exists: value !== undefined,
    data: () => value,
  };
}

function createFakeDb(initialEntries = {}) {
  const store = new Map(Object.entries(initialEntries));
  const reference = (collectionName, id) => ({
    collectionName,
    id,
    path: `${collectionName}/${id}`,
  });

  function collection(collectionName) {
    return {
      doc(id) {
        const ref = reference(collectionName, id);
        return {
          ...ref,
          async get() {
            return snapshotFor(store.get(ref.path));
          },
        };
      },
      where(field, operator, expectedValue) {
        if (operator !== '==') throw new Error('Fake query supports equality only.');
        return {
          limit(limitValue) {
            return {
              async get() {
                const docs = [];
                for (const [path, value] of store) {
                  if (!path.startsWith(`${collectionName}/`) || value?.[field] !== expectedValue) {
                    continue;
                  }
                  docs.push({ id: path.slice(collectionName.length + 1), data: () => value });
                  if (docs.length >= limitValue) break;
                }
                return { docs };
              },
            };
          },
        };
      },
    };
  }

  return {
    store,
    collection,
    async runTransaction(callback) {
      return callback({
        async get(ref) {
          return snapshotFor(store.get(ref.path));
        },
        set(ref, value) {
          store.set(ref.path, value);
        },
        update(ref, patch) {
          store.set(ref.path, { ...store.get(ref.path), ...patch });
        },
      });
    },
  };
}

function makeProjection(overrides = {}) {
  const sourceKey = 'booking-1|operator-1|studio_operator|rule-1|booking_confirmation';
  const calculationSnapshot = {
    compensationModel: 'per_session',
    configuration: { amountIdr: 50000 },
    durationMinutes: 120,
    effectiveAtIso: '2026-09-06T10:00:00.000Z',
    operatorId: 'operator-1',
    operatorType: 'studio_operator',
    percentageBase: null,
    ruleId: 'rule-1',
    sessionTypeId: 'rehearsal',
    studioId: 'studio-a',
  };
  const entry = {
    amountIdr: 50000,
    bookingId: 'booking-1',
    bookingNumber: 'BK-0001',
    calculationSnapshot,
    compensationModel: 'per_session',
    operatorId: 'operator-1',
    operatorType: 'studio_operator',
    payoutId: null,
    ruleId: 'rule-1',
    sourceEvent: 'booking_confirmation',
    sourceKey,
    state: 'pending',
  };
  const bookingSnapshot = {
    diagnostics: [],
    effectiveAtIso: '2026-09-06T10:00:00.000Z',
    entries: [
      {
        amountIdr: entry.amountIdr,
        calculationSnapshot,
        compensationModel: entry.compensationModel,
        operatorId: entry.operatorId,
        operatorType: entry.operatorType,
        ruleId: entry.ruleId,
        sourceEvent: entry.sourceEvent,
        sourceKey,
      },
    ],
    schemaVersion: 1,
    summary: {
      byOperatorType: {
        recording_engineer: { amountIdr: 0, entryCount: 0 },
        studio_operator: { amountIdr: 50000, entryCount: 1 },
      },
      entryCount: 1,
      totalAmountIdr: 50000,
    },
  };

  return {
    bookingSnapshot,
    commissionEntryDrafts: [entry],
    diagnostics: [],
    ...overrides,
  };
}

function createGateway(db) {
  return createTrustedBookingCompensationFirestoreGateway({
    db,
    serverTimestamp: () => 'SERVER_TIMESTAMP',
  });
}

describe('trusted booking compensation Admin Firestore gateway', () => {
  it('atomically initializes the booking snapshot and deterministic pending entry', async () => {
    const db = createFakeDb({ 'bookings/booking-1': { status: 'confirmed' } });
    const gateway = createGateway(db);
    const result = await gateway.persistProjection('booking-1', makeProjection(), {
      actorUid: 'owner-uid',
    });

    expect(result.initializedBookingSnapshot).toBe(true);
    expect(result.createdEntryIds).toHaveLength(1);
    expect(result.createdEntryIds[0]).toMatch(/^booking-comp-[a-f0-9]{64}$/);
    expect(db.store.get('bookings/booking-1')).toMatchObject({
      compensationSummary: { entryCount: 1, totalAmountIdr: 50000 },
      updatedByUid: 'owner-uid',
    });
    expect(db.store.get(`commissionEntries/${result.createdEntryIds[0]}`)).toMatchObject({
      amountIdr: 50000,
      createdByUid: 'owner-uid',
      payoutId: null,
      state: 'pending',
    });
  });

  it('is retry-idempotent and does not downgrade an existing paid entry', async () => {
    const db = createFakeDb({ 'bookings/booking-1': { status: 'confirmed' } });
    const gateway = createGateway(db);
    const projection = makeProjection();
    const first = await gateway.persistProjection('booking-1', projection, {
      actorUid: 'owner-uid',
    });
    const entryPath = `commissionEntries/${first.createdEntryIds[0]}`;
    db.store.set(entryPath, {
      ...db.store.get(entryPath),
      payoutId: 'payout-1',
      state: 'paid',
    });

    const retry = await gateway.persistProjection('booking-1', projection, {
      actorUid: 'owner-uid',
    });
    expect(retry).toMatchObject({
      createdEntryIds: [],
      existingEntryIds: [first.createdEntryIds[0]],
      initializedBookingSnapshot: false,
    });
    expect(db.store.get(entryPath)).toMatchObject({ payoutId: 'payout-1', state: 'paid' });
  });

  it('fails closed when deterministic existing evidence conflicts', async () => {
    const db = createFakeDb({ 'bookings/booking-1': { status: 'confirmed' } });
    const gateway = createGateway(db);
    const projection = makeProjection();
    const first = await gateway.persistProjection('booking-1', projection, {
      actorUid: 'owner-uid',
    });
    const entryPath = `commissionEntries/${first.createdEntryIds[0]}`;
    db.store.set(entryPath, { ...db.store.get(entryPath), amountIdr: 1 });

    await expect(
      gateway.persistProjection('booking-1', projection, { actorUid: 'owner-uid' }),
    ).rejects.toBeInstanceOf(TrustedPersistenceConflictError);
  });

  it('loads only active compensation rules and preserves document IDs', async () => {
    const db = createFakeDb({
      'compensationRules/active-rule': { name: 'Active', status: 'active' },
      'compensationRules/disabled-rule': { name: 'Disabled', status: 'disabled' },
    });
    const rules = await createGateway(db).listActiveCompensationRules(201);
    expect(rules).toEqual([{ id: 'active-rule', name: 'Active', status: 'active' }]);
  });
});