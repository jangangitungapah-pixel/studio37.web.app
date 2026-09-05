import { describe, expect, it, vi } from 'vitest';

import {
  executeTrustedBookingCompensation,
  TrustedBookingCompensationError,
  TRUSTED_COMPENSATION_RULE_LIMIT,
} from './trustedBookingCompensationCore.js';

function makeRule(overrides = {}) {
  return {
    compensationModel: 'per_session',
    configuration: { amountIdr: 50000 },
    effectiveFrom: null,
    effectiveUntil: null,
    id: 'rule-studio-operator',
    name: 'Studio operator per session',
    operatorId: null,
    operatorType: 'studio_operator',
    priority: 100,
    sessionTypeId: null,
    status: 'active',
    studioId: null,
    ...overrides,
  };
}

function makeBooking(overrides = {}) {
  return {
    assignedOperators: [{ operatorId: 'operator-1', operatorType: 'studio_operator' }],
    bookingNumber: 'BK-0001',
    confirmedAt: new Date('2026-09-06T10:00:00.000Z'),
    durationMinutes: 120,
    serviceAmountIdr: 200000,
    sessionTypeId: 'rehearsal',
    status: 'confirmed',
    studioId: 'studio-a',
    subtotalAmountIdr: 200000,
    totalAmountIdr: 180000,
    ...overrides,
  };
}

function makeOwner() {
  return {
    operatorId: null,
    permissionSetId: null,
    role: 'owner',
    status: 'active',
    uid: 'owner-uid',
  };
}

function makeStudioOperator() {
  return {
    operatorId: 'operator-1',
    permissionSetId: 'booking-operator',
    role: 'studio_operator',
    status: 'active',
    uid: 'operator-uid',
  };
}

function makeGateway(overrides = {}) {
  return {
    getBooking: vi.fn(async () => makeBooking()),
    getOperator: vi.fn(async () => ({
      linkedUserUid: 'operator-uid',
      operatorTypes: ['studio_operator'],
      status: 'active',
    })),
    getPermissionSet: vi.fn(async () => ({
      capabilities: ['booking.create'],
      status: 'active',
    })),
    getUser: vi.fn(async (uid) => (uid === 'owner-uid' ? makeOwner() : makeStudioOperator())),
    listActiveCompensationRules: vi.fn(async () => [makeRule()]),
    persistProjection: vi.fn(async () => ({
      createdEntryIds: ['booking-comp-a'],
      existingEntryIds: [],
      initializedBookingSnapshot: true,
    })),
    ...overrides,
  };
}

async function expectTrustedError(promise, code) {
  await expect(promise).rejects.toMatchObject({
    code,
    name: 'TrustedBookingCompensationError',
  });
}

