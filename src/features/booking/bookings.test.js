import { describe, expect, it } from 'vitest';

import {
  BOOKING_PAYMENT_STATUSES,
  BOOKING_STATUSES,
  bookingsOverlap,
  buildBookingDraft,
  buildBookingNumber,
  calculateBookingEndAt,
  canTransitionBookingStatus,
  decodeBookingDocument,
  derivePaymentSummary,
} from './bookings.js';

function customer(overrides = {}) {
  return {
    displayPhone: '+6281234567890',
    email: 'client@example.com',
    id: 'customer-001',
    name: 'Raka Studio',
    normalizedPhone: '+6281234567890',
    ...overrides,
  };
}

function studio(overrides = {}) {
  return { code: 'ROOM-A', id: 'studio-a', name: 'Studio A', status: 'active', ...overrides };
}

function sessionType(overrides = {}) {
  return {
    code: 'REHEARSAL',
    id: 'session-rehearsal',
    name: 'Rehearsal',
    requiresStudioReservation: true,
    status: 'active',
    ...overrides,
  };
}

function pricingSnapshot(overrides = {}) {
  return {
    addOnCalculation: { items: [], totalAddOnAmountIdr: 50000 },
    amounts: {
      addOnAmountIdr: 50000,
      baseAmountIdr: 300000,
      discountAmountIdr: 25000,
      discountableAmountIdr: 350000,
      finalAmountIdr: 325000,
      nonDiscountableAmountIdr: 0,
      subtotalAmountIdr: 350000,
    },
    baseCalculation: { pricingModel: 'hourly', totalAmountIdr: 300000 },
    calculationVersion: 1,
    discountCalculation: { discountAmountIdr: 25000 },
    pricingTimeIso: '2026-09-10T10:00:00.000Z',
    rule: {
      configuration: { amountPerIncrementIdr: 150000, incrementMinutes: 60 },
      effectiveFromIso: null,
      effectiveUntilIso: null,
      id: 'pricing-rule-1',
      name: 'Rehearsal general',
      pricingModel: 'hourly',
      priority: 10,
      sessionTypeId: 'session-rehearsal',
      sourceUpdatedAtIso: '2026-09-01T00:00:00.000Z',
      sourceUpdatedByUid: 'owner-1',
      studioId: null,
    },
    snapshotVersion: 1,
    ...overrides,
  };
}

function draft(overrides = {}) {
  return buildBookingDraft({
    assignedOperatorIds: ['operator-1', 'operator-2'],
    bookingId: 'booking-001',
    customer: customer(),
    durationMinutes: 120,
    notes: 'Bring own cymbals',
    pricingSnapshot: pricingSnapshot(),
    sessionType: sessionType(),
    startAt: new Date('2026-09-12T03:00:00.000Z'),
    studio: studio(),
    ...overrides,
  });
}

function storedBooking(overrides = {}) {
  return {
    ...draft(),
    createdAt: new Date('2026-09-10T10:00:00.000Z'),
    createdByUid: 'owner-1',
    id: 'booking-001',
    updatedAt: new Date('2026-09-10T10:00:00.000Z'),
    updatedByUid: 'owner-1',
    ...overrides,
  };
}

