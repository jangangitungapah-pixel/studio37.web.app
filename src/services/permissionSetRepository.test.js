import { describe, expect, it, vi } from 'vitest';

import { CAPABILITIES } from '../features/auth/capabilities.js';
import {
  createPermissionSetRepository,
  PERMISSION_SET_REPOSITORY_UNAVAILABLE_CODE,
} from './permissionSetRepository.js';

function createHarness() {
  const unsubscribe = vi.fn();
  const adapter = {
    doc: vi.fn(() => ({ path: 'permissionSets/front-desk' })),
    onSnapshot: vi.fn(() => unsubscribe),
  };
  const repository = createPermissionSetRepository({ adapter, db: { name: 'firestore' } });

  return { adapter, repository, unsubscribe };
}

function getSnapshotCallbacks(adapter) {
  return {
    onError: adapter.onSnapshot.mock.calls[0][2],
    onNext: adapter.onSnapshot.mock.calls[0][1],
  };
}

describe('permissionSetRepository', () => {
  it('observes exactly one explicit permissionSets/{id} document', () => {
    const { adapter, repository, unsubscribe } = createHarness();

    expect(repository.observeById('front-desk', vi.fn(), vi.fn())).toBe(unsubscribe);
    expect(adapter.doc).toHaveBeenCalledWith({ name: 'firestore' }, 'permissionSets', 'front-desk');
    expect(adapter.onSnapshot).toHaveBeenCalledOnce();
    expect(repository).not.toHaveProperty('listAll');
  });

  it('emits null for a missing exact document and decodes an existing one', () => {
    const { adapter, repository } = createHarness();
    const onPermissionSetChanged = vi.fn();

    repository.observeById('front-desk', onPermissionSetChanged, vi.fn());
    const callbacks = getSnapshotCallbacks(adapter);
    callbacks.onNext({ exists: () => false });
    callbacks.onNext({
      exists: () => true,
      id: 'front-desk',
      data: () => ({
        name: 'Front Desk',
        status: 'active',
        capabilities: [CAPABILITIES.BOOKING_VIEW],
        createdAt: new Date('2026-08-22T01:00:00.000Z'),
        updatedAt: new Date('2026-08-22T01:00:00.000Z'),
      }),
    });

    expect(onPermissionSetChanged).toHaveBeenNthCalledWith(1, null);
    expect(onPermissionSetChanged).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ id: 'front-desk', capabilities: [CAPABILITIES.BOOKING_VIEW] }),
    );
  });

  it('routes malformed documents and listener failures to the error callback', () => {
    const { adapter, repository } = createHarness();
    const onError = vi.fn();

    repository.observeById('front-desk', vi.fn(), onError);
    const callbacks = getSnapshotCallbacks(adapter);
    callbacks.onNext({
      exists: () => true,
      id: 'front-desk',
      data: () => ({ capabilities: 'everything' }),
    });
    const listenerError = new Error('permission denied');
    callbacks.onError(listenerError);

    expect(onError).toHaveBeenNthCalledWith(1, expect.any(Error));
    expect(onError).toHaveBeenNthCalledWith(2, listenerError);
  });

  it('rejects invalid ids and fails closed when Firestore is unavailable', () => {
    const { repository } = createHarness();
    expect(() => repository.observeById('nested/id', vi.fn(), vi.fn())).toThrow(
      'Permission set id must be a non-empty document id.',
    );

    const unavailableRepository = createPermissionSetRepository({ db: null });
    expect(() => unavailableRepository.observeById('front-desk', vi.fn(), vi.fn())).toThrow(
      expect.objectContaining({ code: PERMISSION_SET_REPOSITORY_UNAVAILABLE_CODE }),
    );
  });
});
