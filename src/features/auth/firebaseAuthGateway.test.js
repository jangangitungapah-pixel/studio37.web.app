import { beforeEach, describe, expect, it, vi } from 'vitest';

const authSdk = vi.hoisted(() => ({
  browserLocalPersistence: { type: 'LOCAL' },
  createUserWithEmailAndPassword: vi.fn(),
  getIdToken: vi.fn(),
  onAuthStateChanged: vi.fn(),
  reload: vi.fn(),
  sendEmailVerification: vi.fn(),
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

  it('creates a Firebase email/password identity without assigning an application role', async () => {
    const user = { email: 'operator@studio37.id', emailVerified: false, uid: 'operator-1' };
    authSdk.createUserWithEmailAndPassword.mockResolvedValue({ user });

    await expect(
      firebaseAuthGateway.createAccount({
        email: 'operator@studio37.id',
        password: 'secret-password',
      }),
    ).resolves.toBe(user);
    expect(authSdk.createUserWithEmailAndPassword).toHaveBeenCalledWith(
      configuredAuth,
      'operator@studio37.id',
      'secret-password',
    );
  });

  it('sends Firebase verification with the invitation page as the continue URL', async () => {
    const user = { email: 'operator@studio37.id', uid: 'operator-1' };
    authSdk.sendEmailVerification.mockResolvedValue(undefined);

    await expect(
      firebaseAuthGateway.sendVerificationEmail(user, {
        continueUrl: 'http://localhost:5173/invite/operator-1/invite-12345678901234567890',
      }),
    ).resolves.toBeUndefined();
    expect(authSdk.sendEmailVerification).toHaveBeenCalledWith(user, {
      url: 'http://localhost:5173/invite/operator-1/invite-12345678901234567890',
    });
  });

  it('reloads the Firebase user and forces a fresh token before invitation reads', async () => {
    const user = { email: 'operator@studio37.id', emailVerified: true, uid: 'operator-1' };
    authSdk.reload.mockResolvedValue(undefined);
    authSdk.getIdToken.mockResolvedValue('fresh-token');

    await expect(firebaseAuthGateway.refreshUser(user)).resolves.toBe(user);
    expect(authSdk.reload).toHaveBeenCalledWith(user);
    expect(authSdk.getIdToken).toHaveBeenCalledWith(user, true);
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
