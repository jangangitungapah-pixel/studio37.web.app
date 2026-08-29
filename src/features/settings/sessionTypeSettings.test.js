import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SESSION_TYPE_FORM_VALUES,
  getNextSessionTypeDisplayOrder,
  toSessionTypeFormValues,
  validateSessionTypeForm,
} from './sessionTypeSettings.js';

function createForm(overrides = {}) {
  return {
    ...DEFAULT_SESSION_TYPE_FORM_VALUES,
    code: 'REHEARSAL',
    description: 'Latihan reguler',
    name: 'Rehearsal',
    ...overrides,
  };
}

describe('session type settings form adapter', () => {
  it('normalizes a reserving session type into canonical domain details', () => {
    const result = validateSessionTypeForm(
      createForm({
        code: ' rehearsal ',
        defaultDurationMinutes: '120',
        displayOrder: '4',
        minimumDurationMinutes: '60',
        name: ' Rehearsal ',
      }),
    );

    expect(result.errors).toEqual({});
    expect(result.value).toEqual({
      code: 'REHEARSAL',
      defaultDurationMinutes: 120,
      description: 'Latihan reguler',
      displayOrder: 4,
      minimumDurationMinutes: 60,
      name: 'Rehearsal',
      requiresStudioReservation: true,
    });
  });

  it('supports a non-reserving session type without duration defaults', () => {
    const result = validateSessionTypeForm(
      createForm({
        defaultDurationMinutes: '',
        minimumDurationMinutes: '',
        requiresStudioReservation: false,
        useDurationConfiguration: false,
      }),
    );

    expect(result.value).toEqual(
      expect.objectContaining({
        defaultDurationMinutes: null,
        minimumDurationMinutes: null,
        requiresStudioReservation: false,
      }),
    );
  });

  it('keeps optional duration defaults for a non-reserving service when enabled', () => {
    const result = validateSessionTypeForm(
      createForm({
        defaultDurationMinutes: '90',
        minimumDurationMinutes: '30',
        requiresStudioReservation: false,
        useDurationConfiguration: true,
      }),
    );

    expect(result.value).toEqual(
      expect.objectContaining({ defaultDurationMinutes: 90, minimumDurationMinutes: 30 }),
    );
  });

  it('rejects invalid codes, display order, and duration relationships without erasing form data', () => {
    const result = validateSessionTypeForm(
      createForm({
        code: 'bad code!',
        defaultDurationMinutes: '60',
        displayOrder: '0',
        minimumDurationMinutes: '75',
      }),
    );

    expect(result.value).toBeNull();
    expect(result.errors).toEqual(
      expect.objectContaining({
        code: true,
        displayOrder: true,
        minimumDurationMinutes: true,
      }),
    );
  });

  it('requires 15-minute duration increments within the configured maximum', () => {
    const result = validateSessionTypeForm(
      createForm({ defaultDurationMinutes: '61', minimumDurationMinutes: '2000' }),
    );

    expect(result.value).toBeNull();
    expect(result.errors.defaultDurationMinutes).toBe(true);
    expect(result.errors.minimumDurationMinutes).toBe(true);
  });

  it('maps persisted session types back to editable form values', () => {
    expect(
      toSessionTypeFormValues({
        code: 'MIXING',
        defaultDurationMinutes: null,
        description: '',
        displayOrder: 7,
        minimumDurationMinutes: null,
        name: 'Mixing',
        requiresStudioReservation: false,
      }),
    ).toEqual({
      code: 'MIXING',
      defaultDurationMinutes: '',
      description: '',
      displayOrder: '7',
      minimumDurationMinutes: '',
      name: 'Mixing',
      requiresStudioReservation: false,
      useDurationConfiguration: false,
    });
  });

  it('selects the next bounded display order deterministically', () => {
    expect(getNextSessionTypeDisplayOrder([])).toBe(1);
    expect(
      getNextSessionTypeDisplayOrder([
        { displayOrder: 3 },
        { displayOrder: 8 },
        { displayOrder: 2 },
      ]),
    ).toBe(9);
    expect(getNextSessionTypeDisplayOrder([{ displayOrder: 999 }])).toBe(999);
  });
});
