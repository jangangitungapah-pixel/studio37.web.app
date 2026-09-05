import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  FirebaseBookingCompensationRuntimeError,
  classifyTrustedBookingCompensationError,
  createFirebaseBookingCompensationRuntime,
  normalizeCallableBookingCompensationRequest,
} from './bookingCompensationRuntime.js';

const OWNER_UID = 'owner-1';
const OPERATOR_UID = 'operator-user';
const OPERATOR_ID = 'operator-studio';
const PERMISSION_SET_ID = 'front-desk';
const BOOKING_ID = 'booking-1';
const EFFECTIVE_AT = new Date('2026-09-07T10:00:00.000Z');

class FakeDocumentSnapshot {
  constructor(reference, value) {
    this.reference = reference;
    this.id = reference.path.split('/').at(-1);
    this.exists = value !== undefined;
    this.value = value;
  }

  data() {
    return this.value;
  }
}

class FakeDocumentReference {
  constructor(db, path) {
    this.db = db;
    this.path = path;
  }

  get() {
    return this.db.read(this.path);
  }
}

class FakeQuery {
  constructor(db, collectionName, filters = [], limitCount = null) {
    this.db = db;
    this.collectionName = collectionName;
    this.filters = filters;
    this.limitCount = limitCount;
  }

  where(field, operator, value) {
    if (operator !== '==') throw new Error('FakeQuery supports only == filters.');
    return new FakeQuery(
      this.db,
      this.collectionName,
      [...this.filters, [field, value]],
      this.limitCount,
    );
  }

  limit(limitCount) {
    return new FakeQuery(this.db, this.collectionName, this.filters, limitCount);
  }

  async get() {
    this.db.collectionReads.push(this.collectionName);
    const prefix = `${this.collectionName}/`;
    let rows = [...this.db.documents.entries()]
      .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
      .filter(([, value]) =>
        this.filters.every(([field, expected]) => value?.[field] === expected),
      );
    if (this.limitCount !== null) rows = rows.slice(0, this.limitCount);
    const docs = rows.map(([path, value]) => new FakeDocumentSnapshot(this.db.doc(path), value));
    return { docs, size: docs.length };
  }
}

class FakeTransaction {
  constructor(db) {
    this.db = db;
    this.writes = [];
  }

  get(reference) {
    return this.db.read(reference.path);
  }

  update(reference, patch) {
    this.writes.push({ type: 'update', path: reference.path, value: patch });
  }

  set(reference, value) {
    this.writes.push({ type: 'set', path: reference.path, value });
  }

  commit() {
    for (const write of this.writes) {
      if (write.type === 'set') {
        this.db.documents.set(write.path, write.value);
        continue;
      }
      const current = this.db.documents.get(write.path);
      if (current === undefined)
        throw new Error(`Cannot update missing fake document ${write.path}.`);
      this.db.documents.set(write.path, { ...current, ...write.value });
    }
  }
}

class FakeFirestore {
  constructor(entries = []) {
    this.documents = new Map(entries);
    this.documentReads = [];
    this.collectionReads = [];
  }

  doc(path) {
    return new FakeDocumentReference(this, path);
  }

  collection(name) {
    return new FakeQuery(this, name);
  }

  async read(path) {
    this.documentReads.push(path);
    return new FakeDocumentSnapshot(this.doc(path), this.documents.get(path));
  }

  async runTransaction(callback) {
    const transaction = new FakeTransaction(this);
    const result = await callback(transaction);
    transaction.commit();
    return result;
  }
}

function createOwnerProfile(overrides = {}) {
  return {
    uid: OWNER_UID,
    role: 'owner',
    status: 'active',
    permissionSetId: null,
    operatorId: null,
    ...overrides,
  };
}

function createOperatorProfile(overrides = {}) {
  return {
    uid: OPERATOR_UID,
    role: 'studio_operator',
    status: 'active',
    permissionSetId: PERMISSION_SET_ID,
    operatorId: OPERATOR_ID,
    ...overrides,
  };
}

