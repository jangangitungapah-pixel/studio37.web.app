import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '../../components/feedback/ToastProvider.jsx';
import { AuthContext } from '../auth/auth-context.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { StudioSettingsPage } from './StudioSettingsPage.jsx';

function createStoredSettings(overrides = {}) {
  return {
    bookingIntervalMinutes: 30,
    businessName: 'Studio37',
    createdAt: new Date('2026-08-22T01:00:00.000Z'),
    createdByUid: 'owner-1',
    id: 'studio',
    operatingHours: { closesAtMinutes: 1320, opensAtMinutes: 600 },
    timeZone: 'Asia/Jakarta',
    updatedAt: new Date('2026-08-22T02:00:00.000Z'),
    updatedByUid: 'owner-1',
    ...overrides,
  };
}

function createRepository(settings = null) {
  return {
    createStudioSettings: vi.fn(async () => 'studio'),
    documentId: 'studio',
    getStudioSettings: vi.fn(async () => settings),
    updateStudioSettings: vi.fn(async () => 'studio'),
  };
}

function createAccess({ capabilities = [], role = 'owner', uid = 'owner-1' } = {}) {
  return {
    capabilities,
    profile: {
      displayName: role === 'owner' ? 'Studio37 Owner' : 'Studio Operator',
      permissionSetId: role === 'owner' ? null : 'studio-team',
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
        <MemoryRouter initialEntries={['/settings/studio']}>
          <StudioSettingsPage repository={repository} />
        </MemoryRouter>
      </AuthContext.Provider>
    </ToastProvider>,
  );
}

describe('StudioSettingsPage', () => {
  it('loads one exact document and creates missing configuration only after submit', async () => {
    const interaction = userEvent.setup();
    const repository = createRepository(null);
    renderPage({ repository });

    expect(await screen.findByText('Konfigurasi awal belum tersimpan.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Nama studio \/ bisnis/)).toHaveValue('Studio37');
    expect(screen.getByLabelText(/Jam buka/)).toHaveValue('10:00');

    await interaction.click(screen.getByRole('button', { name: 'Simpan perubahan' }));

    await waitFor(() => {
      expect(repository.createStudioSettings).toHaveBeenCalledWith(
        {
          bookingIntervalMinutes: 30,
          businessName: 'Studio37',
          operatingHours: { closesAtMinutes: 1320, opensAtMinutes: 600 },
          timeZone: 'Asia/Jakarta',
        },
        { actorUid: 'owner-1' },
      );
    });
    expect(await screen.findByText('Studio Settings tersimpan')).toBeInTheDocument();
    expect(repository.updateStudioSettings).not.toHaveBeenCalled();
  });

  it('updates an existing document and keeps the form values after success', async () => {
    const interaction = userEvent.setup();
    const repository = createRepository(createStoredSettings());
    renderPage({ repository });

    const businessName = await screen.findByLabelText(/Nama studio \/ bisnis/);
    await interaction.clear(businessName);
    await interaction.type(businessName, '37 Music Studio');
    await interaction.click(screen.getByRole('button', { name: 'Simpan perubahan' }));

    await waitFor(() => {
      expect(repository.updateStudioSettings).toHaveBeenCalledWith(
        expect.objectContaining({ businessName: '37 Music Studio' }),
        { actorUid: 'owner-1' },
      );
    });
    expect(businessName).toHaveValue('37 Music Studio');
    expect(screen.getByText('Form sudah sinkron')).toBeInTheDocument();
  });

  it('shows inline schedule validation and preserves the attempted input', async () => {
    const interaction = userEvent.setup();
    const repository = createRepository(null);
    renderPage({ repository });

    const opensAt = await screen.findByLabelText(/Jam buka/);
    const closesAt = screen.getByLabelText(/Jam tutup/);
    await interaction.clear(opensAt);
    await interaction.type(opensAt, '22:00');
    await interaction.clear(closesAt);
    await interaction.type(closesAt, '10:00');
    await interaction.click(screen.getByRole('button', { name: 'Simpan perubahan' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Jam tutup harus setelah jam buka/);
    expect(opensAt).toHaveValue('22:00');
    expect(closesAt).toHaveValue('10:00');
    expect(repository.createStudioSettings).not.toHaveBeenCalled();
  });

  it('renders a capability-limited operator in read-only mode', async () => {
    const repository = createRepository(createStoredSettings());
    renderPage({
      access: createAccess({
        capabilities: [CAPABILITIES.SETTINGS_STUDIO_VIEW],
        role: 'studio_operator',
        uid: 'operator-1',
      }),
      repository,
    });

    expect(await screen.findByText('Mode lihat saja.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Nama studio \/ bisnis/)).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Simpan perubahan' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Studio' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Harga' })).not.toBeInTheDocument();
    expect(repository.createStudioSettings).not.toHaveBeenCalled();
    expect(repository.updateStudioSettings).not.toHaveBeenCalled();
  });

  it('shows a recoverable load error and retries without remounting the page', async () => {
    const interaction = userEvent.setup();
    const repository = createRepository();
    repository.getStudioSettings
      .mockRejectedValueOnce(Object.assign(new Error('offline'), { code: 'unavailable' }))
      .mockResolvedValueOnce(createStoredSettings());
    renderPage({ repository });

    expect(await screen.findByText('Konfigurasi gagal dimuat')).toBeInTheDocument();
    await interaction.click(screen.getByRole('button', { name: 'Coba lagi' }));

    expect(await screen.findByLabelText(/Nama studio \/ bisnis/)).toHaveValue('Studio37');
    expect(repository.getStudioSettings).toHaveBeenCalledTimes(2);
  });
});
