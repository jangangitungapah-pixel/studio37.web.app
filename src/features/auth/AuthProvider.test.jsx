import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AuthProvider } from './AuthProvider.jsx';
import { useAuth } from './useAuth.js';

function SessionProbe() {
  const { signIn, status, user } = useAuth();

  return (
    <div>
      <p>{status}</p>
      <p>{user?.email ?? 'no-user'}</p>
      <button
        type="button"
        onClick={() => signIn({ email: 'owner@studio37.id', password: 'secret-password' })}
      >
        Sign in probe
      </button>
    </div>
  );
}

function createGateway() {
  return {
    configurePersistence: vi.fn().mockResolvedValue(undefined),
    observeSession: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  };
}

describe('AuthProvider', () => {
  it('configures persistence before observing and resolving the current session', async () => {
    const gateway = createGateway();
    const unsubscribe = vi.fn();
    let onUserChanged;
    gateway.observeSession.mockImplementation((nextUser) => {
      onUserChanged = nextUser;
      return unsubscribe;
    });

    const { unmount } = render(
      <AuthProvider gateway={gateway}>
        <SessionProbe />
      </AuthProvider>,
    );

    expect(screen.getByText('loading')).toBeInTheDocument();
    await waitFor(() => expect(gateway.observeSession).toHaveBeenCalledOnce());
    expect(gateway.configurePersistence.mock.invocationCallOrder[0]).toBeLessThan(
      gateway.observeSession.mock.invocationCallOrder[0],
    );

    act(() => onUserChanged({ email: 'owner@studio37.id', uid: 'owner-1' }));

    expect(screen.getByText('authenticated')).toBeInTheDocument();
    expect(screen.getByText('owner@studio37.id')).toBeInTheDocument();

    unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('updates session state after a successful explicit login', async () => {
    const gateway = createGateway();
    const user = { email: 'owner@studio37.id', uid: 'owner-1' };
    gateway.observeSession.mockImplementation((onUserChanged) => {
      onUserChanged(null);
      return vi.fn();
    });
    gateway.signIn.mockResolvedValue(user);
    const interaction = userEvent.setup();

    render(
      <AuthProvider gateway={gateway}>
        <SessionProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText('unauthenticated')).toBeInTheDocument();
    await interaction.click(screen.getByRole('button', { name: 'Sign in probe' }));

    expect(await screen.findByText('authenticated')).toBeInTheDocument();
    expect(screen.getByText('owner@studio37.id')).toBeInTheDocument();
  });

  it('fails closed when persistence initialization fails', async () => {
    const gateway = createGateway();
    gateway.configurePersistence.mockRejectedValue(
      Object.assign(new Error('Not configured'), { code: 'studio37/auth-not-configured' }),
    );

    render(
      <AuthProvider gateway={gateway}>
        <SessionProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText('unauthenticated')).toBeInTheDocument();
    expect(screen.getByText('no-user')).toBeInTheDocument();
    expect(gateway.observeSession).not.toHaveBeenCalled();
  });
});
