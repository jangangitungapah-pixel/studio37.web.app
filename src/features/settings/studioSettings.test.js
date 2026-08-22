import { describe, expect, it } from 'vitest';

import {
  decodeStudioSettingsDocument,
  DEFAULT_STUDIO_SETTINGS_FORM_VALUES,
  formatMinutesAsClockTime,
  normalizeStudioSettings,
  parseClockTimeToMinutes,
  STUDIO_SETTINGS_DOCUMENT_ID,
  toStudioSettingsFormValues,
  validateStudioSettingsForm,
} from './studioSettings.js';

function createSettings(overrides = {}) {
  return {
    bookingIntervalMinutes: 30,
    businessName: 'Studio37',
    operatingHours: {
      closesAtMinutes: 22 * 60,
      opensAtMinutes: 10 * 60,
    },
    timeZone: 'Asia/Jakarta',
    ...overrides,
  };
}

describe('studio settings domain contract', () => {
  it('normalizes the supported profile and booking defaults without mutating input', () => {
    const source = createSettings({ businessName: ' 37 Music Studio ' });
    const normalized = normalizeStudioSettings(source);

    expect(normalized).toEqual({
      bookingIntervalMinutes: 30,
      businessName: '37 Music Studio',
      operatingHours: {
        closesAtMinutes: 1320,
        opensAtMinutes: 600,
      },
      timeZone: 'Asia/Jakarta',
    });
    expect(normalized).not.toBe(source);
    expect(normalized.operatingHours).not.toBe(source.operatingHours);
  });

  it('rejects unsupported timezones, intervals, and misaligned operating hours', () => {
    expect(() => normalizeStudioSettings(createSettings({ timeZone: 'Studio37/Local' }))).toThrow(
      /timeZone is not supported/,
    );
    expect(() => normalizeStudioSettings(createSettings({ bookingIntervalMinutes: 45 }))).toThrow(
      /bookingIntervalMinutes is not supported/,
    );
    expect(() =>
      normalizeStudioSettings(
        createSettings({
          operatingHours: { closesAtMinutes: 600, opensAtMinutes: 1320 },
        }),
      ),
    ).toThrow(/later than opening/);
    expect(() =>
      normalizeStudioSettings(
        createSettings({
          operatingHours: { closesAtMinutes: 1315, opensAtMinutes: 600 },
        }),
      ),
    ).toThrow(/align with the booking interval/);
  });

  it('converts strict HH:mm values and validates form input', () => {
    expect(parseClockTimeToMinutes('10:30')).toBe(630);
    expect(formatMinutesAsClockTime(1320)).toBe('22:00');
    expect(() => parseClockTimeToMinutes('24:00')).toThrow(/HH:mm/);

    const valid = validateStudioSettingsForm({
      ...DEFAULT_STUDIO_SETTINGS_FORM_VALUES,
      businessName: '37 Music Studio',
    });
    const invalid = validateStudioSettingsForm({
      ...DEFAULT_STUDIO_SETTINGS_FORM_VALUES,
      bookingIntervalMinutes: '60',
      closesAt: '10:00',
      opensAt: '22:00',
    });

    expect(valid.errors).toEqual({});
    expect(valid.value).toEqual(createSettings({ businessName: '37 Music Studio' }));
    expect(invalid.value).toBeNull();
    expect(invalid.errors).toHaveProperty('closesAt');
  });

  it('decodes the exact Firestore document contract and clones timestamps', () => {
    const createdAt = new Date('2026-08-22T01:00:00.000Z');
    const updatedAt = new Date('2026-08-22T02:00:00.000Z');
    const decoded = decodeStudioSettingsDocument({
      ...createSettings(),
      createdAt,
      createdByUid: 'owner-1',
      id: STUDIO_SETTINGS_DOCUMENT_ID,
      updatedAt,
      updatedByUid: 'owner-1',
    });

    expect(decoded.createdAt).toEqual(createdAt);
    expect(decoded.createdAt).not.toBe(createdAt);
    expect(decoded.updatedAt).toEqual(updatedAt);
    expect(toStudioSettingsFormValues(decoded)).toEqual(DEFAULT_STUDIO_SETTINGS_FORM_VALUES);
  });

  it('fails closed for unknown fields, wrong ids, or non-monotonic timestamps', () => {
    const document = {
      ...createSettings(),
      createdAt: new Date('2026-08-22T02:00:00.000Z'),
      createdByUid: 'owner-1',
      id: STUDIO_SETTINGS_DOCUMENT_ID,
      updatedAt: new Date('2026-08-22T01:00:00.000Z'),
      updatedByUid: 'owner-1',
    };

    expect(() => decodeStudioSettingsDocument({ ...document, unexpected: true })).toThrow(
      /unsupported document shape/,
    );
    expect(() => decodeStudioSettingsDocument({ ...document, id: 'other' })).toThrow(/document id/);
    expect(() => decodeStudioSettingsDocument(document)).toThrow(/earlier than createdAt/);
  });
});
