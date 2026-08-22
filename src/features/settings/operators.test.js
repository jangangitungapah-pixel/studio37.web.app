import { describe, expect, it } from 'vitest';

import {
  compareOperators,
  DEFAULT_OPERATOR_FORM_VALUES,
  decodeOperatorDocument,
  normalizeOperatorDetails,
  normalizeOperatorTypes,
  OPERATOR_LIST_LIMIT,
  OPERATOR_TYPES,
  toOperatorFormValues,
  validateOperatorForm,
} from './operators.js';

function createDetails(overrides = {}) {
  return {
    displayName: 'Budi Engineer',
    email: 'budi@studio37.id',
    operatorTypes: [OPERATOR_TYPES.RECORDING_ENGINEER],
    phone: '+6281234567890',
    ...overrides,
  };
}

function createDocument(overrides = {}) {
  return {
    ...createDetails(),
    createdAt: new Date('2026-08-22T01:00:00.000Z'),
    createdByUid: 'owner-1',
    id: 'operator-budi',
    linkedUserUid: null,
    status: 'active',
    updatedAt: new Date('2026-08-22T02:00:00.000Z'),
    updatedByUid: 'owner-1',
    ...overrides,
  };
}

describe('operator domain contract', () => {
  it('normalizes identity, contact details, and deterministic operator types', () => {
    expect(
      normalizeOperatorDetails(
        createDetails({
          displayName: '  Budi Engineer  ',
          email: ' BUDI@Studio37.ID ',
          operatorTypes: [OPERATOR_TYPES.RECORDING_ENGINEER, OPERATOR_TYPES.STUDIO_OPERATOR],
          phone: '0812-3456-7890',
        }),
      ),
    ).toEqual({
      displayName: 'Budi Engineer',
      email: 'budi@studio37.id',
      operatorTypes: [OPERATOR_TYPES.STUDIO_OPERATOR, OPERATOR_TYPES.RECORDING_ENGINEER],
      phone: '+6281234567890',
    });
    expect(OPERATOR_LIST_LIMIT).toBe(100);
  });

  it('supports contact-less operator records without requiring a login', () => {
    expect(normalizeOperatorDetails(createDetails({ email: null, phone: null }))).toEqual({
      displayName: 'Budi Engineer',
      email: null,
      operatorTypes: [OPERATOR_TYPES.RECORDING_ENGINEER],
      phone: null,
    });

    expect(decodeOperatorDocument(createDocument()).linkedUserUid).toBeNull();
  });

  it('supports Studio Operator and Recording Engineer types independently or together', () => {
    expect(normalizeOperatorTypes([OPERATOR_TYPES.STUDIO_OPERATOR])).toEqual([
      OPERATOR_TYPES.STUDIO_OPERATOR,
    ]);
    expect(normalizeOperatorTypes([OPERATOR_TYPES.RECORDING_ENGINEER])).toEqual([
      OPERATOR_TYPES.RECORDING_ENGINEER,
    ]);
    expect(
      normalizeOperatorTypes([OPERATOR_TYPES.STUDIO_OPERATOR, OPERATOR_TYPES.RECORDING_ENGINEER]),
    ).toEqual([OPERATOR_TYPES.STUDIO_OPERATOR, OPERATOR_TYPES.RECORDING_ENGINEER]);
  });

  it('rejects malformed details, duplicate or unsupported types, and extra fields', () => {
    expect(() => normalizeOperatorDetails(createDetails({ email: 'not-email' }))).toThrow(/email/);
    expect(() => normalizeOperatorDetails(createDetails({ phone: '+441234567890' }))).toThrow(
      /phone/,
    );
    expect(() => normalizeOperatorTypes([])).toThrow(/one or two/);
    expect(() =>
      normalizeOperatorTypes([OPERATOR_TYPES.STUDIO_OPERATOR, OPERATOR_TYPES.STUDIO_OPERATOR]),
    ).toThrow(/duplicates/);
    expect(() => normalizeOperatorTypes(['admin'])).toThrow(/unsupported/);
    expect(() =>
      normalizeOperatorDetails({ ...createDetails(), permissionSetId: 'admin' }),
    ).toThrow(/unsupported document shape/);
  });

  it('decodes strict metadata, optional login links, and cloned timestamps', () => {
    const source = createDocument({ linkedUserUid: 'user-budi' });
    const decoded = decodeOperatorDocument(source);

    expect(decoded).toEqual(source);
    expect(decoded.createdAt).not.toBe(source.createdAt);
    expect(decoded.updatedAt).not.toBe(source.updatedAt);
  });

  it('fails closed for unknown fields, invalid ids, and non-monotonic timestamps', () => {
    expect(() => decodeOperatorDocument({ ...createDocument(), role: 'owner' })).toThrow(
      /unsupported document shape/,
    );
    expect(() =>
      decodeOperatorDocument(createDocument({ linkedUserUid: 'users/user-budi' })),
    ).toThrow(/document id/);
    expect(() =>
      decodeOperatorDocument(createDocument({ updatedAt: new Date('2026-08-21T23:00:00.000Z') })),
    ).toThrow(/earlier than createdAt/);
  });

  it('sorts names and equal names deterministically by immutable document id', () => {
    const operators = [
      createDocument({ displayName: 'Citra', id: 'operator-c' }),
      createDocument({ displayName: 'Andi', id: 'operator-b' }),
      createDocument({ displayName: 'Andi', id: 'operator-a' }),
    ];

    expect([...operators].sort(compareOperators).map(({ id }) => id)).toEqual([
      'operator-a',
      'operator-b',
      'operator-c',
    ]);
  });

  it('maps persisted details to editable form values without exposing account fields', () => {
    expect(toOperatorFormValues()).toEqual(DEFAULT_OPERATOR_FORM_VALUES);
    expect(
      toOperatorFormValues(
        createDocument({
          email: null,
          operatorTypes: [OPERATOR_TYPES.STUDIO_OPERATOR, OPERATOR_TYPES.RECORDING_ENGINEER],
          phone: null,
        }),
      ),
    ).toEqual({
      displayName: 'Budi Engineer',
      email: '',
      phone: '',
      recordingEngineer: true,
      studioOperator: true,
    });
  });

  it('validates UI form input into canonical nullable contact and operator types', () => {
    const valid = validateOperatorForm({
      displayName: '  Budi Engineer  ',
      email: '',
      phone: '0812-3456-7890',
      recordingEngineer: true,
      studioOperator: false,
    });
    const invalid = validateOperatorForm({
      displayName: '',
      email: 'not-email',
      phone: '+441234',
      recordingEngineer: false,
      studioOperator: false,
    });

    expect(valid.errors).toEqual({});
    expect(valid.value).toEqual({
      displayName: 'Budi Engineer',
      email: null,
      operatorTypes: [OPERATOR_TYPES.RECORDING_ENGINEER],
      phone: '+6281234567890',
    });
    expect(invalid.value).toBeNull();
    expect(invalid.errors).toEqual(
      expect.objectContaining({
        displayName: expect.any(String),
        email: expect.any(String),
        operatorTypes: expect.any(String),
        phone: expect.any(String),
      }),
    );
  });
});
