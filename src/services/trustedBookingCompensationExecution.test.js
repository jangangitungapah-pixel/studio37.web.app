import { describe, expect, it, vi } from 'vitest';

import {
  TRUSTED_BOOKING_COMPENSATION_CAPABILITY,
  TrustedBookingCompensationAuthorizationError,
  TrustedBookingCompensationContextError,
  TrustedBookingCompensationPersistenceError,
  TrustedBookingCompensationProjectionError,
  createTrustedBookingCompensationExecutor,
} from './trustedBookingCompensationExecution.js';

function createHarness(overrides = {}) {
  const authoritativeContext = {
    assignments: [{ operatorId: 'operator-1', operatorType: 'studio_operator' }],
    bookingId: 'booking-1',
    bookingNumber: 'BK-001',
    durationMinutes: 120,
    effectiveAt: new Date('2026-09-06T02:00:00.000Z'),
    percentageBaseAmounts: { booking_total_after_discount: 300000 },
    sessionTypeId: 'session-rehearsal',
    status: 'confirmed',
    studioId: 'studio-a',
  };
  const projection = {
    bookingSnapshot: { diagnostics: [], entries: [], schemaVersion: 1, summary: {} },
    commissionEntryDrafts: [],
    diagnostics: [],
  };

  const authorizeActor = vi.fn().mockResolvedValue(true);
  const loadAuthoritativeBookingContext = vi.fn().mockResolvedValue(authoritativeContext);
  const loadCanonicalCompensationRules = vi.fn().mockResolvedValue([{ id: 'rule-1' }]);
  const projectionBuilder = vi.fn().mockReturnValue(projection);
  const persistBookingCompensation = vi.fn().mockResolvedValue({
    bookingId: 'booking-1',
    createdEntryIds: ['entry-1'],
    existingEntryIds: [],
    initializedBookingSnapshot: true,
  });

  const dependencies = {
    authorizeActor,
    loadAuthoritativeBookingContext,
    loadCanonicalCompensationRules,
    persistBookingCompensation,
    projectionBuilder,
    ...overrides,
  };

  return {
    ...dependencies,
    authoritativeContext,
    executor: createTrustedBookingCompensationExecutor(dependencies),
    projection,
  };
}

