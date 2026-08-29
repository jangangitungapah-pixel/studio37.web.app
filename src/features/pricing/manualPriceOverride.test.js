import { describe, expect, it } from 'vitest';

import { CAPABILITIES } from '../auth/capabilities.js';
import { USER_PROFILE_ROLES, USER_PROFILE_STATUSES } from '../auth/userProfile.js';
import { calculateAddOnPrices } from './addOnPricing.js';
import { calculateDiscount } from './discountPricing.js';
import { calculateFixedSessionPrice } from './fixedSessionPricing.js';
import {
  applyAuthorizedManualPriceOverride,
  MANUAL_PRICE_OVERRIDE_REASON_MAX_LENGTH,
} from './manualPriceOverride.js';
import { PRICING_RULE_MODELS, PRICING_RULE_STATUSES } from './pricingRules.js';
import { buildPricingSnapshot } from './pricingSnapshot.js';

const pricingTime = new Date('2026-08-29T10:00:00.000Z');
const overrideTime = new Date('2026-08-29T10:05:00.000Z');

function createRule(overrides = {}) {
  return {
    configuration: { amountIdr: 500_000 },
    createdAt: new Date('2026-08-20T00:00:00.000Z'),
    createdByUid: 'owner-1',
    effectiveFrom: null,
    effectiveUntil: null,
    id: 'rule-fixed',
    name: 'Fixed mixing session',
    pricingModel: PRICING_RULE_MODELS.FIXED_SESSION,
    priority: 100,
    sessionTypeId: 'session-mixing',
    status: PRICING_RULE_STATUSES.ACTIVE,
    studioId: null,
    updatedAt: new Date('2026-08-25T00:00:00.000Z'),
    updatedByUid: 'owner-1',
    ...overrides,
  };
}

function createPricingSnapshot() {
  const baseCalculation = calculateFixedSessionPrice({
    configuration: { amountIdr: 500_000 },
    pricingModel: PRICING_RULE_MODELS.FIXED_SESSION,
  });
  const addOnCalculation = calculateAddOnPrices({ addOns: [] });
  const discountCalculation = calculateDiscount({
    discount: null,
    discountableAmountIdr: 500_000,
  });

  return buildPricingSnapshot({
    addOnCalculation,
    baseCalculation,
    discountCalculation,
    pricingRule: createRule(),
    pricingTime,
  });
}

function createAccess({
  capabilities = [],
  profileStatus = USER_PROFILE_STATUSES.ACTIVE,
  role = USER_PROFILE_ROLES.OWNER,
  sessionStatus = 'authenticated',
  uid = 'owner-1',
  userUid = uid,
} = {}) {
  return {
    capabilities,
    profile: {
      role,
      status: profileStatus,
      uid,
    },
    status: sessionStatus,
    user: { uid: userUid },
  };
}

function createInput(overrides = {}) {
  return {
    access: createAccess(),
    overrideAmountIdr: 450_000,
    overrideTime,
    pricingSnapshot: createPricingSnapshot(),
    reason: 'Approved loyalty adjustment',
    ...overrides,
  };
}

