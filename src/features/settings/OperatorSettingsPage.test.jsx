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

function createUserProfile(overrides = {}) {
  return {
    createdAt: new Date('2026-08-22T01:00:00.000Z'),
    displayName: 'Dina Operator',
    email: 'dina@studio37.id',
    id: 'user-dina',
    operatorId: null,
    permissionSetId: null,
    phone: '+6281234567800',
    role: 'studio_operator',
    status: 'active',
    uid: 'user-dina',
    updatedAt: new Date('2026-08-22T02:00:00.000Z'),
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

function createAccountRepository(profile = createUserProfile()) {
  return {
    getUserByUid: vi.fn(async () => profile),
    linkOperatorToUser: vi.fn(async (operatorId, userUid) => ({ operatorId, userUid })),
    unlinkOperatorFromUser: vi.fn(async (operatorId) => ({ operatorId, userUid: profile?.uid })),
  };
}

function createInvitationRepository() {
  return {
    createInvitation: vi.fn(async (operatorId) => ({
      invitationId: 'invite-12345678901234567890',
      operatorId,
    })),
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

function renderPage({
  access = createAccess(),
  accountRepository = createAccountRepository(),
  invitationRepository = createInvitationRepository(),
  repository = createRepository(),
} = {}) {
  return render(
    <ToastProvider>
      <AuthContext.Provider value={access}>
        <MemoryRouter initialEntries={['/settings/operators']}>
          <OperatorSettingsPage
            accountRepository={accountRepository}
            invitationRepository={invitationRepository}
            repository={repository}
          />
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

  it('lets an Owner review one exact user profile before linking it atomically', async () => {
    const interaction = userEvent.setup();
    const repository = createRepository([createOperator()]);
    const accountRepository = createAccountRepository();
    renderPage({ accountRepository, repository });

    await interaction.click(
      await screen.findByRole('button', { name: 'Link via UID Budi Engineer' }),
    );
    await interaction.type(screen.getByLabelText(/Firebase user UID/), ' user-dina ');
    await interaction.click(screen.getByRole('button', { name: 'Cari profil' }));

    expect(accountRepository.getUserByUid).toHaveBeenCalledWith('user-dina');
    expect(await screen.findByText('dina@studio37.id')).toBeInTheDocument();
    expect(screen.getByText('Belum ditetapkan')).toBeInTheDocument();
    expect(screen.getByText('Belum terhubung')).toBeInTheDocument();
    await interaction.click(screen.getByRole('button', { name: 'Hubungkan akun' }));

    await waitFor(() => {
      expect(accountRepository.linkOperatorToUser).toHaveBeenCalledWith(
        'operator-budi',
        'user-dina',
        { actorUid: 'owner-1' },
      );
    });
    expect(await screen.findByText('Akun terhubung')).toBeInTheDocument();
    expect(repository.listOperators).toHaveBeenCalledTimes(2);
    expect(accountRepository).not.toHaveProperty('listUsers');
    expect(accountRepository).not.toHaveProperty('setPermissionSet');
  });

  it('blocks direct reassignment while preserving the exact UID for correction', async () => {
    const interaction = userEvent.setup();
    const accountRepository = createAccountRepository(
      createUserProfile({ operatorId: 'operator-lain' }),
    );
    renderPage({
      accountRepository,
      repository: createRepository([createOperator()]),
    });

    await interaction.click(
      await screen.findByRole('button', { name: 'Link via UID Budi Engineer' }),
    );
    await interaction.type(screen.getByLabelText(/Firebase user UID/), 'user-dina');
    await interaction.click(screen.getByRole('button', { name: 'Cari profil' }));

    expect(await screen.findByText('Profil tidak dapat dipilih.')).toBeInTheDocument();
    expect(screen.getAllByText(/operator-lain/)).toHaveLength(2);
    expect(screen.getByLabelText(/Firebase user UID/)).toHaveValue('user-dina');
    expect(screen.getByRole('button', { name: 'Hubungkan akun' })).toBeDisabled();
    expect(accountRepository.linkOperatorToUser).not.toHaveBeenCalled();
  });

  it('loads the reciprocal profile and requires confirmation before unlinking', async () => {
    const interaction = userEvent.setup();
    const linkedOperator = createOperator({ linkedUserUid: 'user-dina' });
    const accountRepository = createAccountRepository(
      createUserProfile({ operatorId: 'operator-budi' }),
    );
    const repository = createRepository([linkedOperator]);
    renderPage({ accountRepository, repository });

    await interaction.click(
      await screen.findByRole('button', { name: 'Kelola akun Budi Engineer' }),
    );

    expect(await screen.findByText('dina@studio37.id')).toBeInTheDocument();
    expect(accountRepository.getUserByUid).toHaveBeenCalledWith('user-dina');
    await interaction.click(screen.getByRole('button', { name: 'Putuskan akun' }));

    await waitFor(() => {
      expect(accountRepository.unlinkOperatorFromUser).toHaveBeenCalledWith('operator-budi', {
        actorUid: 'owner-1',
      });
    });
    expect(await screen.findByText('Hubungan akun diputuskan')).toBeInTheDocument();
    expect(repository.listOperators).toHaveBeenCalledTimes(2);
  });

  it('lets an Owner create a copyable invitation only for an eligible Studio Operator', async () => {
    const interaction = userEvent.setup();
    const invitationRepository = createInvitationRepository();
    renderPage({
      invitationRepository,
      repository: createRepository([
        createOperator({ operatorTypes: [OPERATOR_TYPES.STUDIO_OPERATOR] }),
      ]),
    });

    await interaction.click(
      await screen.findByRole('button', { name: 'Undang akun Budi Engineer' }),
    );
    expect(screen.getByRole('dialog')).toHaveTextContent(/Hak akses tetap terkunci/);
    await interaction.click(screen.getByRole('button', { name: 'Buat link undangan' }));

    await waitFor(() => {
      expect(invitationRepository.createInvitation).toHaveBeenCalledWith('operator-budi', {
        actorUid: 'owner-1',
      });
    });
    expect((await screen.findByLabelText('Link undangan')).value).toContain(
      '/invite/operator-budi/invite-12345678901234567890',
    );
    expect(invitationRepository).not.toHaveProperty('listInvitations');
  });

  it('offers a recoverable retry when the linked profile read is unavailable', async () => {
    const interaction = userEvent.setup();
    const accountRepository = createAccountRepository(
      createUserProfile({ operatorId: 'operator-budi' }),
    );
    accountRepository.getUserByUid
      .mockRejectedValueOnce(Object.assign(new Error('offline'), { code: 'unavailable' }))
      .mockResolvedValueOnce(createUserProfile({ operatorId: 'operator-budi' }));
    renderPage({
      accountRepository,
      repository: createRepository([createOperator({ linkedUserUid: 'user-dina' })]),
    });

    await interaction.click(
      await screen.findByRole('button', { name: 'Kelola akun Budi Engineer' }),
    );
    expect(await screen.findByText(/Firestore sedang tidak tersedia/)).toBeInTheDocument();
    await interaction.click(screen.getByRole('button', { name: 'Coba lagi' }));

    expect(await screen.findByText('dina@studio37.id')).toBeInTheDocument();
    expect(accountRepository.getUserByUid).toHaveBeenCalledTimes(2);
  });

  it('keeps account linking Owner-only even for delegated operator managers', async () => {
    const repository = createRepository([createOperator()]);
    const accountRepository = createAccountRepository();
    renderPage({
      access: createAccess({
        capabilities: [
          CAPABILITIES.SETTINGS_OPERATORS_MANAGE,
          CAPABILITIES.SETTINGS_OPERATORS_VIEW,
        ],
        role: 'studio_operator',
        uid: 'operator-manager',
      }),
      accountRepository,
      repository,
    });

    expect(await screen.findByRole('button', { name: 'Edit Budi Engineer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nonaktifkan Budi Engineer' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Link via UID Budi Engineer' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Undang akun Budi Engineer' }),
    ).not.toBeInTheDocument();
    expect(accountRepository.getUserByUid).not.toHaveBeenCalled();
    expect(accountRepository.linkOperatorToUser).not.toHaveBeenCalled();
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
