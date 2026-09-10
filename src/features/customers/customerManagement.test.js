import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CUSTOMER_FORM_VALUES,
  excludeCurrentCustomer,
  filterCustomerDirectory,
  formatCustomerPhone,
  mergeCustomerResults,
  toCustomerFormValues,
  tryNormalizeExactCustomerPhone,
  validateCustomerForm,
} from './customerManagement.js';

function customer(overrides = {}) {
  return {
    displayPhone: '+6281234567890',
    email: 'raka@example.com',
    id: 'customer-raka',
    name: 'Raka Studio',
    normalizedPhone: '+6281234567890',
    notes: 'Repeat rehearsal customer',
    ...overrides,
  };
}

describe('customer management view model', () => {
  it('keeps a stable empty form contract', () => {
    expect(DEFAULT_CUSTOMER_FORM_VALUES).toEqual({
      displayPhone: '',
      email: '',
      name: '',
      notes: '',
    });
    expect(Object.isFrozen(DEFAULT_CUSTOMER_FORM_VALUES)).toBe(true);
  });

  it('formats canonical phone evidence for presentation only', () => {
    expect(formatCustomerPhone('+6281234567890')).toBe('+62 812-3456-7890');
    expect(toCustomerFormValues(customer()).displayPhone).toBe('+62 812-3456-7890');
  });

  it('validates and normalizes customer form values before persistence', () => {
    const result = validateCustomerForm({
      displayPhone: '0812 3456 7890',
      email: ' RAKA@Example.COM ',
      name: ' Raka Studio ',
      notes: ' Repeat customer ',
    });

    expect(result.errors).toEqual({});
    expect(result.normalized).toEqual({
      displayPhone: '+6281234567890',
      email: 'raka@example.com',
      name: 'Raka Studio',
      normalizedPhone: '+6281234567890',
      notes: 'Repeat customer',
    });
  });

  it('returns field-specific validation errors without producing normalized data', () => {
    const result = validateCustomerForm({
      displayPhone: '555',
      email: 'not-email',
      name: '',
      notes: 'x'.repeat(2001),
    });

    expect(result.normalized).toBeNull();
    expect(Object.keys(result.errors).sort()).toEqual(['displayPhone', 'email', 'name', 'notes']);
  });

  it('filters the bounded directory by name, email, and practical phone fragments', () => {
    const customers = [
      customer(),
      customer({
        displayPhone: '+6281311112222',
        email: 'sinta@example.com',
        id: 'customer-sinta',
        name: 'Sinta Band',
        normalizedPhone: '+6281311112222',
      }),
    ];

    expect(filterCustomerDirectory(customers, 'sinta').map(({ id }) => id)).toEqual([
      'customer-sinta',
    ]);
    expect(filterCustomerDirectory(customers, 'raka@example').map(({ id }) => id)).toEqual([
      'customer-raka',
    ]);
    expect(filterCustomerDirectory(customers, '0813').map(({ id }) => id)).toEqual([
      'customer-sinta',
    ]);
  });

  it('recognizes only complete valid Indonesian phone searches for exact lookup', () => {
    expect(tryNormalizeExactCustomerPhone('0812 3456 7890')).toBe('+6281234567890');
    expect(tryNormalizeExactCustomerPhone('0812')).toBeNull();
    expect(tryNormalizeExactCustomerPhone('raka')).toBeNull();
  });

  it('merges exact-phone results without duplicates and excludes the current edit target', () => {
    const raka = customer();
    const sinta = customer({ id: 'customer-sinta', name: 'Sinta Band' });

    expect(mergeCustomerResults([raka], [raka, sinta]).map(({ id }) => id)).toEqual([
      'customer-raka',
      'customer-sinta',
    ]);
    expect(excludeCurrentCustomer([raka, sinta], 'customer-raka').map(({ id }) => id)).toEqual([
      'customer-sinta',
    ]);
  });
});
