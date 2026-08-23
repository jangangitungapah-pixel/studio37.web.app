import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AuthContext } from './auth-context.js';
import { CAPABILITIES } from './capabilities.js';
import { CapabilityGuard } from './CapabilityGuard.jsx';

function renderGuard(authValue, guardProps = {}) {
  return render(
    <AuthContext.Provider value={authValue}>
      <CapabilityGuard fallback={<p>Action unavailable</p>} {...guardProps}>
        <button type="button">Adjust payment</button>
      </CapabilityGuard>
    </AuthContext.Provider>,
  );
}

function createAccess(role, capabilities = []) {
  return {
    capabilities,
    error: null,
    permissionSet: null,
    profile: { role, status: 'active', uid: 'user-1' },
    signIn: vi.fn(),
    signOut: vi.fn(),
    status: 'authenticated',
    user: { uid: 'user-1' },
  };
}

describe('CapabilityGuard', () => {
  it('renders an action only when the operator has the required capability', () => {
    renderGuard(createAccess('studio_operator', [CAPABILITIES.PAYMENT_CREATE]), {
      allOf: [CAPABILITIES.PAYMENT_CREATE],
    });

    expect(screen.getByRole('button', { name: 'Adjust payment' })).toBeInTheDocument();
    expect(screen.queryByText('Action unavailable')).not.toBeInTheDocument();
  });

  it('renders the safe fallback when capability is absent', () => {
    renderGuard(createAccess('studio_operator'), {
      allOf: [CAPABILITIES.PAYMENT_CREATE],
    });

    expect(screen.getByText('Action unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Adjust payment' })).not.toBeInTheDocument();
  });

  it('supports an independent Owner-only action boundary', () => {
    renderGuard(createAccess('owner'), { ownerOnly: true });

    expect(screen.getByRole('button', { name: 'Adjust payment' })).toBeInTheDocument();
  });
});
