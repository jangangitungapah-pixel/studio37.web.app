import { describe, expect, it, vi } from 'vitest';

import { createDocumentRepository } from './createDocumentRepository.js';

function createAdapter({ exists = true, data = { name: 'Studio A' } } = {}) {
  return {
    doc: vi.fn((_db, collectionName, documentId) => ({ collectionName, documentId })),
    getDoc: vi.fn(async (reference) => ({
      data: () => data,
      exists: () => exists,
      id: reference.documentId,
    })),
    setDoc: vi.fn(async () => undefined),
    updateDoc: vi.fn(async () => undefined),
  };
}

describe('createDocumentRepository', () => {
  it('provides focused document operations without a generic collection-wide list', async () => {
    const adapter = createAdapter();
    const repository = createDocumentRepository({
      adapter,
      collectionName: 'studios',
      db: {},
    });

    await expect(repository.getById('studio-a')).resolves.toEqual({
      id: 'studio-a',
      name: 'Studio A',
    });
    expect(repository.listAll).toBeUndefined();
  });

  it('supports explicit merge writes and document patches', async () => {
    const adapter = createAdapter();
    const repository = createDocumentRepository({
      adapter,
      collectionName: 'studios',
      db: {},
    });

    await repository.setById('studio-a', { active: true }, { merge: true });
    await repository.updateById('studio-a', { name: 'Studio Utama' });

    expect(adapter.setDoc).toHaveBeenCalledWith(
      { collectionName: 'studios', documentId: 'studio-a' },
      { active: true },
      { merge: true },
    );
    expect(adapter.updateDoc).toHaveBeenCalledWith(
      { collectionName: 'studios', documentId: 'studio-a' },
      { name: 'Studio Utama' },
    );
  });

  it('rejects invalid repository names and payloads before touching Firestore', async () => {
    expect(() =>
      createDocumentRepository({
        adapter: createAdapter(),
        collectionName: ' ',
        db: {},
      }),
    ).toThrow(/collectionName/);

    const repository = createDocumentRepository({
      adapter: createAdapter(),
      collectionName: 'studios',
      db: {},
      encode: () => null,
    });

    await expect(repository.setById('studio-a', {})).rejects.toThrow(/encoded document/);
  });
});
