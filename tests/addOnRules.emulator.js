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
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

const TEST_PROJECT_ID = 'studio37-addon-rules-test';
const OWNER_UID = 'owner-1';
const VIEWER_UID = 'pricing-viewer';
const EDITOR_UID = 'pricing-editor';
const OPERATOR_UID = 'operator-1';
const VIEWER_SET_ID = 'pricing-viewer-template';
const EDITOR_SET_ID = 'pricing-editor-template';
const SESSION_TYPE_ID = 'recording';
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
    name: 'Pricing access',
    status: 'active',
    capabilities,
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
  };
}

function createSessionType(overrides = {}) {
  return {
    code: 'RECORDING',
    name: 'Recording',
    description: 'Recording session',
    displayOrder: 1,
    requiresStudioReservation: true,
    defaultDurationMinutes: 120,
    minimumDurationMinutes: 60,
    status: 'active',
    createdAt: FIXTURE_TIMESTAMP,
    createdByUid: OWNER_UID,
    updatedAt: FIXTURE_TIMESTAMP,
    updatedByUid: OWNER_UID,
    ...overrides,
  };
}

function createAddOn({
  configuration = { amountIdr: 50_000 },
  description = 'Extra microphone',
  displayOrder = 1,
  name = 'Extra microphone',
  pricingType = 'fixed',
  sessionTypeId = null,
  status = 'active',
  createdAt = FIXTURE_TIMESTAMP,
  createdByUid = OWNER_UID,
  updatedAt = createdAt,
  updatedByUid = createdByUid,
  ...overrides
} = {}) {
  return {
    configuration,
    description,
    displayOrder,
    name,
    pricingType,
    sessionTypeId,
    status,
    createdAt,
    createdByUid,
    updatedAt,
    updatedByUid,
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
    [`users/${VIEWER_UID}`, createUserProfile({ uid: VIEWER_UID, permissionSetId: VIEWER_SET_ID })],
    [`users/${EDITOR_UID}`, createUserProfile({ uid: EDITOR_UID, permissionSetId: EDITOR_SET_ID })],
    [`users/${OPERATOR_UID}`, createUserProfile({ uid: OPERATOR_UID })],
    [`permissionSets/${VIEWER_SET_ID}`, createPermissionSet(['settings.pricing.view'])],
    [
      `permissionSets/${EDITOR_SET_ID}`,
      createPermissionSet(['settings.pricing.edit', 'settings.pricing.view']),
    ],
    [`sessionTypes/${SESSION_TYPE_ID}`, createSessionType()],
    ['addOns/existing-addon', createAddOn()],
  ]);
});

describe('add-on Firestore authorization boundary', () => {
  test('allows only pricing viewers to read exact or bounded add-on lists', async () => {
    const ownerDb = authenticatedDb(OWNER_UID);
    const viewerDb = authenticatedDb(VIEWER_UID);
    const operatorDb = authenticatedDb(OPERATOR_UID);
    const unauthenticatedDb = testEnvironment.unauthenticatedContext().firestore();

    await assertSucceeds(getDoc(doc(ownerDb, 'addOns/existing-addon')));
    await assertSucceeds(getDoc(doc(viewerDb, 'addOns/existing-addon')));
    await assertFails(getDoc(doc(operatorDb, 'addOns/existing-addon')));
    await assertFails(getDoc(doc(unauthenticatedDb, 'addOns/existing-addon')));

    await assertSucceeds(
      getDocs(query(collection(viewerDb, 'addOns'), orderBy('displayOrder', 'asc'), limit(100))),
    );
    await assertFails(getDocs(collection(viewerDb, 'addOns')));
    await assertFails(
      getDocs(query(collection(viewerDb, 'addOns'), orderBy('displayOrder', 'asc'), limit(101))),
    );
  });

  test('allows validated fixed, quantity, and time add-on creation to pricing editors', async () => {
    const editorDb = authenticatedDb(EDITOR_UID);

    for (const [id, details] of [
      ['fixed-addon', {}],
      [
        'quantity-addon',
        {
          configuration: { amountPerUnitIdr: 25_000 },
          displayOrder: 2,
          name: 'Extra cable',
          pricingType: 'quantity',
          sessionTypeId: SESSION_TYPE_ID,
        },
      ],
      [
        'time-addon',
        {
          configuration: {
            amountPerIncrementIdr: 80_000,
            incrementMinutes: 30,
            roundingMode: 'round_up',
          },
          displayOrder: 3,
          name: 'Extra engineer time',
          pricingType: 'time',
        },
      ],
    ]) {
      await assertSucceeds(
        setDoc(
          doc(editorDb, `addOns/${id}`),
          createAddOn({
            createdAt: serverTimestamp(),
            createdByUid: EDITOR_UID,
            updatedAt: serverTimestamp(),
            updatedByUid: EDITOR_UID,
            ...details,
          }),
        ),
      );
    }
  });

  test('rejects malformed configuration, missing references, spoofed metadata, and hard delete', async () => {
    const editorDb = authenticatedDb(EDITOR_UID);

    await assertFails(
      setDoc(
        doc(editorDb, 'addOns/bad-time'),
        createAddOn({
          configuration: {
            amountPerIncrementIdr: 80_000,
            incrementMinutes: 10,
            roundingMode: 'round_up',
          },
          pricingType: 'time',
          createdAt: serverTimestamp(),
          createdByUid: EDITOR_UID,
          updatedAt: serverTimestamp(),
          updatedByUid: EDITOR_UID,
        }),
      ),
    );
    await assertFails(
      setDoc(
        doc(editorDb, 'addOns/missing-session'),
        createAddOn({
          sessionTypeId: 'missing-session',
          createdAt: serverTimestamp(),
          createdByUid: EDITOR_UID,
          updatedAt: serverTimestamp(),
          updatedByUid: EDITOR_UID,
        }),
      ),
    );
    await assertFails(
      setDoc(
        doc(editorDb, 'addOns/spoofed-actor'),
        createAddOn({
          createdAt: serverTimestamp(),
          createdByUid: OWNER_UID,
          updatedAt: serverTimestamp(),
          updatedByUid: OWNER_UID,
        }),
      ),
    );
    await assertFails(deleteDoc(doc(editorDb, 'addOns/existing-addon')));
  });

  test('preserves creation history while allowing focused edit and soft disable', async () => {
    const editorDb = authenticatedDb(EDITOR_UID);
    const reference = doc(editorDb, 'addOns/existing-addon');

    await assertSucceeds(
      updateDoc(reference, {
        name: 'Updated microphone',
        updatedAt: serverTimestamp(),
        updatedByUid: EDITOR_UID,
      }),
    );
    await assertSucceeds(
      updateDoc(reference, {
        status: 'disabled',
        updatedAt: serverTimestamp(),
        updatedByUid: EDITOR_UID,
      }),
    );
    assert.equal((await getDoc(reference)).data().status, 'disabled');

    await assertFails(
      updateDoc(reference, {
        createdByUid: EDITOR_UID,
        updatedAt: serverTimestamp(),
        updatedByUid: EDITOR_UID,
      }),
    );
    await assertFails(
      updateDoc(reference, {
        updatedAt: serverTimestamp(),
        updatedByUid: OWNER_UID,
      }),
    );
  });
});
