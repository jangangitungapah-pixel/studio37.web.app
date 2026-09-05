import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, describe, test } from 'node:test';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

const TEST_PROJECT_ID = 'studio37-booking-compensation-persistence-test';
const OWNER_UID = 'owner-1';
const INACTIVE_OWNER_UID = 'owner-inactive';
const OPERATOR_UID = 'operator-user';
const PERMISSION_SET_ID = 'commission-operator-template';
const BOOKING_ID = 'booking-1';
const ENTRY_ID = 'booking-comp-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const RULES_PATH = new URL('../firestore.rules', import.meta.url);
const FIXTURE_TIMESTAMP = Timestamp.fromMillis(Date.UTC(2026, 0, 1));

let testEnvironment;

function createUserProfile({
  uid,
  role = 'studio_operator',
  permissionSetId = null,
  ...overrides
}) {
  return {
    uid,
    displayName: `Studio37 ${uid}`,
    email: `${uid}@studio37.test`,
    phone: null,
    role,
    status: 'active',
    permissionSetId,
    operatorId: null,
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
    ...overrides,
  };
}

function createPermissionSet(capabilities) {
  return {
    name: 'Commission access',
    status: 'active',
    capabilities,
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
  };
}

function createBooking(overrides = {}) {
  return {
    bookingNumber: 'ST37-2026-0001',
    status: 'confirmed',
    updatedAt: FIXTURE_TIMESTAMP,
    updatedByUid: OWNER_UID,
    ...overrides,
  };
}

function createCompensationSnapshot(overrides = {}) {
  return {
    diagnostics: [],
    effectiveAtIso: '2026-09-07T10:00:00.000Z',
    entries: [
      {
        amountIdr: 50_000,
        calculationSnapshot: {
          compensationModel: 'per_session',
          configuration: { amountIdr: 50_000 },
          durationMinutes: 120,
          effectiveAtIso: '2026-09-07T10:00:00.000Z',
          expectedAmountIdr: 50_000,
          operatorId: 'operator-studio',
          operatorType: 'studio_operator',
          percentageBase: null,
          ruleId: 'rule-1',
          sessionTypeId: 'rehearsal',
          studioId: 'studio-a',
        },
        compensationModel: 'per_session',
        operatorId: 'operator-studio',
        operatorType: 'studio_operator',
        ruleId: 'rule-1',
        sourceEvent: 'booking_confirmation',
        sourceKey: 'booking-1|operator-studio|studio_operator|rule-1|booking_confirmation',
      },
    ],
    schemaVersion: 1,
    summary: {
      byOperatorType: {
        recording_engineer: { amountIdr: 0, entryCount: 0 },
        studio_operator: { amountIdr: 50_000, entryCount: 1 },
      },
      entryCount: 1,
      totalAmountIdr: 50_000,
    },
    ...overrides,
  };
}

function createCommissionEntry(overrides = {}) {
  return {
    amountIdr: 50_000,
    bookingId: BOOKING_ID,
    bookingNumber: 'ST37-2026-0001',
    calculationSnapshot: {
      compensationModel: 'per_session',
      configuration: { amountIdr: 50_000 },
      durationMinutes: 120,
      effectiveAtIso: '2026-09-07T10:00:00.000Z',
      expectedAmountIdr: 50_000,
      operatorId: 'operator-studio',
      operatorType: 'studio_operator',
      percentageBase: null,
      ruleId: 'rule-1',
      sessionTypeId: 'rehearsal',
      studioId: 'studio-a',
    },
    compensationModel: 'per_session',
    operatorId: 'operator-studio',
    operatorType: 'studio_operator',
    payoutId: null,
    ruleId: 'rule-1',
    sourceEvent: 'booking_confirmation',
    sourceKey: 'booking-1|operator-studio|studio_operator|rule-1|booking_confirmation',
    state: 'pending',
    createdAt: serverTimestamp(),
    createdByUid: OWNER_UID,
    updatedAt: serverTimestamp(),
    updatedByUid: OWNER_UID,
    ...overrides,
  };
}

function authenticatedDb(uid) {
  return testEnvironment.authenticatedContext(uid).firestore();
}

async function seedDocuments(entries) {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    await Promise.all(entries.map(([path, data]) => setDoc(doc(firestore, path), data)));
  });
}

async function initializeBookingCompensation(
  db,
  { entry = createCommissionEntry(), snapshot } = {},
) {
  const resolvedSnapshot = snapshot ?? createCompensationSnapshot();
  const batch = writeBatch(db);
  batch.update(doc(db, `bookings/${BOOKING_ID}`), {
    compensationSnapshot: resolvedSnapshot,
    compensationSummary: resolvedSnapshot.summary,
    updatedAt: serverTimestamp(),
    updatedByUid: OWNER_UID,
  });
  batch.set(doc(db, `commissionEntries/${ENTRY_ID}`), entry);
  return batch.commit();
}

before(async () => {
  const emulatorAddress = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
  const separatorIndex = emulatorAddress.lastIndexOf(':');
  const host = emulatorAddress.slice(0, separatorIndex);
  const port = Number(emulatorAddress.slice(separatorIndex + 1));

  testEnvironment = await initializeTestEnvironment({
    projectId: TEST_PROJECT_ID,
    firestore: {
      host,
      port,
      rules: await readFile(RULES_PATH, 'utf8'),
    },
  });
});

after(async () => {
  await testEnvironment?.cleanup();
});

