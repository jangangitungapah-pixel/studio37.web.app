import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';

import {
  decodeUserProfileDocument,
  USER_PROFILE_ROLES,
  USER_PROFILE_STATUSES,
} from './userProfile.js';

function createProfile(overrides = {}) {
  return {
    id: 'owner-1',
    uid: 'owner-1',
    displayName: 'Studio37 Owner',
    email: 'OWNER@studio37.id',
    phone: '0812-3456-7890',
    role: USER_PROFILE_ROLES.OWNER,
    status: USER_PROFILE_STATUSES.ACTIVE,
    permissionSetId: null,
    operatorId: null,
    createdAt: Timestamp.fromDate(new Date('2026-08-22T01:00:00.000Z')),
    updatedAt: Timestamp.fromDate(new Date('2026-08-22T02:00:00.000Z')),
    ...overrides,
  };
}

describe('Studio37 user profile model', () => {
  it('decodes and normalizes the canonical owner profile shape', () => {
    const profile = decodeUserProfileDocument(createProfile());

    expect(profile).toEqual({
      id: 'owner-1',
      uid: 'owner-1',
      displayName: 'Studio37 Owner',
      email: 'owner@studio37.id',
      phone: '+6281234567890',
      role: 'owner',
      status: 'active',
      permissionSetId: null,
      operatorId: null,
      createdAt: new Date('2026-08-22T01:00:00.000Z'),
      updatedAt: new Date('2026-08-22T02:00:00.000Z'),
    });
    expect(Object.isFrozen(profile)).toBe(true);
  });

  it('requires the stored uid to match the Firestore document id', () => {
    expect(() => decodeUserProfileDocument(createProfile({ uid: 'someone-else' }))).toThrow(
      'user.uid must match the Firestore document id.',
    );
  });

  it.each([
    ['role', 'administrator'],
    ['status', 'suspended'],
  ])('rejects an unsupported %s', (field, value) => {
    expect(() => decodeUserProfileDocument(createProfile({ [field]: value }))).toThrow(
      `user.${field} is not supported.`,
    );
  });

  it('rejects an update timestamp earlier than creation', () => {
    expect(() =>
      decodeUserProfileDocument(createProfile({ updatedAt: new Date('2026-08-21T23:59:59.000Z') })),
    ).toThrow('user.updatedAt cannot be earlier than user.createdAt.');
  });

  it('allows nullable phone and relationship references', () => {
    const profile = decodeUserProfileDocument(
      createProfile({ phone: null, permissionSetId: null, operatorId: null }),
    );

    expect(profile.phone).toBeNull();
    expect(profile.permissionSetId).toBeNull();
    expect(profile.operatorId).toBeNull();
  });
});