function createBooking(overrides = {}) {
  return {
    bookingNumber: 'ST37-2026-0001',
    status: 'confirmed',
    compensationContext: {
      assignments: [{ operatorId: OPERATOR_ID, operatorType: 'studio_operator' }],
      durationMinutes: 120,
      effectiveAt: EFFECTIVE_AT,
      percentageBaseAmounts: {},
      sessionTypeId: 'rehearsal',
      studioId: 'studio-a',
    },
    ...overrides,
  };
}

function createRule(id = 'rule-1', overrides = {}) {
  return {
    id,
    name: 'Studio operator per session',
    operatorType: 'studio_operator',
    operatorId: null,
    sessionTypeId: null,
    studioId: null,
    compensationModel: 'per_session',
    configuration: { amountIdr: 50_000 },
    priority: 100,
    effectiveFrom: null,
    effectiveUntil: null,
    status: 'active',
    ...overrides,
  };
}

function createBaseDocuments({ operatorCapabilities = ['booking.create'] } = {}) {
  return [
    [`users/${OWNER_UID}`, createOwnerProfile()],
    [`users/${OPERATOR_UID}`, createOperatorProfile()],
    [
      `permissionSets/${PERMISSION_SET_ID}`,
      { status: 'active', capabilities: operatorCapabilities },
    ],
    [
      `operators/${OPERATOR_ID}`,
      {
        status: 'active',
        linkedUserUid: OPERATOR_UID,
        operatorTypes: ['studio_operator'],
      },
    ],
    [`bookings/${BOOKING_ID}`, createBooking()],
    ['compensationRules/rule-1', createRule()],
  ];
}

function createRuntime(db) {
  return createFirebaseBookingCompensationRuntime({
    db,
    timestampFactory: () => ({ __serverTimestamp: true }),
  });
}

function findCommissionEntries(db) {
  return [...db.documents.entries()].filter(([path]) => path.startsWith('commissionEntries/'));
}

test('active Owner executes trusted compensation and receives only a redacted receipt', async () => {
  const db = new FakeFirestore(createBaseDocuments());
  const result = await createRuntime(db).execute({ actorUid: OWNER_UID, bookingId: BOOKING_ID });

  assert.deepEqual(result, {
    bookingId: BOOKING_ID,
    createdEntryCount: 1,
    existingEntryCount: 0,
    initializedBookingSnapshot: true,
  });
  assert.equal('amountIdr' in result, false);
  assert.equal('ruleId' in result, false);
  assert.equal(findCommissionEntries(db).length, 1);
  assert.equal(findCommissionEntries(db)[0][1].createdByUid, OWNER_UID);
});

test('delegated reciprocal Studio Operator with booking.create can execute through server authority', async () => {
  const db = new FakeFirestore(createBaseDocuments());
  const result = await createRuntime(db).execute({ actorUid: OPERATOR_UID, bookingId: BOOKING_ID });

  assert.equal(result.createdEntryCount, 1);
  assert.equal(findCommissionEntries(db)[0][1].createdByUid, OPERATOR_UID);
});

test('unauthorized operator is rejected before protected booking or compensation-rule reads', async () => {
  const db = new FakeFirestore(createBaseDocuments({ operatorCapabilities: ['booking.view'] }));

  await assert.rejects(
    createRuntime(db).execute({ actorUid: OPERATOR_UID, bookingId: BOOKING_ID }),
    (error) => error?.name === 'TrustedBookingCompensationAuthorizationError',
  );
  assert.equal(
    db.documentReads.some((path) => path.startsWith('bookings/')),
    false,
  );
  assert.equal(db.collectionReads.includes('compensationRules'), false);
});

test('inactive permission sets fail closed even when capability text is present', async () => {
  const documents = createBaseDocuments();
  documents[2][1] = { status: 'disabled', capabilities: ['booking.create'] };
  const db = new FakeFirestore(documents);

  await assert.rejects(
    createRuntime(db).execute({ actorUid: OPERATOR_UID, bookingId: BOOKING_ID }),
    (error) => error?.name === 'TrustedBookingCompensationAuthorizationError',
  );
});