describe('authorized manual price override', () => {
  it('allows an Owner through implicit booking.override_price capability', () => {
    const result = applyAuthorizedManualPriceOverride(createInput());

    expect(result).toEqual({
      calculationVersion: 1,
      finalAmountIdr: 450_000,
      manualOverride: {
        actorRole: USER_PROFILE_ROLES.OWNER,
        actorUid: 'owner-1',
        authorizationCapability: CAPABILITIES.BOOKING_OVERRIDE_PRICE,
        calculatedOriginalAmountIdr: 500_000,
        overriddenAtIso: '2026-08-29T10:05:00.000Z',
        overriddenFinalAmountIdr: 450_000,
        reason: 'Approved loyalty adjustment',
      },
      pricingRuleId: 'rule-fixed',
      snapshotVersion: 1,
    });
  });

  it('allows an active Studio Operator only with explicit booking.override_price capability', () => {
    const result = applyAuthorizedManualPriceOverride(
      createInput({
        access: createAccess({
          capabilities: [CAPABILITIES.BOOKING_OVERRIDE_PRICE],
          role: USER_PROFILE_ROLES.STUDIO_OPERATOR,
          uid: 'operator-1',
        }),
      }),
    );

    expect(result.manualOverride.actorUid).toBe('operator-1');
    expect(result.manualOverride.actorRole).toBe(USER_PROFILE_ROLES.STUDIO_OPERATOR);
  });

  it('rejects a Studio Operator without booking.override_price capability', () => {
    expect(() =>
      applyAuthorizedManualPriceOverride(
        createInput({
          access: createAccess({
            capabilities: [CAPABILITIES.BOOKING_EDIT],
            role: USER_PROFILE_ROLES.STUDIO_OPERATOR,
            uid: 'operator-1',
          }),
        }),
      ),
    ).toThrow(/booking\.override_price/);
  });

  it('rejects unauthenticated or disabled access before applying an override', () => {
    expect(() =>
      applyAuthorizedManualPriceOverride(
        createInput({ access: createAccess({ sessionStatus: 'unauthenticated' }) }),
      ),
    ).toThrow(/authenticated session/);

    expect(() =>
      applyAuthorizedManualPriceOverride(
        createInput({
          access: createAccess({ profileStatus: USER_PROFILE_STATUSES.DISABLED }),
        }),
      ),
    ).toThrow(/profile must be active/);
  });

  it('rejects actor/profile identity mismatch and unsupported roles', () => {
    expect(() =>
      applyAuthorizedManualPriceOverride(
        createInput({ access: createAccess({ userUid: 'someone-else' }) }),
      ),
    ).toThrow(/must match the actor profile/);

    expect(() =>
      applyAuthorizedManualPriceOverride(
        createInput({ access: createAccess({ role: 'super_admin' }) }),
      ),
    ).toThrow(/actor role is not supported/);
  });

  it('supports both upward and downward override amounts including zero IDR', () => {
    expect(
      applyAuthorizedManualPriceOverride(createInput({ overrideAmountIdr: 650_000 }))
        .finalAmountIdr,
    ).toBe(650_000);
    expect(
      applyAuthorizedManualPriceOverride(createInput({ overrideAmountIdr: 0 })).finalAmountIdr,
    ).toBe(0);
  });

  it('rejects negative, fractional, unsafe, and no-op override amounts', () => {
    for (const overrideAmountIdr of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() =>
        applyAuthorizedManualPriceOverride(createInput({ overrideAmountIdr })),
      ).toThrow();
    }

    expect(() =>
      applyAuthorizedManualPriceOverride(createInput({ overrideAmountIdr: 500_000 })),
    ).toThrow(/must differ/);
  });

  it('trims a required reason and rejects blank or oversized reasons', () => {
    const result = applyAuthorizedManualPriceOverride(
      createInput({ reason: '   Customer service recovery   ' }),
    );

    expect(result.manualOverride.reason).toBe('Customer service recovery');

    expect(() => applyAuthorizedManualPriceOverride(createInput({ reason: '   ' }))).toThrow(
      /non-empty string/,
    );
    expect(() =>
      applyAuthorizedManualPriceOverride(
        createInput({ reason: 'x'.repeat(MANUAL_PRICE_OVERRIDE_REASON_MAX_LENGTH + 1) }),
      ),
    ).toThrow(/at most/);
  });

  it('requires override time at or after the pricing snapshot time', () => {
    expect(() =>
      applyAuthorizedManualPriceOverride(
        createInput({ overrideTime: new Date('2026-08-29T09:59:59.999Z') }),
      ),
    ).toThrow(/cannot be earlier than pricingTime/);

    expect(() =>
      applyAuthorizedManualPriceOverride(createInput({ overrideTime: '2026-08-29' })),
    ).toThrow(/must be a Date or Firestore Timestamp/);
  });

  it('derives the original amount and rule identity from the pricing snapshot', () => {
    const snapshot = createPricingSnapshot();
    const result = applyAuthorizedManualPriceOverride(
      createInput({
        overrideAmountIdr: 600_000,
        pricingSnapshot: snapshot,
      }),
    );

    expect(result.manualOverride.calculatedOriginalAmountIdr).toBe(snapshot.amounts.finalAmountIdr);
    expect(result.pricingRuleId).toBe(snapshot.rule.id);
  });

  it('rejects unsupported snapshot versions and malformed snapshot shapes', () => {
    const snapshot = createPricingSnapshot();

    expect(() =>
      applyAuthorizedManualPriceOverride(
        createInput({ pricingSnapshot: { ...snapshot, snapshotVersion: 999 } }),
      ),
    ).toThrow(/snapshotVersion/);

    expect(() =>
      applyAuthorizedManualPriceOverride(
        createInput({ pricingSnapshot: { ...snapshot, unexpected: true } }),
      ),
    ).toThrow(/unsupported input shape/);
  });

  it('rejects internally inconsistent snapshot amount summaries', () => {
    const snapshot = createPricingSnapshot();
    const tamperedSnapshot = {
      ...snapshot,
      amounts: {
        ...snapshot.amounts,
        finalAmountIdr: snapshot.amounts.finalAmountIdr - 1,
      },
    };

    expect(() =>
      applyAuthorizedManualPriceOverride(createInput({ pricingSnapshot: tamperedSnapshot })),
    ).toThrow(/internally inconsistent/);
  });

  it('rejects invalid pricing snapshot rule identity and pricing time', () => {
    const snapshot = createPricingSnapshot();

    expect(() =>
      applyAuthorizedManualPriceOverride(
        createInput({
          pricingSnapshot: {
            ...snapshot,
            rule: { ...snapshot.rule, id: 'pricing/rule' },
          },
        }),
      ),
    ).toThrow(/Firestore document id/);

    expect(() =>
      applyAuthorizedManualPriceOverride(
        createInput({ pricingSnapshot: { ...snapshot, pricingTimeIso: '2026-08-29' } }),
      ),
    ).toThrow(/canonical ISO-8601/);
  });

  it('rejects unknown top-level fields so actor and original amount cannot be caller supplied', () => {
    expect(() =>
      applyAuthorizedManualPriceOverride({
        ...createInput(),
        actorUid: 'forged-owner',
      }),
    ).toThrow(/unsupported input shape/);
  });

  it('returns frozen audit metadata without mutating the pricing snapshot', () => {
    const snapshot = createPricingSnapshot();
    const originalSnapshotJson = JSON.stringify(snapshot);
    const result = applyAuthorizedManualPriceOverride(createInput({ pricingSnapshot: snapshot }));

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.manualOverride)).toBe(true);
    expect(JSON.stringify(snapshot)).toBe(originalSnapshotJson);
    expect(snapshot.amounts.finalAmountIdr).toBe(500_000);
  });
});
