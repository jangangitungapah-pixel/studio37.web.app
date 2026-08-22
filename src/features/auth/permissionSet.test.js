import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';

import { CAPABILITIES } from './capabilities.js';
import { decodePermissionSetDocument, PERMISSION_SET_STATUSES } from './permissionSet.js';

function createPermissionSet(overrides = {}) {
  return {
    id: 'front-desk',
    name: 'Front Desk',
    status: PERMISSION_SET_STATUSES.ACTIVE,
    capabilities: [CAPABILITIES.DASHBOARD_VIEW, CAPABILITIES.BOOKING_VIEW],
    createdAt: Timestamp.fromDate(new Date('2026-08-22T01:00:00.000Z')),
    updatedAt: Timestamp.fromDate(new Date('2026-08-22T02:00:00.000Z')),
    ...overrides,
  };
}

describe('Studio37 permission set model', () => {
  it('decodes the canonical permission set shape', () => {
    const permissionSet = decodePermissionSetDocument(createPermissionSet());

    expect(permissionSet).toEqual({
      id: 'front-desk',
      name: 'Front Desk',
      status: 'active',
      capabilities: [CAPABILITIES.BOOKING_VIEW, CAPABILITIES.DASHBOARD_VIEW],
      createdAt: new Date('2026-08-22T01:00:00.000Z'),
      updatedAt: new Date('2026-08-22T02:00:00.000Z'),
    });
    expect(Object.isFrozen(permissionSet)).toBe(true);
    expect(Object.isFrozen(permissionSet.capabilities)).toBe(true);
  });

  it('rejects unsupported status and unsafe delegated capabilities', () => {
    expect(() => decodePermissionSetDocument(createPermissionSet({ status: 'archived' }))).toThrow(
      'permissionSet.status is not supported.',
    );
    expect(() =>
      decodePermissionSetDocument(
        createPermissionSet({ capabilities: [CAPABILITIES.PERMISSIONS_MANAGE] }),
      ),
    ).toThrow('permissions.manage cannot be delegated to a Studio Operator.');
  });

  it('rejects an update timestamp earlier than creation', () => {
    expect(() =>
      decodePermissionSetDocument(
        createPermissionSet({ updatedAt: new Date('2026-08-21T23:59:59.000Z') }),
      ),
    ).toThrow('permissionSet.updatedAt cannot be earlier than permissionSet.createdAt.');
  });
});
