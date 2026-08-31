import {
  PRICING_RULE_DURATION_STEP_MINUTES,
  PRICING_RULE_MAX_DURATION_MINUTES,
  PRICING_RULE_ROUNDING_MODES,
} from '../pricing/pricingRules.js';

export const DURATION_PRESET_MINUTES = Object.freeze([15, 30, 45, 60, 90, 120, 180, 240, 360]);

function toAlignedDuration(value) {
  const normalized = String(value ?? '').trim();
  if (!/^\d+$/.test(normalized)) return null;

  const minutes = Number(normalized);
  if (
    !Number.isSafeInteger(minutes) ||
    minutes < PRICING_RULE_DURATION_STEP_MINUTES ||
    minutes > PRICING_RULE_MAX_DURATION_MINUTES ||
    minutes % PRICING_RULE_DURATION_STEP_MINUTES !== 0
  ) {
    return null;
  }

  return minutes;
}

export function formatDurationMinutes(value) {
  const minutes = toAlignedDuration(value);
  if (minutes === null) return null;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const parts = [];

  if (hours > 0) parts.push(`${hours} jam`);
  if (remainingMinutes > 0) parts.push(`${remainingMinutes} menit`);

  return parts.join(' ');
}

export function getDurationPresetLabel(minutes) {
  return formatDurationMinutes(minutes) ?? `${minutes} menit`;
}

export function getHourlyDurationBehavior({ incrementMinutes, minimumDurationMinutes, roundingMode }) {
  const increment = toAlignedDuration(incrementMinutes);
  const minimum = toAlignedDuration(minimumDurationMinutes);

  if (increment === null || minimum === null) return null;

  if (roundingMode === PRICING_RULE_ROUNDING_MODES.EXACT) {
    const firstAlignedDuration = Math.ceil(minimum / increment) * increment;
    if (firstAlignedDuration > PRICING_RULE_MAX_DURATION_MINUTES) return null;

    return Object.freeze({
      firstAlignedDuration,
      text: `Minimum ${formatDurationMinutes(minimum)}. Durasi booking harus pas kelipatan ${formatDurationMinutes(increment)}; pilihan pertama yang valid ${formatDurationMinutes(firstAlignedDuration)}.`,
    });
  }

  if (roundingMode === PRICING_RULE_ROUNDING_MODES.ROUND_UP) {
    return Object.freeze({
      firstAlignedDuration: minimum,
      text: `Minimum ${formatDurationMinutes(minimum)}. Durasi di luar kelipatan ${formatDurationMinutes(increment)} tetap boleh dan penagihan dibulatkan ke increment berikutnya.`,
    });
  }

  return null;
}

export function getBaseAdditionalDurationBehavior({ baseDurationMinutes, additionalIncrementMinutes }) {
  const baseDuration = toAlignedDuration(baseDurationMinutes);
  const additionalIncrement = toAlignedDuration(additionalIncrementMinutes);
  if (baseDuration === null || additionalIncrement === null) return null;

  return `Window dasar ${formatDurationMinutes(baseDuration)}. Setelah itu waktu tambahan dihitung per ${formatDurationMinutes(additionalIncrement)}.`;
}

export function getPackageDurationBehavior({ durationMinutes, additionalIncrementMinutes = null }) {
  const duration = toAlignedDuration(durationMinutes);
  if (duration === null) return null;

  if (additionalIncrementMinutes === null || additionalIncrementMinutes === '') {
    return `Durasi package ${formatDurationMinutes(duration)}.`;
  }

  const additionalIncrement = toAlignedDuration(additionalIncrementMinutes);
  if (additionalIncrement === null) return null;

  return `Durasi package ${formatDurationMinutes(duration)}. Extra time dihitung per ${formatDurationMinutes(additionalIncrement)}.`;
}

export function getSessionDurationBehavior({ defaultDurationMinutes, minimumDurationMinutes }) {
  const defaultDuration = toAlignedDuration(defaultDurationMinutes);
  const minimumDuration = toAlignedDuration(minimumDurationMinutes);
  if (defaultDuration === null || minimumDuration === null || minimumDuration > defaultDuration) {
    return null;
  }

  return `Default ${formatDurationMinutes(defaultDuration)} · minimum ${formatDurationMinutes(minimumDuration)}.`;
}
