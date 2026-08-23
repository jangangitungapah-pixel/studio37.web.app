import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AuthContext } from './auth-context.js';
import { CAPABILITIES } from './capabilities.js';
import { CapabilityRoute } from './CapabilityRoute.jsx';

function renderRoute(capabilities) {
  return render(
    <AuthContext.Provider
      value={{
        capabilities,
        error: null,
        permissionSet: null,
        profile: { role: 'studio_operator', status: 'active', uid: 'operator-1' },
        signIn: vi.fn(),
        signOut: vi.fn(),
        status: 'authenticated',
        user: { uid: 'operator-1' },
      }}
    >
      <MemoryRouter initialEntries={['/calendar']}>
        <Routes>
          <Route element={<CapabilityRoute policy={{ allOf: [CAPABILITIES.BOOKING_VIEW] }} />}>
            <Route path="/calendar" element={<h1>Protected calendar</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('CapabilityRoute', () => {
  it('renders the route for an assigned capability', () => {
    renderRoute([CAPABILITIES.BOOKING_VIEW]);

    expect(screen.getByRole('heading', { name: 'Protected calendar' })).toBeInTheDocument();
  });

  it('shows a clear denied state for direct unauthorized navigation', () => {
    renderRoute([]);

    expect(screen.getByRole('heading', { name: 'Akses tidak diizinkan' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Protected calendar' })).not.toBeInTheDocument();
  });
});