beforeEach(async () => {
  await testEnvironment.clearFirestore();
  await seedDocuments([
    [`users/${OWNER_UID}`, createUserProfile({ uid: OWNER_UID, role: 'owner' })],
    [
      `users/${INACTIVE_OWNER_UID}`,
      createUserProfile({ uid: INACTIVE_OWNER_UID, role: 'owner', status: 'disabled' }),
    ],
    [
      `users/${OPERATOR_UID}`,
      createUserProfile({ uid: OPERATOR_UID, permissionSetId: PERMISSION_SET_ID }),
    ],
    [
      `permissionSets/${PERMISSION_SET_ID}`,
      createPermissionSet([
        'booking.create',
        'booking.edit',
        'booking.view',
        'commission.adjust',
        'commission.payout',
        'commission.view_all',
        'commission.view_own',
      ]),
    ],
    [`bookings/${BOOKING_ID}`, createBooking()],
  ]);
});

describe('booking compensation persistence Firestore boundary', () => {
  test('allows only an active Owner to read the exact booking during compensation initialization', async () => {
    const ownerDb = authenticatedDb(OWNER_UID);
    const inactiveOwnerDb = authenticatedDb(INACTIVE_OWNER_UID);
    const operatorDb = authenticatedDb(OPERATOR_UID);
    const unauthenticatedDb = testEnvironment.unauthenticatedContext().firestore();

    await assertSucceeds(getDoc(doc(ownerDb, `bookings/${BOOKING_ID}`)));
    await assertFails(getDoc(doc(inactiveOwnerDb, `bookings/${BOOKING_ID}`)));
    await assertFails(getDoc(doc(operatorDb, `bookings/${BOOKING_ID}`)));
    await assertFails(getDoc(doc(unauthenticatedDb, `bookings/${BOOKING_ID}`)));
  });

  test('atomically initializes booking compensation and creates one pending entry for Owner', async () => {
    const ownerDb = authenticatedDb(OWNER_UID);

    await assertSucceeds(initializeBookingCompensation(ownerDb));

    const booking = await getDoc(doc(ownerDb, `bookings/${BOOKING_ID}`));
    const entry = await getDoc(doc(ownerDb, `commissionEntries/${ENTRY_ID}`));
    if (!booking.exists() || !entry.exists())
      throw new Error('Expected persisted compensation records.');
  });

  test('denies delegated operators from initializing booking compensation or creating commission entries', async () => {
    const operatorDb = authenticatedDb(OPERATOR_UID);
    const operatorEntry = createCommissionEntry({
      createdByUid: OPERATOR_UID,
      updatedByUid: OPERATOR_UID,
    });

    await assertFails(initializeBookingCompensation(operatorDb, { entry: operatorEntry }));
    await assertFails(setDoc(doc(operatorDb, 'commissionEntries/operator-forged'), operatorEntry));
  });

  test('fails closed for unresolved booking snapshot diagnostics', async () => {
    const ownerDb = authenticatedDb(OWNER_UID);
    const snapshot = createCompensationSnapshot({
      diagnostics: [
        {
          code: 'no_matching_rule',
          operatorId: 'operator-studio',
          operatorType: 'studio_operator',
        },
      ],
    });

    await assertFails(initializeBookingCompensation(ownerDb, { snapshot }));
  });

  test('requires commission entries to be pending, payout-free, and linked to an existing booking', async () => {
    const ownerDb = authenticatedDb(OWNER_UID);

    await assertFails(
      setDoc(
        doc(ownerDb, 'commissionEntries/earned-forged'),
        createCommissionEntry({ state: 'earned' }),
      ),
    );
    await assertFails(
      setDoc(
        doc(ownerDb, 'commissionEntries/paid-forged'),
        createCommissionEntry({ payoutId: 'payout-1', state: 'paid' }),
      ),
    );
    await assertFails(
      setDoc(
        doc(ownerDb, 'commissionEntries/orphan'),
        createCommissionEntry({ bookingId: 'missing-booking' }),
      ),
    );
  });

  test('does not allow a second client-side booking compensation initialization', async () => {
    const ownerDb = authenticatedDb(OWNER_UID);
    await assertSucceeds(initializeBookingCompensation(ownerDb));

    const replacement = createCompensationSnapshot({
      summary: {
        byOperatorType: {
          recording_engineer: { amountIdr: 0, entryCount: 0 },
          studio_operator: { amountIdr: 99_999, entryCount: 1 },
        },
        entryCount: 1,
        totalAmountIdr: 99_999,
      },
    });

    await assertFails(
      updateDoc(doc(ownerDb, `bookings/${BOOKING_ID}`), {
        compensationSnapshot: replacement,
        compensationSummary: replacement.summary,
        updatedAt: serverTimestamp(),
        updatedByUid: OWNER_UID,
      }),
    );
  });

  test('keeps commission entries Owner-readable with bounded lists and denies mutation after create', async () => {
    const ownerDb = authenticatedDb(OWNER_UID);
    const operatorDb = authenticatedDb(OPERATOR_UID);
    await assertSucceeds(initializeBookingCompensation(ownerDb));

    await assertSucceeds(getDoc(doc(ownerDb, `commissionEntries/${ENTRY_ID}`)));
    await assertFails(getDoc(doc(operatorDb, `commissionEntries/${ENTRY_ID}`)));
    await assertSucceeds(getDocs(query(collection(ownerDb, 'commissionEntries'), limit(200))));
    await assertFails(getDocs(collection(ownerDb, 'commissionEntries')));
    await assertFails(getDocs(query(collection(ownerDb, 'commissionEntries'), limit(201))));
    await assertFails(
      updateDoc(doc(ownerDb, `commissionEntries/${ENTRY_ID}`), {
        state: 'earned',
        updatedAt: serverTimestamp(),
        updatedByUid: OWNER_UID,
      }),
    );
    await assertFails(deleteDoc(doc(ownerDb, `commissionEntries/${ENTRY_ID}`)));
  });
});
