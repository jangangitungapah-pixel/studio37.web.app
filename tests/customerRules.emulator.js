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
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

const TEST_PROJECT_ID = 'studio37-customer-rules-test';
const OWNER_UID = 'owner-1';
const VIEWER_UID = 'customer-viewer';
const EDITOR_UID = 'customer-editor';
const OPERATOR_UID = 'operator-1';
const DISABLED_UID = 'disabled-viewer';
const VIEWER_SET_ID = 'customer-viewer-template';
const EDITOR_SET_ID = 'customer-editor-template';
const DISABLED_SET_ID = 'disabled-customer-template';
const CUSTOMER_ID = 'customer-existing';
const RULES_PATH = new URL('../firestore.rules', import.meta.url);
const FIXTURE_TIMESTAMP = Timestamp.fromMillis(Date.UTC(2026, 8, 1));

let testEnvironment;

function createUserProfile({
  uid,
  role = 'studio_operator',
  permissionSetId = null,
  status = 'active',
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
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
    ...overrides,
  };
}

function createPermissionSet(capabilities, overrides = {}) {
  return {
    name: 'Customer access',
    status: 'active',
    capabilities,
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
    ...overrides,
  };
}

function createCustomer(overrides = {}) {
  return {
    name: 'Raka Studio',
    normalizedPhone: '+6281234567890',
    displayPhone: '+6281234567890',
    email: 'client@example.com',
    notes: 'Repeat customer',
    createdAt: FIXTURE_TIMESTAMP,
    createdByUid: OWNER_UID,
    updatedAt: FIXTURE_TIMESTAMP,
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
    [
      `users/${DISABLED_UID}`,
      createUserProfile({ uid: DISABLED_UID, permissionSetId: DISABLED_SET_ID }),
    ],
    [`permissionSets/${VIEWER_SET_ID}`, createPermissionSet(['customer.view'])],
    [`permissionSets/${EDITOR_SET_ID}`, createPermissionSet(['customer.edit'])],
    [
      `permissionSets/${DISABLED_SET_ID}`,
      createPermissionSet(['customer.view'], { status: 'disabled' }),
    ],
    [`customers/${CUSTOMER_ID}`, createCustomer()],
  ]);
});

