import { describe, expect, it } from 'vitest';

import { ADD_ON_PRICING_TYPES } from './addOnPricing.js';
import {
  ADD_ON_STATUSES,
  compareAddOns,
  decodeAddOnDocument,
  normalizeAddOnDetails,
} from './addOns.js';
import { PRICING_RULE_ROUNDING_MODES } from './pricingRules.js';

function createDetails(overrides = {}) {
  return {
    configuration: { amountIdr: 50_000 },
    description: 'Tambahan layanan',
    displayOrder: 1,
    name: 'Extra microphone',
    pricingType: ADD_ON_PRICING_TYPES.FIXED,
    sessionTypeId: null,
    ...overrides,
  };
}

function createDocument(overrides = {}) {
  return {
    ...createDetails(),
    createdAt: new Date('2026-08-31T01:00:00.000Z'),
    createdByUid: 'owner-1',
    id: 'addon-mic',
    status: ADD_ON_STATUSES.ACTIVE,
    updatedAt: new Date('2026-08-31T02:00:00.000Z'),
    updatedByUid: 'owner-1',
    ...overrides,
  };
}

describe('add-on configuration domain', () => {
  it('normalizes fixed, quantity, and time configurations with calculator-compatible shapes', () => {
    expect(normalizeAddOnDetails(createDetails()).configuration).toEqual({ amountIdr: 50_000 });
    expect(
      normalizeAddOnDetails(
        createDetails({
          configuration: { amountPerUnitIdr: 25_000 },
          pricingType: ADD_ON_PRICING_TYPES.QUANTITY,
          sessionTypeId: 'session-recording',
        }),
      ),
    ).toMatchObject({
      configuration: { amountPerUnitIdr: 25_000 },
      sessionTypeId: 'session-recording',
    });
    expect(
      normalizeAddOnDetails(
        createDetails({
          configuration: {
            amountPerIncrementIdr: 80_000,
            incrementMinutes: 60,
            roundingMode: PRICING_RULE_ROUNDING_MODES.ROUND_UP,
          },
          pricingType: ADD_ON_PRICING_TYPES.TIME,
        }),
      ).configuration,
    ).toEqual({
      amountPerIncrementIdr: 80_000,
      incrementMinutes: 60,
      roundingMode: PRICING_RULE_ROUNDING_MODES.ROUND_UP,
    });
  });

  it('rejects malformed shape, money, scope, duration, and pricing type values', () => {
    expect(() => normalizeAddOnDetails({ ...createDetails(), mystery: true })).toThrow(
      /unsupported document shape/,
    );
    expect(() =>
      normalizeAddOnDetails(createDetails({ configuration: { amountIdr: -1 } })),
    ).toThrow();
    expect(() => normalizeAddOnDetails(createDetails({ sessionTypeId: 'bad/id' }))).toThrow(
      /document id/,
    );
    expect(() =>
      normalizeAddOnDetails(
        createDetails({
          configuration: {
            amountPerIncrementIdr: 10_000,
            incrementMinutes: 10,
            roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT,
          },
          pricingType: ADD_ON_PRICING_TYPES.TIME,
        }),
      ),
    ).toThrow(/incrementMinutes/);
    expect(() => normalizeAddOnDetails(createDetails({ pricingType: 'mystery' }))).toThrow(
      /pricingType/,
    );
  });

  it('decodes persisted metadata and rejects time regression or unknown fields', () => {
    expect(decodeAddOnDocument(createDocument())).toMatchObject({
      id: 'addon-mic',
      name: 'Extra microphone',
      status: ADD_ON_STATUSES.ACTIVE,
    });
    expect(() =>
      decodeAddOnDocument(
        createDocument({
          createdAt: new Date('2026-08-31T03:00:00.000Z'),
          updatedAt: new Date('2026-08-31T02:00:00.000Z'),
        }),
      ),
    ).toThrow(/updatedAt/);
    expect(() => decodeAddOnDocument({ ...createDocument(), deletedAt: null })).toThrow(
      /unsupported document shape/,
    );
  });

  it('sorts by display order, Indonesian name, then immutable id', () => {
    const values = [
      createDocument({ displayOrder: 2, id: 'z', name: 'Zulu' }),
      createDocument({ displayOrder: 1, id: 'b', name: 'Beta' }),
      createDocument({ displayOrder: 1, id: 'a', name: 'Alpha' }),
    ];

    expect(values.sort(compareAddOns).map(({ id }) => id)).toEqual(['a', 'b', 'z']);
  });
});
