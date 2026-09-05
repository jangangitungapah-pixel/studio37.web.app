import { describe, expect, it } from 'vitest';

import {
  COMPENSATION_PERCENTAGE_BASES,
  COMPENSATION_RULE_MODELS,
} from './compensationRules.js';
import { calculateCompensation } from './compensationCalculation.js';

describe('calculateCompensation', () => {
  it('calculates whole-hour compensation with checked integer arithmetic', () => {
    expect(
      calculateCompensation({
        compensationModel: COMPENSATION_RULE_MODELS.PER_HOUR,
        configuration: { amountPerHourIdr: 10_000 },
        input: { compensatedHours: 6 },
      }),
    ).toEqual({
      amountIdr: 60_000,
      compensationModel: COMPENSATION_RULE_MODELS.PER_HOUR,
      inputs: { amountPerHourIdr: 10_000, compensatedHours: 6 },
    });
  });

  it('fails closed instead of guessing partial-hour compensation', () => {
    expect(() =>
      calculateCompensation({
        compensationModel: COMPENSATION_RULE_MODELS.PER_HOUR,
        configuration: { amountPerHourIdr: 10_000 },
        input: { compensatedHours: 1.5 },
      }),
    ).toThrow(/safe integer/i);
  });

  it.each([
    [COMPENSATION_RULE_MODELS.PER_SESSION, 50_000],
    [COMPENSATION_RULE_MODELS.FIXED, 40_000],
  ])('calculates %s compensation as one configured amount', (compensationModel, amountIdr) => {
    expect(
      calculateCompensation({
        compensationModel,
        configuration: { amountIdr },
        input: {},
      }),
    ).toEqual({
      amountIdr,
      compensationModel,
      inputs: { configuredAmountIdr: amountIdr },
    });
  });

  it('calculates package compensation only when duration exactly matches', () => {
    expect(
      calculateCompensation({
        compensationModel: COMPENSATION_RULE_MODELS.PACKAGE,
        configuration: { amountIdr: 450_000, durationMinutes: 360 },
        input: { durationMinutes: 360 },
      }),
    ).toEqual({
      amountIdr: 450_000,
      compensationModel: COMPENSATION_RULE_MODELS.PACKAGE,
      inputs: {
        configuredAmountIdr: 450_000,
        configuredDurationMinutes: 360,
        durationMinutes: 360,
      },
    });

    expect(() =>
      calculateCompensation({
        compensationModel: COMPENSATION_RULE_MODELS.PACKAGE,
        configuration: { amountIdr: 450_000, durationMinutes: 360 },
        input: { durationMinutes: 180 },
      }),
    ).toThrow(/exactly match/i);
  });

  it('calculates percentage compensation from the explicitly matching configured base', () => {
    expect(
      calculateCompensation({
        compensationModel: COMPENSATION_RULE_MODELS.PERCENTAGE,
        configuration: {
          base: COMPENSATION_PERCENTAGE_BASES.SERVICE_AMOUNT,
          basisPoints: 1250,
        },
        input: {
          base: COMPENSATION_PERCENTAGE_BASES.SERVICE_AMOUNT,
          baseAmountIdr: 950_000,
        },
      }),
    ).toEqual({
      amountIdr: 118_750,
      compensationModel: COMPENSATION_RULE_MODELS.PERCENTAGE,
      inputs: {
        base: COMPENSATION_PERCENTAGE_BASES.SERVICE_AMOUNT,
        baseAmountIdr: 950_000,
        basisPoints: 1250,
      },
    });
  });

  it('uses deterministic integer floor semantics for percentage fractions', () => {
    expect(
      calculateCompensation({
        compensationModel: COMPENSATION_RULE_MODELS.PERCENTAGE,
        configuration: {
          base: COMPENSATION_PERCENTAGE_BASES.BOOKING_TOTAL_AFTER_DISCOUNT,
          basisPoints: 3333,
        },
        input: {
          base: COMPENSATION_PERCENTAGE_BASES.BOOKING_TOTAL_AFTER_DISCOUNT,
          baseAmountIdr: 101,
        },
      }).amountIdr,
    ).toBe(33);
  });

  it('rejects a percentage input whose base does not match the configured base', () => {
    expect(() =>
      calculateCompensation({
        compensationModel: COMPENSATION_RULE_MODELS.PERCENTAGE,
        configuration: {
          base: COMPENSATION_PERCENTAGE_BASES.SERVICE_AMOUNT,
          basisPoints: 1000,
        },
        input: {
          base: COMPENSATION_PERCENTAGE_BASES.BOOKING_TOTAL_AFTER_DISCOUNT,
          baseAmountIdr: 900_000,
        },
      }),
    ).toThrow(/exactly match/i);
  });

  it('rejects unsupported fields instead of silently ignoring them', () => {
    expect(() =>
      calculateCompensation({
        compensationModel: COMPENSATION_RULE_MODELS.FIXED,
        configuration: { amountIdr: 40_000, unexpected: true },
        input: {},
      }),
    ).toThrow(/unsupported input shape/i);
  });

  it('rejects unsafe arithmetic overflow', () => {
    expect(() =>
      calculateCompensation({
        compensationModel: COMPENSATION_RULE_MODELS.PER_HOUR,
        configuration: { amountPerHourIdr: Number.MAX_SAFE_INTEGER },
        input: { compensatedHours: 2 },
      }),
    ).toThrow(/safe integer IDR range/i);
  });
});
