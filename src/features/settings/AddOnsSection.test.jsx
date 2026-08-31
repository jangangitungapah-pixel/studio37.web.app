import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '../../components/feedback/ToastProvider.jsx';
import { ADD_ON_PRICING_TYPES } from '../pricing/addOnPricing.js';
import { PRICING_RULE_ROUNDING_MODES } from '../pricing/pricingRules.js';
import { AddOnsSection } from './AddOnsSection.jsx';

function createSessionType(overrides = {}) {
  return {
    code: 'RECORDING',
    id: 'session-recording',
    name: 'Recording',
    status: 'active',
    ...overrides,
  };
}

function createAddOn(overrides = {}) {
  return {
    configuration: { amountIdr: 50_000 },
    createdAt: new Date('2026-08-31T01:00:00.000Z'),
    createdByUid: 'owner-1',
    description: 'Tambahan microphone',
    displayOrder: 1,
    id: 'addon-mic',
    name: 'Extra microphone',
    pricingType: ADD_ON_PRICING_TYPES.FIXED,
    sessionTypeId: null,
    status: 'active',
    updatedAt: new Date('2026-08-31T02:00:00.000Z'),
    updatedByUid: 'owner-1',
    ...overrides,
  };
}

function createRepository(addOns = []) {
  return {
    createAddOn: vi.fn(async () => 'addon-created'),
    listAddOns: vi.fn(async () => addOns),
    listLimit: 100,
    setAddOnStatus: vi.fn(async (addOnId) => addOnId),
    updateAddOn: vi.fn(async (addOnId) => addOnId),
  };
}

function createAccess() {
  return { user: { email: 'owner@studio37.test', uid: 'owner-1' } };
}

function renderSection({
  canEdit = true,
  repository = createRepository(),
  sessionTypes = [createSessionType()],
} = {}) {
  render(
    <ToastProvider>
      <AddOnsSection
        access={createAccess()}
        canEdit={canEdit}
        repository={repository}
        sessionTypes={sessionTypes}
      />
    </ToastProvider>,
  );
  return repository;
}

