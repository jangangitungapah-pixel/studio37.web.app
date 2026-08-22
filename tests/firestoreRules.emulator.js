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
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

const TEST_PROJECT_ID = 'studio37-rules-test';
const OWNER_UID = 'owner-1';
const OPERATOR_UID = 'operator-1';
const DISABLED_UID = 'disabled-operator';
const UNASSIGNED_UID = 'unassigned-operator';
const DISABLED_SET_UID = 'disabled-set-operator';
const STUDIO_EDITOR_UID = 'studio-editor';
const DELEGATED_SET_ID = 'front-desk';
const DISABLED_SET_ID = 'disabled-template';
const STUDIO_EDITOR_SET_ID = 'studio-editor-template';
const RULES_PATH = new URL('../firestore.rules', import.meta.url);
const FIXTURE_TIMESTAMP = Timestamp.fromMillis(Date.UTC(2026, 0, 1));

let testEnvironment;

function createUserProfile({
  uid,
  role = 'studio_operator',
  status = 'active',
  permissionSetId = null,
  createdAt = FIXTURE_TIMESTAMP,
  updatedAt = createdAt,
  ...overrides
}) {
  return {
    uid,
    displayName: `Studio37 ${uid}`,
    email: `${uid}@studio37.test`,
    phone: null,
    role,
    status,
    permissionSetId,
    operatorId: null,
    createdAt,
    updatedAt,
    ...overrides,
  };
}

function createPermissionSet({
  name = 'Front Desk',
  status = 'active',
  capabilities = ['booking.view', 'dashboard.view'],
  createdAt = FIXTURE_TIMESTAMP,
  updatedAt = createdAt,
  ...overrides
} = {}) {
  return {
    name,
    status,
    capabilities,
    createdAt,
    updatedAt,
    ...overrides,
  };
}

function createStudioSettings({
  businessName = 'Studio37',
  timeZone = 'Asia/Jakarta',
  operatingHours = { closesAtMinutes: 1320, opensAtMinutes: 600 },
  bookingIntervalMinutes = 30,
  createdAt = FIXTURE_TIMESTAMP,
  createdByUid = OWNER_UID,
  updatedAt = createdAt,
  updatedByUid = createdByUid,
  ...overrides
} = {}) {
  return {
    businessName,
    timeZone,
    operatingHours,
    bookingIntervalMinutes,
    createdAt,
    createdByUid,
    updatedAt,
    updatedByUid,
    ...overrides,
  };
}

function authenticatedDb(uid) {
  return testEnvironment
    .authenticatedContext(uid, {
      email: `${uid}@studio37.test`,
    })
    .firestore();
}

function recentTimestamp(offsetMilliseconds = 0) {
  return Timestamp.fromMillis(Date.now() - 2_000 + offsetMilliseconds);
}

async function seedDocuments(entries) {
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();

    await Promise.all(entries.map(([path, data]) => setDoc(doc(firestore, path), data)));
  });
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
    [
      `users/${OWNER_UID}`,
      createUserProfile({ uid: OWNER_UID, role: 'owner', permissionSetId: null }),
    ],
    [
      `users/${OPERATOR_UID}`,
      createUserProfile({ uid: OPERATOR_UID, permissionSetId: DELEGATED_SET_ID }),
    ],
    [
      `users/${DISABLED_UID}`,
      createUserProfile({
        uid: DISABLED_UID,
        status: 'disabled',
        permissionSetId: DELEGATED_SET_ID,
      }),
    ],
    [`users/${UNASSIGNED_UID}`, createUserProfile({ uid: UNASSIGNED_UID })],
    [
      `users/${DISABLED_SET_UID}`,
      createUserProfile({ uid: DISABLED_SET_UID, permissionSetId: DISABLED_SET_ID }),
    ],
    [
      `users/${STUDIO_EDITOR_UID}`,
      createUserProfile({ uid: STUDIO_EDITOR_UID, permissionSetId: STUDIO_EDITOR_SET_ID }),
    ],
    [`permissionSets/${DELEGATED_SET_ID}`, createPermissionSet()],
    [
      `permissionSets/${DISABLED_SET_ID}`,
      createPermissionSet({ name: 'Disabled template', status: 'disabled' }),
    ],
    [
      `permissionSets/${STUDIO_EDITOR_SET_ID}`,
      createPermissionSet({
        name: 'Studio settings editor',
        capabilities: ['settings.studio.edit', 'settings.studio.view'],
      }),
    ],
    ['studio37System/connectivity-probe', { checkedAt: FIXTURE_TIMESTAMP }],
  ]);
});

