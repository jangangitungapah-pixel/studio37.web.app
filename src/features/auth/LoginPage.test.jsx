import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AuthContext } from './auth-context.js';
import { LoginPage } from './LoginPage.jsx';

function renderLogin(authValue, initialEntry = '/login') {
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/calendar" element={<h1>Booking Calendar destination</h1>} />
          <Route path="/dashboard" element={<h1>Dashboard destination</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

function unauthenticatedValue(overrides = {}) {
  return {
    error: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    status: 'unauthenticated',
    user: null,
    ...overrides,
  };
}

describe('LoginPage', () => {
  it('shows explicit required-field validation', () => {
    renderLogin(unauthenticatedValue());

    fireEvent.submit(screen.getByRole('form', { name: 'Login Studio37' }));

    expect(screen.getByText('Email wajib diisi.')).toBeInTheDocument();
    expect(screen.getByText('Password wajib diisi.')).toBeInTheDocument();
  });

  it('submits normalized email and maps invalid credentials safely', async () => {
    const signIn = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('provider detail'), { code: 'auth/invalid-credential' }),
      );
    const interaction = userEvent.setup();
    renderLogin(unauthenticatedValue({ signIn }));

    await interaction.type(screen.getByLabelText(/Email/), '  owner@studio37.id  ');
    await interaction.type(screen.getByLabelText(/Password/), 'secret-password');
    await interaction.click(screen.getByRole('button', { name: 'Masuk' }));

    expect(signIn).toHaveBeenCalledWith({
      email: 'owner@studio37.id',
      password: 'secret-password',
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Email atau password tidak cocok.');
    expect(screen.queryByText('provider detail')).not.toBeInTheDocument();
  });

  it('returns an authenticated user to the originally requested internal route', () => {
    renderLogin(unauthenticatedValue({ status: 'authenticated', user: { uid: 'owner-1' } }), {
      pathname: '/login',
      state: { from: { pathname: '/calendar' } },
    });

    expect(
      screen.getByRole('heading', { name: 'Booking Calendar destination' }),
    ).toBeInTheDocument();
  });
});
