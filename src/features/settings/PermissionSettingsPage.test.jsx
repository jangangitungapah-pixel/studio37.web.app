import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '../../components/feedback/ToastProvider.jsx';
import { AuthContext } from '../auth/auth-context.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { PermissionSettingsPage } from './PermissionSettingsPage.jsx';

function createPermissionSet(overrides = {}) {
  return {
    capabilities: [CAPABILITIES.DASHBOARD_VIEW, CAPABILITIES.BOOKING_VIEW],
    createdAt: new Date('2026-08-23T01:00:00.000Z'),
    id: 'front-desk',
    name: 'Front Desk',
    status: 'active',
    updatedAt: new Date('2026-08-23T02:00:00.000Z'),
    ...overrides,
  };
}

function createOperator(overrides = {}) {
  return {
    displayName: 'Dina Studio',
    id: 'operator-dina',
    linkedUserUid: 'user-dina',
    operatorTypes: ['studio_operator'],
    status: 'active',
    ...overrides,
  };
}

function createUserProfile(overrides = {}) {
  return {
    displayName: 'Dina Studio',
    email: 'dina@studio37.id',
    operatorId: 'operator-dina',
    permissionSetId: null,
    role: 'studio_operator',
    status: 'active',
    uid: 'user-dina',
    ...overrides,
  };
}

function createPermissionRepository({
  permissionSets = [],
  userProfile = createUserProfile(),
} = {}) {
  return {
    assignPermissionSetToUser: vi.fn(async (userUid, permissionSetId) => ({
      changed: true,
      permissionSetId,
      userUid,
    })),
    createPermissionSet: vi.fn(async () => 'permission-created'),
    getUserByUid: vi.fn(async () => userProfile),
    listLimit: 50,
    listPermissionSets: vi.fn(async () => permissionSets),
    setPermissionSetStatus: vi.fn(async (permissionSetId) => permissionSetId),
    updatePermissionSet: vi.fn(async (permissionSetId) => permissionSetId),
  };
}

function createOperatorRepository(operators = []) {
  return {
    listLimit: 100,
    listOperators: vi.fn(async () => operators),
  };
}

function createAccess(role = 'owner') {
  return {
    capabilities: [],
    profile: {
      displayName: role === 'owner' ? 'Studio37 Owner' : 'Studio Operator',
      permissionSetId: role === 'owner' ? null : 'front-desk',
      role,
      status: 'active',
      uid: role === 'owner' ? 'owner-1' : 'operator-1',
    },
    status: 'authenticated',
    user: { email: `${role}@studio37.id`, uid: role === 'owner' ? 'owner-1' : 'operator-1' },
  };
}

function renderPage({
  access = createAccess(),
  operatorRepository = createOperatorRepository(),
  repository = createPermissionRepository(),
} = {}) {
  return render(
    <ToastProvider>
      <AuthContext.Provider value={access}>
        <MemoryRouter initialEntries={['/settings/permissions']}>
          <PermissionSettingsPage operatorRepository={operatorRepository} repository={repository} />
        </MemoryRouter>
      </AuthContext.Provider>
    </ToastProvider>,
  );
}

