import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

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

describe('Studio37 application shell', () => {
  it('renders the dashboard inside the semantic application shell for an authenticated session', async () => {
    window.history.pushState({}, '', '/dashboard');

    const { container } = render(<App authGateway={createAuthGateway()} />);

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

    render(<App authGateway={createAuthGateway()} />);

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

    render(<App authGateway={createAuthGateway(null)} />);

    expect(await screen.findByRole('heading', { name: 'Masuk ke Studio37' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/login');
  });
});