describe('trusted booking compensation execution', () => {
  it('requires authentication before reading protected data', async () => {
    const gateway = makeGateway();
    await expectTrustedError(
      executeTrustedBookingCompensation({ auth: null, data: { bookingId: 'booking-1' } }, { gateway }),
      'unauthenticated',
    );
    expect(gateway.getUser).not.toHaveBeenCalled();
  });

  it('accepts bookingId only and rejects forged financial/rule input', async () => {
    const gateway = makeGateway();
    await expectTrustedError(
      executeTrustedBookingCompensation(
        {
          auth: { uid: 'owner-uid' },
          data: { amountIdr: 1, bookingId: 'booking-1', ruleId: 'attacker-rule' },
        },
        { gateway },
      ),
      'invalid-argument',
    );
    expect(gateway.getUser).not.toHaveBeenCalled();
  });

  it('allows an active Owner and derives the projection from authoritative booking data', async () => {
    const gateway = makeGateway();
    const result = await executeTrustedBookingCompensation(
      { auth: { uid: 'owner-uid' }, data: { bookingId: 'booking-1' } },
      { gateway },
    );

    expect(gateway.persistProjection).toHaveBeenCalledTimes(1);
    const [bookingId, projection, options] = gateway.persistProjection.mock.calls[0];
    expect(bookingId).toBe('booking-1');
    expect(options).toEqual({ actorUid: 'owner-uid' });
    expect(projection.commissionEntryDrafts).toHaveLength(1);
    expect(projection.commissionEntryDrafts[0]).toMatchObject({
      amountIdr: 50000,
      operatorId: 'operator-1',
      ruleId: 'rule-studio-operator',
      state: 'pending',
    });
    expect(result).toEqual({
      bookingId: 'booking-1',
      createdEntryCount: 1,
      existingEntryCount: 0,
      initializedBookingSnapshot: true,
      status: 'initialized',
    });
    expect(JSON.stringify(result)).not.toContain('rule-studio-operator');
    expect(JSON.stringify(result)).not.toContain('amountIdr');
  });

  it('allows a reciprocal active Studio Operator only with booking.create capability', async () => {
    const gateway = makeGateway();
    await expect(
      executeTrustedBookingCompensation(
        { auth: { uid: 'operator-uid' }, data: { bookingId: 'booking-1' } },
        { gateway },
      ),
    ).resolves.toMatchObject({ status: 'initialized' });
    expect(gateway.getPermissionSet).toHaveBeenCalledWith('booking-operator');
    expect(gateway.getOperator).toHaveBeenCalledWith('operator-1');
  });

  it('denies a Studio Operator without booking.create capability', async () => {
    const gateway = makeGateway({
      getPermissionSet: vi.fn(async () => ({ capabilities: ['booking.view'], status: 'active' })),
    });
    await expectTrustedError(
      executeTrustedBookingCompensation(
        { auth: { uid: 'operator-uid' }, data: { bookingId: 'booking-1' } },
        { gateway },
      ),
      'permission-denied',
    );
    expect(gateway.getBooking).not.toHaveBeenCalled();
  });

  it('denies a Studio Operator without a reciprocal active operator link', async () => {
    const gateway = makeGateway({
      getOperator: vi.fn(async () => ({
        linkedUserUid: 'different-user',
        operatorTypes: ['studio_operator'],
        status: 'active',
      })),
    });
    await expectTrustedError(
      executeTrustedBookingCompensation(
        { auth: { uid: 'operator-uid' }, data: { bookingId: 'booking-1' } },
        { gateway },
      ),
      'permission-denied',
    );
    expect(gateway.getBooking).not.toHaveBeenCalled();
  });

  it('requires a confirmed booking and explicit confirmedAt effective instant', async () => {
    const gateway = makeGateway({
      getBooking: vi.fn(async () => makeBooking({ status: 'in_progress' })),
    });
    await expectTrustedError(
      executeTrustedBookingCompensation(
        { auth: { uid: 'owner-uid' }, data: { bookingId: 'booking-1' } },
        { gateway },
      ),
      'failed-precondition',
    );
    expect(gateway.persistProjection).not.toHaveBeenCalled();
  });

  it('fails closed when an assigned operator has no matching rule', async () => {
    const gateway = makeGateway({ listActiveCompensationRules: vi.fn(async () => []) });
    await expectTrustedError(
      executeTrustedBookingCompensation(
        { auth: { uid: 'owner-uid' }, data: { bookingId: 'booking-1' } },
        { gateway },
      ),
      'failed-precondition',
    );
    expect(gateway.persistProjection).not.toHaveBeenCalled();
  });

  it('fails closed on ambiguous authoritative compensation rules', async () => {
    const gateway = makeGateway({
      listActiveCompensationRules: vi.fn(async () => [
        makeRule({ id: 'rule-a' }),
        makeRule({ id: 'rule-b' }),
      ]),
    });
    await expectTrustedError(
      executeTrustedBookingCompensation(
        { auth: { uid: 'owner-uid' }, data: { bookingId: 'booking-1' } },
        { gateway },
      ),
      'failed-precondition',
    );
    expect(gateway.persistProjection).not.toHaveBeenCalled();
  });

  it('fails closed instead of silently truncating more than the active-rule limit', async () => {
    const gateway = makeGateway({
      listActiveCompensationRules: vi.fn(async () =>
        Array.from({ length: TRUSTED_COMPENSATION_RULE_LIMIT + 1 }, (_, index) =>
          makeRule({ id: `rule-${index}` }),
        ),
      ),
    });
    await expectTrustedError(
      executeTrustedBookingCompensation(
        { auth: { uid: 'owner-uid' }, data: { bookingId: 'booking-1' } },
        { gateway },
      ),
      'failed-precondition',
    );
    expect(gateway.persistProjection).not.toHaveBeenCalled();
  });

  it('returns retry-safe counts without exposing historical evidence', async () => {
    const gateway = makeGateway({
      persistProjection: vi.fn(async () => ({
        createdEntryIds: [],
        existingEntryIds: ['booking-comp-a'],
        initializedBookingSnapshot: false,
      })),
    });
    await expect(
      executeTrustedBookingCompensation(
        { auth: { uid: 'owner-uid' }, data: { bookingId: 'booking-1' } },
        { gateway },
      ),
    ).resolves.toEqual({
      bookingId: 'booking-1',
      createdEntryCount: 0,
      existingEntryCount: 1,
      initializedBookingSnapshot: false,
      status: 'initialized',
    });
  });

  it('uses stored percentage bases rather than caller-supplied amounts', async () => {
    const gateway = makeGateway({
      listActiveCompensationRules: vi.fn(async () => [
        makeRule({
          compensationModel: 'percentage',
          configuration: { base: 'booking_total_after_discount', basisPoints: 1000 },
        }),
      ]),
    });
    await executeTrustedBookingCompensation(
      { auth: { uid: 'owner-uid' }, data: { bookingId: 'booking-1' } },
      { gateway },
    );
    const projection = gateway.persistProjection.mock.calls[0][1];
    expect(projection.commissionEntryDrafts[0].amountIdr).toBe(18000);
  });

  it('surfaces typed errors for callers and keeps unexpected types distinct', () => {
    const error = new TrustedBookingCompensationError('internal', 'test');
    expect(error).toMatchObject({ code: 'internal', name: 'TrustedBookingCompensationError' });
  });
});