describe('PermissionSettingsPage', () => {
  it('loads only bounded template/operator lists and defers every exact user read to an action', async () => {
    const repository = createPermissionRepository({
      permissionSets: [
        createPermissionSet(),
        createPermissionSet({
          capabilities: [],
          id: 'no-access',
          name: 'Login Tanpa Akses',
          status: 'disabled',
        }),
      ],
    });
    const operatorRepository = createOperatorRepository([
      createOperator(),
      createOperator({
        displayName: 'Budi Tanpa Login',
        id: 'operator-budi',
        linkedUserUid: null,
      }),
      createOperator({
        displayName: 'Citra Engineer',
        id: 'operator-citra',
        linkedUserUid: 'user-citra',
        operatorTypes: ['recording_engineer'],
      }),
    ]);

    renderPage({ operatorRepository, repository });

    expect(await screen.findByRole('heading', { name: 'Front Desk' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Login Tanpa Akses' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dina Studio' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Budi Tanpa Login' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Citra Engineer' })).not.toBeInTheDocument();
    expect(repository.listPermissionSets).toHaveBeenCalledOnce();
    expect(operatorRepository.listOperators).toHaveBeenCalledOnce();
    expect(repository.getUserByUid).not.toHaveBeenCalled();
    expect(repository).not.toHaveProperty('listUsers');
  });

  it('creates a normalized grouped permission template without exposing Owner capabilities', async () => {
    const interaction = userEvent.setup();
    const repository = createPermissionRepository();
    renderPage({ repository });

    await screen.findByText('Belum ada template permission');
    await interaction.click(screen.getByRole('button', { name: 'Buat template' }));
    await interaction.type(screen.getByLabelText(/Nama template/), ' Front Desk ');
    await interaction.click(screen.getByRole('checkbox', { name: /Lihat dashboard/ }));
    await interaction.click(screen.getByRole('checkbox', { name: /Override harga/ }));

    expect(screen.queryByText(CAPABILITIES.PERMISSIONS_MANAGE)).not.toBeInTheDocument();
    expect(screen.queryByText(CAPABILITIES.DANGER_ZONE_EXECUTE)).not.toBeInTheDocument();
    await interaction.click(screen.getByRole('button', { name: 'Simpan template' }));

    await waitFor(() => {
      expect(repository.createPermissionSet).toHaveBeenCalledWith({
        capabilities: [CAPABILITIES.BOOKING_OVERRIDE_PRICE, CAPABILITIES.DASHBOARD_VIEW],
        name: 'Front Desk',
      });
    });
    expect(await screen.findByText('Template dibuat')).toBeInTheDocument();
    expect(repository.listPermissionSets).toHaveBeenCalledTimes(2);
  });

  it('edits capabilities without mixing the status mutation into the write', async () => {
    const interaction = userEvent.setup();
    const repository = createPermissionRepository({ permissionSets: [createPermissionSet()] });
    renderPage({ repository });

    await interaction.click(await screen.findByRole('button', { name: 'Edit Front Desk' }));
    expect(screen.getByRole('checkbox', { name: /Lihat dashboard/ })).toBeChecked();
    await interaction.click(screen.getByRole('checkbox', { name: /Lihat dashboard/ }));
    await interaction.click(screen.getByRole('checkbox', { name: /Buat booking/ }));
    await interaction.click(screen.getByRole('button', { name: 'Simpan template' }));

    await waitFor(() => {
      expect(repository.updatePermissionSet).toHaveBeenCalledWith('front-desk', {
        capabilities: [CAPABILITIES.BOOKING_CREATE, CAPABILITIES.BOOKING_VIEW],
        name: 'Front Desk',
      });
    });
    expect(repository.setPermissionSetStatus).not.toHaveBeenCalled();
  });

  it('requires explicit confirmation before soft-disabling a template', async () => {
    const interaction = userEvent.setup();
    const repository = createPermissionRepository({ permissionSets: [createPermissionSet()] });
    renderPage({ repository });

    await interaction.click(await screen.findByRole('button', { name: 'Nonaktifkan Front Desk' }));
    expect(screen.getByRole('dialog')).toHaveTextContent(/langsung dicabut/);
    await interaction.click(screen.getByRole('button', { name: 'Nonaktifkan template' }));

    await waitFor(() => {
      expect(repository.setPermissionSetStatus).toHaveBeenCalledWith('front-desk', 'disabled');
    });
    expect(await screen.findByText('Template dinonaktifkan')).toBeInTheDocument();
    expect(repository.listPermissionSets).toHaveBeenCalledTimes(2);
  });

  it('reads one exact linked user only after Owner opens assignment and saves an active set', async () => {
    const interaction = userEvent.setup();
    const permissionSets = [
      createPermissionSet(),
      createPermissionSet({ id: 'session-team', name: 'Session Team' }),
    ];
    const repository = createPermissionRepository({ permissionSets });
    const operatorRepository = createOperatorRepository([createOperator()]);
    renderPage({ operatorRepository, repository });

    await interaction.click(
      await screen.findByRole('button', { name: 'Kelola akses Dina Studio' }),
    );
    expect(repository.getUserByUid).toHaveBeenCalledWith('user-dina');
    expect(await screen.findByText('dina@studio37.id')).toBeInTheDocument();
    await interaction.selectOptions(
      screen.getByRole('combobox', { name: 'Template permission' }),
      'session-team',
    );
    await interaction.click(screen.getByRole('button', { name: 'Simpan permission' }));

    await waitFor(() => {
      expect(repository.assignPermissionSetToUser).toHaveBeenCalledWith(
        'user-dina',
        'session-team',
      );
    });
    expect(await screen.findByText('Permission ditetapkan')).toBeInTheDocument();
    expect(operatorRepository.listOperators).toHaveBeenCalledOnce();
  });

  it('allows a disabled linked operator to clear an existing assignment but not choose an active set', async () => {
    const interaction = userEvent.setup();
    const repository = createPermissionRepository({
      permissionSets: [createPermissionSet()],
      userProfile: createUserProfile({ permissionSetId: 'front-desk' }),
    });
    const operatorRepository = createOperatorRepository([createOperator({ status: 'disabled' })]);
    renderPage({ operatorRepository, repository });

    await interaction.click(
      await screen.findByRole('button', { name: 'Kelola akses Dina Studio' }),
    );
    expect(await screen.findByText(/Template aktif tidak dapat ditetapkan/)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Front Desk/ })).toBeDisabled();
    await interaction.selectOptions(
      screen.getByRole('combobox', { name: 'Template permission' }),
      '',
    );
    await interaction.click(screen.getByRole('button', { name: 'Simpan permission' }));

    await waitFor(() => {
      expect(repository.assignPermissionSetToUser).toHaveBeenCalledWith('user-dina', null);
    });
    expect(await screen.findByText('Permission dicabut')).toBeInTheDocument();
  });

  it('performs no permission or operator read when rendered for a non-Owner session', () => {
    const repository = createPermissionRepository();
    const operatorRepository = createOperatorRepository();
    renderPage({
      access: createAccess('studio_operator'),
      operatorRepository,
      repository,
    });

    expect(screen.getByText('Halaman khusus Owner')).toBeInTheDocument();
    expect(repository.listPermissionSets).not.toHaveBeenCalled();
    expect(operatorRepository.listOperators).not.toHaveBeenCalled();
  });
});
