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
    profile: null,
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
    renderLogin(
      unauthenticatedValue({
        profile: { status: 'active', uid: 'owner-1' },
        status: 'authenticated',
        user: { uid: 'owner-1' },
      }),
      {
        pathname: '/login',
        state: { from: { pathname: '/calendar' } },
      },
    );

    expect(
      screen.getByRole('heading', { name: 'Booking Calendar destination' }),
    ).toBeInTheDocument();
  });

  it.each([
    ['profile-missing', 'Profil akses belum tersedia'],
    ['disabled', 'Akun dinonaktifkan'],
    ['profile-error', 'Profil akses gagal diverifikasi'],
  ])('blocks the login form for an authenticated Firebase user with %s access', (status, title) => {
    renderLogin(unauthenticatedValue({ status, user: { uid: 'owner-1' } }));

    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Login Studio37' })).not.toBeInTheDocument();
  });

  it('lets a blocked user end the Firebase session and choose another account', async () => {
    const signOut = vi.fn().mockResolvedValue(undefined);
    const interaction = userEvent.setup();
    renderLogin(
      unauthenticatedValue({
        profile: { status: 'disabled', uid: 'owner-1' },
        signOut,
        status: 'disabled',
        user: { uid: 'owner-1' },
      }),
    );

    await interaction.click(screen.getByRole('button', { name: 'Keluar dan gunakan akun lain' }));

    expect(signOut).toHaveBeenCalledOnce();
  });
});
