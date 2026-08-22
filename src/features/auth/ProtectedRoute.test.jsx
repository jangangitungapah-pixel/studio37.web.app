import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AuthContext } from './auth-context.js';
import { ProtectedRoute } from './ProtectedRoute.jsx';

function LoginProbe() {
  const location = useLocation();
  return <p>Login from {location.state?.from?.pathname ?? 'unknown'}</p>;
}

function renderRoute(authValue) {
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={['/calendar']}>
        <Routes>
          <Route path="/login" element={<LoginProbe />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/calendar" element={<h1>Protected calendar</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('ProtectedRoute', () => {
  it('waits for the Firebase session observer before deciding', () => {
    renderRoute({ error: null, signIn: vi.fn(), signOut: vi.fn(), status: 'loading', user: null });

    expect(screen.getByText('Memeriksa sesi Studio37…')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Protected calendar' })).not.toBeInTheDocument();
  });

  it('redirects unauthenticated users and preserves the requested path', () => {
    renderRoute({
      error: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      status: 'unauthenticated',
      user: null,
    });

    expect(screen.getByText('Login from /calendar')).toBeInTheDocument();
  });

  it('renders protected content for an authenticated Firebase user', () => {
    renderRoute({
      error: null,
      signIn: vi.fn(),
      signOut: vi.fn(),
      status: 'authenticated',
      user: { uid: 'owner-1' },
    });

    expect(screen.getByRole('heading', { name: 'Protected calendar' })).toBeInTheDocument();
  });
});
