import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { AuthContext } from './auth-context.js';
import { OperatorAccountInvitationPage } from './OperatorAccountInvitationPage.jsx';

const invitationId = 'invite-12345678901234567890';
const invitationPath = `/invite/operator-dina/${invitationId}`;

function createAccess(overrides = {}) {
  return {
    capabilities: [],
    createAccount: vi.fn(),
    error: null,
    profile: null,
    refreshUser: vi.fn(),
    sendVerificationEmail: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn().mockResolvedValue(undefined),
    status: 'unauthenticated',
    user: null,
    ...overrides,
  };
}

function createInvitation(overrides = {}) {
  return {
    displayName: 'Dina Studio',
    email: 'dina@studio37.id',
    expiresAt: new Date('2099-08-29T10:00:00.000Z'),
    invitationId,
    operatorId: 'operator-dina',
    status: 'pending',
    ...overrides,
  };
}

function createRepository(invitation = createInvitation()) {
  return {
    getInvitation: vi.fn().mockResolvedValue(invitation),
    redeemInvitation: vi.fn().mockResolvedValue({
      invitationId,
      operatorId: 'operator-dina',
      userUid: 'invitee-1',
    }),
  };
}

function renderInvitationPage({
  access = createAccess(),
  initialEntry = invitationPath,
  repository = createRepository(),
} = {}) {
  return render(
    <AuthContext.Provider value={access}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            path="/invite/:operatorId/:invitationId"
            element={
              <OperatorAccountInvitationPage
                continueUrl={`http://localhost:5173${initialEntry}`}
                repository={repository}
              />
            }
          />
          <Route path="/login" element={<h1>Login destination</h1>} />
          <Route path="/settings/account" element={<h1>Account destination</h1>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}

describe('OperatorAccountInvitationPage', () => {
  it('rejects malformed invitation paths before any Firestore read', () => {
    const repository = createRepository();
    renderInvitationPage({ initialEntry: '/invite/operator-dina/short', repository });

    expect(screen.getByRole('heading', { name: 'Link undangan tidak valid' })).toBeInTheDocument();
    expect(repository.getInvitation).not.toHaveBeenCalled();
    expect(repository.redeemInvitation).not.toHaveBeenCalled();
  });

  it('creates an email/password identity and sends verification back to the same invite route', async () => {
    const interaction = userEvent.setup();
    const createdUser = {
      email: 'dina@studio37.id',
      emailVerified: false,
      uid: 'invitee-1',
    };
    const access = createAccess({
      createAccount: vi.fn().mockResolvedValue(createdUser),
      sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
    });
    const repository = createRepository();
    renderInvitationPage({ access, repository });

    await interaction.type(screen.getByLabelText(/Email undangan/), ' Dina@Studio37.ID ');
    await interaction.type(screen.getByLabelText(/^Password/), 'secret-password');
    await interaction.type(screen.getByLabelText(/Konfirmasi password/), 'secret-password');
    await interaction.click(screen.getByRole('button', { name: 'Buat akun dan verifikasi email' }));

    expect(access.createAccount).toHaveBeenCalledWith({
      email: 'dina@studio37.id',
      password: 'secret-password',
    });
    expect(access.sendVerificationEmail).toHaveBeenCalledWith(createdUser, {
      continueUrl: `http://localhost:5173${invitationPath}`,
    });
    expect(
      await screen.findByRole('heading', { name: 'Verifikasi email akun' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Permintaan email verifikasi diterima Firebase/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kirim ulang dalam 60 detik' })).toBeDisabled();
    expect(repository.getInvitation).not.toHaveBeenCalled();
  });

  it('uses a resend-specific recovery state when Firebase throttles verification email', async () => {
    const interaction = userEvent.setup();
    const unverifiedUser = {
      email: 'dina@studio37.id',
      emailVerified: false,
      uid: 'invitee-1',
    };
    const access = createAccess({
      sendVerificationEmail: vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('provider details'), { code: 'auth/too-many-requests' }),
        ),
      status: 'profile-missing',
      user: unverifiedUser,
    });
    renderInvitationPage({ access });

    await interaction.click(screen.getByRole('button', { name: 'Kirim email verifikasi' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Firebase sementara membatasi pengiriman email verifikasi/,
    );
    expect(
      screen.queryByText(/Permintaan email verifikasi diterima Firebase/),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kirim ulang dalam 60 detik' })).toBeDisabled();
  });

  it('refreshes the Firebase token before reading a verified invitation', async () => {
    const interaction = userEvent.setup();
    const unverifiedUser = {
      email: 'dina@studio37.id',
      emailVerified: false,
      uid: 'invitee-1',
    };
    const verifiedUser = { ...unverifiedUser, emailVerified: true };
    const access = createAccess({
      refreshUser: vi.fn().mockResolvedValue(verifiedUser),
      status: 'profile-missing',
      user: unverifiedUser,
    });
    const repository = createRepository();
    renderInvitationPage({ access, repository });

    await interaction.click(screen.getByRole('button', { name: 'Saya sudah verifikasi' }));

    expect(access.refreshUser).toHaveBeenCalledWith(unverifiedUser);
    expect(await screen.findByText('Dina Studio')).toBeInTheDocument();
    expect(repository.getInvitation).toHaveBeenCalledWith('operator-dina', invitationId);
  });

  it('lets an existing verified Firebase user sign in without creating another identity', async () => {
    const interaction = userEvent.setup();
    const verifiedUser = {
      email: 'dina@studio37.id',
      emailVerified: true,
      uid: 'invitee-1',
    };
    const access = createAccess({ signIn: vi.fn().mockResolvedValue(verifiedUser) });
    const repository = createRepository();
    renderInvitationPage({ access, repository });

    await interaction.click(screen.getByRole('button', { name: 'Sudah punya akun' }));
    expect(screen.queryByLabelText(/Konfirmasi password/)).not.toBeInTheDocument();
    await interaction.type(screen.getByLabelText(/Email undangan/), 'DINA@STUDIO37.ID');
    await interaction.type(screen.getByLabelText(/^Password/), 'secret-password');
    await interaction.click(screen.getByRole('button', { name: 'Masuk dan periksa undangan' }));

    expect(access.signIn).toHaveBeenCalledWith({
      email: 'dina@studio37.id',
      password: 'secret-password',
    });
    expect(await screen.findByText('Dina Studio')).toBeInTheDocument();
    expect(access.createAccount).not.toHaveBeenCalled();
  });

  it('redeems a verified pending invitation through the exact atomic repository operation', async () => {
    const interaction = userEvent.setup();
    const verifiedUser = {
      email: 'dina@studio37.id',
      emailVerified: true,
      uid: 'invitee-1',
    };
    const repository = createRepository();
    renderInvitationPage({
      access: createAccess({ status: 'profile-missing', user: verifiedUser }),
      repository,
    });

    expect(await screen.findByText('Dina Studio')).toBeInTheDocument();
    expect(screen.getByText('Belum ditetapkan')).toBeInTheDocument();
    await interaction.click(screen.getByRole('button', { name: 'Aktifkan akun Studio37' }));

    await waitFor(() => {
      expect(repository.redeemInvitation).toHaveBeenCalledWith('operator-dina', invitationId, {
        email: 'dina@studio37.id',
        emailVerified: true,
        userUid: 'invitee-1',
      });
    });
    expect(
      await screen.findByRole('heading', { name: 'Akun operator berhasil diaktifkan' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Menyiapkan profil akses…' })).toBeDisabled();
  });

  it('shows a non-secret recovery state when verified invitation access is denied', async () => {
    const repository = createRepository();
    repository.getInvitation.mockRejectedValue(
      Object.assign(new Error('rules details'), { code: 'permission-denied' }),
    );
    renderInvitationPage({
      access: createAccess({
        status: 'profile-missing',
        user: {
          email: 'wrong@studio37.id',
          emailVerified: true,
          uid: 'wrong-user',
        },
      }),
      repository,
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Pastikan email akun sudah terverifikasi dan sama/,
    );
    expect(screen.queryByText('rules details')).not.toBeInTheDocument();
    expect(repository.redeemInvitation).not.toHaveBeenCalled();
  });
});
