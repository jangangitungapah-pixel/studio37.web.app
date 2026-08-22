import { describe, expect, it } from 'vitest';

import { normalizeIndonesianPhone } from './indonesianPhone.js';

describe('normalizeIndonesianPhone', () => {
  it.each([
    ['0812-3456-7890', '+6281234567890'],
    ['+62 812 3456 7890', '+6281234567890'],
    ['62 (812) 3456.7890', '+6281234567890'],
    ['81234567890', '+6281234567890'],
    ['+62 0812-3456-7890', '+6281234567890'],
    ['021 555 1234', '+62215551234'],
  ])('normalizes %s to canonical E.164 form', (input, expected) => {
    expect(normalizeIndonesianPhone(input)).toBe(expected);
  });

  it('allows missing optional phone values only when requested', () => {
    expect(normalizeIndonesianPhone(null, { allowNull: true })).toBeNull();
    expect(() => normalizeIndonesianPhone(null)).toThrow(/required/);
    expect(() => normalizeIndonesianPhone('   ')).toThrow(/required/);
  });

  it('rejects ambiguous, foreign, malformed, and invalid-length values', () => {
    expect(() => normalizeIndonesianPhone(81234567890)).toThrow(/text/);
    expect(() => normalizeIndonesianPhone('+1 202 555 0100')).toThrow(/Indonesian/);
    expect(() => normalizeIndonesianPhone('0812-CALL-ME')).toThrow(/unsupported/);
    expect(() => normalizeIndonesianPhone('++62 812 3456 7890')).toThrow(/unsupported/);
    expect(() => normalizeIndonesianPhone('08123')).toThrow(/valid-length/);
    expect(() => normalizeIndonesianPhone(`0${'8'.repeat(14)}`)).toThrow(/valid-length/);
  });
});
