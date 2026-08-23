import { describe, expect, it } from 'vitest';

import {
  ALL_CAPABILITIES,
  CAPABILITIES,
  NON_DELEGABLE_CAPABILITIES,
} from '../auth/capabilities.js';
import {
  canAssignActivePermissionSet,
  canClearPermissionAssignment,
  createPermissionSetFormValues,
  DELEGABLE_CAPABILITY_OPTIONS,
  getPermissionSetDomainLabels,
  isLoginLinkedStudioOperator,
  PERMISSION_CAPABILITY_GROUPS,
  validatePermissionSetForm,
} from './permissionAdministrationUi.js';

function createOperator(overrides = {}) {
  return {
    id: 'operator-dina',
    linkedUserUid: 'user-dina',
    operatorTypes: ['studio_operator'],
    status: 'active',
    ...overrides,
  };
}

function createUserProfile(overrides = {}) {
  return {
    operatorId: 'operator-dina',
    permissionSetId: 'front-desk',
    role: 'studio_operator',
    status: 'active',
    uid: 'user-dina',
    ...overrides,
  };
}

describe('permission administration UI contract', () => {
  it('groups every delegable capability exactly once and excludes Owner-only capabilities', () => {
    const groupedCapabilities = PERMISSION_CAPABILITY_GROUPS.flatMap((group) =>
      group.capabilities.map(({ value }) => value),
    );
    const expectedDelegableCapabilities = ALL_CAPABILITIES.filter(
      (capability) => !NON_DELEGABLE_CAPABILITIES.includes(capability),
    );

    expect(groupedCapabilities).toHaveLength(new Set(groupedCapabilities).size);
    expect(groupedCapabilities.sort()).toEqual(expectedDelegableCapabilities.sort());
    expect(DELEGABLE_CAPABILITY_OPTIONS).toHaveLength(expectedDelegableCapabilities.length);

    for (const capability of NON_DELEGABLE_CAPABILITIES) {
      expect(groupedCapabilities).not.toContain(capability);
    }
  });

  it('normalizes template input and keeps an empty capability set valid', () => {
    expect(
      validatePermissionSetForm({
        capabilities: [CAPABILITIES.BOOKING_VIEW, CAPABILITIES.DASHBOARD_VIEW],
        name: '  Front Desk  ',
      }),
    ).toEqual({
      errors: {},
      value: {
        capabilities: [CAPABILITIES.BOOKING_VIEW, CAPABILITIES.DASHBOARD_VIEW],
        name: 'Front Desk',
      },
    });

    expect(
      validatePermissionSetForm({ capabilities: [], name: 'Login tanpa akses' }).value,
    ).toEqual({
      capabilities: [],
      name: 'Login tanpa akses',
    });
  });

  it('reports invalid names and injected capabilities without returning a write value', () => {
    expect(validatePermissionSetForm({ capabilities: [], name: '  ' })).toEqual({
      errors: { name: 'Nama template wajib diisi dan maksimal 120 karakter.' },
      value: null,
    });
    expect(
      validatePermissionSetForm({ capabilities: [CAPABILITIES.PERMISSIONS_MANAGE], name: 'Owner' }),
    ).toEqual({
      errors: { capabilities: 'Pilih hanya capability yang dapat didelegasikan.' },
      value: null,
    });
  });

  it('creates editable form copies and derives concise domain labels', () => {
    const permissionSet = {
      capabilities: [CAPABILITIES.BOOKING_VIEW, CAPABILITIES.PAYMENT_VIEW],
      name: 'Front Desk',
    };
    const values = createPermissionSetFormValues(permissionSet);

    expect(values).toEqual(permissionSet);
    expect(values.capabilities).not.toBe(permissionSet.capabilities);
    expect(getPermissionSetDomainLabels(permissionSet)).toEqual(['Booking', 'Payment']);
  });

  it('recognizes only reciprocal active linked Studio Operators for non-null assignment', () => {
    const operator = createOperator();
    const userProfile = createUserProfile();

    expect(isLoginLinkedStudioOperator(operator)).toBe(true);
    expect(canAssignActivePermissionSet(operator, userProfile)).toBe(true);
    expect(canAssignActivePermissionSet(operator, createUserProfile({ status: 'disabled' }))).toBe(
      false,
    );
    expect(
      canAssignActivePermissionSet(operator, createUserProfile({ operatorId: 'operator-lain' })),
    ).toBe(false);
    expect(canAssignActivePermissionSet(createOperator({ status: 'disabled' }), userProfile)).toBe(
      false,
    );
    expect(isLoginLinkedStudioOperator(createOperator({ linkedUserUid: null }))).toBe(false);
  });

  it('allows safe clearing only for a Studio Operator profile with an existing assignment', () => {
    expect(canClearPermissionAssignment(createUserProfile())).toBe(true);
    expect(canClearPermissionAssignment(createUserProfile({ permissionSetId: null }))).toBe(false);
    expect(canClearPermissionAssignment(createUserProfile({ role: 'owner' }))).toBe(false);
  });
});
