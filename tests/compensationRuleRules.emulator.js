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

const TEST_PROJECT_ID = 'studio37-compensation-rules-test';
const OWNER_UID = 'owner-1';
const INACTIVE_OWNER_UID = 'owner-inactive';
const OPERATOR_UID = 'operator-user';
const PERMISSION_SET_ID = 'commission-operator-template';
const SESSION_TYPE_ID = 'rehearsal';
const STUDIO_ID = 'studio-a';
const STUDIO_OPERATOR_ID = 'studio-operator-1';
const RECORDING_ENGINEER_ID = 'recording-engineer-1';
const RULES_PATH = new URL('../firestore.rules', import.meta.url);
const FIXTURE_TIMESTAMP = Timestamp.fromMillis(Date.UTC(2026, 0, 1));

let testEnvironment;

function createUserProfile({ uid, role = 'studio_operator', permissionSetId = null, ...overrides }) {
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

function createSessionType(overrides = {}) {
  return {
    code: 'REHEARSAL',
    name: 'Rehearsal',
    description: 'Studio rehearsal',
    displayOrder: 1,
    requiresStudioReservation: true,
    defaultDurationMinutes: 60,
    minimumDurationMinutes: 60,
    status: 'active',
    createdAt: FIXTURE_TIMESTAMP,
    createdByUid: OWNER_UID,
    updatedAt: FIXTURE_TIMESTAMP,
    updatedByUid: OWNER_UID,
    ...overrides,
  };
}

function createStudio(overrides = {}) {
  return {
    code: 'STUDIO-A',
    name: 'Studio A',
    description: 'Main room',
    displayOrder: 1,
    status: 'active',
    createdAt: FIXTURE_TIMESTAMP,
    createdByUid: OWNER_UID,
    updatedAt: FIXTURE_TIMESTAMP,
    updatedByUid: OWNER_UID,
    ...overrides,
  };
}

function createOperator({ operatorTypes = ['studio_operator'], ...overrides } = {}) {
  return {
    displayName: 'Operator Studio37',
    email: 'operator@studio37.test',
    phone: null,
    operatorTypes,
    linkedUserUid: null,
    status: 'active',
    createdAt: FIXTURE_TIMESTAMP,
    createdByUid: OWNER_UID,
    updatedAt: FIXTURE_TIMESTAMP,
    updatedByUid: OWNER_UID,
    ...overrides,
  };
}

function createCompensationRule({
  compensationModel = 'per_hour',
  configuration = { amountPerHourIdr: 10_000 },
  effectiveFrom = null,
  effectiveUntil = null,
  name = 'Rehearsal studio operator',
  operatorId = null,
  operatorType = 'studio_operator',
  priority = 100,
  sessionTypeId = SESSION_TYPE_ID,
  studioId = null,
  status = 'active',
  createdAt = FIXTURE_TIMESTAMP,
  createdByUid = OWNER_UID,
  updatedAt = createdAt,
  updatedByUid = createdByUid,
  ...overrides
} = {}) {
  return {
    compensationModel,
    configuration,
    effectiveFrom,
    effectiveUntil,
    name,
    operatorId,
    operatorType,
    priority,
    sessionTypeId,
    studioId,
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
        'commission.adjust',
        'commission.payout',
        'commission.view_all',
        'commission.view_own',
      ]),
    ],
    [`sessionTypes/${SESSION_TYPE_ID}`, createSessionType()],
    [`studios/${STUDIO_ID}`, createStudio()],
    [`operators/${STUDIO_OPERATOR_ID}`, createOperator()],
    [
      `operators/${RECORDING_ENGINEER_ID}`,
      createOperator({ operatorTypes: ['recording_engineer'] }),
    ],
    ['compensationRules/existing-rule', createCompensationRule()],
    [
      'compensationRules/disabled-rule',
      createCompensationRule({ name: 'Disabled rule', status: 'disabled' }),
    ],
  ]);
});

