import { describe, expect, it, vi } from 'vitest';

import {
  createUserProfileRepository,
  USER_PROFILE_REPOSITORY_UNAVAILABLE_CODE,
} from './userProfileRepository.js';

function createHarness() {
  const unsubscribe = vi.fn();
  const adapter = {
    doc: vi.fn(() => ({ path: 'users/owner-1' })),
    onSnapshot: vi.fn(() => unsubscribe),
  };
  const repository = createUserProfileRepository({ adapter, db: { name: 'firestore' } });

  return { adapter, repository, unsubscribe };
}

function getSnapshotCallbacks(adapter) {
  return {
    onError: adapter.onSnapshot.mock.calls[0][2],
    onNext: adapter.onSnapshot.mock.calls[0][1],
  };
}

describe('userProfileRepository', () => {
  it('observes exactly one explicit users/{uid} document and returns unsubscribe', () => {
    const { adapter, repository, unsubscribe } = createHarness();
    const onProfileChanged = vi.fn();
    const onError = vi.fn();

    expect(repository.observeByUid('owner-1', onProfileChanged, onError)).toBe(unsubscribe);
    expect(adapter.doc).toHaveBeenCalledWith({ name: 'firestore' }, 'users', 'owner-1');
    expect(adapter.onSnapshot).toHaveBeenCalledOnce();
    expect(repository).not.toHaveProperty('listAll');
  });

  it('emits null when the exact profile document does not exist', () => {
    const { adapter, repository } = createHarness();
    const onProfileChanged = vi.fn();

    repository.observeByUid('owner-1', onProfileChanged, vi.fn());
    getSnapshotCallbacks(adapter).onNext({ exists: () => false });

    expect(onProfileChanged).toHaveBeenCalledWith(null);
  });

  it('decodes an existing profile before emitting it', () => {
    const { adapter, repository } = createHarness();
    const onProfileChanged = vi.fn();

    repository.observeByUid('owner-1', onProfileChanged, vi.fn());
    getSnapshotCallbacks(adapter).onNext({
      exists: () => true,
      id: 'owner-1',
      data: () => ({
        uid: 'owner-1',
        displayName: 'Owner',
        email: 'owner@studio37.id',
        phone: null,
        role: 'owner',
        status: 'active',
        permissionSetId: null,
        operatorId: null,
        createdAt: new Date('2026-08-22T01:00:00.000Z'),
        updatedAt: new Date('2026-08-22T01:00:00.000Z'),
      }),
    });

    expect(onProfileChanged).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'owner-1', role: 'owner', status: 'active' }),
    );
  });

  it('routes malformed documents and listener failures to the error callback', () => {
    const { adapter, repository } = createHarness();
    const onError = vi.fn();

    repository.observeByUid('owner-1', vi.fn(), onError);
    const callbacks = getSnapshotCallbacks(adapter);
    callbacks.onNext({
      exists: () => true,
      id: 'owner-1',
      data: () => ({ uid: 'different-user' }),
    });
    const listenerError = new Error('permission denied');
    callbacks.onError(listenerError);

    expect(onError).toHaveBeenNthCalledWith(1, expect.any(Error));
    expect(onError).toHaveBeenNthCalledWith(2, listenerError);
  });

  it('fails closed when Firestore is unavailable', () => {
    const repository = createUserProfileRepository({ db: null });

    expect(() => repository.observeByUid('owner-1', vi.fn(), vi.fn())).toThrow(
      expect.objectContaining({ code: USER_PROFILE_REPOSITORY_UNAVAILABLE_CODE }),
    );
  });
});
