import assert from 'node:assert/strict';
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
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

const TEST_PROJECT_ID = 'studio37-rules-test';
const OWNER_UID = 'owner-1';
const OPERATOR_UID = 'operator-1';
const DISABLED_UID = 'disabled-operator';
const UNASSIGNED_UID = 'unassigned-operator';
const DISABLED_SET_UID = 'disabled-set-operator';
const STUDIO_EDITOR_UID = 'studio-editor';
const OPERATOR_MANAGER_UID = 'operator-manager';
const PRICING_VIEWER_UID = 'pricing-viewer';
const PRICING_EDITOR_UID = 'pricing-editor';
const INVITED_UID = 'invited-operator';
const EXISTING_INVITED_UID = 'existing-invited-operator';
const ASSIGNABLE_UID = 'assignable-operator';
const ASSIGNABLE_OPERATOR_ID = 'operator-assignable';
const INVITED_OPERATOR_ID = 'operator-invited';
const INVITATION_ID = 'invite-12345678901234567890';
const INVITED_EMAIL = 'invitee@studio37.id';
const DELEGATED_SET_ID = 'front-desk';
const DISABLED_SET_ID = 'disabled-template';
const STUDIO_EDITOR_SET_ID = 'studio-editor-template';
const OPERATOR_MANAGER_SET_ID = 'operator-manager-template';
const PRICING_VIEWER_SET_ID = 'pricing-viewer-template';
const PRICING_EDITOR_SET_ID = 'pricing-editor-template';
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

function createStudioRoom({
  code = 'ST-A',
  name = 'Studio A',
  description = 'Ruang latihan utama',
  displayOrder = 1,
  status = 'active',
  createdAt = FIXTURE_TIMESTAMP,
  createdByUid = OWNER_UID,
  updatedAt = createdAt,
  updatedByUid = createdByUid,
  ...overrides
} = {}) {
  return {
    code,
    name,
    description,
    displayOrder,
    status,
    createdAt,
    createdByUid,
    updatedAt,
    updatedByUid,
    ...overrides,
  };
}

function createSessionType({
  code = 'REHEARSAL',
  name = 'Rehearsal',
  description = 'Latihan band dengan reservasi studio.',
  displayOrder = 1,
  requiresStudioReservation = true,
  defaultDurationMinutes = 120,
  minimumDurationMinutes = 60,
  status = 'active',
  createdAt = FIXTURE_TIMESTAMP,
  createdByUid = OWNER_UID,
  updatedAt = createdAt,
  updatedByUid = createdByUid,
  ...overrides
} = {}) {
  return {
    code,
    name,
    description,
    displayOrder,
    requiresStudioReservation,
    defaultDurationMinutes,
    minimumDurationMinutes,
    status,
    createdAt,
    createdByUid,
    updatedAt,
    updatedByUid,
    ...overrides,
  };
}

function createPricingRule({
  name = 'Rehearsal hourly — general',
  sessionTypeId = 'rehearsal',
  studioId = null,
  pricingModel = 'hourly',
  configuration = {
    amountPerIncrementIdr: 120_000,
    incrementMinutes: 60,
    minimumDurationMinutes: 120,
    roundingMode: 'round_up',
  },
  priority = 100,
  effectiveFrom = null,
  effectiveUntil = null,
  status = 'active',
  createdAt = FIXTURE_TIMESTAMP,
  createdByUid = OWNER_UID,
  updatedAt = createdAt,
  updatedByUid = createdByUid,
  ...overrides
} = {}) {
  return {
    name,
    sessionTypeId,
    studioId,
    pricingModel,
    configuration,
    priority,
    effectiveFrom,
    effectiveUntil,
    status,
    createdAt,
    createdByUid,
    updatedAt,
    updatedByUid,
    ...overrides,
  };
}

function createOperator({
  displayName = 'Budi Engineer',
  email = 'budi@studio37.id',
  phone = '+6281234567890',
  operatorTypes = ['recording_engineer'],
  linkedUserUid = null,
  status = 'active',
  createdAt = FIXTURE_TIMESTAMP,
  createdByUid = OWNER_UID,
  updatedAt = createdAt,
  updatedByUid = createdByUid,
  ...overrides
} = {}) {
  return {
    displayName,
    email,
    phone,
    operatorTypes,
    linkedUserUid,
    status,
    createdAt,
    createdByUid,
    updatedAt,
    updatedByUid,
    ...overrides,
  };
}

function createAccountInvitation({
  operatorId = INVITED_OPERATOR_ID,
  displayName = 'Invited Operator',
  email = INVITED_EMAIL,
  phone = '+6281234567890',
  status = 'pending',
  expiresAt = Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000),
  createdAt = recentTimestamp(),
  createdByUid = OWNER_UID,
  updatedAt = createdAt,
  updatedByUid = createdByUid,
  acceptedAt = null,
  acceptedByUid = null,
  ...overrides
} = {}) {
  return {
    operatorId,
    displayName,
    email,
    phone,
    status,
    expiresAt,
    createdAt,
    createdByUid,
    updatedAt,
    updatedByUid,
    acceptedAt,
    acceptedByUid,
    ...overrides,
  };
}

function authenticatedDb(uid, { email = `${uid}@studio37.test`, emailVerified = false } = {}) {
  return testEnvironment
    .authenticatedContext(uid, {
      email,
      email_verified: emailVerified,
    })
    .firestore();
}

function newUserInvitationRedemptionBatch(
  firestore,
  {
    userUid = INVITED_UID,
    operatorId = INVITED_OPERATOR_ID,
    invitationId = INVITATION_ID,
    profileOverrides = {},
  } = {},
) {
  const batch = writeBatch(firestore);

  batch.set(doc(firestore, `users/${userUid}`), {
    activationInviteId: invitationId,
    createdAt: serverTimestamp(),
    displayName: 'Invited Operator',
    email: INVITED_EMAIL,
    operatorId,
    permissionSetId: null,
    phone: '+6281234567890',
    role: 'studio_operator',
    status: 'active',
    uid: userUid,
    updatedAt: serverTimestamp(),
    ...profileOverrides,
  });
  batch.update(doc(firestore, `operators/${operatorId}`), {
    linkedUserUid: userUid,
    updatedAt: serverTimestamp(),
    updatedByUid: userUid,
  });
  batch.update(doc(firestore, `operators/${operatorId}/accountInvites/${invitationId}`), {
    acceptedAt: serverTimestamp(),
    acceptedByUid: userUid,
    status: 'accepted',
    updatedAt: serverTimestamp(),
    updatedByUid: userUid,
  });

  return batch;
}

