import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { App } from './App.jsx';

describe('Studio37 application shell', () => {
  it('renders the dashboard inside the semantic application shell', () => {
    window.history.pushState({}, '', '/dashboard');

    const { container } = render(<App />);

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
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

    render(<App />);

    const openButton = screen.getByRole('button', { name: 'Buka menu' });
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
});
