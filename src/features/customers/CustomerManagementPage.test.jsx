import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '../../components/feedback/ToastProvider.jsx';
import { AuthContext } from '../auth/auth-context.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { CustomerManagementPage } from './CustomerManagementPage.jsx';

function createCustomer(overrides = {}) {
  return {
    createdAt: new Date('2026-09-01T03:00:00.000Z'),
    createdByUid: 'owner-1',
    displayPhone: '+6281234567890',
    email: 'raka@example.com',
    id: 'customer-raka',
    name: 'Raka Studio',
    normalizedPhone: '+6281234567890',
    notes: 'Repeat rehearsal customer',
    updatedAt: new Date('2026-09-02T04:00:00.000Z'),
    updatedByUid: 'owner-1',
    ...overrides,
  };
}

function createRepository({ directory = [], exactMatches = [] } = {}) {
  return {
    createCustomer: vi.fn(async () => 'customer-created'),
    directoryLimit: 50,
    findCustomersByPhone: vi.fn(async () => exactMatches),
    listCustomerDirectory: vi.fn(async () => directory),
    updateCustomer: vi.fn(async (customerId) => customerId),
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
        <MemoryRouter initialEntries={['/customers']}>
          <CustomerManagementPage repository={repository} />
        </MemoryRouter>
      </AuthContext.Provider>
    </ToastProvider>,
  );
}

describe('CustomerManagementPage', () => {
  it('loads the bounded directory and filters locally by customer identity', async () => {
    const interaction = userEvent.setup();
    const repository = createRepository({
      directory: [
        createCustomer(),
        createCustomer({
          displayPhone: '+6281311112222',
          email: 'sinta@example.com',
          id: 'customer-sinta',
          name: 'Sinta Band',
          normalizedPhone: '+6281311112222',
        }),
      ],
    });
    renderPage({ repository });

    expect(await screen.findByRole('heading', { name: 'Raka Studio' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sinta Band' })).toBeInTheDocument();
    expect(repository.listCustomerDirectory).toHaveBeenCalledOnce();

    await interaction.type(screen.getByLabelText('Cari customer'), 'Sinta');

    expect(screen.queryByRole('heading', { name: 'Raka Studio' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sinta Band' })).toBeInTheDocument();
  });

  it('keeps customer viewers read-only when customer.edit is not delegated', async () => {
    const repository = createRepository({ directory: [createCustomer()] });
    renderPage({
      access: createAccess({ capabilities: [CAPABILITIES.CUSTOMER_VIEW], role: 'studio_operator' }),
      repository,
    });

    expect(await screen.findByText('Mode lihat saja')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tambah customer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Raka Studio' })).not.toBeInTheDocument();
  });

  it('uses exact normalized-phone lookup to surface a customer outside the bounded directory', async () => {
    const interaction = userEvent.setup();
    const outsideCustomer = createCustomer({
      displayPhone: '+6281399990000',
      id: 'customer-outside',
      name: 'Outside Directory',
      normalizedPhone: '+6281399990000',
    });
    const repository = createRepository({
      directory: [createCustomer()],
      exactMatches: [outsideCustomer],
    });
    renderPage({ repository });

    await screen.findByRole('heading', { name: 'Raka Studio' });
    await interaction.type(screen.getByLabelText('Cari customer'), '081399990000');

    expect(await screen.findByRole('heading', { name: 'Outside Directory' })).toBeInTheDocument();
    expect(repository.findCustomersByPhone).toHaveBeenCalledWith('+6281399990000');
  });

  it('creates a normalized customer after validating the form', async () => {
    const interaction = userEvent.setup();
    const repository = createRepository();
    renderPage({ repository });

    await screen.findByText('Belum ada customer');
    await interaction.click(screen.getByRole('button', { name: 'Tambah customer' }));
    await interaction.type(screen.getByLabelText(/Nama customer/), 'Raka Studio');
    await interaction.type(screen.getByLabelText(/Nomor WhatsApp/), '0812 3456 7890');
    await interaction.type(screen.getByLabelText(/^Email/), 'RAKA@Example.COM');
    await interaction.type(screen.getByLabelText(/Catatan/), 'Repeat customer');
    await interaction.click(screen.getByRole('button', { name: 'Simpan customer' }));

    await waitFor(() => {
      expect(repository.createCustomer).toHaveBeenCalledWith(
        {
          displayPhone: '+6281234567890',
          email: 'raka@example.com',
          name: 'Raka Studio',
          notes: 'Repeat customer',
        },
        { actorUid: 'owner-1' },
      );
    });
    expect(await screen.findByText('Customer ditambahkan')).toBeInTheDocument();
  });

  it('requires explicit override before creating a likely duplicate phone record', async () => {
    const interaction = userEvent.setup();
    const existing = createCustomer();
    const repository = createRepository({ exactMatches: [existing] });
    renderPage({ repository });

    await screen.findByText('Belum ada customer');
    await interaction.click(screen.getByRole('button', { name: 'Tambah customer' }));
    await interaction.type(screen.getByLabelText(/Nama customer/), 'Raka Duplicate');
    await interaction.type(screen.getByLabelText(/Nomor WhatsApp/), '0812 3456 7890');
    await interaction.click(screen.getByRole('button', { name: 'Simpan customer' }));

    expect(await screen.findByText('Nomor ini sudah dipakai customer lain.')).toBeInTheDocument();
    expect(repository.createCustomer).not.toHaveBeenCalled();

    await interaction.click(screen.getByRole('button', { name: 'Tetap simpan customer' }));

    await waitFor(() => expect(repository.createCustomer).toHaveBeenCalledOnce());
  });

  it('excludes the current customer from duplicate checks while editing', async () => {
    const interaction = userEvent.setup();
    const existing = createCustomer();
    const repository = createRepository({ directory: [existing], exactMatches: [existing] });
    renderPage({ repository });

    await interaction.click(await screen.findByRole('button', { name: 'Edit Raka Studio' }));
    await interaction.click(screen.getByRole('button', { name: 'Simpan customer' }));

    await waitFor(() => {
      expect(repository.updateCustomer).toHaveBeenCalledWith(
        'customer-raka',
        expect.objectContaining({
          displayPhone: '+6281234567890',
          name: 'Raka Studio',
        }),
        { actorUid: 'owner-1' },
      );
    });
    expect(screen.queryByText('Nomor ini sudah dipakai customer lain.')).not.toBeInTheDocument();
  });

  it('keeps a recoverable load-error state', async () => {
    const repository = createRepository();
    repository.listCustomerDirectory.mockRejectedValueOnce({ code: 'unavailable' });
    renderPage({ repository });

    expect(
      await screen.findByRole('heading', { name: 'Customer belum bisa dimuat' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Firestore sedang tidak tersedia/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeInTheDocument();
  });
});
