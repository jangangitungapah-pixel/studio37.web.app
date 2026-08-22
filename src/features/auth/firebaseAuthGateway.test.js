import { beforeEach, describe, expect, it, vi } from 'vitest';

const authSdk = vi.hoisted(() => ({
  browserLocalPersistence: { type: 'LOCAL' },
  onAuthStateChanged: vi.fn(),
  setPersistence: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));

const configuredAuth = vi.hoisted(() => ({ name: 'studio37-auth' }));

vi.mock('firebase/auth', () => authSdk);
vi.mock('../../lib/firebase/client.js', () => ({ firebaseAuth: configuredAuth }));

import {
  AUTH_NOT_CONFIGURED_CODE,
  createFirebaseAuthGateway,
  firebaseAuthGateway,
} from './firebaseAuthGateway.js';

describe('Firebase Auth gateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('configures browser-local persistence explicitly', async () => {
    authSdk.setPersistence.mockResolvedValue(undefined);

    await firebaseAuthGateway.configurePersistence();

    expect(authSdk.setPersistence).toHaveBeenCalledWith(
      configuredAuth,
      authSdk.browserLocalPersistence,
    );
  });

  it('registers the Firebase session observer and returns its unsubscribe callback', () => {
    const onUserChanged = vi.fn();
    const onError = vi.fn();
    const unsubscribe = vi.fn();
    authSdk.onAuthStateChanged.mockReturnValue(unsubscribe);

    expect(firebaseAuthGateway.observeSession(onUserChanged, onError)).toBe(unsubscribe);
    expect(authSdk.onAuthStateChanged).toHaveBeenCalledWith(configuredAuth, onUserChanged, onError);
  });

  it('returns the authenticated user from email/password login', async () => {
    const user = { email: 'owner@studio37.id', uid: 'owner-1' };
    authSdk.signInWithEmailAndPassword.mockResolvedValue({ user });

    await expect(
      firebaseAuthGateway.signIn({ email: 'owner@studio37.id', password: 'secret-password' }),
    ).resolves.toBe(user);
    expect(authSdk.signInWithEmailAndPassword).toHaveBeenCalledWith(
      configuredAuth,
      'owner@studio37.id',
      'secret-password',
    );
  });

  it('delegates logout to the configured Firebase Auth instance', async () => {
    authSdk.signOut.mockResolvedValue(undefined);

    await expect(firebaseAuthGateway.signOut()).resolves.toBeUndefined();
    expect(authSdk.signOut).toHaveBeenCalledWith(configuredAuth);
  });

  it('fails closed when Firebase Authentication is not configured', async () => {
    const gateway = createFirebaseAuthGateway(null);

    await expect(gateway.configurePersistence()).rejects.toMatchObject({
      code: AUTH_NOT_CONFIGURED_CODE,
    });
    expect(() => gateway.observeSession(vi.fn(), vi.fn())).toThrow(
      expect.objectContaining({ code: AUTH_NOT_CONFIGURED_CODE }),
    );
  });
});
