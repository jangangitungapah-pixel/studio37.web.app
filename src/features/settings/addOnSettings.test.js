import { describe, expect, it } from 'vitest';

import { ADD_ON_PRICING_TYPES } from '../pricing/addOnPricing.js';
import { PRICING_RULE_ROUNDING_MODES } from '../pricing/pricingRules.js';
import {
  DEFAULT_ADD_ON_FORM_VALUES,
  formatAddOnPricingSummary,
  toAddOnFormValues,
  validateAddOnForm,
} from './addOnSettings.js';

function validate(overrides = {}) {
  return validateAddOnForm({
    ...DEFAULT_ADD_ON_FORM_VALUES,
    displayOrder: '1',
    name: 'Extra microphone',
    ...overrides,
  });
}

function createAddOn(overrides = {}) {
  return {
    configuration: { amountIdr: 50_000 },
    description: 'Tambahan microphone',
    displayOrder: 1,
    name: 'Extra microphone',
    pricingType: ADD_ON_PRICING_TYPES.FIXED,
    sessionTypeId: null,
    ...overrides,
  };
}

describe('addOnSettings form adapter', () => {
  it('builds general fixed and exact-session quantity configuration', () => {
    expect(validate({ amountIdr: '50000', pricingType: ADD_ON_PRICING_TYPES.FIXED }).value).toEqual(
      expect.objectContaining({
        configuration: { amountIdr: 50_000 },
        sessionTypeId: null,
      }),
    );

    expect(
      validate({
        amountPerUnitIdr: '25000',
        pricingType: ADD_ON_PRICING_TYPES.QUANTITY,
        sessionTypeId: 'session-recording',
      }).value,
    ).toEqual(
      expect.objectContaining({
        configuration: { amountPerUnitIdr: 25_000 },
        sessionTypeId: 'session-recording',
      }),
    );
  });

  it('builds time configuration with canonical duration and rounding', () => {
    const result = validate({
      amountPerIncrementIdr: '80000',
      incrementMinutes: '60',
      pricingType: ADD_ON_PRICING_TYPES.TIME,
      roundingMode: PRICING_RULE_ROUNDING_MODES.ROUND_UP,
    });

    expect(result.errors).toEqual({});
    expect(result.value.configuration).toEqual({
      amountPerIncrementIdr: 80_000,
      incrementMinutes: 60,
      roundingMode: PRICING_RULE_ROUNDING_MODES.ROUND_UP,
    });
  });

  it('rejects malformed model, money, order, scope, and duration values', () => {
    expect(validate({ pricingType: '' }).errors.pricingType).toBe(true);
    expect(
      validate({ amountIdr: '-1', pricingType: ADD_ON_PRICING_TYPES.FIXED }).errors.amountIdr,
    ).toBe(true);
    expect(
      validate({ amountIdr: '1', displayOrder: '0', pricingType: ADD_ON_PRICING_TYPES.FIXED })
        .errors.displayOrder,
    ).toBe(true);
    expect(
      validate({
        amountIdr: '1',
        pricingType: ADD_ON_PRICING_TYPES.FIXED,
        sessionTypeId: 'bad/id',
      }).errors.sessionTypeId,
    ).toBe(true);
    expect(
      validate({
        amountPerIncrementIdr: '1',
        incrementMinutes: '50',
        pricingType: ADD_ON_PRICING_TYPES.TIME,
      }).errors.incrementMinutes,
    ).toBe(true);
  });

  it('round-trips persisted configuration into editable strings', () => {
    expect(toAddOnFormValues(createAddOn())).toMatchObject({
      amountIdr: '50000',
      displayOrder: '1',
      name: 'Extra microphone',
      pricingType: ADD_ON_PRICING_TYPES.FIXED,
      sessionTypeId: '',
    });

    expect(
      toAddOnFormValues(
        createAddOn({
          configuration: {
            amountPerIncrementIdr: 80_000,
            incrementMinutes: 30,
            roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT,
          },
          pricingType: ADD_ON_PRICING_TYPES.TIME,
          sessionTypeId: 'session-recording',
        }),
      ),
    ).toMatchObject({
      amountPerIncrementIdr: '80000',
      incrementMinutes: '30',
      sessionTypeId: 'session-recording',
    });
  });

  it('formats human-readable fixed, quantity, and time summaries', () => {
    expect(formatAddOnPricingSummary(createAddOn())).toMatch(/50\.000/);
    expect(
      formatAddOnPricingSummary(
        createAddOn({
          configuration: { amountPerUnitIdr: 25_000 },
          pricingType: ADD_ON_PRICING_TYPES.QUANTITY,
        }),
      ),
    ).toMatch(/unit/);
    expect(
      formatAddOnPricingSummary(
        createAddOn({
          configuration: {
            amountPerIncrementIdr: 80_000,
            incrementMinutes: 60,
            roundingMode: PRICING_RULE_ROUNDING_MODES.ROUND_UP,
          },
          pricingType: ADD_ON_PRICING_TYPES.TIME,
        }),
      ),
    ).toMatch(/bulatkan ke atas/);
  });
});
