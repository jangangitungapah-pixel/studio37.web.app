import { describe, expect, it } from 'vitest';

import { PRICING_RULE_ROUNDING_MODES } from '../pricing/pricingRules.js';
import {
  DURATION_PRESET_MINUTES,
  formatDurationMinutes,
  getBaseAdditionalDurationBehavior,
  getDurationPresetLabel,
  getHourlyDurationBehavior,
  getPackageDurationBehavior,
  getSessionDurationBehavior,
} from './durationSettings.js';

describe('durationSettings', () => {
  it('formats aligned durations into human-readable Indonesian labels', () => {
    expect(formatDurationMinutes(15)).toBe('15 menit');
    expect(formatDurationMinutes(60)).toBe('1 jam');
    expect(formatDurationMinutes(90)).toBe('1 jam 30 menit');
    expect(formatDurationMinutes(360)).toBe('6 jam');
    expect(formatDurationMinutes(181)).toBeNull();
    expect(formatDurationMinutes('bad')).toBeNull();
  });

  it('keeps common quick presets on the canonical 15-minute grid', () => {
    expect(DURATION_PRESET_MINUTES).toEqual([15, 30, 45, 60, 90, 120, 180, 240, 360]);
    expect(DURATION_PRESET_MINUTES.every((minutes) => minutes % 15 === 0)).toBe(true);
    expect(getDurationPresetLabel(90)).toBe('1 jam 30 menit');
  });

  it('explains exact hourly duration behavior including the first valid aligned duration', () => {
    expect(
      getHourlyDurationBehavior({
        incrementMinutes: '60',
        minimumDurationMinutes: '90',
        roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT,
      }),
    ).toEqual({
      firstAlignedDuration: 120,
      text: 'Minimum 1 jam 30 menit. Durasi booking harus pas kelipatan 1 jam; pilihan pertama yang valid 2 jam.',
    });
  });

  it('explains round-up hourly duration behavior without claiming exact alignment', () => {
    expect(
      getHourlyDurationBehavior({
        incrementMinutes: '30',
        minimumDurationMinutes: '60',
        roundingMode: PRICING_RULE_ROUNDING_MODES.ROUND_UP,
      }).text,
    ).toContain('penagihan dibulatkan ke increment berikutnya');
  });

  it('summarizes base/additional, package, and session duration relationships', () => {
    expect(
      getBaseAdditionalDurationBehavior({
        additionalIncrementMinutes: '60',
        baseDurationMinutes: '120',
      }),
    ).toBe('Window dasar 2 jam. Setelah itu waktu tambahan dihitung per 1 jam.');

    expect(
      getPackageDurationBehavior({ durationMinutes: '180', additionalIncrementMinutes: '30' }),
    ).toBe('Durasi package 3 jam. Extra time dihitung per 30 menit.');

    expect(
      getSessionDurationBehavior({ defaultDurationMinutes: '120', minimumDurationMinutes: '60' }),
    ).toBe('Default 2 jam · minimum 1 jam.');
  });

  it('fails closed for malformed or contradictory display inputs', () => {
    expect(
      getHourlyDurationBehavior({
        incrementMinutes: '17',
        minimumDurationMinutes: '60',
        roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT,
      }),
    ).toBeNull();
    expect(
      getSessionDurationBehavior({ defaultDurationMinutes: '60', minimumDurationMinutes: '120' }),
    ).toBeNull();
  });
});