describe('compensation rule Firestore authorization boundary', () => {
  test('allows active Owner get/list with a bounded query and denies everyone else', async () => {
    const ownerDb = authenticatedDb(OWNER_UID);
    const inactiveOwnerDb = authenticatedDb(INACTIVE_OWNER_UID);
    const operatorDb = authenticatedDb(OPERATOR_UID);
    const unauthenticatedDb = testEnvironment.unauthenticatedContext().firestore();

    await assertSucceeds(getDoc(doc(ownerDb, 'compensationRules/existing-rule')));
    await assertFails(getDoc(doc(inactiveOwnerDb, 'compensationRules/existing-rule')));
    await assertFails(getDoc(doc(operatorDb, 'compensationRules/existing-rule')));
    await assertFails(getDoc(doc(unauthenticatedDb, 'compensationRules/existing-rule')));

    await assertSucceeds(
      getDocs(
        query(collection(ownerDb, 'compensationRules'), orderBy('priority', 'desc'), limit(200)),
      ),
    );
    await assertFails(getDocs(collection(ownerDb, 'compensationRules')));
    await assertFails(
      getDocs(
        query(collection(ownerDb, 'compensationRules'), orderBy('priority', 'desc'), limit(201)),
      ),
    );
    await assertFails(
      getDocs(
        query(collection(operatorDb, 'compensationRules'), orderBy('priority', 'desc'), limit(200)),
      ),
    );
  });

  test('accepts all five canonical compensation models for active Owner creates', async () => {
    const ownerDb = authenticatedDb(OWNER_UID);
    const cases = [
      ['per-hour', 'per_hour', { amountPerHourIdr: 10_000 }],
      ['per-session', 'per_session', { amountIdr: 50_000 }],
      ['fixed', 'fixed', { amountIdr: 40_000 }],
      ['package', 'package', { amountIdr: 450_000, durationMinutes: 360 }],
      [
        'percentage',
        'percentage',
        { base: 'booking_subtotal_before_discount', basisPoints: 1250 },
      ],
    ];

    for (const [id, compensationModel, configuration] of cases) {
      await assertSucceeds(
        setDoc(
          doc(ownerDb, `compensationRules/${id}`),
          createCompensationRule({
            compensationModel,
            configuration,
            createdAt: serverTimestamp(),
            createdByUid: OWNER_UID,
            updatedAt: serverTimestamp(),
            updatedByUid: OWNER_UID,
          }),
        ),
      );
    }
  });

  test('validates optional references and exact operator type compatibility', async () => {
    const ownerDb = authenticatedDb(OWNER_UID);

    await assertSucceeds(
      setDoc(
        doc(ownerDb, 'compensationRules/exact-studio-operator'),
        createCompensationRule({
          operatorId: STUDIO_OPERATOR_ID,
          studioId: STUDIO_ID,
          createdAt: serverTimestamp(),
          createdByUid: OWNER_UID,
          updatedAt: serverTimestamp(),
          updatedByUid: OWNER_UID,
        }),
      ),
    );
    await assertSucceeds(
      setDoc(
        doc(ownerDb, 'compensationRules/exact-recording-engineer'),
        createCompensationRule({
          compensationModel: 'package',
          configuration: { amountIdr: 450_000, durationMinutes: 360 },
          operatorId: RECORDING_ENGINEER_ID,
          operatorType: 'recording_engineer',
          createdAt: serverTimestamp(),
          createdByUid: OWNER_UID,
          updatedAt: serverTimestamp(),
          updatedByUid: OWNER_UID,
        }),
      ),
    );

    for (const [id, overrides] of [
      ['missing-session', { sessionTypeId: 'missing-session' }],
      ['missing-studio', { studioId: 'missing-studio' }],
      ['missing-operator', { operatorId: 'missing-operator' }],
      [
        'operator-type-mismatch',
        { operatorId: RECORDING_ENGINEER_ID, operatorType: 'studio_operator' },
      ],
    ]) {
      await assertFails(
        setDoc(
          doc(ownerDb, `compensationRules/${id}`),
          createCompensationRule({
            ...overrides,
            createdAt: serverTimestamp(),
            createdByUid: OWNER_UID,
            updatedAt: serverTimestamp(),
            updatedByUid: OWNER_UID,
          }),
        ),
      );
    }
  });

  test('fails closed for malformed schema, unsupported configuration, and forged metadata', async () => {
    const ownerDb = authenticatedDb(OWNER_UID);
    const operatorDb = authenticatedDb(OPERATOR_UID);

    await assertFails(
      setDoc(
        doc(ownerDb, 'compensationRules/unsupported-model'),
        createCompensationRule({
          compensationModel: 'per_shift',
          configuration: { amountIdr: 50_000 },
          createdAt: serverTimestamp(),
          createdByUid: OWNER_UID,
          updatedAt: serverTimestamp(),
          updatedByUid: OWNER_UID,
        }),
      ),
    );
    await assertFails(
      setDoc(
        doc(ownerDb, 'compensationRules/bad-package'),
        createCompensationRule({
          compensationModel: 'package',
          configuration: { amountIdr: 450_000, durationMinutes: 350 },
          createdAt: serverTimestamp(),
          createdByUid: OWNER_UID,
          updatedAt: serverTimestamp(),
          updatedByUid: OWNER_UID,
        }),
      ),
    );
    await assertFails(
      setDoc(
        doc(ownerDb, 'compensationRules/unknown-field'),
        createCompensationRule({
          unexpectedField: true,
          createdAt: serverTimestamp(),
          createdByUid: OWNER_UID,
          updatedAt: serverTimestamp(),
          updatedByUid: OWNER_UID,
        }),
      ),
    );
    await assertFails(
      setDoc(
        doc(ownerDb, 'compensationRules/unknown-config-field'),
        createCompensationRule({
          configuration: { amountPerHourIdr: 10_000, roundingMode: 'round_up' },
          createdAt: serverTimestamp(),
          createdByUid: OWNER_UID,
          updatedAt: serverTimestamp(),
          updatedByUid: OWNER_UID,
        }),
      ),
    );
    await assertFails(
      setDoc(
        doc(ownerDb, 'compensationRules/disabled-create'),
        createCompensationRule({
          status: 'disabled',
          createdAt: serverTimestamp(),
          createdByUid: OWNER_UID,
          updatedAt: serverTimestamp(),
          updatedByUid: OWNER_UID,
        }),
      ),
    );
    await assertFails(
      setDoc(
        doc(ownerDb, 'compensationRules/forged-actor'),
        createCompensationRule({
          createdAt: serverTimestamp(),
          createdByUid: OPERATOR_UID,
          updatedAt: serverTimestamp(),
          updatedByUid: OPERATOR_UID,
        }),
      ),
    );
    await assertFails(
      setDoc(
        doc(operatorDb, 'compensationRules/operator-write'),
        createCompensationRule({
          createdAt: serverTimestamp(),
          createdByUid: OPERATOR_UID,
          updatedAt: serverTimestamp(),
          updatedByUid: OPERATOR_UID,
        }),
      ),
    );
  });

  test('allows focused Owner update, preserves creation history, and always denies hard delete', async () => {
    const ownerDb = authenticatedDb(OWNER_UID);
    const operatorDb = authenticatedDb(OPERATOR_UID);
    const reference = doc(ownerDb, 'compensationRules/existing-rule');

    await assertSucceeds(
      updateDoc(reference, {
        name: 'Updated compensation rule',
        priority: 150,
        updatedAt: serverTimestamp(),
        updatedByUid: OWNER_UID,
      }),
    );
    await assertSucceeds(
      updateDoc(reference, {
        status: 'disabled',
        updatedAt: serverTimestamp(),
        updatedByUid: OWNER_UID,
      }),
    );

    await assertFails(
      updateDoc(reference, {
        createdByUid: OPERATOR_UID,
        updatedAt: serverTimestamp(),
        updatedByUid: OWNER_UID,
      }),
    );
    await assertFails(
      updateDoc(reference, {
        updatedAt: serverTimestamp(),
        updatedByUid: OPERATOR_UID,
      }),
    );
    await assertFails(
      updateDoc(doc(operatorDb, 'compensationRules/existing-rule'), {
        status: 'disabled',
        updatedAt: serverTimestamp(),
        updatedByUid: OPERATOR_UID,
      }),
    );

    await assertFails(deleteDoc(reference));
    await assertFails(deleteDoc(doc(ownerDb, 'compensationRules/disabled-rule')));
  });
});
