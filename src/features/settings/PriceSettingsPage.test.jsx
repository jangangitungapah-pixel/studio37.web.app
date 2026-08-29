import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '../../components/feedback/ToastProvider.jsx';
import { AuthContext } from '../auth/auth-context.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { PriceSettingsPage } from './PriceSettingsPage.jsx';

function createSessionType(overrides = {}) {
  return {
    code: 'REHEARSAL',
    createdAt: new Date('2026-08-24T01:00:00.000Z'),
    createdByUid: 'owner-1',
    defaultDurationMinutes: 120,
    description: 'Latihan reguler',
    displayOrder: 1,
    id: 'session-rehearsal',
    minimumDurationMinutes: 60,
    name: 'Rehearsal',
    requiresStudioReservation: true,
    status: 'active',
    updatedAt: new Date('2026-08-24T02:00:00.000Z'),
    updatedByUid: 'owner-1',
    ...overrides,
  };
}

function createRepository(sessionTypes = []) {
  return {
    createSessionType: vi.fn(async () => 'session-created'),
    listLimit: 100,
    listSessionTypes: vi.fn(async () => sessionTypes),
    setSessionTypeStatus: vi.fn(async (sessionTypeId) => sessionTypeId),
    updateSessionType: vi.fn(async (sessionTypeId) => sessionTypeId),
  };
}

function createAccess({ capabilities = [], role = 'owner', uid = 'owner-1' } = {}) {
  return {
    capabilities,
    profile: {
      displayName: role === 'owner' ? 'Studio37 Owner' : 'Pricing Viewer',
      permissionSetId: role === 'owner' ? null : 'pricing-viewer',
      role,
      status: 'active',
      uid,
    },
    status: 'authenticated',
    user: { email: `${uid}@studio37.test`, uid },
  };
}

function renderPage({ access = createAccess(), repository = createRepository() } = {}) {
  return render(
    <ToastProvider>
      <AuthContext.Provider value={access}>
        <MemoryRouter initialEntries={['/settings/pricing']}>
          <PriceSettingsPage repository={repository} />
        </MemoryRouter>
      </AuthContext.Provider>
    </ToastProvider>,
  );
}

