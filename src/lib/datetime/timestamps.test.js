import { Timestamp } from 'firebase/firestore';
import { describe, expect, it } from 'vitest';

import * as time from './timestamps.js';

describe('timestamp and timezone utilities', () => {
  const instant = new Date('2026-08-22T07:05:09.000Z');

  it('normalizes timestamp values as cloned Date objects', () => {
    const fromDate = time.toJavaScriptDate(instant);
    const timestamp = Timestamp.fromDate(instant);
    const fromTimestamp = time.toJavaScriptDate(timestamp);

    expect(fromDate).toEqual(instant);
    expect(fromDate).not.toBe(instant);
    expect(fromTimestamp).toEqual(instant);
  });

  it('keeps the exact instant stable across conversions', () => {
    const timestamp = time.toFirestoreTimestamp(instant);

    expect(timestamp).toBeInstanceOf(Timestamp);
    expect(timestamp.toMillis()).toBe(instant.getTime());
    expect(time.toIsoDateTime(timestamp)).toBe('2026-08-22T07:05:09.000Z');
  });

  it('uses the configured IANA timezone', () => {
    const parts = time.getDateTimePartsInTimeZone(instant);
    const formatter = new Intl.DateTimeFormat('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Jakarta',
    });

    expect(time.DEFAULT_STUDIO_TIME_ZONE).toBe('Asia/Jakarta');
    expect(parts).toEqual({
      day: 22,
      hour: 14,
      minute: 5,
      month: 8,
      second: 9,
      year: 2026,
    });
    expect(time.formatDateTimeInTimeZone(instant)).toBe(formatter.format(instant));
  });

  it('requires null and invalid-value handling to be explicit', () => {
    expect(() => time.toJavaScriptDate(null)).toThrow(/required/);
    expect(time.toJavaScriptDate(null, { allowNull: true })).toBeNull();
    expect(time.toFirestoreTimestamp(undefined, { allowNull: true })).toBeNull();
    expect(time.toIsoDateTime(null, { allowNull: true })).toBeNull();
    expect(() => time.toJavaScriptDate('2026-08-22')).toThrow(/Date or Firestore Timestamp/);
    expect(() => time.toJavaScriptDate(new Date('invalid'))).toThrow(/valid Date/);
  });

  it('rejects invalid IANA timezone identifiers', () => {
    const useInvalidTimeZone = () => {
      time.getDateTimePartsInTimeZone(instant, { timeZone: 'Studio37/Invalid' });
    };

    expect(useInvalidTimeZone).toThrow(RangeError);
  });
});