describe('initial Firestore authorization boundary', () => {
  test('denies unauthenticated access and client-side first-Owner bootstrap', async () => {
    const firestore = testEnvironment.unauthenticatedContext().firestore();
    const firstOwnerUid = 'first-owner-attempt';
    const firstOwnerDb = authenticatedDb(firstOwnerUid);

    await assertFails(getDoc(doc(firestore, `users/${OWNER_UID}`)));
    await assertFails(getDoc(doc(firestore, `permissionSets/${DELEGATED_SET_ID}`)));
    await assertFails(getDoc(doc(firestore, 'studio37System/connectivity-probe')));
    await assertFails(getDoc(doc(firestore, 'bookings/booking-1')));
    await assertFails(
      setDoc(
        doc(firestore, 'users/anonymous-owner'),
        createUserProfile({ uid: 'anonymous-owner', role: 'owner' }),
      ),
    );
    await assertFails(
      setDoc(
        doc(firstOwnerDb, `users/${firstOwnerUid}`),
        createUserProfile({ uid: firstOwnerUid, role: 'owner' }),
      ),
    );
  });

  test('allows exact self-profile reads while keeping other profiles private', async () => {
    const operatorDb = authenticatedDb(OPERATOR_UID);
    const disabledDb = authenticatedDb(DISABLED_UID);
    const ownerDb = authenticatedDb(OWNER_UID);

    await assertSucceeds(getDoc(doc(operatorDb, `users/${OPERATOR_UID}`)));
    await assertSucceeds(getDoc(doc(disabledDb, `users/${DISABLED_UID}`)));
    await assertFails(getDoc(doc(operatorDb, `users/${OWNER_UID}`)));
    await assertSucceeds(getDoc(doc(ownerDb, `users/${OPERATOR_UID}`)));
  });

  test('rejects user and permission-set collection scans for every role', async () => {
    const ownerDb = authenticatedDb(OWNER_UID);
    const operatorDb = authenticatedDb(OPERATOR_UID);

    await assertFails(getDocs(collection(ownerDb, 'users')));
    await assertFails(getDocs(collection(operatorDb, 'users')));
    await assertFails(getDocs(collection(ownerDb, 'permissionSets')));
    await assertFails(getDocs(collection(operatorDb, 'permissionSets')));
  });

  test('lets an active Owner create and soft-disable a validated operator profile', async () => {
    const ownerDb = authenticatedDb(OWNER_UID);
    const uid = 'new-operator';
    const createdAt = recentTimestamp();
    const reference = doc(ownerDb, `users/${uid}`);

    await assertSucceeds(
      setDoc(
        reference,
        createUserProfile({
          uid,
          permissionSetId: DELEGATED_SET_ID,
          createdAt,
          updatedAt: createdAt,
        }),
      ),
    );

    await assertSucceeds(
      updateDoc(reference, {
        status: 'disabled',
        updatedAt: recentTimestamp(500),
      }),
    );
    await assertFails(deleteDoc(reference));
  });

  test('rejects invalid user shapes even when an active Owner submits them', async () => {
    const ownerDb = authenticatedDb(OWNER_UID);
    const createdAt = recentTimestamp();

    await assertFails(
      setDoc(
        doc(ownerDb, 'users/mismatched-user'),
        createUserProfile({ uid: 'different-user', createdAt, updatedAt: createdAt }),
      ),
    );
    await assertFails(
      setDoc(
        doc(ownerDb, 'users/unknown-field-user'),
        createUserProfile({
          uid: 'unknown-field-user',
          createdAt,
          updatedAt: createdAt,
          isAdmin: true,
        }),
      ),
    );
    await assertFails(
      setDoc(
        doc(ownerDb, 'users/owner-with-template'),
        createUserProfile({
          uid: 'owner-with-template',
          role: 'owner',
          permissionSetId: DELEGATED_SET_ID,
          createdAt,
          updatedAt: createdAt,
        }),
      ),
    );
    await assertFails(
      setDoc(
        doc(ownerDb, 'users/non-canonical-phone'),
        createUserProfile({
          uid: 'non-canonical-phone',
          phone: '081234567890',
          createdAt,
          updatedAt: createdAt,
        }),
      ),
    );
    await assertFails(
      setDoc(
        doc(ownerDb, 'users/future-timestamp'),
        createUserProfile({
          uid: 'future-timestamp',
          createdAt: Timestamp.fromMillis(Date.now() + 60_000),
          updatedAt: Timestamp.fromMillis(Date.now() + 60_000),
        }),
      ),
    );
  });

  test('preserves profile and permission-set creation history', async () => {
    const ownerDb = authenticatedDb(OWNER_UID);

    await assertFails(
      updateDoc(doc(ownerDb, `users/${OPERATOR_UID}`), {
        createdAt: recentTimestamp(),
        updatedAt: recentTimestamp(500),
      }),
    );
    await assertFails(
      updateDoc(doc(ownerDb, `permissionSets/${DELEGATED_SET_ID}`), {
        createdAt: recentTimestamp(),
        updatedAt: recentTimestamp(500),
      }),
    );
  });

  test('prevents an Operator from promoting or assigning permissions to itself', async () => {
    const operatorDb = authenticatedDb(OPERATOR_UID);
    const reference = doc(operatorDb, `users/${OPERATOR_UID}`);

    await assertFails(
      updateDoc(reference, {
        role: 'owner',
        permissionSetId: null,
        updatedAt: recentTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(reference, {
        permissionSetId: 'privileged-template',
        updatedAt: recentTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(reference, {
        displayName: 'Attempted profile edit',
        updatedAt: recentTimestamp(),
      }),
    );
  });

  test('prevents an Owner from accidentally disabling or demoting its own profile', async () => {
    const ownerDb = authenticatedDb(OWNER_UID);
    const reference = doc(ownerDb, `users/${OWNER_UID}`);

    await assertFails(
      updateDoc(reference, {
        status: 'disabled',
        updatedAt: recentTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(reference, {
        role: 'studio_operator',
        permissionSetId: DELEGATED_SET_ID,
        updatedAt: recentTimestamp(),
      }),
    );
  });

  test('trusts only a validated active Owner profile for privileged writes', async () => {
    const malformedOwnerUid = 'malformed-owner';
    const disabledOwnerUid = 'disabled-owner';

    await seedDocuments([
      [
        `users/${malformedOwnerUid}`,
        createUserProfile({ uid: malformedOwnerUid, role: 'owner', unexpectedAdminFlag: true }),
      ],
      [
        `users/${disabledOwnerUid}`,
        createUserProfile({ uid: disabledOwnerUid, role: 'owner', status: 'disabled' }),
      ],
    ]);

    await assertFails(
      setDoc(
        doc(authenticatedDb(malformedOwnerUid), 'permissionSets/malformed-owner-write'),
        createPermissionSet(),
      ),
    );
    await assertFails(
      setDoc(
        doc(authenticatedDb(disabledOwnerUid), 'permissionSets/disabled-owner-write'),
        createPermissionSet(),
      ),
    );
  });

  test('lets an active Operator read only its exact assigned permission set', async () => {
    const operatorDb = authenticatedDb(OPERATOR_UID);
    const unassignedDb = authenticatedDb(UNASSIGNED_UID);
    const disabledDb = authenticatedDb(DISABLED_UID);
    const disabledSetDb = authenticatedDb(DISABLED_SET_UID);

    await assertSucceeds(getDoc(doc(operatorDb, `permissionSets/${DELEGATED_SET_ID}`)));
    await assertFails(getDoc(doc(operatorDb, `permissionSets/${DISABLED_SET_ID}`)));
    await assertFails(getDoc(doc(unassignedDb, `permissionSets/${DELEGATED_SET_ID}`)));
    await assertFails(getDoc(doc(disabledDb, `permissionSets/${DELEGATED_SET_ID}`)));
    await assertSucceeds(getDoc(doc(disabledSetDb, `permissionSets/${DISABLED_SET_ID}`)));
  });

  test('allows only an active Owner to manage validated permission sets', async () => {
    const ownerDb = authenticatedDb(OWNER_UID);
    const operatorDb = authenticatedDb(OPERATOR_UID);
    const reference = doc(ownerDb, 'permissionSets/booking-team');
    const createdAt = recentTimestamp();

    await assertSucceeds(
      setDoc(
        reference,
        createPermissionSet({
          name: 'Booking team',
          capabilities: ['booking.create', 'booking.edit', 'booking.view'],
          createdAt,
          updatedAt: createdAt,
        }),
      ),
    );
    await assertSucceeds(
      updateDoc(reference, {
        status: 'disabled',
        updatedAt: recentTimestamp(500),
      }),
    );
    await assertFails(
      setDoc(doc(operatorDb, 'permissionSets/operator-created'), createPermissionSet()),
    );
    await assertFails(deleteDoc(reference));
  });

  test('rejects unknown and Owner-only delegated capabilities', async () => {
    const ownerDb = authenticatedDb(OWNER_UID);
    const createdAt = recentTimestamp();

    for (const [id, capabilities] of [
      ['unknown-capability', ['booking.view', 'unknown.action']],
      ['permission-admin', ['permissions.manage']],
      ['danger-zone', ['danger_zone.execute']],
    ]) {
      await assertFails(
        setDoc(
          doc(ownerDb, `permissionSets/${id}`),
          createPermissionSet({ capabilities, createdAt, updatedAt: createdAt }),
        ),
      );
    }
  });

  test('allows active operational users to read only the exact studio settings document', async () => {
    await seedDocuments([['appSettings/studio', createStudioSettings()]]);

    const ownerDb = authenticatedDb(OWNER_UID);
    const operatorDb = authenticatedDb(OPERATOR_UID);
    const disabledDb = authenticatedDb(DISABLED_UID);
    const unauthenticatedDb = testEnvironment.unauthenticatedContext().firestore();

    await assertSucceeds(getDoc(doc(ownerDb, 'appSettings/studio')));
    await assertSucceeds(getDoc(doc(operatorDb, 'appSettings/studio')));
    await assertFails(getDoc(doc(disabledDb, 'appSettings/studio')));
    await assertFails(getDoc(doc(unauthenticatedDb, 'appSettings/studio')));
    await assertFails(getDocs(collection(ownerDb, 'appSettings')));
    await assertFails(getDoc(doc(ownerDb, 'appSettings/other')));
  });

  test('allows validated writes only to Owner or an explicitly delegated studio editor', async () => {
    const ownerDb = authenticatedDb(OWNER_UID);
    const operatorDb = authenticatedDb(OPERATOR_UID);
    const editorDb = authenticatedDb(STUDIO_EDITOR_UID);
    const reference = doc(ownerDb, 'appSettings/studio');

    await assertSucceeds(
      setDoc(
        reference,
        createStudioSettings({
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      ),
    );

    await assertFails(
      updateDoc(doc(operatorDb, 'appSettings/studio'), {
        businessName: 'Unauthorized update',
        updatedAt: serverTimestamp(),
        updatedByUid: OPERATOR_UID,
      }),
    );
    await assertSucceeds(
      updateDoc(doc(editorDb, 'appSettings/studio'), {
        businessName: '37 Music Studio',
        updatedAt: serverTimestamp(),
        updatedByUid: STUDIO_EDITOR_UID,
      }),
    );
    await assertFails(deleteDoc(doc(editorDb, 'appSettings/studio')));
  });

  test('rejects malformed studio settings and spoofed actor metadata', async () => {
    const ownerDb = authenticatedDb(OWNER_UID);
    const reference = doc(ownerDb, 'appSettings/studio');
    const writeSettings = (overrides) =>
      setDoc(
        reference,
        createStudioSettings({
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          ...overrides,
        }),
      );

    for (const invalidSettings of [
      { timeZone: 'Studio37/Local' },
      { bookingIntervalMinutes: 45 },
      { operatingHours: { closesAtMinutes: 600, opensAtMinutes: 1320 } },
      { operatingHours: { closesAtMinutes: 1315, opensAtMinutes: 600 } },
      { createdByUid: OPERATOR_UID },
      { updatedByUid: OPERATOR_UID },
      { isPublic: true },
    ]) {
      await assertFails(writeSettings(invalidSettings));
    }
  });

  test('preserves studio settings creation history and requires server update metadata', async () => {
    await seedDocuments([['appSettings/studio', createStudioSettings()]]);
    const ownerDb = authenticatedDb(OWNER_UID);
    const reference = doc(ownerDb, 'appSettings/studio');

    await assertFails(
      updateDoc(reference, {
        createdAt: recentTimestamp(),
        updatedAt: serverTimestamp(),
        updatedByUid: OWNER_UID,
      }),
    );
    await assertFails(
      updateDoc(reference, {
        businessName: 'Client-clock update',
        updatedAt: recentTimestamp(),
        updatedByUid: OWNER_UID,
      }),
    );
    await assertFails(
      updateDoc(reference, {
        businessName: 'Spoofed actor',
        updatedAt: serverTimestamp(),
        updatedByUid: OPERATOR_UID,
      }),
    );
  });

  test('keeps not-yet-implemented domain collections default-deny', async () => {
    await seedDocuments([
      ['pricingRules/standard', { amount: 100_000 }],
      ['studios/room-a', { active: true, name: 'Studio A' }],
      ['commissionEntries/paid-1', { amount: 50_000, status: 'paid' }],
      ['bookings/booking-1', { status: 'confirmed' }],
    ]);

    const ownerDb = authenticatedDb(OWNER_UID);
    const operatorDb = authenticatedDb(OPERATOR_UID);

    await assertFails(getDoc(doc(ownerDb, 'bookings/booking-1')));
    await assertFails(getDoc(doc(operatorDb, 'bookings/booking-1')));
    await assertFails(updateDoc(doc(operatorDb, 'pricingRules/standard'), { amount: 1 }));
    await assertFails(updateDoc(doc(operatorDb, 'studios/room-a'), { name: 'Hijacked' }));
    await assertFails(updateDoc(doc(operatorDb, 'commissionEntries/paid-1'), { amount: 0 }));
  });

  test('keeps the manual connectivity probe read-only and Owner-only', async () => {
    const ownerDb = authenticatedDb(OWNER_UID);
    const operatorDb = authenticatedDb(OPERATOR_UID);
    const ownerReference = doc(ownerDb, 'studio37System/connectivity-probe');

    await assertSucceeds(getDoc(ownerReference));
    await assertFails(getDoc(doc(operatorDb, 'studio37System/connectivity-probe')));
    await assertFails(updateDoc(ownerReference, { checkedAt: recentTimestamp() }));
  });
});
