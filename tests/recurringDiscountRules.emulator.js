import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, describe, test } from 'node:test';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { Timestamp, doc, serverTimestamp, setDoc } from 'firebase/firestore';

const TEST_PROJECT_ID = 'studio37-rules-test';
const OWNER_UID = 'owner-recurring-discount';
const RULES_PATH = new URL('../firestore.rules', import.meta.url);
const FIXTURE_TIMESTAMP = Timestamp.fromMillis(Date.UTC(2026, 0, 1));

let testEnvironment;

function createOwnerProfile() {
  return {
    uid: OWNER_UID,
    displayName: 'Studio37 Owner',
    email: 'owner-recurring-discount@studio37.test',
    phone: null,
    role: 'owner',
    status: 'active',
    permissionSetId: null,
    operatorId: null,
    createdAt: FIXTURE_TIMESTAMP,
    updatedAt: FIXTURE_TIMESTAMP,
  };
}

function createSessionType() {
  return {
    code: 'REHEARSAL',
    name: 'Rehearsal',
    description: 'Latihan band dengan reservasi studio.',
    displayOrder: 1,
    requiresStudioReservation: true,
    defaultDurationMinutes: 120,
    minimumDurationMinutes: 60,
    status: 'active',
    createdAt: FIXTURE_TIMESTAMP,
    createdByUid: OWNER_UID,
    updatedAt: FIXTURE_TIMESTAMP,
    updatedByUid: OWNER_UID,
  };
}

function createPricingRule(configuration) {
  return {
    name: 'Rehearsal hourly general',
    sessionTypeId: 'rehearsal',
    studioId: null,
    pricingModel: 'hourly',
    configuration,
    priority: 100,
    effectiveFrom: null,
    effectiveUntil: null,
    status: 'active',
    createdAt: serverTimestamp(),
    createdByUid: OWNER_UID,
    updatedAt: serverTimestamp(),
    updatedByUid: OWNER_UID,
  };
}

function legacyHourlyConfiguration() {
  return {
    amountPerIncrementIdr: 120_000,
    incrementMinutes: 60,
    minimumDurationMinutes: 60,
    roundingMode: 'exact',
  };
}

function recurringHourlyConfiguration(overrides = {}) {
  return {
    ...legacyHourlyConfiguration(),
    recurringDurationDiscount: {
      amountPerBlockIdr: 40_000,
      blockDurationMinutes: 180,
      enabled: true,
      ...overrides,
    },
  };
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
  await testEnvironment.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    await setDoc(doc(firestore, `users/${OWNER_UID}`), createOwnerProfile());
    await setDoc(doc(firestore, 'sessionTypes/rehearsal'), createSessionType());
  });
});

describe('recurring duration-block discount Firestore validation', () => {
  test('keeps legacy hourly pricing documents valid', async () => {
    const firestore = testEnvironment.authenticatedContext(OWNER_UID).firestore();

    await assertSucceeds(
      setDoc(
        doc(firestore, 'pricingRules/legacy-hourly'),
        createPricingRule(legacyHourlyConfiguration()),
      ),
    );
  });

  test('accepts a configurable recurring discount', async () => {
    const firestore = testEnvironment.authenticatedContext(OWNER_UID).firestore();

    await assertSucceeds(
      setDoc(
        doc(firestore, 'pricingRules/rehearsal-discount'),
        createPricingRule(recurringHourlyConfiguration()),
      ),
    );
    await assertSucceeds(
      setDoc(
        doc(firestore, 'pricingRules/rehearsal-future-discount'),
        createPricingRule(
          recurringHourlyConfiguration({
            amountPerBlockIdr: 20_000,
            blockDurationMinutes: 240,
          }),
        ),
      ),
    );
  });

  test('rejects a recurring discount block that does not align with the hourly increment', async () => {
    const firestore = testEnvironment.authenticatedContext(OWNER_UID).firestore();

    await assertFails(
      setDoc(
        doc(firestore, 'pricingRules/bad-discount-block'),
        createPricingRule(recurringHourlyConfiguration({ blockDurationMinutes: 90 })),
      ),
    );
  });

  test('rejects malformed recurring discount shapes', async () => {
    const firestore = testEnvironment.authenticatedContext(OWNER_UID).firestore();
    const malformed = recurringHourlyConfiguration();
    malformed.recurringDurationDiscount.sessionCode = 'REHEARSAL';

    await assertFails(
      setDoc(doc(firestore, 'pricingRules/bad-discount-shape'), createPricingRule(malformed)),
    );
  });

  test('rejects non-boolean enabled flags', async () => {
    const firestore = testEnvironment.authenticatedContext(OWNER_UID).firestore();

    await assertFails(
      setDoc(
        doc(firestore, 'pricingRules/bad-enabled-flag'),
        createPricingRule(recurringHourlyConfiguration({ enabled: 'yes' })),
      ),
    );
  });
});

assert.equal(typeof TEST_PROJECT_ID, 'string');
