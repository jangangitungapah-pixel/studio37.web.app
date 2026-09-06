import { describe, expect, it, vi } from 'vitest';

import {
  BookingCompensationClientContractError,
  BookingCompensationClientError,
  createBookingCompensationCallableClient,
} from './bookingCompensationCallableClient.js';

function createSafeReceipt(overrides = {}) {
  return {
    bookingId: 'booking-001',
    createdEntryCount: 2,
    existingEntryCount: 0,
    initializedBookingSnapshot: true,
    ...overrides,
  };
}

describe('booking compensation callable client boundary', () => {
  it('sends only bookingId to the trusted callable', async () => {
    const invokeCallable = vi.fn(async () => ({ data: createSafeReceipt() }));
    const client = createBookingCompensationCallableClient({ invokeCallable });

    await expect(client.initialize({ bookingId: ' booking-001 ' })).resolves.toEqual(
      createSafeReceipt(),
    );

    expect(invokeCallable).toHaveBeenCalledTimes(1);
    expect(invokeCallable).toHaveBeenCalledWith({ bookingId: 'booking-001' });
  });

  it('rejects compensation-shaped caller fields before invoking the backend', async () => {
    const invokeCallable = vi.fn();
    const client = createBookingCompensationCallableClient({ invokeCallable });

    await expect(
      client.initialize({
        bookingId: 'booking-001',
        amountIdr: 900000,
      }),
    ).rejects.toMatchObject({
      code: 'invalid-argument',
      message: 'Booking compensation request must contain only a valid bookingId.',
    });

    expect(invokeCallable).not.toHaveBeenCalled();
  });

  it('normalizes and freezes the safe receipt contract', async () => {
    const client = createBookingCompensationCallableClient({
      invokeCallable: async () => ({ data: createSafeReceipt() }),
    });

    const receipt = await client.initialize({ bookingId: 'booking-001' });

    expect(receipt).toEqual(createSafeReceipt());
    expect(Object.isFrozen(receipt)).toBe(true);
  });

  it('fails closed if protected compensation evidence appears in the response', async () => {
    const client = createBookingCompensationCallableClient({
      invokeCallable: async () => ({
        data: createSafeReceipt({ amountIdr: 250000 }),
      }),
    });

    await expect(client.initialize({ bookingId: 'booking-001' })).rejects.toBeInstanceOf(
      BookingCompensationClientContractError,
    );
    await expect(client.initialize({ bookingId: 'booking-001' })).rejects.toMatchObject({
      code: 'protected-field-exposed',
    });
  });

  it('fails closed on unknown receipt fields or missing safe fields', async () => {
    const unknownFieldClient = createBookingCompensationCallableClient({
      invokeCallable: async () => ({
        data: createSafeReceipt({ serverTraceId: 'trace-001' }),
      }),
    });
    const missingFieldClient = createBookingCompensationCallableClient({
      invokeCallable: async () => ({
        data: {
          bookingId: 'booking-001',
          createdEntryCount: 2,
          existingEntryCount: 0,
        },
      }),
    });

    await expect(unknownFieldClient.initialize({ bookingId: 'booking-001' })).rejects.toMatchObject(
      {
        code: 'unexpected-receipt-shape',
      },
    );
    await expect(missingFieldClient.initialize({ bookingId: 'booking-001' })).rejects.toMatchObject(
      {
        code: 'unexpected-receipt-shape',
      },
    );
  });

  it('rejects mismatched booking IDs and invalid receipt counters', async () => {
    const mismatchedClient = createBookingCompensationCallableClient({
      invokeCallable: async () => ({ data: createSafeReceipt({ bookingId: 'booking-002' }) }),
    });
    const invalidCounterClient = createBookingCompensationCallableClient({
      invokeCallable: async () => ({ data: createSafeReceipt({ createdEntryCount: -1 }) }),
    });

    await expect(mismatchedClient.initialize({ bookingId: 'booking-001' })).rejects.toMatchObject({
      code: 'booking-mismatch',
    });
    await expect(
      invalidCounterClient.initialize({ bookingId: 'booking-001' }),
    ).rejects.toMatchObject({
      code: 'invalid-receipt',
    });
  });

  it('maps callable failures to stable sanitized client errors', async () => {
    const client = createBookingCompensationCallableClient({
      invokeCallable: async () => {
        throw Object.assign(new Error('internal backend details must not leak'), {
          code: 'functions/failed-precondition',
        });
      },
    });

    await expect(client.initialize({ bookingId: 'booking-001' })).rejects.toEqual(
      expect.objectContaining({
        code: 'failed-precondition',
        message: 'Booking compensation is not ready to initialize.',
      }),
    );
  });

  it('maps unknown backend failures to a generic internal error', async () => {
    const client = createBookingCompensationCallableClient({
      invokeCallable: async () => {
        throw new Error('secret diagnostic details');
      },
    });

    await expect(client.initialize({ bookingId: 'booking-001' })).rejects.toBeInstanceOf(
      BookingCompensationClientError,
    );
    await expect(client.initialize({ bookingId: 'booking-001' })).rejects.toMatchObject({
      code: 'internal',
      message: 'Booking compensation initialization failed safely.',
    });
  });

  it('preserves idempotent retry receipt semantics without exposing entry identities', async () => {
    const client = createBookingCompensationCallableClient({
      invokeCallable: async () => ({
        data: createSafeReceipt({
          createdEntryCount: 0,
          existingEntryCount: 2,
          initializedBookingSnapshot: false,
        }),
      }),
    });

    const receipt = await client.initialize({ bookingId: 'booking-001' });

    expect(receipt).toEqual({
      bookingId: 'booking-001',
      createdEntryCount: 0,
      existingEntryCount: 2,
      initializedBookingSnapshot: false,
    });
    expect(receipt).not.toHaveProperty('entryIds');
    expect(receipt).not.toHaveProperty('ruleId');
    expect(receipt).not.toHaveProperty('amountIdr');
  });
});
