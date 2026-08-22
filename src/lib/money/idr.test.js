import { describe, expect, it } from 'vitest';

import { formatIntegerIdr, requireIntegerIdr, sumIntegerIdr } from './idr.js';

describe('integer-IDR utilities', () => {
  it('accepts zero and positive safe integers without changing their value', () => {
    expect(requireIntegerIdr(0)).toBe(0);
    expect(requireIntegerIdr(120000)).toBe(120000);
  });

  it('rejects fractional, unsafe, non-number, and negative amounts by default', () => {
    expect(() => requireIntegerIdr(120000.5)).toThrow(/safe integer/);
    expect(() => requireIntegerIdr(Number.MAX_SAFE_INTEGER + 1)).toThrow(/safe integer/);
    expect(() => requireIntegerIdr('120000')).toThrow(/safe integer/);
    expect(() => requireIntegerIdr(-50000)).toThrow(/must not be negative/);
    expect(() => requireIntegerIdr(0, { allowZero: false })).toThrow(/greater than zero/);
  });

  it('allows signed amounts only when a refund or adjustment flow opts in', () => {
    expect(requireIntegerIdr(-50000, { allowNegative: true })).toBe(-50000);
    expect(sumIntegerIdr([500000, -200000], { allowNegative: true })).toBe(300000);
  });

  it('sums integer IDR exactly and rejects unsafe totals', () => {
    expect(sumIntegerIdr([120000, 120000, 50000])).toBe(290000);
    expect(sumIntegerIdr([])).toBe(0);
    expect(() => sumIntegerIdr('120000')).toThrow(/array/);
    expect(() => sumIntegerIdr([Number.MAX_SAFE_INTEGER, 1])).toThrow(/safe integer IDR range/);
  });

  it('formats IDR without inventing fractional currency values', () => {
    const expected = new Intl.NumberFormat('id-ID', {
      currency: 'IDR',
      currencyDisplay: 'symbol',
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
      style: 'currency',
    }).format(120000);

    expect(formatIntegerIdr(120000)).toBe(expected);
    expect(formatIntegerIdr(120000)).toContain('120.000');
  });
});
