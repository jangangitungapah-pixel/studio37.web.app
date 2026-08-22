import { describe, expect, it } from 'vitest';

import {
  CAPABILITIES,
  canAccessPolicy,
  hasCapability,
  NON_DELEGABLE_CAPABILITIES,
  normalizeDelegatedCapabilities,
} from './capabilities.js';

const ownerAccess = Object.freeze({
  capabilities: [],
  profile: { role: 'owner' },
});

const operatorAccess = Object.freeze({
  capabilities: [CAPABILITIES.BOOKING_VIEW, CAPABILITIES.COMMISSION_VIEW_OWN],
  profile: { role: 'studio_operator' },
});

describe('Studio37 capability helpers', () => {
  it('normalizes delegated capabilities into a unique stable list', () => {
    expect(
      normalizeDelegatedCapabilities([
        CAPABILITIES.COMMISSION_VIEW_OWN,
        CAPABILITIES.BOOKING_VIEW,
        CAPABILITIES.BOOKING_VIEW,
      ]),
    ).toEqual([CAPABILITIES.BOOKING_VIEW, CAPABILITIES.COMMISSION_VIEW_OWN]);
  });

  it('rejects unsupported and non-delegable capabilities', () => {
    expect(() => normalizeDelegatedCapabilities(['booking.fly'])).toThrow(
      'permissionSet.capabilities[0] is not supported.',
    );

    for (const capability of NON_DELEGABLE_CAPABILITIES) {
      expect(() => normalizeDelegatedCapabilities([capability])).toThrow(
        `${capability} cannot be delegated to a Studio Operator.`,
      );
    }
  });

  it('grants every supported capability to Owner implicitly', () => {
    expect(hasCapability(ownerAccess, CAPABILITIES.DANGER_ZONE_EXECUTE)).toBe(true);
    expect(hasCapability(ownerAccess, CAPABILITIES.PERMISSIONS_MANAGE)).toBe(true);
  });

  it('grants Studio Operators only explicitly assigned capabilities', () => {
    expect(hasCapability(operatorAccess, CAPABILITIES.BOOKING_VIEW)).toBe(true);
    expect(hasCapability(operatorAccess, CAPABILITIES.BOOKING_EDIT)).toBe(false);
    expect(hasCapability(operatorAccess, 'booking.fly')).toBe(false);
  });

  it('evaluates all-of, any-of, and Owner-only policies fail closed', () => {
    expect(canAccessPolicy(operatorAccess, { allOf: [CAPABILITIES.BOOKING_VIEW] })).toBe(true);
    expect(
      canAccessPolicy(operatorAccess, {
        anyOf: [CAPABILITIES.COMMISSION_VIEW_ALL, CAPABILITIES.COMMISSION_VIEW_OWN],
      }),
    ).toBe(true);
    expect(
      canAccessPolicy(operatorAccess, {
        allOf: [CAPABILITIES.BOOKING_VIEW, CAPABILITIES.BOOKING_EDIT],
      }),
    ).toBe(false);
    expect(canAccessPolicy(operatorAccess, { ownerOnly: true })).toBe(false);
    expect(canAccessPolicy(ownerAccess, { ownerOnly: true })).toBe(true);
  });
});