test('callable request accepts only bookingId and rejects compensation-shaped forged fields', () => {
  assert.deepEqual(normalizeCallableBookingCompensationRequest({ bookingId: BOOKING_ID }), {
    bookingId: BOOKING_ID,
  });
  assert.throws(
    () =>
      normalizeCallableBookingCompensationRequest({
        bookingId: BOOKING_ID,
        amountIdr: 1,
        ruleId: 'forged-rule',
      }),
    /only bookingId/,
  );
});

test('active compensation-rule count above the trusted bound fails before persistence', async () => {
  const documents = createBaseDocuments().filter(
    ([path]) => !path.startsWith('compensationRules/'),
  );
  for (let index = 0; index < 201; index += 1) {
    documents.push([`compensationRules/rule-${index}`, createRule(`rule-${index}`)]);
  }
  const db = new FakeFirestore(documents);

  await assert.rejects(
    createRuntime(db).execute({ actorUid: OWNER_UID, bookingId: BOOKING_ID }),
    (error) =>
      error instanceof FirebaseBookingCompensationRuntimeError &&
      error.code === 'rule-limit-exceeded',
  );
  assert.equal(findCommissionEntries(db).length, 0);
  assert.equal(db.documents.get(`bookings/${BOOKING_ID}`).compensationSnapshot, undefined);
});

test('idempotent retry preserves an already advanced paid commission lifecycle state', async () => {
  const db = new FakeFirestore(createBaseDocuments());
  const runtime = createRuntime(db);
  await runtime.execute({ actorUid: OWNER_UID, bookingId: BOOKING_ID });

  const [entryPath, entry] = findCommissionEntries(db)[0];
  db.documents.set(entryPath, { ...entry, state: 'paid', payoutId: 'payout-1' });

  const retry = await runtime.execute({ actorUid: OWNER_UID, bookingId: BOOKING_ID });
  assert.equal(retry.createdEntryCount, 0);
  assert.equal(retry.existingEntryCount, 1);
  assert.equal(retry.initializedBookingSnapshot, false);
  assert.equal(db.documents.get(entryPath).state, 'paid');
  assert.equal(db.documents.get(entryPath).payoutId, 'payout-1');
});

test('retry fails closed when historical booking snapshot evidence was changed', async () => {
  const db = new FakeFirestore(createBaseDocuments());
  const runtime = createRuntime(db);
  await runtime.execute({ actorUid: OWNER_UID, bookingId: BOOKING_ID });

  const booking = db.documents.get(`bookings/${BOOKING_ID}`);
  db.documents.set(`bookings/${BOOKING_ID}`, {
    ...booking,
    compensationSnapshot: {
      ...booking.compensationSnapshot,
      summary: { ...booking.compensationSnapshot.summary, totalAmountIdr: 99_999 },
    },
  });

  await assert.rejects(
    runtime.execute({ actorUid: OWNER_UID, bookingId: BOOKING_ID }),
    (error) =>
      error instanceof FirebaseBookingCompensationRuntimeError &&
      error.code === 'existing-snapshot-conflict',
  );
});

test('booking without server-authoritative compensationContext fails closed', async () => {
  const documents = createBaseDocuments();
  documents[4][1] = { bookingNumber: 'ST37-2026-0001', status: 'confirmed' };
  const db = new FakeFirestore(documents);

  await assert.rejects(
    createRuntime(db).execute({ actorUid: OWNER_UID, bookingId: BOOKING_ID }),
    (error) =>
      error instanceof FirebaseBookingCompensationRuntimeError &&
      error.code === 'booking-context-missing',
  );
});

test('public error classification does not expose internal commission evidence', () => {
  const classified = classifyTrustedBookingCompensationError(
    new FirebaseBookingCompensationRuntimeError(
      'commission-conflict',
      'secret sourceKey booking-1|operator|rule-1',
    ),
  );

  assert.deepEqual(classified, {
    code: 'aborted',
    message: 'Existing booking compensation evidence conflicts with this request.',
  });
  assert.equal(classified.message.includes('sourceKey'), false);
  assert.equal(classified.message.includes('rule-1'), false);
});
