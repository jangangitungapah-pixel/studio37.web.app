import { describe, expect, it, vi } from 'vitest';

import { CUSTOMER_PHONE_MATCH_LIMIT } from '../features/customers/customers.js';
import { createCustomerRepository } from './customerRepository.js';

function createStoredCustomer(overrides = {}) {
  return {
    createdAt: new Date('2026-09-01T03:00:00.000Z'),
    createdByUid: 'owner-1',
    displayPhone: '+6281234567890',
    email: 'client@example.com',
    name: 'Raka Studio',
    normalizedPhone: '+6281234567890',
    notes: 'Repeat customer',
    updatedAt: new Date('2026-09-02T04:00:00.000Z'),
    updatedByUid: 'owner-1',
    ...overrides,
  };
}

function createDetails(overrides = {}) {
  return {
    displayPhone: '0812-3456-7890',
    email: 'client@example.com',
    name: 'Raka Studio',
    notes: 'Repeat customer',
    ...overrides,
  };
}

function createHarness({ exactCustomer = createStoredCustomer(), phoneDocuments } = {}) {
  const collectionReference = { path: 'customers' };
  const generatedReference = { id: 'generated-customer', path: 'customers/generated-customer' };
  const writeTimestamp = { kind: 'server-timestamp' };
  const adapter = {
    collection: vi.fn(() => collectionReference),
    doc: vi.fn((_collectionReference, customerId) =>
      customerId ? { id: customerId, path: `customers/${customerId}` } : generatedReference,
    ),
    getDoc: vi.fn(async (reference) => ({
      data: () => exactCustomer,
      exists: () => exactCustomer !== null,
      id: reference.id,
    })),
    getDocs: vi.fn(async () => ({
      docs: phoneDocuments ?? [
        { data: () => createStoredCustomer(), id: 'customer-001' },
        { data: () => createStoredCustomer({ name: 'Raka Band' }), id: 'customer-002' },
      ],
    })),
    limit: vi.fn((value) => ({ type: 'limit', value })),
    query: vi.fn((...constraints) => ({ constraints })),
    setDoc: vi.fn(async () => undefined),
    updateDoc: vi.fn(async () => undefined),
    where: vi.fn((field, operator, value) => ({ field, operator, type: 'where', value })),
  };
  const timestampFactory = vi.fn(() => writeTimestamp);
  const repository = createCustomerRepository({
    adapter,
    db: { name: 'firestore' },
    timestampFactory,
  });

  return { adapter, generatedReference, repository, timestampFactory, writeTimestamp };
}

describe('customerRepository', () => {
  it('reads only an exact known customer document when requested', async () => {
    const { adapter, repository } = createHarness();

    const customer = await repository.getCustomer('customer-001');

    expect(adapter.getDoc).toHaveBeenCalledWith({
      id: 'customer-001',
      path: 'customers/customer-001',
    });
    expect(customer.id).toBe('customer-001');
  });

  it('returns null when an exact customer document does not exist', async () => {
    const { repository } = createHarness({ exactCustomer: null });

    await expect(repository.getCustomer('customer-missing')).resolves.toBeNull();
  });

  it('matches repeat customers with one normalized-phone query capped at five results', async () => {
    const { adapter, repository } = createHarness();

    const customers = await repository.findCustomersByPhone('+62 812 3456 7890');

    expect(adapter.where).toHaveBeenCalledWith('normalizedPhone', '==', '+6281234567890');
    expect(adapter.limit).toHaveBeenCalledWith(CUSTOMER_PHONE_MATCH_LIMIT);
    expect(adapter.getDocs).toHaveBeenCalledOnce();
    expect(customers.map(({ id }) => id)).toEqual(['customer-001', 'customer-002']);
    expect(Object.isFrozen(customers)).toBe(true);
    expect(repository).not.toHaveProperty('listAll');
    expect(repository).not.toHaveProperty('deleteCustomer');
  });

  it('creates a canonical customer with an auto id and server metadata', async () => {
    const { adapter, generatedReference, repository, timestampFactory, writeTimestamp } =
      createHarness();

    await expect(
      repository.createCustomer(createDetails({ email: ' CLIENT@Example.COM ' }), {
        actorUid: 'owner-1',
      }),
    ).resolves.toBe('generated-customer');

    expect(timestampFactory).toHaveBeenCalledOnce();
    expect(adapter.setDoc).toHaveBeenCalledWith(generatedReference, {
      displayPhone: '+6281234567890',
      email: 'client@example.com',
      name: 'Raka Studio',
      normalizedPhone: '+6281234567890',
      notes: 'Repeat customer',
      createdAt: writeTimestamp,
      createdByUid: 'owner-1',
      updatedAt: writeTimestamp,
      updatedByUid: 'owner-1',
    });
  });

  it('updates only mutable customer details plus server update metadata', async () => {
    const { adapter, repository, writeTimestamp } = createHarness();

    await expect(
      repository.updateCustomer(
        'customer-001',
        createDetails({ displayPhone: '+62 813 0000 0000', name: 'Raka Baru' }),
        { actorUid: 'owner-1' },
      ),
    ).resolves.toBe('customer-001');

    expect(adapter.updateDoc).toHaveBeenCalledWith(
      { id: 'customer-001', path: 'customers/customer-001' },
      {
        displayPhone: '+6281300000000',
        email: 'client@example.com',
        name: 'Raka Baru',
        normalizedPhone: '+6281300000000',
        notes: 'Repeat customer',
        updatedAt: writeTimestamp,
        updatedByUid: 'owner-1',
      },
    );
    expect(adapter.updateDoc.mock.calls[0][1]).not.toHaveProperty('createdAt');
    expect(adapter.updateDoc.mock.calls[0][1]).not.toHaveProperty('createdByUid');
  });

  it('rejects malformed identifiers and customer data before Firestore writes', async () => {
    const { adapter, repository } = createHarness();

    await expect(repository.getCustomer('customers/customer-001')).rejects.toThrow(/document id/);
    await expect(
      repository.createCustomer(createDetails({ displayPhone: '555-1234' }), {
        actorUid: 'owner-1',
      }),
    ).rejects.toThrow(/Indonesian/);
    await expect(
      repository.updateCustomer('customer-001', createDetails(), { actorUid: 'users/owner-1' }),
    ).rejects.toThrow(/document id/);

    expect(adapter.setDoc).not.toHaveBeenCalled();
    expect(adapter.updateDoc).not.toHaveBeenCalled();
  });

  it('fails closed when stored phone evidence is inconsistent', async () => {
    const { repository } = createHarness({
      phoneDocuments: [
        {
          data: () => createStoredCustomer({ normalizedPhone: '+6289999999999' }),
          id: 'customer-001',
        },
      ],
    });

    await expect(repository.findCustomersByPhone('0812-3456-7890')).rejects.toThrow(/not canonical/);
  });
});