describe('booking domain', () => {
  it('builds a stable booking number and canonical end time', () => {
    expect(buildBookingNumber('booking-001')).toBe('ST37-booking-001');
    expect(
      calculateBookingEndAt(new Date('2026-09-12T03:30:00.000Z'), 150).toISOString(),
    ).toBe('2026-09-12T06:00:00.000Z');
    expect(() => buildBookingNumber('bookings/booking-001')).toThrow(/document id/);
    expect(() => calculateBookingEndAt(new Date('2026-09-12T03:30:00.000Z'), 70)).toThrow(
      /15-minute/,
    );
  });

  it('blocks only real same-room interval intersections', () => {
    const base = {
      endAt: new Date('2026-09-12T06:00:00.000Z'),
      startAt: new Date('2026-09-12T03:00:00.000Z'),
      status: BOOKING_STATUSES.CONFIRMED,
      studioId: 'studio-a',
    };

    expect(bookingsOverlap(base, { ...base, startAt: new Date('2026-09-12T05:59:00.000Z') })).toBe(
      true,
    );
    expect(
      bookingsOverlap(base, {
        ...base,
        endAt: new Date('2026-09-12T07:00:00.000Z'),
        startAt: new Date('2026-09-12T06:00:00.000Z'),
      }),
    ).toBe(false);
    expect(bookingsOverlap(base, { ...base, studioId: 'studio-b' })).toBe(false);
    expect(bookingsOverlap(base, { ...base, status: BOOKING_STATUSES.CANCELLED })).toBe(false);
  });

  it('keeps payment state separate and derived from integer-IDR totals', () => {
    expect(derivePaymentSummary(600000, 0).paymentStatus).toBe(BOOKING_PAYMENT_STATUSES.PENDING);
    expect(derivePaymentSummary(600000, 200000).paymentStatus).toBe(BOOKING_PAYMENT_STATUSES.DP);
    expect(derivePaymentSummary(600000, 600000).paymentStatus).toBe(BOOKING_PAYMENT_STATUSES.LUNAS);
    expect(() => derivePaymentSummary(600000, 600001)).toThrow(/cannot exceed/);
  });

  it('builds an immutable confirmed draft from canonical snapshots', () => {
    const value = draft();
    expect(value).toMatchObject({
      balanceAmountIdr: 325000,
      bookingNumber: 'ST37-booking-001',
      customerId: 'customer-001',
      durationMinutes: 120,
      paymentStatus: BOOKING_PAYMENT_STATUSES.PENDING,
      sessionTypeId: 'session-rehearsal',
      status: BOOKING_STATUSES.CONFIRMED,
      studioId: 'studio-a',
      totalAmountIdr: 325000,
    });
    expect(value.endAt.toISOString()).toBe('2026-09-12T05:00:00.000Z');
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.pricingSnapshot.rule.configuration)).toBe(true);
  });

  it('rejects disabled resources and mismatched pricing scope', () => {
    expect(() => draft({ studio: studio({ status: 'disabled' }) })).toThrow(/active studio/);
    expect(() => draft({ sessionType: sessionType({ status: 'disabled' }) })).toThrow(
      /active session type/,
    );
    expect(() =>
      draft({
        pricingSnapshot: pricingSnapshot({
          rule: { ...pricingSnapshot().rule, sessionTypeId: 'session-recording' },
        }),
      }),
    ).toThrow(/session type does not match/);
    expect(() =>
      draft({
        pricingSnapshot: pricingSnapshot({
          rule: { ...pricingSnapshot().rule, studioId: 'studio-b' },
        }),
      }),
    ).toThrow(/studio scope does not match/);
  });

  it('allows non-reserving sessions to omit a studio', () => {
    const value = draft({
      sessionType: sessionType({ requiresStudioReservation: false }),
      studio: null,
    });
    expect(value.studioId).toBeNull();
    expect(value.studioSnapshot).toBeNull();
  });

  it('enforces the supported booking lifecycle', () => {
    expect(canTransitionBookingStatus('confirmed', 'in_progress')).toBe(true);
    expect(canTransitionBookingStatus('confirmed', 'cancelled')).toBe(true);
    expect(canTransitionBookingStatus('in_progress', 'completed')).toBe(true);
    expect(canTransitionBookingStatus('completed', 'confirmed')).toBe(false);
    expect(canTransitionBookingStatus('cancelled', 'confirmed')).toBe(false);
  });

  it('decodes canonical persistence and rejects derived-field drift', () => {
    expect(decodeBookingDocument(storedBooking()).totalAmountIdr).toBe(325000);
    expect(() =>
      decodeBookingDocument(storedBooking({ endAt: new Date('2026-09-12T06:00:00.000Z') })),
    ).toThrow(/endAt does not match/);
    expect(() => decodeBookingDocument(storedBooking({ totalAmountIdr: 999999 }))).toThrow(
      /pricing amounts do not match/,
    );
  });
});
