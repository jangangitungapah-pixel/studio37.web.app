import { describe, expect, it } from 'vitest';

import { OPERATOR_TYPES } from '../settings/operators.js';
import {
  COMPENSATION_PERCENTAGE_BASES,
  COMPENSATION_RULE_MODELS,
  COMPENSATION_RULE_STATUSES,
} from './compensationRules.js';
import {
  BOOKING_COMPENSATION_DIAGNOSTIC_CODES,
  BOOKING_COMPENSATION_SNAPSHOT_VERSION,
  buildBookingCompensationProjection,
  buildCommissionEntryTransition,
  COMMISSION_ENTRY_SOURCE_EVENTS,
  COMMISSION_ENTRY_STATES,
  createCommissionSourceKey,
  DuplicateCompensationAssignmentError,
} from './bookingCompensation.js';

function makeRule(overrides = {}) {
  return {
    compensationModel: COMPENSATION_RULE_MODELS.PER_SESSION,
    configuration: { amountIdr: 50000 },
    effectiveFrom: null,
    effectiveUntil: null,
    id: 'rule-default',
    name: 'Default rule',
    operatorId: null,
    operatorType: OPERATOR_TYPES.STUDIO_OPERATOR,
    priority: 100,
    sessionTypeId: null,
    status: COMPENSATION_RULE_STATUSES.ACTIVE,
    studioId: null,
    ...overrides,
  };
}

function makeProjectionInput(overrides = {}) {
  return {
    assignments: [
      {
        operatorId: 'operator-studio',
        operatorType: OPERATOR_TYPES.STUDIO_OPERATOR,
      },
    ],
    bookingId: 'booking-1',
    bookingNumber: 'ST37-2026-0001',
    durationMinutes: 120,
    effectiveAt: new Date('2026-09-07T10:00:00.000Z'),
    percentageBaseAmounts: {},
    rules: [makeRule()],
    sessionTypeId: 'rehearsal',
    studioId: 'studio-a',
    ...overrides,
  };
}

describe('booking compensation projection', () => {
  it('projects one pending commission entry and one immutable booking snapshot', () => {
    const result = buildBookingCompensationProjection(makeProjectionInput());

    expect(result.commissionEntryDrafts).toHaveLength(1);
    expect(result.commissionEntryDrafts[0]).toMatchObject({
      amountIdr: 50000,
      bookingId: 'booking-1',
      bookingNumber: 'ST37-2026-0001',
      compensationModel: COMPENSATION_RULE_MODELS.PER_SESSION,
      operatorId: 'operator-studio',
      operatorType: OPERATOR_TYPES.STUDIO_OPERATOR,
      payoutId: null,
      ruleId: 'rule-default',
      sourceEvent: COMMISSION_ENTRY_SOURCE_EVENTS.BOOKING_CONFIRMATION,
      state: COMMISSION_ENTRY_STATES.PENDING,
    });
    expect(result.bookingSnapshot).toMatchObject({
      effectiveAtIso: '2026-09-07T10:00:00.000Z',
      schemaVersion: BOOKING_COMPENSATION_SNAPSHOT_VERSION,
      summary: {
        entryCount: 1,
        totalAmountIdr: 50000,
      },
    });
    expect(Object.isFrozen(result.bookingSnapshot)).toBe(true);
    expect(Object.isFrozen(result.commissionEntryDrafts[0].calculationSnapshot)).toBe(true);
  });

  it('supports Studio Operator and Recording Engineer compensation independently on one booking', () => {
    const result = buildBookingCompensationProjection(
      makeProjectionInput({
        assignments: [
          {
            operatorId: 'same-person',
            operatorType: OPERATOR_TYPES.STUDIO_OPERATOR,
          },
          {
            operatorId: 'same-person',
            operatorType: OPERATOR_TYPES.RECORDING_ENGINEER,
          },
        ],
        rules: [
          makeRule({
            configuration: { amountIdr: 40000 },
            id: 'studio-rule',
          }),
          makeRule({
            compensationModel: COMPENSATION_RULE_MODELS.FIXED,
            configuration: { amountIdr: 150000 },
            id: 'recording-rule',
            operatorType: OPERATOR_TYPES.RECORDING_ENGINEER,
          }),
        ],
      }),
    );

    expect(result.commissionEntryDrafts).toHaveLength(2);
    expect(result.bookingSnapshot.summary).toEqual({
      byOperatorType: {
        [OPERATOR_TYPES.RECORDING_ENGINEER]: {
          amountIdr: 150000,
          entryCount: 1,
        },
        [OPERATOR_TYPES.STUDIO_OPERATOR]: {
          amountIdr: 40000,
          entryCount: 1,
        },
      },
      entryCount: 2,
      totalAmountIdr: 190000,
    });
  });

  it('preserves explicit percentage base evidence in the historical calculation snapshot', () => {
    const base = COMPENSATION_PERCENTAGE_BASES.BOOKING_TOTAL_AFTER_DISCOUNT;
    const result = buildBookingCompensationProjection(
      makeProjectionInput({
        percentageBaseAmounts: { [base]: 625000 },
        rules: [
          makeRule({
            compensationModel: COMPENSATION_RULE_MODELS.PERCENTAGE,
            configuration: { base, basisPoints: 1000 },
          }),
        ],
      }),
    );

    expect(result.commissionEntryDrafts[0].amountIdr).toBe(62500);
    expect(result.commissionEntryDrafts[0].calculationSnapshot.percentageBase).toEqual({
      amountIdr: 625000,
      base,
    });
  });

  it('returns a no-matching-rule diagnostic instead of silently creating a zero-value entry', () => {
    const result = buildBookingCompensationProjection(
      makeProjectionInput({
        rules: [makeRule({ operatorType: OPERATOR_TYPES.RECORDING_ENGINEER })],
      }),
    );

    expect(result.commissionEntryDrafts).toEqual([]);
    expect(result.bookingSnapshot.summary.totalAmountIdr).toBe(0);
    expect(result.diagnostics).toEqual([
      {
        code: BOOKING_COMPENSATION_DIAGNOSTIC_CODES.NO_MATCHING_RULE,
        operatorId: 'operator-studio',
        operatorType: OPERATOR_TYPES.STUDIO_OPERATOR,
      },
    ]);
  });

  it('rejects the same operator/type assignment twice but permits the same person in different roles', () => {
    const duplicate = {
      operatorId: 'operator-studio',
      operatorType: OPERATOR_TYPES.STUDIO_OPERATOR,
    };

    expect(() =>
      buildBookingCompensationProjection(
        makeProjectionInput({ assignments: [duplicate, { ...duplicate }] }),
      ),
    ).toThrow(DuplicateCompensationAssignmentError);
  });

  it('generates a stable source key from booking, operator, role, rule, and event', () => {
    const input = {
      bookingId: 'booking-1',
      operatorId: 'operator-1',
      operatorType: OPERATOR_TYPES.STUDIO_OPERATOR,
      ruleId: 'rule-1',
    };

    expect(createCommissionSourceKey(input)).toBe(createCommissionSourceKey(input));
    expect(createCommissionSourceKey(input)).not.toBe(
      createCommissionSourceKey({ ...input, ruleId: 'rule-2' }),
    );
    expect(createCommissionSourceKey(input)).not.toBe(
      createCommissionSourceKey({
        ...input,
        operatorType: OPERATOR_TYPES.RECORDING_ENGINEER,
      }),
    );
  });

  it('detaches the booking snapshot from later mutable rule configuration changes', () => {
    const configuration = { amountIdr: 50000 };
    const rule = makeRule({ configuration });
    const result = buildBookingCompensationProjection(makeProjectionInput({ rules: [rule] }));

    configuration.amountIdr = 999999;
    rule.name = 'Changed later';

    expect(result.commissionEntryDrafts[0].calculationSnapshot.configuration).toEqual({
      amountIdr: 50000,
    });
    expect(result.commissionEntryDrafts[0].amountIdr).toBe(50000);
  });
});

