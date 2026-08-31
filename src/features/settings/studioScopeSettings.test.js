import { describe, expect, it } from 'vitest';

import { STUDIO_ROOM_STATUSES } from './studioRooms.js';
import {
  buildStudioScopeOptions,
  formatStudioScopeLabel,
  getStudioScopeFieldDescription,
} from './studioScopeSettings.js';

function createRoom(id, overrides = {}) {
  return {
    code: id.toUpperCase(),
    id,
    name: `Room ${id}`,
    status: STUDIO_ROOM_STATUSES.ACTIVE,
    ...overrides,
  };
}

describe('studioScopeSettings', () => {
  it('builds general plus active studio choices in repository order', () => {
    const options = buildStudioScopeOptions([createRoom('a'), createRoom('b')]);

    expect(options.map(({ value }) => value)).toEqual(['', 'a', 'b']);
    expect(options[0].label).toBe('Semua studio (general)');
    expect(Object.isFrozen(options)).toBe(true);
  });

  it('keeps a disabled current studio visible without allowing it as a fresh choice', () => {
    const options = buildStudioScopeOptions(
      [createRoom('a', { status: STUDIO_ROOM_STATUSES.DISABLED })],
      { currentStudioId: 'a' },
    );

    expect(options[1]).toMatchObject({ disabled: true, value: 'a' });
    expect(options[1].label).toContain('nonaktif');
  });

  it('adds a fail-safe current reference when the studio is outside the loaded set', () => {
    const options = buildStudioScopeOptions([], { currentStudioId: 'studio-legacy' });

    expect(options).toContainEqual(
      expect.objectContaining({
        disabled: true,
        label: 'Studio studio-legacy · tidak tersedia',
        value: 'studio-legacy',
      }),
    );
  });

  it('hides unrelated exact choices when studio visibility is unavailable', () => {
    const options = buildStudioScopeOptions([createRoom('a'), createRoom('b')], {
      currentStudioId: 'a',
      specificSelectionAvailable: false,
    });

    expect(options.map(({ value }) => value)).toEqual(['', 'a']);
  });

  it('formats exact scope with human-readable room context and falls back to the id', () => {
    const rooms = [createRoom('studio-a', { code: 'A', name: 'Studio A' })];

    expect(formatStudioScopeLabel(null, rooms)).toBe('Semua studio');
    expect(formatStudioScopeLabel('studio-a', rooms)).toBe('Studio A · A');
    expect(formatStudioScopeLabel('studio-missing', rooms)).toBe('Studio studio-missing');
  });

  it('explains fail-safe locking when a current exact scope cannot be resolved', () => {
    expect(
      getStudioScopeFieldDescription({ currentStudioId: 'studio-a', state: 'error' }),
    ).toMatch(/dikunci/i);
    expect(getStudioScopeFieldDescription({ state: 'unavailable' })).toMatch(
      /settings\.studio\.view/i,
    );
  });
});