describe('customer Firestore authorization boundary', () => {
  test('allows only customer viewers to read exact or bounded customer queries', async () => {
    const ownerDb = authenticatedDb(OWNER_UID);
    const viewerDb = authenticatedDb(VIEWER_UID);
    const editorDb = authenticatedDb(EDITOR_UID);
    const operatorDb = authenticatedDb(OPERATOR_UID);
    const disabledDb = authenticatedDb(DISABLED_UID);
    const unauthenticatedDb = testEnvironment.unauthenticatedContext().firestore();

    await assertSucceeds(getDoc(doc(ownerDb, `customers/${CUSTOMER_ID}`)));
    await assertSucceeds(getDoc(doc(viewerDb, `customers/${CUSTOMER_ID}`)));
    await assertFails(getDoc(doc(editorDb, `customers/${CUSTOMER_ID}`)));
    await assertFails(getDoc(doc(operatorDb, `customers/${CUSTOMER_ID}`)));
    await assertFails(getDoc(doc(disabledDb, `customers/${CUSTOMER_ID}`)));
    await assertFails(getDoc(doc(unauthenticatedDb, `customers/${CUSTOMER_ID}`)));

    const phoneQuery = query(
      collection(viewerDb, 'customers'),
      where('normalizedPhone', '==', '+6281234567890'),
      limit(5),
    );
    const phoneMatches = await assertSucceeds(getDocs(phoneQuery));
    assert.equal(phoneMatches.size, 1);

    await assertFails(getDocs(collection(viewerDb, 'customers')));
    await assertFails(getDocs(query(collection(viewerDb, 'customers'), limit(51))));
  });

  test('allows customer editors and Owner to create canonical customer records', async () => {
    const ownerDb = authenticatedDb(OWNER_UID);
    const editorDb = authenticatedDb(EDITOR_UID);
    const viewerDb = authenticatedDb(VIEWER_UID);

    await assertSucceeds(
      setDoc(doc(editorDb, 'customers/customer-editor-created'), {
        ...createCustomer({
          createdAt: serverTimestamp(),
          createdByUid: EDITOR_UID,
          updatedAt: serverTimestamp(),
          updatedByUid: EDITOR_UID,
        }),
      }),
    );

    await assertSucceeds(
      setDoc(doc(ownerDb, 'customers/customer-owner-created'), {
        ...createCustomer({
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }),
      }),
    );

    await assertFails(
      setDoc(doc(viewerDb, 'customers/customer-viewer-created'), {
        ...createCustomer({
          createdAt: serverTimestamp(),
          createdByUid: VIEWER_UID,
          updatedAt: serverTimestamp(),
          updatedByUid: VIEWER_UID,
        }),
      }),
    );
  });

  test('allows focused customer edits while preserving creation history', async () => {
    const editorDb = authenticatedDb(EDITOR_UID);

    await assertSucceeds(
      updateDoc(doc(editorDb, `customers/${CUSTOMER_ID}`), {
        name: 'Raka Baru',
        normalizedPhone: '+6281300000000',
        displayPhone: '+6281300000000',
        email: null,
        notes: 'Updated notes',
        updatedAt: serverTimestamp(),
        updatedByUid: EDITOR_UID,
      }),
    );

    await assertFails(
      updateDoc(doc(editorDb, `customers/${CUSTOMER_ID}`), {
        createdByUid: EDITOR_UID,
        updatedAt: serverTimestamp(),
        updatedByUid: EDITOR_UID,
      }),
    );
  });

  test('rejects noncanonical phone evidence, malformed contact data, and forged metadata', async () => {
    const editorDb = authenticatedDb(EDITOR_UID);

    await assertFails(
      setDoc(
        doc(editorDb, 'customers/noncanonical-phone'),
        createCustomer({
          displayPhone: '0812-3456-7890',
          createdAt: serverTimestamp(),
          createdByUid: EDITOR_UID,
          updatedAt: serverTimestamp(),
          updatedByUid: EDITOR_UID,
        }),
      ),
    );

    await assertFails(
      setDoc(
        doc(editorDb, 'customers/mismatched-phone'),
        createCustomer({
          displayPhone: '+6281300000000',
          createdAt: serverTimestamp(),
          createdByUid: EDITOR_UID,
          updatedAt: serverTimestamp(),
          updatedByUid: EDITOR_UID,
        }),
      ),
    );

    await assertFails(
      setDoc(
        doc(editorDb, 'customers/invalid-email'),
        createCustomer({
          email: 'not-an-email',
          createdAt: serverTimestamp(),
          createdByUid: EDITOR_UID,
          updatedAt: serverTimestamp(),
          updatedByUid: EDITOR_UID,
        }),
      ),
    );

    await assertFails(
      setDoc(
        doc(editorDb, 'customers/forged-actor'),
        createCustomer({
          createdAt: serverTimestamp(),
          createdByUid: OWNER_UID,
          updatedAt: serverTimestamp(),
          updatedByUid: OWNER_UID,
        }),
      ),
    );

    await assertFails(
      setDoc(
        doc(editorDb, 'customers/extra-field'),
        createCustomer({
          bookingCount: 999,
          createdAt: serverTimestamp(),
          createdByUid: EDITOR_UID,
          updatedAt: serverTimestamp(),
          updatedByUid: EDITOR_UID,
        }),
      ),
    );
  });

  test('never allows ordinary customer hard deletion', async () => {
    const ownerDb = authenticatedDb(OWNER_UID);
    const editorDb = authenticatedDb(EDITOR_UID);

    await assertFails(deleteDoc(doc(ownerDb, `customers/${CUSTOMER_ID}`)));
    await assertFails(deleteDoc(doc(editorDb, `customers/${CUSTOMER_ID}`)));
  });
});