describe('commission entry base lifecycle', () => {
  function makeEntry(state = COMMISSION_ENTRY_STATES.PENDING) {
    return {
      sourceKey: 'booking-1|operator-1|studio_operator|rule-1|booking_confirmation',
      state,
    };
  }

  it('allows pending -> earned without a payout', () => {
    expect(
      buildCommissionEntryTransition(makeEntry(), {
        toState: COMMISSION_ENTRY_STATES.EARNED,
      }),
    ).toEqual({
      fromState: COMMISSION_ENTRY_STATES.PENDING,
      payoutId: null,
      reason: null,
      sourceKey: makeEntry().sourceKey,
      toState: COMMISSION_ENTRY_STATES.EARNED,
    });
  });

  it('requires a reason to void pending or earned entries', () => {
    expect(() =>
      buildCommissionEntryTransition(makeEntry(), {
        toState: COMMISSION_ENTRY_STATES.VOID,
      }),
    ).toThrow('Void transition requires a reason.');

    expect(
      buildCommissionEntryTransition(makeEntry(COMMISSION_ENTRY_STATES.EARNED), {
        reason: 'Booking cancelled before entitlement was settled',
        toState: COMMISSION_ENTRY_STATES.VOID,
      }).toState,
    ).toBe(COMMISSION_ENTRY_STATES.VOID);
  });

  it('requires an explicit payout reference for earned -> paid', () => {
    expect(() =>
      buildCommissionEntryTransition(makeEntry(COMMISSION_ENTRY_STATES.EARNED), {
        toState: COMMISSION_ENTRY_STATES.PAID,
      }),
    ).toThrow('Earned-to-paid transition requires a payoutId.');

    expect(
      buildCommissionEntryTransition(makeEntry(COMMISSION_ENTRY_STATES.EARNED), {
        payoutId: 'payout-1',
        toState: COMMISSION_ENTRY_STATES.PAID,
      }),
    ).toMatchObject({
      payoutId: 'payout-1',
      toState: COMMISSION_ENTRY_STATES.PAID,
    });
  });

  it('keeps paid and void entries terminal so later changes require adjustment/reversal flows', () => {
    expect(() =>
      buildCommissionEntryTransition(makeEntry(COMMISSION_ENTRY_STATES.PAID), {
        reason: 'Cancellation after payout',
        toState: COMMISSION_ENTRY_STATES.VOID,
      }),
    ).toThrow('paid commission entries are terminal in the base lifecycle.');

    expect(() =>
      buildCommissionEntryTransition(makeEntry(COMMISSION_ENTRY_STATES.VOID), {
        toState: COMMISSION_ENTRY_STATES.EARNED,
      }),
    ).toThrow('void commission entries are terminal in the base lifecycle.');
  });

  it('rejects direct pending -> paid transitions', () => {
    expect(() =>
      buildCommissionEntryTransition(makeEntry(), {
        payoutId: 'payout-1',
        toState: COMMISSION_ENTRY_STATES.PAID,
      }),
    ).toThrow('Unsupported commission transition: pending -> paid.');
  });
});
