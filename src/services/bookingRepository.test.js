import { describe, expect, it, vi } from 'vitest';

import { BOOKING_CONFLICT_QUERY_LIMIT, buildBookingDraft } from '../features/booking/bookings.js';
import {
  BookingConflictQuerySaturationError,
  createBookingRepository,
} from './bookingRepository.js';

function pricingSnapshot() {
  return {
    addOnCalculation: { items: [], totalAddOnAmountIdr: 0 },
    amounts: {
      addOnAmountIdr: 0,
      baseAmountIdr: 300000,
      discountAmountIdr: 0,
      discountableAmountIdr: 300000,
      finalAmountIdr: 300000,
      nonDiscountableAmountIdr: 0,
      subtotalAmountIdr: 300000,
    },
    baseCalculation: { pricingModel: 'hourly', totalAmountIdr: 300000 },
    calculationVersion: 1,
    discountCalculation: { discountAmountIdr: 0 },
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
  };
}

function storedBooking({
  bookingId = 'booking-existing',
  startAt = new Date('2026-09-12T03:00:00.000Z'),
  status = 'confirmed',
  studioId = 'studio-a',
} = {}) {
  const draft = buildBookingDraft({
    bookingId,
    customer: {
      displayPhone: '+6281234567890',
      email: null,
      id: 'customer-001',
      name: 'Raka Studio',
      normalizedPhone: '+6281234567890',
    },
    durationMinutes: 120,
    pricingSnapshot: pricingSnapshot(),
    sessionType: {
      code: 'REHEARSAL',
      id: 'session-rehearsal',
      name: 'Rehearsal',
      requiresStudioReservation: true,
      status: 'active',
    },
    startAt,
    studio: { code: 'ROOM-A', id: studioId, name: 'Studio A', status: 'active' },
  });

  return {
    ...draft,
    createdAt: new Date('2026-09-10T10:00:00.000Z'),
    createdByUid: 'owner-1',
    status,
    updatedAt: new Date('2026-09-10T10:00:00.000Z'),
    updatedByUid: 'owner-1',
  };
}

function queryDocument(id, value) {
  return { data: () => value, id };
}

function createHarness({ documents = [], exactBooking = storedBooking() } = {}) {
  const collectionReference = { path: 'bookings' };
  const adapter = {
    collection: vi.fn(() => collectionReference),
    doc: vi.fn((_collection, bookingId) => ({ id: bookingId, path: `bookings/${bookingId}` })),
    getDoc: vi.fn(async (reference) => ({
      data: () => exactBooking,
      exists: () => exactBooking !== null,
      id: reference.id,
    })),
    getDocs: vi.fn(async () => ({ docs: documents })),
    limit: vi.fn((value) => ({ type: 'limit', value })),
    orderBy: vi.fn((field, direction) => ({ direction, field, type: 'orderBy' })),
    query: vi.fn((...constraints) => ({ constraints })),
    where: vi.fn((field, operator, value) => ({ field, operator, type: 'where', value })),
  };
  const repository = createBookingRepository({ adapter, db: { name: 'firestore' } });
  return { adapter, repository };
}

describe('bookingRepository', () => {
  it('reads one exact booking document and exposes no persistence mutation path yet', async () => {
    const { adapter, repository } = createHarness();

    const booking = await repository.getBooking('booking-existing');

    expect(adapter.getDoc).toHaveBeenCalledWith({
      id: 'booking-existing',
      path: 'bookings/booking-existing',
    });
    expect(booking.id).toBe('booking-existing');
    expect(repository).not.toHaveProperty('createBooking');
    expect(repository).not.toHaveProperty('updateBooking');
    expect(repository).not.toHaveProperty('deleteBooking');
    expect(repository).not.toHaveProperty('listAll');
  });

  it('returns null when an exact booking document is missing', async () => {
    const { repository } = createHarness({ exactBooking: null });
    await expect(repository.getBooking('booking-missing')).resolves.toBeNull();
  });

  it('uses one same-studio startAt range query capped at the safety bound', async () => {
    const existing = storedBooking();
    const { adapter, repository } = createHarness({
      documents: [queryDocument('booking-existing', existing)],
    });

    const conflicts = await repository.findBookingConflicts({
      endAt: new Date('2026-09-12T06:00:00.000Z'),
      startAt: new Date('2026-09-12T04:00:00.000Z'),
      studioId: 'studio-a',
    });

    expect(adapter.where).toHaveBeenCalledWith('studioId', '==', 'studio-a');
    expect(adapter.where).toHaveBeenCalledWith(
      'startAt',
      '<',
      new Date('2026-09-12T06:00:00.000Z'),
    );
    expect(adapter.orderBy).toHaveBeenCalledWith('startAt', 'asc');
    expect(adapter.limit).toHaveBeenCalledWith(BOOKING_CONFLICT_QUERY_LIMIT);
    expect(conflicts.map(({ id }) => id)).toEqual(['booking-existing']);
  });

  it('filters back-to-back, cancelled, and excluded records without hiding true overlaps', async () => {
    const { repository } = createHarness({
      documents: [
        queryDocument('overlap', storedBooking({ bookingId: 'overlap' })),
        queryDocument(
          'back-to-back',
          storedBooking({
            bookingId: 'back-to-back',
            startAt: new Date('2026-09-12T01:00:00.000Z'),
          }),
        ),
        queryDocument('cancelled', storedBooking({ bookingId: 'cancelled', status: 'cancelled' })),
      ],
    });

    const conflicts = await repository.findBookingConflicts({
      endAt: new Date('2026-09-12T06:00:00.000Z'),
      excludeBookingId: 'overlap',
      startAt: new Date('2026-09-12T03:00:00.000Z'),
      studioId: 'studio-a',
    });

    expect(conflicts).toEqual([]);
  });

  it('does not query Firestore for a non-room reservation window', async () => {
    const { adapter, repository } = createHarness();

    await expect(
      repository.findBookingConflicts({
        endAt: new Date('2026-09-12T06:00:00.000Z'),
        startAt: new Date('2026-09-12T04:00:00.000Z'),
        studioId: null,
      }),
    ).resolves.toEqual([]);
    expect(adapter.getDocs).not.toHaveBeenCalled();
  });

  it('fails closed when the conflict candidate query reaches its safety bound', async () => {
    const documents = Array.from({ length: BOOKING_CONFLICT_QUERY_LIMIT }, (_, index) =>
      queryDocument(`booking-${index}`, storedBooking({ bookingId: `booking-${index}` })),
    );
    const { repository } = createHarness({ documents });

    await expect(
      repository.findBookingConflicts({
        endAt: new Date('2026-09-12T06:00:00.000Z'),
        startAt: new Date('2026-09-12T04:00:00.000Z'),
        studioId: 'studio-a',
      }),
    ).rejects.toBeInstanceOf(BookingConflictQuerySaturationError);
  });

  it('rejects malformed conflict windows before querying Firestore', async () => {
    const { adapter, repository } = createHarness();

    await expect(
      repository.findBookingConflicts({
        endAt: new Date('2026-09-12T03:00:00.000Z'),
        startAt: new Date('2026-09-12T04:00:00.000Z'),
        studioId: 'studio-a',
      }),
    ).rejects.toThrow(/later than startAt/);
    await expect(
      repository.findBookingConflicts({
        endAt: new Date('2026-09-12T06:00:00.000Z'),
        startAt: new Date('2026-09-12T04:00:00.000Z'),
        studioId: 'studios/studio-a',
      }),
    ).rejects.toThrow(/document id/);
    expect(adapter.getDocs).not.toHaveBeenCalled();
  });
});
