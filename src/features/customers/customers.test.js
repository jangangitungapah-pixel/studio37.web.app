import { describe, expect, it } from 'vitest';

import {
  buildCustomerSnapshot,
  customerMatchesPhone,
  decodeCustomerDocument,
  decodeCustomerSnapshot,
  normalizeCustomerDetails,
  normalizeCustomerPhoneMatch,
} from './customers.js';

const CREATED_AT = new Date('2026-09-01T03:00:00.000Z');
const UPDATED_AT = new Date('2026-09-02T04:00:00.000Z');

function createCustomerDocument(overrides = {}) {
  return {
    createdAt: CREATED_AT,
    createdByUid: 'owner-1',
    displayPhone: '0812-3456-7890',
    email: 'client@example.com',
    id: 'customer-001',
    name: 'Raka Studio',
    normalizedPhone: '+6281234567890',
    notes: 'Repeat rehearsal customer',
    updatedAt: UPDATED_AT,
    updatedByUid: 'owner-1',
    ...overrides,
  };
}

describe('customer domain foundation', () => {
  it('normalizes customer details and Indonesian phone variants', () => {
    expect(
      normalizeCustomerDetails({
        displayPhone: ' 0812-3456-7890 ',
        email: ' CLIENT@Example.COM ',
        name: ' Raka Studio ',
        notes: '  Repeat rehearsal customer  ',
      }),
    ).toEqual({
      displayPhone: '0812-3456-7890',
      email: 'client@example.com',
      name: 'Raka Studio',
      normalizedPhone: '+6281234567890',
      notes: 'Repeat rehearsal customer',
    });

    expect(normalizeCustomerPhoneMatch('6281234567890')).toBe('+6281234567890');
    expect(normalizeCustomerPhoneMatch('+62 812 3456 7890')).toBe('+6281234567890');
  });

  it('keeps display phone while deriving one canonical matching value', () => {
    const details = normalizeCustomerDetails({
      displayPhone: '+62 (812) 3456-7890',
      email: null,
      name: 'Raka Studio',
      notes: '',
    });

    expect(details.displayPhone).toBe('+62 (812) 3456-7890');
    expect(details.normalizedPhone).toBe('+6281234567890');
    expect(details.email).toBeNull();
  });

  it('fails closed for unsupported shapes, invalid phones, and invalid email', () => {
    expect(() =>
      normalizeCustomerDetails({
        displayPhone: '0812-3456-7890',
        email: null,
        name: 'Raka Studio',
        notes: '',
        normalizedPhone: '+6281234567890',
      }),
    ).toThrow('unsupported document shape');

    expect(() =>
      normalizeCustomerDetails({
        displayPhone: '555-1234',
        email: null,
        name: 'Raka Studio',
        notes: '',
      }),
    ).toThrow('Indonesian');

    expect(() =>
      normalizeCustomerDetails({
        displayPhone: '0812-3456-7890',
        email: 'not-an-email',
        name: 'Raka Studio',
        notes: '',
      }),
    ).toThrow('valid email');
  });

  it('decodes a canonical customer document and validates normalized phone evidence', () => {
    const customer = decodeCustomerDocument(createCustomerDocument());

    expect(customer.id).toBe('customer-001');
    expect(customer.normalizedPhone).toBe('+6281234567890');
    expect(customer.createdAt.toISOString()).toBe(CREATED_AT.toISOString());
    expect(Object.isFrozen(customer)).toBe(true);

    expect(() =>
      decodeCustomerDocument(createCustomerDocument({ normalizedPhone: '+6289999999999' })),
    ).toThrow('does not match');
  });

  it('rejects customer documents whose update time predates creation', () => {
    expect(() =>
      decodeCustomerDocument(
        createCustomerDocument({ updatedAt: new Date('2026-08-31T23:59:59.000Z') }),
      ),
    ).toThrow('cannot be earlier');
  });

  it('builds a detached minimal booking-time customer snapshot', () => {
    const customer = decodeCustomerDocument(createCustomerDocument());
    const snapshot = buildCustomerSnapshot(customer);

    expect(snapshot).toEqual({
      customerId: 'customer-001',
      displayPhone: '0812-3456-7890',
      email: 'client@example.com',
      name: 'Raka Studio',
      normalizedPhone: '+6281234567890',
    });
    expect(snapshot).not.toHaveProperty('notes');
    expect(snapshot).not.toHaveProperty('createdAt');
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('decodes only the canonical snapshot shape', () => {
    const snapshot = buildCustomerSnapshot(decodeCustomerDocument(createCustomerDocument()));

    expect(decodeCustomerSnapshot(snapshot)).toEqual(snapshot);
    expect(() => decodeCustomerSnapshot({ ...snapshot, notes: 'must not leak' })).toThrow(
      'unsupported document shape',
    );
  });

  it('matches repeat customers using normalized phone rather than display formatting', () => {
    const customer = decodeCustomerDocument(createCustomerDocument());

    expect(customerMatchesPhone(customer, '+62 812 3456 7890')).toBe(true);
    expect(customerMatchesPhone(customer, '0813-0000-0000')).toBe(false);
  });
});