function existingUserInvitationRedemptionBatch(
  firestore,
  {
    userUid = EXISTING_INVITED_UID,
    operatorId = INVITED_OPERATOR_ID,
    invitationId = INVITATION_ID,
  } = {},
) {
  const batch = writeBatch(firestore);

  batch.update(doc(firestore, `users/${userUid}`), {
    activationInviteId: invitationId,
    operatorId,
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(firestore, `operators/${operatorId}`), {
    linkedUserUid: userUid,
    updatedAt: serverTimestamp(),
    updatedByUid: userUid,
  });
  batch.update(doc(firestore, `operators/${operatorId}/accountInvites/${invitationId}`), {
    acceptedAt: serverTimestamp(),
    acceptedByUid: userUid,
    status: 'accepted',
    updatedAt: serverTimestamp(),
    updatedByUid: userUid,
  });

  return batch;
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
    [
      `users/${OPERATOR_MANAGER_UID}`,
      createUserProfile({
        uid: OPERATOR_MANAGER_UID,
        permissionSetId: OPERATOR_MANAGER_SET_ID,
      }),
    ],
    [
      `users/${PRICING_VIEWER_UID}`,
      createUserProfile({ uid: PRICING_VIEWER_UID, permissionSetId: PRICING_VIEWER_SET_ID }),
    ],
    [
      `users/${PRICING_EDITOR_UID}`,
      createUserProfile({ uid: PRICING_EDITOR_UID, permissionSetId: PRICING_EDITOR_SET_ID }),
    ],
    [
      `users/${ASSIGNABLE_UID}`,
      createUserProfile({ uid: ASSIGNABLE_UID, operatorId: ASSIGNABLE_OPERATOR_ID }),
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
    [
      `permissionSets/${OPERATOR_MANAGER_SET_ID}`,
      createPermissionSet({
        name: 'Operator manager',
        capabilities: ['settings.operators.manage', 'settings.operators.view'],
      }),
    ],
    [
      `permissionSets/${PRICING_VIEWER_SET_ID}`,
      createPermissionSet({
        name: 'Pricing viewer',
        capabilities: ['settings.pricing.view'],
      }),
    ],
    [
      `permissionSets/${PRICING_EDITOR_SET_ID}`,
      createPermissionSet({
        name: 'Pricing editor',
        capabilities: ['settings.pricing.edit', 'settings.pricing.view'],
      }),
    ],
    [
      `operators/${ASSIGNABLE_OPERATOR_ID}`,
      createOperator({
        displayName: 'Assignable Operator',
        linkedUserUid: ASSIGNABLE_UID,
        operatorTypes: ['studio_operator'],
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

  test('keeps user scans denied and permission-set administration bounded to Owner', async () => {
    const ownerDb = authenticatedDb(OWNER_UID);
    const operatorDb = authenticatedDb(OPERATOR_UID);

    await assertFails(getDocs(collection(ownerDb, 'users')));
    await assertFails(getDocs(collection(operatorDb, 'users')));
    await assertFails(getDocs(collection(ownerDb, 'permissionSets')));
    await assertFails(getDocs(collection(operatorDb, 'permissionSets')));
    await assertSucceeds(
      getDocs(query(collection(ownerDb, 'permissionSets'), orderBy('name', 'asc'), limit(50))),
    );
    await assertFails(
      getDocs(query(collection(ownerDb, 'permissionSets'), orderBy('name', 'asc'), limit(51))),
    );
    await assertFails(
      getDocs(query(collection(operatorDb, 'permissionSets'), orderBy('name', 'asc'), limit(50))),
    );
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
    await assertFails(
      setDoc(
        doc(ownerDb, 'users/prelinked-user'),
        createUserProfile({
          uid: 'prelinked-user',
          operatorId: 'operator-budi',
          createdAt,
          updatedAt: createdAt,
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

  test('lets only an active Owner assign and clear an active permission set on a linked user', async () => {
    const ownerDb = authenticatedDb(OWNER_UID);
    const operatorDb = authenticatedDb(OPERATOR_UID);
    const reference = doc(ownerDb, `users/${ASSIGNABLE_UID}`);

    await assertSucceeds(
      updateDoc(reference, {
        permissionSetId: DELEGATED_SET_ID,
        updatedAt: serverTimestamp(),
      }),
    );
    assert.equal((await getDoc(reference)).data().permissionSetId, DELEGATED_SET_ID);

    await assertFails(
      updateDoc(doc(operatorDb, `users/${ASSIGNABLE_UID}`), {
        permissionSetId: null,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      updateDoc(reference, {
        permissionSetId: null,
        updatedAt: serverTimestamp(),
      }),
    );
    assert.equal((await getDoc(reference)).data().permissionSetId, null);
  });

  test('rejects disabled, missing, unlinked, or mixed-field permission assignments', async () => {
    const ownerDb = authenticatedDb(OWNER_UID);
    const assignableReference = doc(ownerDb, `users/${ASSIGNABLE_UID}`);

    await assertFails(
      updateDoc(assignableReference, {
        permissionSetId: DISABLED_SET_ID,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(assignableReference, {
        permissionSetId: 'missing-permission-set',
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(ownerDb, `users/${UNASSIGNED_UID}`), {
        permissionSetId: DELEGATED_SET_ID,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(assignableReference, {
        permissionSetId: DELEGATED_SET_ID,
        status: 'disabled',
        updatedAt: serverTimestamp(),
      }),
    );
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

  test('allows only bounded room lists to users with studio-settings view access', async () => {
    await seedDocuments([
      ['studios/room-a', createStudioRoom()],
      ['studios/room-b', createStudioRoom({ code: 'ST-B', name: 'Studio B', displayOrder: 2 })],
    ]);

    const ownerDb = authenticatedDb(OWNER_UID);
    const operatorDb = authenticatedDb(OPERATOR_UID);
    const editorDb = authenticatedDb(STUDIO_EDITOR_UID);
    const disabledDb = authenticatedDb(DISABLED_UID);
    const ownerQuery = query(
      collection(ownerDb, 'studios'),
      orderBy('displayOrder', 'asc'),
      limit(50),
    );
    const editorQuery = query(
      collection(editorDb, 'studios'),
      orderBy('displayOrder', 'asc'),
      limit(50),
    );

    await assertSucceeds(getDocs(ownerQuery));
    await assertSucceeds(getDocs(editorQuery));
    await assertSucceeds(getDoc(doc(editorDb, 'studios/room-a')));
    await assertFails(getDocs(collection(ownerDb, 'studios')));
    await assertFails(
      getDocs(query(collection(ownerDb, 'studios'), orderBy('displayOrder', 'asc'), limit(51))),
    );
    await assertFails(
      getDocs(query(collection(operatorDb, 'studios'), orderBy('displayOrder', 'asc'), limit(50))),
    );
    await assertFails(getDoc(doc(operatorDb, 'studios/room-a')));
    await assertFails(
      getDocs(query(collection(disabledDb, 'studios'), orderBy('displayOrder', 'asc'), limit(50))),
    );
  });

  test('allows validated room create, edit, and soft-disable only to delegated editors', async () => {
    const ownerDb = authenticatedDb(OWNER_UID);
    const operatorDb = authenticatedDb(OPERATOR_UID);
    const editorDb = authenticatedDb(STUDIO_EDITOR_UID);
    const ownerReference = doc(ownerDb, 'studios/room-a');

    await assertSucceeds(
      setDoc(
        ownerReference,
        createStudioRoom({ createdAt: serverTimestamp(), updatedAt: serverTimestamp() }),
      ),
    );
    await assertSucceeds(
      updateDoc(doc(editorDb, 'studios/room-a'), {
        name: 'Studio Utama',
        displayOrder: 2,
        updatedAt: serverTimestamp(),
        updatedByUid: STUDIO_EDITOR_UID,
      }),
    );
    await assertSucceeds(
      updateDoc(doc(editorDb, 'studios/room-a'), {
        status: 'disabled',
        updatedAt: serverTimestamp(),
        updatedByUid: STUDIO_EDITOR_UID,
      }),
    );
    await assertFails(
      updateDoc(doc(operatorDb, 'studios/room-a'), {
        name: 'Unauthorized edit',
        updatedAt: serverTimestamp(),
        updatedByUid: OPERATOR_UID,
      }),
    );
    await assertFails(deleteDoc(ownerReference));
  });

  test('rejects malformed rooms and spoofed creation metadata', async () => {
    const ownerDb = authenticatedDb(OWNER_UID);

    for (const [roomId, invalidRoom] of [
      ['lowercase-code', { code: 'studio-a' }],
      ['invalid-order', { displayOrder: 0 }],
      ['invalid-status', { status: 'archived' }],
      ['long-description', { description: 'x'.repeat(241) }],
      ['spoofed-creator', { createdByUid: OPERATOR_UID }],
      ['spoofed-updater', { updatedByUid: OPERATOR_UID }],
      ['unknown-field', { capacity: 10 }],
    ]) {
      await assertFails(
        setDoc(
          doc(ownerDb, `studios/${roomId}`),
          createStudioRoom({
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            ...invalidRoom,
          }),
        ),
      );
    }
  });

  test('preserves room creation history and requires server update metadata', async () => {
    await seedDocuments([['studios/room-a', createStudioRoom()]]);
    const ownerDb = authenticatedDb(OWNER_UID);
    const reference = doc(ownerDb, 'studios/room-a');

    await assertFails(
      updateDoc(reference, {
        createdAt: recentTimestamp(),
        updatedAt: serverTimestamp(),
        updatedByUid: OWNER_UID,
      }),
    );
    await assertFails(
      updateDoc(reference, {
        name: 'Client-clock update',
        updatedAt: recentTimestamp(),
        updatedByUid: OWNER_UID,
      }),
    );
    await assertFails(
      updateDoc(reference, {
        name: 'Spoofed actor',
        updatedAt: serverTimestamp(),
        updatedByUid: OPERATOR_UID,
      }),
    );
  });

  test('allows only bounded session-type lists to users with pricing-settings view access', async () => {
    await seedDocuments([
      ['sessionTypes/rehearsal', createSessionType()],
      [
        'sessionTypes/recording',
        createSessionType({ code: 'RECORDING', name: 'Recording', displayOrder: 2 }),
      ],
    ]);

    const ownerDb = authenticatedDb(OWNER_UID);
    const viewerDb = authenticatedDb(PRICING_VIEWER_UID);
    const operatorDb = authenticatedDb(OPERATOR_UID);
    const disabledDb = authenticatedDb(DISABLED_UID);
    const ownerQuery = query(
      collection(ownerDb, 'sessionTypes'),
      orderBy('displayOrder', 'asc'),
      limit(100),
    );
    const viewerQuery = query(
      collection(viewerDb, 'sessionTypes'),
      orderBy('displayOrder', 'asc'),
      limit(100),
    );

    await assertSucceeds(getDocs(ownerQuery));
    await assertSucceeds(getDocs(viewerQuery));
    await assertSucceeds(getDoc(doc(viewerDb, 'sessionTypes/rehearsal')));
    await assertFails(getDocs(collection(ownerDb, 'sessionTypes')));
    await assertFails(
      getDocs(
        query(collection(ownerDb, 'sessionTypes'), orderBy('displayOrder', 'asc'), limit(101)),
      ),
    );
    await assertFails(
      getDocs(
        query(collection(operatorDb, 'sessionTypes'), orderBy('displayOrder', 'asc'), limit(100)),
      ),
    );
    await assertFails(getDoc(doc(operatorDb, 'sessionTypes/rehearsal')));
    await assertFails(
      getDocs(
        query(collection(disabledDb, 'sessionTypes'), orderBy('displayOrder', 'asc'), limit(100)),
      ),
    );
  });

  test('allows validated session-type create, edit, and soft-disable only to pricing editors', async () => {
    const ownerDb = authenticatedDb(OWNER_UID);
    const viewerDb = authenticatedDb(PRICING_VIEWER_UID);
    const editorDb = authenticatedDb(PRICING_EDITOR_UID);
    const ownerReference = doc(ownerDb, 'sessionTypes/rehearsal');

    await assertSucceeds(
      setDoc(
        ownerReference,
        createSessionType({ createdAt: serverTimestamp(), updatedAt: serverTimestamp() }),
      ),
    );
    await assertSucceeds(
      updateDoc(doc(editorDb, 'sessionTypes/rehearsal'), {
        defaultDurationMinutes: 180,
        minimumDurationMinutes: 90,
        updatedAt: serverTimestamp(),
        updatedByUid: PRICING_EDITOR_UID,
      }),
    );
    await assertSucceeds(
      updateDoc(doc(editorDb, 'sessionTypes/rehearsal'), {
        status: 'disabled',
        updatedAt: serverTimestamp(),
        updatedByUid: PRICING_EDITOR_UID,
      }),
    );
    await assertFails(
      updateDoc(doc(viewerDb, 'sessionTypes/rehearsal'), {
        name: 'Unauthorized edit',
        updatedAt: serverTimestamp(),
        updatedByUid: PRICING_VIEWER_UID,
      }),
    );
    await assertFails(deleteDoc(ownerReference));
  });

  test('rejects malformed session types and spoofed creation metadata', async () => {
    const ownerDb = authenticatedDb(OWNER_UID);

    for (const [sessionTypeId, invalidSessionType] of [
      ['lowercase-code', { code: 'rehearsal' }],
      ['invalid-order', { displayOrder: 0 }],
      ['invalid-status', { status: 'archived' }],
      ['invalid-duration-step', { defaultDurationMinutes: 125 }],
      ['invalid-duration-order', { minimumDurationMinutes: 180 }],
      [
        'missing-reservation-duration',
        { defaultDurationMinutes: null, minimumDurationMinutes: null },
      ],
      ['spoofed-creator', { createdByUid: OPERATOR_UID }],
      ['spoofed-updater', { updatedByUid: OPERATOR_UID }],
      ['unknown-field', { pricingModel: 'hourly' }],
    ]) {
      await assertFails(
        setDoc(
          doc(ownerDb, `sessionTypes/${sessionTypeId}`),
          createSessionType({
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            ...invalidSessionType,
          }),
        ),
      );
    }

    await assertSucceeds(
      setDoc(
        doc(ownerDb, 'sessionTypes/mixing'),
        createSessionType({
          code: 'MIXING',
          name: 'Mixing',
          requiresStudioReservation: false,
          defaultDurationMinutes: null,
          minimumDurationMinutes: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      ),
    );
  });

  test('preserves session-type creation history and requires server update metadata', async () => {
    await seedDocuments([['sessionTypes/rehearsal', createSessionType()]]);
    const ownerDb = authenticatedDb(OWNER_UID);
    const reference = doc(ownerDb, 'sessionTypes/rehearsal');

    await assertFails(
      updateDoc(reference, {
        createdAt: recentTimestamp(),
        updatedAt: serverTimestamp(),
        updatedByUid: OWNER_UID,
      }),
    );
    await assertFails(
      updateDoc(reference, {
        name: 'Client-clock update',
        updatedAt: recentTimestamp(),
        updatedByUid: OWNER_UID,
      }),
    );
    await assertFails(
      updateDoc(reference, {
        name: 'Spoofed actor',
        updatedAt: serverTimestamp(),
        updatedByUid: OPERATOR_UID,
      }),
    );
  });

  test('allows only bounded pricing-rule lists to users with pricing-settings view access', async () => {
    await seedDocuments([
      ['sessionTypes/rehearsal', createSessionType()],
      ['pricingRules/rehearsal-general', createPricingRule()],
      [
        'pricingRules/rehearsal-priority',
        createPricingRule({ name: 'Priority rule', priority: 200 }),
      ],
    ]);

    const ownerDb = authenticatedDb(OWNER_UID);
    const viewerDb = authenticatedDb(PRICING_VIEWER_UID);
    const operatorDb = authenticatedDb(OPERATOR_UID);
    const disabledDb = authenticatedDb(DISABLED_UID);
    const ownerQuery = query(
      collection(ownerDb, 'pricingRules'),
      orderBy('priority', 'desc'),
      limit(200),
    );
    const viewerQuery = query(
      collection(viewerDb, 'pricingRules'),
      orderBy('priority', 'desc'),
      limit(200),
    );

    await assertSucceeds(getDocs(ownerQuery));
    await assertSucceeds(getDocs(viewerQuery));
    await assertSucceeds(getDoc(doc(viewerDb, 'pricingRules/rehearsal-general')));
    await assertFails(getDocs(collection(ownerDb, 'pricingRules')));
    await assertFails(
      getDocs(query(collection(ownerDb, 'pricingRules'), orderBy('priority', 'desc'), limit(201))),
    );
    await assertFails(
      getDocs(
        query(collection(operatorDb, 'pricingRules'), orderBy('priority', 'desc'), limit(200)),
      ),
    );
    await assertFails(getDoc(doc(operatorDb, 'pricingRules/rehearsal-general')));
    await assertFails(
      getDocs(
        query(collection(disabledDb, 'pricingRules'), orderBy('priority', 'desc'), limit(200)),
      ),
    );
  });

  test('allows validated pricing-rule create, edit, and soft-disable only to pricing editors', async () => {
    await seedDocuments([
      ['sessionTypes/rehearsal', createSessionType()],
      ['studios/room-a', createStudioRoom()],
    ]);
    const ownerDb = authenticatedDb(OWNER_UID);
    const viewerDb = authenticatedDb(PRICING_VIEWER_UID);
    const editorDb = authenticatedDb(PRICING_EDITOR_UID);
    const ownerReference = doc(ownerDb, 'pricingRules/rehearsal-room-a');

    await assertSucceeds(
      setDoc(
        ownerReference,
        createPricingRule({
          studioId: 'room-a',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      ),
    );
    await assertSucceeds(
      updateDoc(doc(editorDb, 'pricingRules/rehearsal-room-a'), {
        priority: 150,
        updatedAt: serverTimestamp(),
        updatedByUid: PRICING_EDITOR_UID,
      }),
    );
    await assertSucceeds(
      updateDoc(doc(editorDb, 'pricingRules/rehearsal-room-a'), {
        status: 'disabled',
        updatedAt: serverTimestamp(),
        updatedByUid: PRICING_EDITOR_UID,
      }),
    );
    await assertFails(
      updateDoc(doc(viewerDb, 'pricingRules/rehearsal-room-a'), {
        name: 'Unauthorized edit',
        updatedAt: serverTimestamp(),
        updatedByUid: PRICING_VIEWER_UID,
      }),
    );
    await assertFails(deleteDoc(ownerReference));
  });

  test('rejects malformed pricing configurations, invalid windows, and missing references', async () => {
    await seedDocuments([
      ['sessionTypes/rehearsal', createSessionType()],
      ['studios/room-a', createStudioRoom()],
    ]);
    const ownerDb = authenticatedDb(OWNER_UID);

    for (const [pricingRuleId, invalidPricingRule] of [
      ['invalid-priority', { priority: 0 }],
      ['missing-session', { sessionTypeId: 'missing-session' }],
      ['missing-studio', { studioId: 'missing-studio' }],
      [
        'fractional-money',
        {
          configuration: {
            amountPerIncrementIdr: 1.5,
            incrementMinutes: 60,
            minimumDurationMinutes: 120,
            roundingMode: 'round_up',
          },
        },
      ],
      [
        'invalid-duration',
        {
          configuration: {
            amountPerIncrementIdr: 120_000,
            incrementMinutes: 20,
            minimumDurationMinutes: 120,
            roundingMode: 'round_up',
          },
        },
      ],
      ['mismatched-model', { pricingModel: 'fixed_session', configuration: { amountIdr: -1 } }],
      [
        'partial-package-extra-time',
        {
          pricingModel: 'duration_package',
          configuration: {
            additionalAmountPerIncrementIdr: 100_000,
            additionalIncrementMinutes: null,
            amountIdr: 450_000,
            durationMinutes: 180,
            extraTimePolicy: 'blocked',
            roundingMode: null,
          },
        },
      ],
      [
        'invalid-effective-window',
        {
          effectiveFrom: recentTimestamp(),
          effectiveUntil: recentTimestamp(-1_000),
        },
      ],
      ['spoofed-creator', { createdByUid: OPERATOR_UID }],
      ['spoofed-updater', { updatedByUid: OPERATOR_UID }],
      ['unknown-field', { discountId: null }],
    ]) {
      await assertFails(
        setDoc(
          doc(ownerDb, `pricingRules/${pricingRuleId}`),
          createPricingRule({
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            ...invalidPricingRule,
          }),
        ),
      );
    }

    await assertSucceeds(
      setDoc(
        doc(ownerDb, 'pricingRules/fixed-mixing'),
        createPricingRule({
          configuration: { amountIdr: 500_000 },
          pricingModel: 'fixed_session',
          studioId: 'room-a',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      ),
    );
  });

  test('preserves pricing-rule creation history and requires server update metadata', async () => {
    await seedDocuments([
      ['sessionTypes/rehearsal', createSessionType()],
      ['pricingRules/rehearsal-general', createPricingRule()],
    ]);
    const ownerDb = authenticatedDb(OWNER_UID);
    const reference = doc(ownerDb, 'pricingRules/rehearsal-general');

    await assertFails(
      updateDoc(reference, {
        createdAt: recentTimestamp(),
        updatedAt: serverTimestamp(),
        updatedByUid: OWNER_UID,
      }),
    );
    await assertFails(
      updateDoc(reference, {
        priority: 200,
        updatedAt: recentTimestamp(),
        updatedByUid: OWNER_UID,
      }),
    );
    await assertFails(
      updateDoc(reference, {
        name: 'Spoofed actor',
        updatedAt: serverTimestamp(),
        updatedByUid: OPERATOR_UID,
      }),
    );
  });

  test('allows only bounded operator lists to users with operator-settings view access', async () => {
    await seedDocuments([
      ['operators/operator-budi', createOperator()],
      [
        'operators/operator-citra',
        createOperator({ displayName: 'Citra Operator', operatorTypes: ['studio_operator'] }),
      ],
    ]);

    const ownerDb = authenticatedDb(OWNER_UID);
    const operatorDb = authenticatedDb(OPERATOR_UID);
    const managerDb = authenticatedDb(OPERATOR_MANAGER_UID);
    const disabledDb = authenticatedDb(DISABLED_UID);
    const ownerQuery = query(
      collection(ownerDb, 'operators'),
      orderBy('displayName', 'asc'),
      limit(100),
    );
    const managerQuery = query(
      collection(managerDb, 'operators'),
      orderBy('displayName', 'asc'),
      limit(100),
    );

    await assertSucceeds(getDocs(ownerQuery));
    await assertSucceeds(getDocs(managerQuery));
    await assertSucceeds(getDoc(doc(managerDb, 'operators/operator-budi')));
    await assertFails(getDocs(collection(ownerDb, 'operators')));
    await assertFails(
      getDocs(query(collection(ownerDb, 'operators'), orderBy('displayName', 'asc'), limit(101))),
    );
    await assertFails(
      getDocs(
        query(collection(operatorDb, 'operators'), orderBy('displayName', 'asc'), limit(100)),
      ),
    );
    await assertFails(getDoc(doc(operatorDb, 'operators/operator-budi')));
    await assertFails(
      getDocs(
        query(collection(disabledDb, 'operators'), orderBy('displayName', 'asc'), limit(100)),
      ),
    );
  });

  test('allows validated unlinked operator create, edit, and soft-disable to delegated managers', async () => {
    const managerDb = authenticatedDb(OPERATOR_MANAGER_UID);
    const operatorDb = authenticatedDb(OPERATOR_UID);
    const reference = doc(managerDb, 'operators/operator-budi');

    await assertSucceeds(
      setDoc(
        reference,
        createOperator({
          createdAt: serverTimestamp(),
          createdByUid: OPERATOR_MANAGER_UID,
          updatedAt: serverTimestamp(),
          updatedByUid: OPERATOR_MANAGER_UID,
        }),
      ),
    );
    await assertSucceeds(
      updateDoc(reference, {
        displayName: 'Budi Recording Engineer',
        operatorTypes: ['studio_operator', 'recording_engineer'],
        updatedAt: serverTimestamp(),
        updatedByUid: OPERATOR_MANAGER_UID,
      }),
    );
    await assertSucceeds(
      updateDoc(reference, {
        status: 'disabled',
        updatedAt: serverTimestamp(),
        updatedByUid: OPERATOR_MANAGER_UID,
      }),
    );
    await assertFails(
      updateDoc(doc(operatorDb, 'operators/operator-budi'), {
        displayName: 'Unauthorized edit',
        updatedAt: serverTimestamp(),
        updatedByUid: OPERATOR_UID,
      }),
    );
    await assertFails(deleteDoc(reference));
  });

  test('allows an active Owner to atomically link and unlink reciprocal operator/user records', async () => {
    await seedDocuments([['operators/operator-budi', createOperator()]]);
    const ownerDb = authenticatedDb(OWNER_UID);
    const operatorReference = doc(ownerDb, 'operators/operator-budi');
    const userReference = doc(ownerDb, `users/${UNASSIGNED_UID}`);

    await assertSucceeds(
      runTransaction(ownerDb, async (transaction) => {
        await transaction.get(operatorReference);
        await transaction.get(userReference);
        transaction.update(operatorReference, {
          linkedUserUid: UNASSIGNED_UID,
          updatedAt: serverTimestamp(),
          updatedByUid: OWNER_UID,
        });
        transaction.update(userReference, {
          operatorId: 'operator-budi',
          updatedAt: serverTimestamp(),
        });
      }),
    );

    const linkedOperator = await getDoc(operatorReference);
    const linkedUser = await getDoc(userReference);
    assert.equal(linkedOperator.data().linkedUserUid, UNASSIGNED_UID);
    assert.equal(linkedUser.data().operatorId, 'operator-budi');

    await assertSucceeds(
      runTransaction(ownerDb, async (transaction) => {
        await transaction.get(operatorReference);
        await transaction.get(userReference);
        transaction.update(operatorReference, {
          linkedUserUid: null,
          updatedAt: serverTimestamp(),
          updatedByUid: OWNER_UID,
        });
        transaction.update(userReference, {
          operatorId: null,
          updatedAt: serverTimestamp(),
        });
      }),
    );
  });

  test('rejects one-sided links, direct reassignment, and delegated account linking', async () => {
    await seedDocuments([['operators/operator-budi', createOperator()]]);
    const ownerDb = authenticatedDb(OWNER_UID);
    const managerDb = authenticatedDb(OPERATOR_MANAGER_UID);

    await assertFails(
      updateDoc(doc(ownerDb, 'operators/operator-budi'), {
        linkedUserUid: UNASSIGNED_UID,
        updatedAt: serverTimestamp(),
        updatedByUid: OWNER_UID,
      }),
    );
    await assertFails(
      updateDoc(doc(ownerDb, `users/${UNASSIGNED_UID}`), {
        operatorId: 'operator-budi',
        updatedAt: serverTimestamp(),
      }),
    );

    const delegatedBatch = writeBatch(managerDb);
    delegatedBatch.update(doc(managerDb, 'operators/operator-budi'), {
      linkedUserUid: UNASSIGNED_UID,
      updatedAt: serverTimestamp(),
      updatedByUid: OPERATOR_MANAGER_UID,
    });
    delegatedBatch.update(doc(managerDb, `users/${UNASSIGNED_UID}`), {
      operatorId: 'operator-budi',
      updatedAt: serverTimestamp(),
    });
    await assertFails(delegatedBatch.commit());

    await seedDocuments([
      ['operators/operator-budi', createOperator({ linkedUserUid: OPERATOR_UID })],
      [
        `users/${OPERATOR_UID}`,
        createUserProfile({
          uid: OPERATOR_UID,
          permissionSetId: DELEGATED_SET_ID,
          operatorId: 'operator-budi',
        }),
      ],
    ]);
    const reassignmentBatch = writeBatch(ownerDb);
    reassignmentBatch.update(doc(ownerDb, 'operators/operator-budi'), {
      linkedUserUid: UNASSIGNED_UID,
      updatedAt: serverTimestamp(),
      updatedByUid: OWNER_UID,
    });
    reassignmentBatch.update(doc(ownerDb, `users/${UNASSIGNED_UID}`), {
      operatorId: 'operator-budi',
      updatedAt: serverTimestamp(),
    });
    await assertFails(reassignmentBatch.commit());
  });

  test('allows only an active Owner to create and revoke an exact-path account invitation', async () => {
    await seedDocuments([
      [
        `operators/${INVITED_OPERATOR_ID}`,
        createOperator({
          displayName: 'Invited Operator',
          email: INVITED_EMAIL,
          operatorTypes: ['studio_operator'],
        }),
      ],
    ]);
    const ownerDb = authenticatedDb(OWNER_UID);
    const managerDb = authenticatedDb(OPERATOR_MANAGER_UID);
    const invitationReference = doc(
      ownerDb,
      `operators/${INVITED_OPERATOR_ID}/accountInvites/${INVITATION_ID}`,
    );

    await assertSucceeds(
      setDoc(
        invitationReference,
        createAccountInvitation({
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      ),
    );
    await assertSucceeds(getDoc(invitationReference));
    await assertFails(
      getDocs(collection(ownerDb, `operators/${INVITED_OPERATOR_ID}/accountInvites`)),
    );
    await assertFails(
      setDoc(
        doc(
          managerDb,
          `operators/${INVITED_OPERATOR_ID}/accountInvites/invite-09876543210987654321`,
        ),
        createAccountInvitation({
          createdAt: serverTimestamp(),
          createdByUid: OPERATOR_MANAGER_UID,
          updatedAt: serverTimestamp(),
          updatedByUid: OPERATOR_MANAGER_UID,
        }),
      ),
    );
    await assertFails(
      updateDoc(
        doc(
          authenticatedDb(INVITED_UID, {
            email: INVITED_EMAIL,
            emailVerified: true,
          }),
          `operators/${INVITED_OPERATOR_ID}/accountInvites/${INVITATION_ID}`,
        ),
        {
          status: 'revoked',
          updatedAt: serverTimestamp(),
          updatedByUid: INVITED_UID,
        },
      ),
    );
    await assertSucceeds(
      updateDoc(invitationReference, {
        status: 'revoked',
        updatedAt: serverTimestamp(),
        updatedByUid: OWNER_UID,
      }),
    );
    await assertFails(deleteDoc(invitationReference));
  });

  test('allows invitation reads only to the Owner or a verified matching email', async () => {
    await seedDocuments([
      [
        `operators/${INVITED_OPERATOR_ID}/accountInvites/${INVITATION_ID}`,
        createAccountInvitation(),
      ],
    ]);
    const invitationPath = `operators/${INVITED_OPERATOR_ID}/accountInvites/${INVITATION_ID}`;

    await assertSucceeds(getDoc(doc(authenticatedDb(OWNER_UID), invitationPath)));
    await assertSucceeds(
      getDoc(
        doc(
          authenticatedDb(INVITED_UID, {
            email: INVITED_EMAIL.toUpperCase(),
            emailVerified: true,
          }),
          invitationPath,
        ),
      ),
    );
    await assertFails(
      getDoc(
        doc(
          authenticatedDb(INVITED_UID, {
            email: INVITED_EMAIL,
            emailVerified: false,
          }),
          invitationPath,
        ),
      ),
    );
    await assertFails(
      getDoc(
        doc(
          authenticatedDb('wrong-invitee', {
            email: 'wrong@studio37.id',
            emailVerified: true,
          }),
          invitationPath,
        ),
      ),
    );
  });

  test('atomically redeems an invitation into a zero-permission Studio Operator profile', async () => {
    await seedDocuments([
      [
        `operators/${INVITED_OPERATOR_ID}`,
        createOperator({
          displayName: 'Invited Operator',
          email: INVITED_EMAIL,
          operatorTypes: ['studio_operator'],
        }),
      ],
      [
        `operators/${INVITED_OPERATOR_ID}/accountInvites/${INVITATION_ID}`,
        createAccountInvitation(),
      ],
    ]);
    const inviteeDb = authenticatedDb(INVITED_UID, {
      email: INVITED_EMAIL,
      emailVerified: true,
    });

    await assertSucceeds(newUserInvitationRedemptionBatch(inviteeDb).commit());

    const userSnapshot = await getDoc(doc(inviteeDb, `users/${INVITED_UID}`));
    const ownerDb = authenticatedDb(OWNER_UID);
    const operatorSnapshot = await getDoc(doc(ownerDb, `operators/${INVITED_OPERATOR_ID}`));
    const invitationSnapshot = await getDoc(
      doc(ownerDb, `operators/${INVITED_OPERATOR_ID}/accountInvites/${INVITATION_ID}`),
    );

    assert.equal(userSnapshot.data().role, 'studio_operator');
    assert.equal(userSnapshot.data().permissionSetId, null);
    assert.equal(userSnapshot.data().operatorId, INVITED_OPERATOR_ID);
    assert.equal(userSnapshot.data().activationInviteId, INVITATION_ID);
    assert.equal(operatorSnapshot.data().linkedUserUid, INVITED_UID);
    assert.equal(invitationSnapshot.data().status, 'accepted');
    assert.equal(invitationSnapshot.data().acceptedByUid, INVITED_UID);
  });

  test('atomically links an eligible existing Studio Operator without changing permissions', async () => {
    await seedDocuments([
      [
        `users/${EXISTING_INVITED_UID}`,
        createUserProfile({
          uid: EXISTING_INVITED_UID,
          displayName: 'Existing Invitee',
          email: INVITED_EMAIL.toUpperCase(),
          permissionSetId: DELEGATED_SET_ID,
        }),
      ],
      [
        `operators/${INVITED_OPERATOR_ID}`,
        createOperator({
          displayName: 'Invited Operator',
          email: INVITED_EMAIL,
          operatorTypes: ['studio_operator'],
        }),
      ],
      [
        `operators/${INVITED_OPERATOR_ID}/accountInvites/${INVITATION_ID}`,
        createAccountInvitation(),
      ],
    ]);
    const inviteeDb = authenticatedDb(EXISTING_INVITED_UID, {
      email: INVITED_EMAIL,
      emailVerified: true,
    });

    await assertSucceeds(existingUserInvitationRedemptionBatch(inviteeDb).commit());

    const userSnapshot = await getDoc(doc(inviteeDb, `users/${EXISTING_INVITED_UID}`));
    assert.equal(userSnapshot.data().role, 'studio_operator');
    assert.equal(userSnapshot.data().permissionSetId, DELEGATED_SET_ID);
    assert.equal(userSnapshot.data().operatorId, INVITED_OPERATOR_ID);
    assert.equal(userSnapshot.data().activationInviteId, INVITATION_ID);
  });

  test('rejects unverified, mismatched, expired, one-sided, and privileged redemptions', async () => {
    await seedDocuments([
      [
        `operators/${INVITED_OPERATOR_ID}`,
        createOperator({
          displayName: 'Invited Operator',
          email: INVITED_EMAIL,
          operatorTypes: ['studio_operator'],
        }),
      ],
      [
        `operators/${INVITED_OPERATOR_ID}/accountInvites/${INVITATION_ID}`,
        createAccountInvitation(),
      ],
    ]);

    const unverifiedDb = authenticatedDb(INVITED_UID, {
      email: INVITED_EMAIL,
      emailVerified: false,
    });
    await assertFails(newUserInvitationRedemptionBatch(unverifiedDb).commit());

    const mismatchedDb = authenticatedDb(INVITED_UID, {
      email: 'wrong@studio37.id',
      emailVerified: true,
    });
    await assertFails(newUserInvitationRedemptionBatch(mismatchedDb).commit());

    const verifiedDb = authenticatedDb(INVITED_UID, {
      email: INVITED_EMAIL,
      emailVerified: true,
    });
    await assertFails(
      newUserInvitationRedemptionBatch(verifiedDb, {
        profileOverrides: { role: 'owner' },
      }).commit(),
    );
    await assertFails(
      newUserInvitationRedemptionBatch(verifiedDb, {
        profileOverrides: { permissionSetId: DELEGATED_SET_ID },
      }).commit(),
    );
    await assertFails(
      setDoc(doc(verifiedDb, `users/${INVITED_UID}`), {
        activationInviteId: INVITATION_ID,
        createdAt: serverTimestamp(),
        displayName: 'Invited Operator',
        email: INVITED_EMAIL,
        operatorId: INVITED_OPERATOR_ID,
        permissionSetId: null,
        phone: '+6281234567890',
        role: 'studio_operator',
        status: 'active',
        uid: INVITED_UID,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(verifiedDb, `operators/${INVITED_OPERATOR_ID}`), {
        linkedUserUid: INVITED_UID,
        updatedAt: serverTimestamp(),
        updatedByUid: INVITED_UID,
      }),
    );

    await seedDocuments([
      [
        `operators/${INVITED_OPERATOR_ID}/accountInvites/${INVITATION_ID}`,
        createAccountInvitation({
          createdAt: Timestamp.fromMillis(Date.now() - 60_000),
          expiresAt: Timestamp.fromMillis(Date.now() - 1_000),
          updatedAt: Timestamp.fromMillis(Date.now() - 60_000),
        }),
      ],
    ]);
    await assertFails(newUserInvitationRedemptionBatch(verifiedDb).commit());
  });

  test('prevents an Owner from creating or promoting another Owner through app rules', async () => {
    const ownerDb = authenticatedDb(OWNER_UID);
    const createdAt = recentTimestamp();

    await assertFails(
      setDoc(
        doc(ownerDb, 'users/second-owner'),
        createUserProfile({
          uid: 'second-owner',
          role: 'owner',
          createdAt,
          updatedAt: createdAt,
        }),
      ),
    );
    await assertFails(
      updateDoc(doc(ownerDb, `users/${UNASSIGNED_UID}`), {
        role: 'owner',
        updatedAt: serverTimestamp(),
      }),
    );
  });

  test('rejects malformed operators, duplicate types, account links, and spoofed metadata', async () => {
    const ownerDb = authenticatedDb(OWNER_UID);

    for (const [operatorId, invalidOperator] of [
      ['empty-name', { displayName: '' }],
      ['invalid-email', { email: 'not-email' }],
      ['invalid-phone', { phone: '081234567890' }],
      ['missing-type', { operatorTypes: [] }],
      ['duplicate-type', { operatorTypes: ['studio_operator', 'studio_operator'] }],
      ['invalid-type', { operatorTypes: ['owner'] }],
      ['linked-on-create', { linkedUserUid: 'firebase-user' }],
      ['invalid-status', { status: 'archived' }],
      ['spoofed-creator', { createdByUid: OPERATOR_UID }],
      ['spoofed-updater', { updatedByUid: OPERATOR_UID }],
      ['unknown-field', { permissionSetId: DELEGATED_SET_ID }],
    ]) {
      await assertFails(
        setDoc(
          doc(ownerDb, `operators/${operatorId}`),
          createOperator({
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            ...invalidOperator,
          }),
        ),
      );
    }
  });

  test('preserves operator creation history and rejects one-sided account unlinking', async () => {
    await seedDocuments([
      ['operators/operator-budi', createOperator({ linkedUserUid: 'firebase-user' })],
    ]);
    const ownerDb = authenticatedDb(OWNER_UID);
    const reference = doc(ownerDb, 'operators/operator-budi');

    await assertFails(
      updateDoc(reference, {
        linkedUserUid: null,
        updatedAt: serverTimestamp(),
        updatedByUid: OWNER_UID,
      }),
    );
    await assertFails(
      updateDoc(reference, {
        createdAt: recentTimestamp(),
        updatedAt: serverTimestamp(),
        updatedByUid: OWNER_UID,
      }),
    );
    await assertFails(
      updateDoc(reference, {
        displayName: 'Client-clock update',
        updatedAt: recentTimestamp(),
        updatedByUid: OWNER_UID,
      }),
    );
    await assertFails(
      updateDoc(reference, {
        displayName: 'Spoofed actor',
        updatedAt: serverTimestamp(),
        updatedByUid: OPERATOR_UID,
      }),
    );
  });

  test('keeps remaining not-yet-implemented domain collections default-deny', async () => {
    await seedDocuments([
      ['commissionEntries/paid-1', { amount: 50_000, status: 'paid' }],
      ['bookings/booking-1', { status: 'confirmed' }],
    ]);

    const ownerDb = authenticatedDb(OWNER_UID);
    const operatorDb = authenticatedDb(OPERATOR_UID);

    await assertFails(getDoc(doc(ownerDb, 'bookings/booking-1')));
    await assertFails(getDoc(doc(operatorDb, 'bookings/booking-1')));
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
