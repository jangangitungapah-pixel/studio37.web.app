import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CAPABILITIES } from '../features/auth/capabilities.js';
import { App } from './App.jsx';

function createAuthGateway(user = { email: 'owner@studio37.id', uid: 'owner-1' }) {
  return {
    configurePersistence: vi.fn().mockResolvedValue(undefined),
    observeSession: vi.fn((onUserChanged) => {
      onUserChanged(user);
      return vi.fn();
    }),
    signIn: vi.fn(),
    signOut: vi.fn(),
  };
}

function createUserProfileRepository(
  profile = {
    displayName: 'Studio37 Owner',
    permissionSetId: null,
    role: 'owner',
    status: 'active',
    uid: 'owner-1',
  },
) {
  return {
    observeByUid: vi.fn((uid, onProfileChanged) => {
      if (uid !== profile.uid) throw new Error('Unexpected profile uid.');
      onProfileChanged(profile);
      return vi.fn();
    }),
  };
}

function createPermissionSetRepository(permissionSet) {
  return {
    observeById: vi.fn((permissionSetId, onPermissionSetChanged) => {
      if (permissionSetId !== permissionSet.id) throw new Error('Unexpected permission set id.');
      onPermissionSetChanged(permissionSet);
      return vi.fn();
    }),
  };
}

describe('Studio37 application shell', () => {
  it('renders the dashboard inside the semantic application shell for an authenticated session', async () => {
    window.history.pushState({}, '', '/dashboard');

    const { container } = render(
      <App
        authGateway={createAuthGateway()}
        userProfileRepository={createUserProfileRepository()}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(container.querySelector('.app-shell__sidebar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buka menu' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Lewati ke konten utama' })).toHaveAttribute(
      'href',
      '#main-content',
    );
    expect(screen.getByText('Workspace foundation ready')).toBeInTheDocument();
  });

  it('opens and closes the mobile navigation accessibly', async () => {
    const user = userEvent.setup();
    window.history.pushState({}, '', '/calendar');

    render(
      <App
        authGateway={createAuthGateway()}
        userProfileRepository={createUserProfileRepository()}
      />,
    );

    const openButton = await screen.findByRole('button', { name: 'Buka menu' });
    expect(openButton).toHaveAttribute('aria-expanded', 'false');

    await user.click(openButton);

    expect(openButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('navigation', { name: 'Navigasi utama mobile' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tutup menu' }));

    expect(openButton).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByRole('navigation', { name: 'Navigasi utama mobile' }),
    ).not.toBeInTheDocument();
  });

  it('redirects an unauthenticated protected URL to login', async () => {
    window.history.pushState({}, '', '/calendar');

    render(
      <App
        authGateway={createAuthGateway(null)}
        userProfileRepository={createUserProfileRepository()}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Masuk ke Studio37' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
  });

  it('blocks the shell when the live application profile is disabled', async () => {
    window.history.pushState({}, '', '/dashboard');

    render(
      <App
        authGateway={createAuthGateway()}
        userProfileRepository={createUserProfileRepository({
          displayName: 'Studio37 Owner',
          permissionSetId: null,
          role: 'owner',
          status: 'disabled',
          uid: 'owner-1',
        })}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Akun dinonaktifkan' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
  });

  it('enforces an operator permission set for navigation and direct route access', async () => {
    window.history.pushState({}, '', '/bookkeeping');
    const operatorProfile = {
      displayName: 'Front Desk Operator',
      permissionSetId: 'front-desk',
      role: 'studio_operator',
      status: 'active',
      uid: 'operator-1',
    };
    const permissionSet = {
      capabilities: [CAPABILITIES.DASHBOARD_VIEW, CAPABILITIES.BOOKING_VIEW],
      id: 'front-desk',
      name: 'Front Desk',
      status: 'active',
    };

    render(
      <App
        authGateway={createAuthGateway({
          email: 'operator@studio37.id',
          uid: 'operator-1',
        })}
        permissionSetRepository={createPermissionSetRepository(permissionSet)}
        userProfileRepository={createUserProfileRepository(operatorProfile)}
      />,
    );

    expect(
      await screen.findByRole('heading', { name: 'Akses tidak diizinkan' }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/bookkeeping');
    expect(screen.getByText('Dashboard', { selector: 'a' })).toBeInTheDocument();
    expect(screen.getByText('Booking Calendar', { selector: 'a' })).toBeInTheDocument();
    expect(screen.getByText('Settings', { selector: 'a' })).toBeInTheDocument();
    expect(screen.queryByText('Fee & Commission', { selector: 'a' })).not.toBeInTheDocument();
    expect(screen.queryByText('Pembukuan', { selector: 'a' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Pembukuan' })).not.toBeInTheDocument();
  });

  it('allows an operator to open an explicitly permitted route', async () => {
    window.history.pushState({}, '', '/calendar');
    const operatorProfile = {
      displayName: 'Front Desk Operator',
      permissionSetId: 'front-desk',
      role: 'studio_operator',
      status: 'active',
      uid: 'operator-1',
    };

    render(
      <App
        authGateway={createAuthGateway({
          email: 'operator@studio37.id',
          uid: 'operator-1',
        })}
        permissionSetRepository={createPermissionSetRepository({
          capabilities: [CAPABILITIES.BOOKING_VIEW],
          id: 'front-desk',
          name: 'Front Desk',
          status: 'active',
        })}
        userProfileRepository={createUserProfileRepository(operatorProfile)}
      />,
    );

    expect(await screen.findByRole('heading', { name: 'Booking Calendar' })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Akses tidak diizinkan' }),
    ).not.toBeInTheDocument();
  });
});
