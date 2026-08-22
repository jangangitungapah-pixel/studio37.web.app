import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_STUDIO_TIME_ZONE,
  formatDateTimeInTimeZone,
  getDateTimePartsInTimeZone,
  toFirestoreTimestamp,
  toIsoDateTime,
  toJavaScriptDate,
} from './timestamps.js';

describe('timestamp and timezone utilities', () => {
  const instant = new Date('2026-08-22T07:05:09.000Z');

  it('normalizes Date and Firestore Timestamp values as cloned Date objects', () => {
    const fromDate = toJavaScriptDate(instant);
    const fromTimestamp = toJavaScriptDate(Timestamp.fromDate(instant));

    expect(fromDate).toEqual(instant);
    expect(fromDate).not.toBe(instant);
    expect(fromTimestamp).toEqual(instant);
  });

  it('keeps an exact instant stable across Firestore and ISO conversions', () => {
    const timestamp = toFirestoreTimestamp(instant);

    expect(timestamp).toBeInstanceOf(Timestamp);
    expect(timestamp.toMillis()).toBe(instant.getTime());
    expect(toIsoDateTime(timestamp)).toBe('2026-08-22T07:05:09.000Z');
  });

  it('uses the configured IANA timezone without changing the stored instant', () => {
    expect(DEFAULT_STUDIO_TIME_ZONE).toBe('Asia/Jakarta');
    expect(getDateTimePartsInTimeZone(instant)).toEqual({
      day: 22,
      hour: 14,
      minute: 5,
      month: 8,
      second: 9,
      year: 2026,
    });

    const expectedLabel = new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Jakarta',
    }).format(instant);

    expect(formatDateTimeInTimeZone(instant)).toBe(expectedLabel);
  });

  it('requires null handling and invalid values to be explicit', () => {
    expect(() => toJavaScriptDate(null)).toThrow(/required/);
    expect(toJavaScriptDate(null, { allowNull: true })).toBeNull();
    expect(toFirestoreTimestamp(undefined, { allowNull: true })).toBeNull();
    expect(toIsoDateTime(null, { allowNull: true })).toBeNull();
    expect(() => toJavaScriptDate('2026-08-22')).toThrow(/Date or Firestore Timestamp/);
    expect(() => toJavaScriptDate(new Date('invalid'))).toThrow(/valid Date/);
  });

  it('rejects invalid IANA timezone identifiers', () => {
    expect(() =>
      getDateTimePartsInTimeZone(instant, { timeZone: 'Studio37/Invalid' }),
    ).toThrow(RangeError);
  });
});
