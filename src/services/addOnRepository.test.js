import { describe, expect, it, vi } from 'vitest';

import { ADD_ON_PRICING_TYPES } from '../features/pricing/addOnPricing.js';
import { ADD_ON_LIST_LIMIT } from '../features/pricing/addOns.js';
import { createAddOnRepository } from './addOnRepository.js';

function createDetails(overrides = {}) {
  return {
    configuration: { amountIdr: 50_000 },
    description: 'Tambahan layanan',
    displayOrder: 1,
    name: 'Extra microphone',
    pricingType: ADD_ON_PRICING_TYPES.FIXED,
    sessionTypeId: null,
    ...overrides,
  };
}

function createStoredAddOn(overrides = {}) {
  return {
    ...createDetails(),
    createdAt: new Date('2026-08-31T01:00:00.000Z'),
    createdByUid: 'owner-1',
    status: 'active',
    updatedAt: new Date('2026-08-31T02:00:00.000Z'),
    updatedByUid: 'owner-1',
    ...overrides,
  };
}

function createHarness({ documents } = {}) {
  const collectionReference = { path: 'addOns' };
  const generatedReference = { id: 'generated-addon', path: 'addOns/generated-addon' };
  const writeTimestamp = { kind: 'server-timestamp' };
  const adapter = {
    collection: vi.fn(() => collectionReference),
    doc: vi.fn((_collectionReference, addOnId) =>
      addOnId ? { id: addOnId, path: `addOns/${addOnId}` } : generatedReference,
    ),
    getDocs: vi.fn(async () => ({
      docs: documents ?? [
        { data: () => createStoredAddOn({ displayOrder: 2, name: 'Engineer' }), id: 'engineer' },
        { data: () => createStoredAddOn(), id: 'microphone' },
      ],
    })),
    limit: vi.fn((value) => ({ type: 'limit', value })),
    orderBy: vi.fn((field, direction) => ({ direction, field, type: 'orderBy' })),
    query: vi.fn((...constraints) => ({ constraints })),
    setDoc: vi.fn(async () => undefined),
    updateDoc: vi.fn(async () => undefined),
  };
  const timestampFactory = vi.fn(() => writeTimestamp);
  const repository = createAddOnRepository({
    adapter,
    db: { name: 'firestore' },
    timestampFactory,
  });
  return { adapter, generatedReference, repository, timestampFactory, writeTimestamp };
}

describe('addOnRepository', () => {
  it('lists add-ons with one display-order query capped at 100 documents', async () => {
    const { adapter, repository } = createHarness();
    const addOns = await repository.listAddOns();

    expect(adapter.collection).toHaveBeenCalledWith({ name: 'firestore' }, 'addOns');
    expect(adapter.orderBy).toHaveBeenCalledWith('displayOrder', 'asc');
    expect(adapter.limit).toHaveBeenCalledWith(ADD_ON_LIST_LIMIT);
    expect(adapter.getDocs).toHaveBeenCalledOnce();
    expect(addOns.map(({ id }) => id)).toEqual(['microphone', 'engineer']);
    expect(repository).not.toHaveProperty('listAll');
    expect(repository).not.toHaveProperty('deleteAddOn');
  });

  it('creates an active add-on with server-owned metadata', async () => {
    const { adapter, generatedReference, repository, timestampFactory, writeTimestamp } =
      createHarness();

    await expect(
      repository.createAddOn(createDetails({ name: '  Extra microphone  ' }), {
        actorUid: 'owner-1',
      }),
    ).resolves.toBe('generated-addon');

    expect(timestampFactory).toHaveBeenCalledOnce();
    expect(adapter.setDoc).toHaveBeenCalledWith(generatedReference, {
      ...createDetails(),
      createdAt: writeTimestamp,
      createdByUid: 'owner-1',
      status: 'active',
      updatedAt: writeTimestamp,
      updatedByUid: 'owner-1',
    });
  });

  it('updates only editable fields plus server update metadata', async () => {
    const { adapter, repository, writeTimestamp } = createHarness();

    await expect(
      repository.updateAddOn('microphone', createDetails({ displayOrder: 3 }), {
        actorUid: 'owner-1',
      }),
    ).resolves.toBe('microphone');

    expect(adapter.updateDoc).toHaveBeenCalledWith(
      { id: 'microphone', path: 'addOns/microphone' },
      {
        ...createDetails({ displayOrder: 3 }),
        updatedAt: writeTimestamp,
        updatedByUid: 'owner-1',
      },
    );
    expect(adapter.updateDoc.mock.calls[0][1]).not.toHaveProperty('createdAt');
    expect(adapter.updateDoc.mock.calls[0][1]).not.toHaveProperty('status');
  });

  it('soft-disables add-ons without exposing hard delete', async () => {
    const { adapter, repository, writeTimestamp } = createHarness();

    await expect(
      repository.setAddOnStatus('microphone', 'disabled', { actorUid: 'owner-1' }),
    ).resolves.toBe('microphone');

    expect(adapter.updateDoc).toHaveBeenCalledWith(
      { id: 'microphone', path: 'addOns/microphone' },
      { status: 'disabled', updatedAt: writeTimestamp, updatedByUid: 'owner-1' },
    );
    expect(repository.deleteAddOn).toBeUndefined();
  });

  it('rejects malformed values and stored documents before returning or writing', async () => {
    const { adapter, repository } = createHarness();

    await expect(
      repository.createAddOn(createDetails({ displayOrder: 0 }), { actorUid: 'owner-1' }),
    ).rejects.toThrow(/displayOrder/);
    await expect(
      repository.updateAddOn('bad/id', createDetails(), { actorUid: 'owner-1' }),
    ).rejects.toThrow(/document id/);
    await expect(
      repository.setAddOnStatus('microphone', 'archived', { actorUid: 'owner-1' }),
    ).rejects.toThrow(/status/);
    expect(adapter.setDoc).not.toHaveBeenCalled();
    expect(adapter.updateDoc).not.toHaveBeenCalled();

    const malformed = createHarness({
      documents: [{ data: () => createStoredAddOn({ deletedAt: null }), id: 'microphone' }],
    });
    await expect(malformed.repository.listAddOns()).rejects.toThrow(/unsupported document shape/);
  });
});