describe('PriceSettingsPage session type workflow', () => {
  it('loads the bounded session type list and exposes human-readable behavior', async () => {
    const repository = createRepository([createSessionType()]);
    renderPage({ repository });

    expect(await screen.findByRole('heading', { name: 'Rehearsal' })).toBeInTheDocument();
    expect(screen.getByText('Reservasi studio')).toBeInTheDocument();
    expect(screen.getByText('Default 120 mnt · Min 60 mnt')).toBeInTheDocument();
    expect(screen.getByText('REHEARSAL')).toBeInTheDocument();
    expect(repository.listSessionTypes).toHaveBeenCalledOnce();
  });

  it('creates a reserving session type through the existing repository contract', async () => {
    const interaction = userEvent.setup();
    const repository = createRepository([]);
    renderPage({ repository });

    await screen.findByText('Belum ada session type');
    await interaction.click(screen.getByRole('button', { name: 'Tambah session type' }));
    await interaction.type(screen.getByLabelText(/^Nama session type/), 'Rehearsal');
    await interaction.type(screen.getByLabelText(/^Kode/), 'rehearsal');
    await interaction.type(screen.getByLabelText('Deskripsi'), 'Latihan reguler');
    await interaction.clear(screen.getByLabelText(/^Durasi default \(menit\)/));
    await interaction.type(screen.getByLabelText(/^Durasi default \(menit\)/), '120');
    await interaction.click(screen.getByRole('button', { name: 'Simpan session type' }));

    await waitFor(() => {
      expect(repository.createSessionType).toHaveBeenCalledWith(
        {
          code: 'REHEARSAL',
          defaultDurationMinutes: 120,
          description: 'Latihan reguler',
          displayOrder: 1,
          minimumDurationMinutes: 60,
          name: 'Rehearsal',
          requiresStudioReservation: true,
        },
        { actorUid: 'owner-1' },
      );
    });
    expect(await screen.findByText('Session type ditambahkan')).toBeInTheDocument();
  });

  it('edits an existing session type while preserving its document identity', async () => {
    const interaction = userEvent.setup();
    const repository = createRepository([createSessionType()]);
    renderPage({ repository });

    await interaction.click(await screen.findByRole('button', { name: 'Edit Rehearsal' }));
    const nameInput = screen.getByLabelText(/^Nama session type/);
    await interaction.clear(nameInput);
    await interaction.type(nameInput, 'Band Rehearsal');
    await interaction.click(screen.getByRole('button', { name: 'Simpan session type' }));

    await waitFor(() => {
      expect(repository.updateSessionType).toHaveBeenCalledWith(
        'session-rehearsal',
        expect.objectContaining({ name: 'Band Rehearsal' }),
        { actorUid: 'owner-1' },
      );
    });
    expect(repository.createSessionType).not.toHaveBeenCalled();
  });

  it('blocks duplicate codes before any repository write', async () => {
    const interaction = userEvent.setup();
    const repository = createRepository([createSessionType()]);
    renderPage({ repository });

    await interaction.click(await screen.findByRole('button', { name: 'Tambah session type' }));
    await interaction.type(screen.getByLabelText(/^Nama session type/), 'Another Service');
    await interaction.type(screen.getByLabelText(/^Kode/), 'REHEARSAL');
    await interaction.click(screen.getByRole('button', { name: 'Simpan session type' }));

    expect(
      await screen.findByText('Kode session type sudah digunakan. Gunakan kode unik lain.'),
    ).toBeInTheDocument();
    expect(repository.createSessionType).not.toHaveBeenCalled();
  });

  it('soft-deactivates a session type and explains historical preservation', async () => {
    const interaction = userEvent.setup();
    const repository = createRepository([createSessionType()]);
    renderPage({ repository });

    await interaction.click(await screen.findByRole('button', { name: 'Nonaktifkan Rehearsal' }));
    expect(screen.getByText(/snapshot historis tetap dipertahankan/i)).toBeInTheDocument();
    await interaction.click(screen.getByRole('button', { name: 'Nonaktifkan' }));

    await waitFor(() => {
      expect(repository.setSessionTypeStatus).toHaveBeenCalledWith(
        'session-rehearsal',
        'disabled',
        { actorUid: 'owner-1' },
      );
    });
    expect(await screen.findByText('Session type dinonaktifkan')).toBeInTheDocument();
  });

  it('renders a pricing-view-only Studio Operator without mutation controls', async () => {
    const repository = createRepository([createSessionType()]);
    renderPage({
      access: createAccess({
        capabilities: [CAPABILITIES.SETTINGS_PRICING_VIEW],
        role: 'studio_operator',
        uid: 'operator-1',
      }),
      repository,
    });

    expect(await screen.findByText('Mode lihat saja.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tambah session type' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Rehearsal' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nonaktifkan Rehearsal' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Harga' })).toBeInTheDocument();
    expect(repository.createSessionType).not.toHaveBeenCalled();
    expect(repository.updateSessionType).not.toHaveBeenCalled();
  });

  it('shows a recoverable list error and retries the bounded query', async () => {
    const interaction = userEvent.setup();
    const repository = createRepository();
    repository.listSessionTypes
      .mockRejectedValueOnce(Object.assign(new Error('offline'), { code: 'unavailable' }))
      .mockResolvedValueOnce([createSessionType()]);
    renderPage({ repository });

    expect(await screen.findByText('Session types gagal dimuat')).toBeInTheDocument();
    await interaction.click(screen.getByRole('button', { name: 'Coba lagi' }));

    expect(await screen.findByRole('heading', { name: 'Rehearsal' })).toBeInTheDocument();
    expect(repository.listSessionTypes).toHaveBeenCalledTimes(2);
  });
});