describe('AddOnsSection', () => {
  it('loads bounded add-ons with human-readable pricing and session context', async () => {
    const repository = createRepository([
      createAddOn({ sessionTypeId: 'session-recording' }),
      createAddOn({
        configuration: { amountPerUnitIdr: 25_000 },
        displayOrder: 2,
        id: 'addon-cable',
        name: 'Extra cable',
        pricingType: ADD_ON_PRICING_TYPES.QUANTITY,
      }),
    ]);
    renderSection({ repository });

    expect(await screen.findByRole('heading', { name: 'Extra microphone' })).toBeInTheDocument();
    expect(screen.getByText('Recording · RECORDING')).toBeInTheDocument();
    expect(screen.getByText('Semua session type')).toBeInTheDocument();
    expect(screen.getByText(/25\.000.*unit/)).toBeInTheDocument();
    expect(repository.listAddOns).toHaveBeenCalledOnce();
  });

  it('creates an exact-session fixed add-on through the canonical repository', async () => {
    const interaction = userEvent.setup();
    const repository = createRepository([]);
    renderSection({ repository });

    await screen.findByText('Belum ada add-on');
    await interaction.click(screen.getByRole('button', { name: 'Tambah add-on' }));
    await interaction.type(screen.getByLabelText(/^Nama add-on/), 'Engineer service');
    await interaction.selectOptions(screen.getByLabelText(/^Tersedia untuk/), 'session-recording');
    await interaction.selectOptions(
      screen.getByLabelText(/^Model harga add-on/),
      ADD_ON_PRICING_TYPES.FIXED,
    );
    await interaction.type(screen.getByLabelText(/^Harga add-on \(IDR\)/), '150000');
    await interaction.click(screen.getByRole('button', { name: 'Simpan add-on' }));

    await waitFor(() => {
      expect(repository.createAddOn).toHaveBeenCalledWith(
        expect.objectContaining({
          configuration: { amountIdr: 150_000 },
          displayOrder: 1,
          name: 'Engineer service',
          pricingType: ADD_ON_PRICING_TYPES.FIXED,
          sessionTypeId: 'session-recording',
        }),
        { actorUid: 'owner-1' },
      );
    });
    expect(await screen.findByText('Add-on ditambahkan')).toBeInTheDocument();
  });

  it('creates a time-based add-on without embedding booking duration', async () => {
    const interaction = userEvent.setup();
    const repository = createRepository([]);
    renderSection({ repository });

    await screen.findByText('Belum ada add-on');
    await interaction.click(screen.getByRole('button', { name: 'Tambah add-on' }));
    await interaction.type(screen.getByLabelText(/^Nama add-on/), 'Extra engineer time');
    await interaction.selectOptions(
      screen.getByLabelText(/^Model harga add-on/),
      ADD_ON_PRICING_TYPES.TIME,
    );
    await interaction.type(screen.getByLabelText(/^Harga per increment \(IDR\)/), '80000');
    await interaction.clear(screen.getByLabelText(/^Increment waktu/));
    await interaction.type(screen.getByLabelText(/^Increment waktu/), '30');
    await interaction.selectOptions(
      screen.getByLabelText(/^Rounding waktu/),
      PRICING_RULE_ROUNDING_MODES.ROUND_UP,
    );
    await interaction.click(screen.getByRole('button', { name: 'Simpan add-on' }));

    await waitFor(() => {
      expect(repository.createAddOn).toHaveBeenCalledWith(
        expect.objectContaining({
          configuration: {
            amountPerIncrementIdr: 80_000,
            incrementMinutes: 30,
            roundingMode: PRICING_RULE_ROUNDING_MODES.ROUND_UP,
          },
          pricingType: ADD_ON_PRICING_TYPES.TIME,
        }),
        { actorUid: 'owner-1' },
      );
    });
    expect(repository.createAddOn.mock.calls[0][0]).not.toHaveProperty('durationMinutes');
  });

  it('edits an add-on while preserving document identity and can soft-disable it', async () => {
    const interaction = userEvent.setup();
    const repository = createRepository([createAddOn()]);
    renderSection({ repository });

    await interaction.click(await screen.findByRole('button', { name: 'Edit add-on Extra microphone' }));
    const amountInput = screen.getByLabelText(/^Harga add-on \(IDR\)/);
    await interaction.clear(amountInput);
    await interaction.type(amountInput, '60000');
    await interaction.click(screen.getByRole('button', { name: 'Simpan add-on' }));

    await waitFor(() => {
      expect(repository.updateAddOn).toHaveBeenCalledWith(
        'addon-mic',
        expect.objectContaining({ configuration: { amountIdr: 60_000 } }),
        { actorUid: 'owner-1' },
      );
    });

    repository.listAddOns.mockResolvedValueOnce([createAddOn()]);
    await waitFor(() => expect(repository.listAddOns).toHaveBeenCalledTimes(2));
    await interaction.click(screen.getByRole('button', { name: 'Nonaktifkan add-on Extra microphone' }));
    await interaction.click(screen.getByRole('button', { name: 'Nonaktifkan' }));

    await waitFor(() => {
      expect(repository.setAddOnStatus).toHaveBeenCalledWith('addon-mic', 'disabled', {
        actorUid: 'owner-1',
      });
    });
  });

  it('renders view-only add-ons without mutation controls', async () => {
    renderSection({ canEdit: false, repository: createRepository([createAddOn()]) });

    expect(await screen.findByRole('heading', { name: 'Extra microphone' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tambah add-on' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit add-on Extra microphone' })).not.toBeInTheDocument();
  });

  it('shows a recoverable list error and retries the bounded query', async () => {
    const interaction = userEvent.setup();
    const repository = createRepository();
    repository.listAddOns
      .mockRejectedValueOnce(Object.assign(new Error('offline'), { code: 'unavailable' }))
      .mockResolvedValueOnce([createAddOn()]);
    renderSection({ repository });

    expect(await screen.findByText('Add-ons gagal dimuat')).toBeInTheDocument();
    await interaction.click(screen.getByRole('button', { name: 'Coba lagi add-ons' }));
    expect(await screen.findByRole('heading', { name: 'Extra microphone' })).toBeInTheDocument();
    expect(repository.listAddOns).toHaveBeenCalledTimes(2);
  });
});