describe('trusted booking compensation execution', () => {
  it('authorizes booking.create before loading protected booking context or rules', async () => {
    const harness = createHarness();

    await harness.executor.execute({ actorUid: 'user-1', bookingId: 'booking-1' });

    expect(harness.authorizeActor).toHaveBeenCalledWith({
      actorUid: 'user-1',
      bookingId: 'booking-1',
      capability: TRUSTED_BOOKING_COMPENSATION_CAPABILITY,
    });
    expect(harness.authorizeActor.mock.invocationCallOrder[0]).toBeLessThan(
      harness.loadAuthoritativeBookingContext.mock.invocationCallOrder[0],
    );
    expect(harness.authorizeActor.mock.invocationCallOrder[0]).toBeLessThan(
      harness.loadCanonicalCompensationRules.mock.invocationCallOrder[0],
    );
  });

  it('fails closed before protected reads when the actor is unauthorized', async () => {
    const authorizeActor = vi.fn().mockResolvedValue(false);
    const harness = createHarness({ authorizeActor });

    await expect(
      harness.executor.execute({ actorUid: 'user-1', bookingId: 'booking-1' }),
    ).rejects.toBeInstanceOf(TrustedBookingCompensationAuthorizationError);

    expect(harness.loadAuthoritativeBookingContext).not.toHaveBeenCalled();
    expect(harness.loadCanonicalCompensationRules).not.toHaveBeenCalled();
    expect(harness.persistBookingCompensation).not.toHaveBeenCalled();
  });

  it('builds projection only from authoritative context and protected rules', async () => {
    const harness = createHarness();

    await harness.executor.execute({
      actorUid: 'user-1',
      bookingId: 'booking-1',
      assignments: [{ operatorId: 'attacker', operatorType: 'studio_operator' }],
      durationMinutes: 9999,
      percentageBaseAmounts: { booking_total_after_discount: 999999999 },
      rules: [{ id: 'forged-rule' }],
    });

    expect(harness.projectionBuilder).toHaveBeenCalledWith({
      assignments: harness.authoritativeContext.assignments,
      bookingId: harness.authoritativeContext.bookingId,
      bookingNumber: harness.authoritativeContext.bookingNumber,
      durationMinutes: harness.authoritativeContext.durationMinutes,
      effectiveAt: harness.authoritativeContext.effectiveAt,
      percentageBaseAmounts: harness.authoritativeContext.percentageBaseAmounts,
      rules: [{ id: 'rule-1' }],
      sessionTypeId: harness.authoritativeContext.sessionTypeId,
      studioId: harness.authoritativeContext.studioId,
    });
  });

  it('rejects mismatched or non-confirmed authoritative booking context', async () => {
    const mismatch = createHarness({
      loadAuthoritativeBookingContext: vi.fn().mockResolvedValue({
        ...createHarness().authoritativeContext,
        bookingId: 'booking-other',
      }),
    });

    await expect(
      mismatch.executor.execute({ actorUid: 'user-1', bookingId: 'booking-1' }),
    ).rejects.toBeInstanceOf(TrustedBookingCompensationContextError);

    const nonConfirmed = createHarness({
      loadAuthoritativeBookingContext: vi.fn().mockResolvedValue({
        ...createHarness().authoritativeContext,
        status: 'completed',
      }),
    });

    await expect(
      nonConfirmed.executor.execute({ actorUid: 'user-1', bookingId: 'booking-1' }),
    ).rejects.toBeInstanceOf(TrustedBookingCompensationContextError);
  });

  it('refuses unresolved projection diagnostics before persistence', async () => {
    const projectionBuilder = vi.fn().mockReturnValue({
      bookingSnapshot: { diagnostics: [{ code: 'no_matching_rule' }] },
      commissionEntryDrafts: [],
      diagnostics: [{ code: 'no_matching_rule' }],
    });
    const harness = createHarness({ projectionBuilder });

    await expect(
      harness.executor.execute({ actorUid: 'user-1', bookingId: 'booking-1' }),
    ).rejects.toBeInstanceOf(TrustedBookingCompensationProjectionError);

    expect(harness.persistBookingCompensation).not.toHaveBeenCalled();
  });

  it('passes the internally generated projection and authenticated actor to persistence', async () => {
    const harness = createHarness();

    await harness.executor.execute({ actorUid: 'user-1', bookingId: 'booking-1' });

    expect(harness.persistBookingCompensation).toHaveBeenCalledWith({
      actorUid: 'user-1',
      bookingId: 'booking-1',
      projection: harness.projection,
    });
  });

  it('returns a safe receipt without raw rules, entry ids, source keys, or commission amounts', async () => {
    const harness = createHarness();

    const result = await harness.executor.execute({
      actorUid: 'user-1',
      bookingId: 'booking-1',
    });

    expect(result).toEqual({
      bookingId: 'booking-1',
      createdEntryCount: 1,
      existingEntryCount: 0,
      initializedBookingSnapshot: true,
    });
    expect(JSON.stringify(result)).not.toContain('rule-1');
    expect(JSON.stringify(result)).not.toContain('entry-1');
    expect(JSON.stringify(result)).not.toContain('amount');
  });

  it('preserves idempotent persistence semantics in the safe retry receipt', async () => {
    const persistBookingCompensation = vi.fn().mockResolvedValue({
      bookingId: 'booking-1',
      createdEntryIds: [],
      existingEntryIds: ['entry-1', 'entry-2'],
      initializedBookingSnapshot: false,
    });
    const harness = createHarness({ persistBookingCompensation });

    await expect(
      harness.executor.execute({ actorUid: 'user-1', bookingId: 'booking-1' }),
    ).resolves.toEqual({
      bookingId: 'booking-1',
      createdEntryCount: 0,
      existingEntryCount: 2,
      initializedBookingSnapshot: false,
    });
  });

  it('rejects a persistence receipt for a different booking', async () => {
    const persistBookingCompensation = vi.fn().mockResolvedValue({
      bookingId: 'booking-other',
      createdEntryIds: [],
      existingEntryIds: [],
      initializedBookingSnapshot: true,
    });
    const harness = createHarness({ persistBookingCompensation });

    await expect(
      harness.executor.execute({ actorUid: 'user-1', bookingId: 'booking-1' }),
    ).rejects.toBeInstanceOf(TrustedBookingCompensationPersistenceError);
  });
});
