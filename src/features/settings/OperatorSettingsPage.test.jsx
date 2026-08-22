import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '../../components/feedback/ToastProvider.jsx';
import { AuthContext } from '../auth/auth-context.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { OperatorSettingsPage } from './OperatorSettingsPage.jsx';
import { OPERATOR_TYPES } from './operators.js';

function createOperator(overrides = {}) {
  return {
    createdAt: new Date('2026-08-22T01:00:00.000Z'),
    createdByUid: 'owner-1',
    displayName: 'Budi Engineer',
    email: 'budi@studio37.id',
    id: 'operator-budi',
    linkedUserUid: null,
    operatorTypes: [OPERATOR_TYPES.RECORDING_ENGINEER],
    phone: '+6281234567890',
    status: 'active',
    updatedAt: new Date('2026-08-22T02:00:00.000Z'),
    updatedByUid: 'owner-1',
    ...overrides,
  };
}

function createRepository(operators = []) {
  return {
    createOperator: vi.fn(async () => 'operator-created'),
    listLimit: 100,
    listOperators: vi.fn(async () => operators),
    setOperatorStatus: vi.fn(async (operatorId) => operatorId),
    updateOperator: vi.fn(async (operatorId) => operatorId),
  };
}

function createAccess({ capabilities = [], role = 'owner', uid = 'owner-1' } = {}) {
  return {
    capabilities,
    profile: {
      displayName: role === 'owner' ? 'Studio37 Owner' : 'Studio Operator',
      permissionSetId: role === 'owner' ? null : 'operator-team',
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
        <MemoryRouter initialEntries={['/settings/operators']}>
          <OperatorSettingsPage repository={repository} />
        </MemoryRouter>
      </AuthContext.Provider>
    </ToastProvider>,
  );
}

describe('OperatorSettingsPage', () => {
  it('loads active, disabled, login, and no-login operator context from one repository list', async () => {
    const repository = createRepository([
      createOperator(),
      createOperator({
        displayName: 'Citra Studio',
        id: 'operator-citra',
        linkedUserUid: 'user-citra',
        operatorTypes: [OPERATOR_TYPES.STUDIO_OPERATOR],
        status: 'disabled',
      }),
    ]);
    renderPage({ repository });

    expect(await screen.findByRole('heading', { name: 'Budi Engineer' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Citra Studio' })).toBeInTheDocument();
    expect(screen.getByText('Recording Engineer')).toBeInTheDocument();
    expect(screen.getByText('Studio Operator')).toBeInTheDocument();
    expect(screen.getByText('Tanpa login')).toBeInTheDocument();
    expect(screen.getByText('Login terhubung')).toBeInTheDocument();
    expect(repository.listOperators).toHaveBeenCalledOnce();
  });

  it('creates a normalized operator without creating or linking a login account', async () => {
    const interaction = userEvent.setup();
    const repository = createRepository([]);
    renderPage({ repository });

    await screen.findByText('Belum ada profil operator');
    await interaction.click(screen.getByRole('button', { name: 'Tambah operator' }));
    await interaction.type(screen.getByLabelText(/Nama operator/), 'Budi Engineer');
    await interaction.type(screen.getByLabelText(/Email kontak/), 'BUDI@Studio37.ID');
    await interaction.type(screen.getByLabelText(/Nomor WhatsApp/), '0812-3456-7890');
    await interaction.click(screen.getByRole('checkbox', { name: /Recording Engineer/ }));
    await interaction.click(screen.getByRole('button', { name: 'Simpan operator' }));

    await waitFor(() => {
      expect(repository.createOperator).toHaveBeenCalledWith(
        {
          displayName: 'Budi Engineer',
          email: 'budi@studio37.id',
          operatorTypes: [OPERATOR_TYPES.RECORDING_ENGINEER],
          phone: '+6281234567890',
        },
        { actorUid: 'owner-1' },
      );
    });
    expect(await screen.findByText('Operator ditambahkan')).toBeInTheDocument();
    expect(repository.listOperators).toHaveBeenCalledTimes(2);
    expect(repository).not.toHaveProperty('linkUserAccount');
  });

  it('edits operator identity and types without changing status or account links', async () => {
    const interaction = userEvent.setup();
    const repository = createRepository([createOperator()]);
    renderPage({ repository });

    await interaction.click(await screen.findByRole('button', { name: 'Edit Budi Engineer' }));
    const displayName = screen.getByLabelText(/Nama operator/);
    await interaction.clear(displayName);
    await interaction.type(displayName, 'Budi Utama');
    await interaction.click(screen.getByRole('checkbox', { name: /Studio Operator/ }));
    await interaction.click(screen.getByRole('button', { name: 'Simpan operator' }));

    await waitFor(() => {
      expect(repository.updateOperator).toHaveBeenCalledWith(
        'operator-budi',
        expect.objectContaining({
          displayName: 'Budi Utama',
          operatorTypes: [OPERATOR_TYPES.STUDIO_OPERATOR, OPERATOR_TYPES.RECORDING_ENGINEER],
        }),
        { actorUid: 'owner-1' },
      );
    });
    expect(repository.setOperatorStatus).not.toHaveBeenCalled();
    expect(repository.updateOperator.mock.calls[0][1]).not.toHaveProperty('linkedUserUid');
  });

  it('requires explicit confirmation before soft-disabling an operator', async () => {
    const interaction = userEvent.setup();
    const repository = createRepository([createOperator()]);
    renderPage({ repository });

    await interaction.click(
      await screen.findByRole('button', { name: 'Nonaktifkan Budi Engineer' }),
    );
    expect(screen.getByRole('dialog')).toHaveTextContent(/Tidak ada hard delete/);
    await interaction.click(screen.getByRole('button', { name: 'Nonaktifkan operator' }));

    await waitFor(() => {
      expect(repository.setOperatorStatus).toHaveBeenCalledWith('operator-budi', 'disabled', {
        actorUid: 'owner-1',
      });
    });
    expect(await screen.findByText('Operator dinonaktifkan')).toBeInTheDocument();
  });

  it('shows inline validation while preserving attempted contact and type input', async () => {
    const interaction = userEvent.setup();
    const repository = createRepository([]);
    renderPage({ repository });

    await screen.findByText('Belum ada profil operator');
    await interaction.click(screen.getByRole('button', { name: 'Tambah operator' }));
    await interaction.type(screen.getByLabelText(/Email kontak/), 'email-salah');
    await interaction.type(screen.getByLabelText(/Nomor WhatsApp/), '+441234');
    await interaction.click(screen.getByRole('button', { name: 'Simpan operator' }));

    expect(await screen.findByText(/Nama operator wajib diisi/)).toBeInTheDocument();
    expect(screen.getByText(/Masukkan alamat email yang valid/)).toBeInTheDocument();
    expect(screen.getByText(/Gunakan nomor Indonesia yang valid/)).toBeInTheDocument();
    expect(screen.getByText(/Pilih minimal satu jenis operator/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email kontak/)).toHaveValue('email-salah');
    expect(repository.createOperator).not.toHaveBeenCalled();
  });

  it('keeps view-only users away from mutations and supports a recoverable reload', async () => {
    const interaction = userEvent.setup();
    const repository = createRepository([createOperator()]);
    repository.listOperators
      .mockRejectedValueOnce(Object.assign(new Error('offline'), { code: 'unavailable' }))
      .mockResolvedValueOnce([createOperator()]);
    renderPage({
      access: createAccess({
        capabilities: [CAPABILITIES.SETTINGS_OPERATORS_VIEW],
        role: 'studio_operator',
        uid: 'operator-viewer',
      }),
      repository,
    });

    expect(await screen.findByText('Daftar operator gagal dimuat')).toBeInTheDocument();
    await interaction.click(screen.getByRole('button', { name: 'Coba lagi' }));

    expect(await screen.findByRole('heading', { name: 'Budi Engineer' })).toBeInTheDocument();
    expect(screen.getByText('Mode lihat saja.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tambah operator' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Budi Engineer' })).not.toBeInTheDocument();
    expect(repository.createOperator).not.toHaveBeenCalled();
    expect(repository.updateOperator).not.toHaveBeenCalled();
    expect(repository.setOperatorStatus).not.toHaveBeenCalled();
  });

  it('disables creation when the fixed repository bound is reached', async () => {
    const repository = createRepository([createOperator()]);
    repository.listLimit = 1;
    renderPage({ repository });

    expect(await screen.findByText('Batas 1 operator tercapai.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tambah operator' })).toBeDisabled();
  });
});
