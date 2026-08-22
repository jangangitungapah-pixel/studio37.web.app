import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AuthContext } from './auth-context.js';
import { UserMenu } from './UserMenu.jsx';

function createAuthValue(overrides = {}) {
  return {
    capabilities: [],
    error: null,
    permissionSet: null,
    profile: {
      displayName: 'Studio37 Owner',
      email: 'owner@studio37.id',
      role: 'owner',
      status: 'active',
      uid: 'owner-1',
    },
    signIn: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
    status: 'authenticated',
    user: { email: 'owner@studio37.id', uid: 'owner-1' },
    ...overrides,
  };
}

function renderMenu(authValue = createAuthValue()) {
  return render(
    <AuthContext.Provider value={authValue}>
      <UserMenu />
      <button type="button">Outside target</button>
    </AuthContext.Provider>,
  );
}

describe('UserMenu', () => {
  it('discloses the authenticated identity and role', async () => {
    const interaction = userEvent.setup();
    renderMenu();

    const trigger = screen.getByRole('button', {
      name: 'Buka menu pengguna: Studio37 Owner',
    });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await interaction.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: 'Menu pengguna' })).toBeInTheDocument();
    expect(screen.getByText('owner@studio37.id')).toBeInTheDocument();
    expect(screen.getAllByText('Owner').length).toBeGreaterThan(0);
  });

  it('labels a Studio Operator identity without exposing Owner context', async () => {
    const interaction = userEvent.setup();
    renderMenu(
      createAuthValue({
        profile: {
          displayName: 'Front Desk Operator',
          email: 'operator@studio37.id',
          role: 'studio_operator',
          status: 'active',
          uid: 'operator-1',
        },
        user: { email: 'operator@studio37.id', uid: 'operator-1' },
      }),
    );

    await interaction.click(
      screen.getByRole('button', { name: 'Buka menu pengguna: Front Desk Operator' }),
    );

    expect(screen.getByText('operator@studio37.id')).toBeInTheDocument();
    expect(screen.getAllByText('Studio Operator').length).toBeGreaterThan(0);
    expect(screen.queryByText('Owner')).not.toBeInTheDocument();
  });

  it('closes on Escape and outside interaction', async () => {
    const interaction = userEvent.setup();
    renderMenu();
    const trigger = screen.getByRole('button', {
      name: 'Buka menu pengguna: Studio37 Owner',
    });

    await interaction.click(trigger);
    await interaction.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'Menu pengguna' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await interaction.click(trigger);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside target' }));
    expect(screen.queryByRole('region', { name: 'Menu pengguna' })).not.toBeInTheDocument();
  });

  it('shows a pending state and closes after successful logout', async () => {
    let resolveSignOut;
    const signOut = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveSignOut = resolve;
        }),
    );
    const interaction = userEvent.setup();
    renderMenu(createAuthValue({ signOut }));

    await interaction.click(
      screen.getByRole('button', { name: 'Buka menu pengguna: Studio37 Owner' }),
    );
    const logoutButton = screen.getByRole('button', { name: 'Keluar dari Studio37' });
    await interaction.click(logoutButton);

    expect(signOut).toHaveBeenCalledOnce();
    expect(logoutButton).toBeDisabled();
    expect(logoutButton).toHaveAttribute('aria-busy', 'true');

    act(() => resolveSignOut());
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Menu pengguna' })).not.toBeInTheDocument(),
    );
  });

  it('keeps the session controls available when logout fails', async () => {
    const interaction = userEvent.setup();
    renderMenu(
      createAuthValue({ signOut: vi.fn().mockRejectedValue(new Error('network unavailable')) }),
    );

    await interaction.click(
      screen.getByRole('button', { name: 'Buka menu pengguna: Studio37 Owner' }),
    );
    await interaction.click(screen.getByRole('button', { name: 'Keluar dari Studio37' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sesi belum dapat ditutup. Periksa koneksi lalu coba lagi.',
    );
    expect(screen.getByRole('button', { name: 'Keluar dari Studio37' })).toBeEnabled();
  });
});
