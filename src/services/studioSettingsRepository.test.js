import { describe, expect, it, vi } from 'vitest';

import { createStudioSettingsRepository } from './studioSettingsRepository.js';

function createStoredSettings() {
  return {
    bookingIntervalMinutes: 30,
    businessName: 'Studio37',
    createdAt: new Date('2026-08-22T01:00:00.000Z'),
    createdByUid: 'owner-1',
    operatingHours: { closesAtMinutes: 1320, opensAtMinutes: 600 },
    timeZone: 'Asia/Jakarta',
    updatedAt: new Date('2026-08-22T02:00:00.000Z'),
    updatedByUid: 'owner-1',
  };
}

function createHarness({ exists = true } = {}) {
  const writeTimestamp = { kind: 'server-timestamp' };
  const reference = { path: 'appSettings/studio' };
  const adapter = {
    doc: vi.fn(() => reference),
    getDoc: vi.fn(async () => ({
      data: () => createStoredSettings(),
      exists: () => exists,
      id: 'studio',
    })),
    setDoc: vi.fn(async () => undefined),
    updateDoc: vi.fn(async () => undefined),
  };
  const timestampFactory = vi.fn(() => writeTimestamp);
  const repository = createStudioSettingsRepository({
    adapter,
    db: { name: 'firestore' },
    timestampFactory,
  });

  return { adapter, reference, repository, timestampFactory, writeTimestamp };
}

function createDraft(overrides = {}) {
  return {
    bookingIntervalMinutes: 30,
    businessName: 'Studio37',
    operatingHours: { closesAtMinutes: 1320, opensAtMinutes: 600 },
    timeZone: 'Asia/Jakarta',
    ...overrides,
  };
}

describe('studioSettingsRepository', () => {
  it('reads only the exact appSettings/studio document and decodes timestamps', async () => {
    const { adapter, repository } = createHarness();

    const settings = await repository.getStudioSettings();

    expect(adapter.doc).toHaveBeenCalledWith({ name: 'firestore' }, 'appSettings', 'studio');
    expect(adapter.getDoc).toHaveBeenCalledOnce();
    expect(settings).toEqual(
      expect.objectContaining({
        businessName: 'Studio37',
        createdAt: new Date('2026-08-22T01:00:00.000Z'),
        id: 'studio',
      }),
    );
    expect(repository).not.toHaveProperty('listAll');
  });

  it('returns null when the exact settings document is missing', async () => {
    const { repository } = createHarness({ exists: false });

    await expect(repository.getStudioSettings()).resolves.toBeNull();
  });

  it('creates the canonical document with server timestamps and actor metadata', async () => {
    const { adapter, reference, repository, timestampFactory, writeTimestamp } = createHarness();

    await expect(
      repository.createStudioSettings(createDraft({ businessName: ' 37 Music Studio ' }), {
        actorUid: 'owner-1',
      }),
    ).resolves.toBe('studio');

    expect(timestampFactory).toHaveBeenCalledOnce();
    expect(adapter.setDoc).toHaveBeenCalledWith(reference, {
      ...createDraft({ businessName: '37 Music Studio' }),
      createdAt: writeTimestamp,
      createdByUid: 'owner-1',
      updatedAt: writeTimestamp,
      updatedByUid: 'owner-1',
    });
  });

  it('updates only mutable settings plus server update metadata', async () => {
    const { adapter, reference, repository, writeTimestamp } = createHarness();

    await expect(
      repository.updateStudioSettings(createDraft({ bookingIntervalMinutes: 60 }), {
        actorUid: 'owner-1',
      }),
    ).resolves.toBe('studio');

    expect(adapter.updateDoc).toHaveBeenCalledWith(reference, {
      ...createDraft({ bookingIntervalMinutes: 60 }),
      updatedAt: writeTimestamp,
      updatedByUid: 'owner-1',
    });
    expect(adapter.updateDoc.mock.calls[0][1]).not.toHaveProperty('createdAt');
    expect(adapter.updateDoc.mock.calls[0][1]).not.toHaveProperty('createdByUid');
  });

  it('rejects malformed settings and actor identifiers before writing', async () => {
    const { adapter, repository } = createHarness();

    expect(() =>
      repository.createStudioSettings(createDraft({ bookingIntervalMinutes: 45 }), {
        actorUid: 'owner-1',
      }),
    ).toThrow(/bookingIntervalMinutes/);
    expect(() =>
      repository.updateStudioSettings(createDraft(), { actorUid: 'users/owner-1' }),
    ).toThrow(/document id/);
    expect(adapter.setDoc).not.toHaveBeenCalled();
    expect(adapter.updateDoc).not.toHaveBeenCalled();
  });
});
