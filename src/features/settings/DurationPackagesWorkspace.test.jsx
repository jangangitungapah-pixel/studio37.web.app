import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '../../components/feedback/ToastProvider.jsx';
import {
  PRICING_RULE_MODELS,
  PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES,
  PRICING_RULE_STATUSES,
} from '../pricing/pricingRules.js';
import { DurationPackagesWorkspace } from './DurationPackagesWorkspace.jsx';

function createSessionType(overrides = {}) {
  return {
    code: 'RECORDING',
    id: 'session-recording',
    name: 'Recording',
    status: 'active',
    ...overrides,
  };
}

function createStudioRoom(id = 'studio-a', overrides = {}) {
  return {
    code: id === 'studio-a' ? 'A' : 'B',
    id,
    name: id === 'studio-a' ? 'Studio A' : 'Studio B',
    status: 'active',
    ...overrides,
  };
}

function createPackageRule(durationMinutes, overrides = {}) {
  return {
    configuration: {
      additionalAmountPerIncrementIdr: null,
      additionalIncrementMinutes: null,
      amountIdr: durationMinutes === 180 ? 450000 : 800000,
      durationMinutes,
      extraTimePolicy: PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.BLOCKED,
      roundingMode: null,
    },
    effectiveFrom: null,
    effectiveUntil: null,
    id: `package-${durationMinutes}`,
    name: `Recording ${durationMinutes / 60} jam`,
    pricingModel: PRICING_RULE_MODELS.DURATION_PACKAGE,
    priority: 200,
    sessionTypeId: 'session-recording',
    status: PRICING_RULE_STATUSES.ACTIVE,
    studioId: 'studio-a',
    ...overrides,
  };
}

function createRepository() {
  return {
    createPricingRule: vi.fn(async () => 'package-created'),
    deletePricingRule: vi.fn(async (pricingRuleId) => pricingRuleId),
    setPricingRuleStatus: vi.fn(async (pricingRuleId) => pricingRuleId),
    updatePricingRule: vi.fn(async (pricingRuleId) => pricingRuleId),
  };
}

function createAccess(role = 'owner') {
  return {
    profile: { role },
    user: { email: 'owner@studio37.test', uid: 'owner-1' },
  };
}

function renderWorkspace({
  access = createAccess(),
  canEdit = true,
  limitReached = false,
  pricingRules = [],
  repository = createRepository(),
  sessionTypes = [createSessionType()],
  studioRooms = [createStudioRoom()],
  studioScopeState = 'ready',
} = {}) {
  const onChanged = vi.fn();
  render(
    <ToastProvider>
      <DurationPackagesWorkspace
        access={access}
        canEdit={canEdit}
        limitReached={limitReached}
        listLimit={200}
        onChanged={onChanged}
        pricingRules={pricingRules}
        repository={repository}
        sessionTypes={sessionTypes}
        studioRooms={studioRooms}
        studioScopeState={studioScopeState}
      />
    </ToastProvider>,
  );

  return { onChanged, repository };
}

async function selectStudioScope(interaction, optionName) {
  await interaction.click(screen.getByLabelText('Berlaku untuk'));
  await interaction.click(screen.getByRole('option', { name: optionName }));
}

describe('DurationPackagesWorkspace', () => {
  it('groups sibling packages into one set and renders human-readable studio context', () => {
    renderWorkspace({ pricingRules: [createPackageRule(360), createPackageRule(180)] });

    const packageList = screen.getByRole('generic', { name: 'Paket Recording' });
    const rows = within(packageList).getAllByRole('article');

    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('180')).toBeInTheDocument();
    expect(within(rows[1]).getByText('360')).toBeInTheDocument();
    expect(screen.getByText('Studio A · A')).toBeInTheDocument();
  });

  it('creates a new exact-studio package when starting a package set', async () => {
    const interaction = userEvent.setup();
    const { repository } = renderWorkspace({
      pricingRules: [],
      studioRooms: [createStudioRoom('studio-a'), createStudioRoom('studio-b')],
    });

    await interaction.click(screen.getByRole('button', { name: 'Tambah paket' }));
    await interaction.type(screen.getByLabelText(/^Nama package/), 'Recording Studio B 3 jam');
    await selectStudioScope(interaction, 'Studio B · B');
    await interaction.type(screen.getByLabelText(/^Harga package/), '500000');
    await interaction.click(screen.getByRole('button', { name: 'Simpan package' }));

    await waitFor(() => {
      expect(repository.createPricingRule).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Recording Studio B 3 jam',
          sessionTypeId: 'session-recording',
          studioId: 'studio-b',
        }),
        { actorUid: 'owner-1' },
      );
    });
  });

  it('creates a sibling package while inheriting the package-set envelope', async () => {
    const interaction = userEvent.setup();
    const effectiveFrom = new Date('2026-09-01T00:00:00.000Z');
    const effectiveUntil = new Date('2026-10-01T00:00:00.000Z');
    const template = createPackageRule(180, { effectiveFrom, effectiveUntil });
    const { onChanged, repository } = renderWorkspace({ pricingRules: [template] });

    await interaction.click(screen.getByRole('button', { name: 'Tambah paket lain' }));
    expect(screen.getByLabelText('Berlaku untuk')).toBeDisabled();
    await interaction.type(screen.getByLabelText(/^Nama package/), 'Recording 6 jam');
    await interaction.clear(screen.getByLabelText(/^Durasi package/));
    await interaction.type(screen.getByLabelText(/^Durasi package/), '360');
    await interaction.type(screen.getByLabelText(/^Harga package/), '800000');
    await interaction.click(screen.getByRole('button', { name: 'Simpan package' }));

    await waitFor(() => {
      expect(repository.createPricingRule).toHaveBeenCalledWith(
        expect.objectContaining({
          effectiveFrom,
          effectiveUntil,
          name: 'Recording 6 jam',
          pricingModel: PRICING_RULE_MODELS.DURATION_PACKAGE,
          priority: 200,
          sessionTypeId: 'session-recording',
          studioId: 'studio-a',
          configuration: expect.objectContaining({
            amountIdr: 800000,
            durationMinutes: 360,
          }),
        }),
        { actorUid: 'owner-1' },
      );
    });
    expect(onChanged).toHaveBeenCalledOnce();
    expect(await screen.findByText('Paket ditambahkan')).toBeInTheDocument();
  });

  it('blocks duplicate active duration inside the same package set before repository write', async () => {
    const interaction = userEvent.setup();
    const repository = createRepository();
    renderWorkspace({ pricingRules: [createPackageRule(180)], repository });

    await interaction.click(screen.getByRole('button', { name: 'Tambah paket lain' }));
    await interaction.type(screen.getByLabelText(/^Nama package/), 'Recording 3 jam duplicate');
    await interaction.type(screen.getByLabelText(/^Harga package/), '460000');
    await interaction.click(screen.getByRole('button', { name: 'Simpan package' }));

    expect(await screen.findByText(/durasi yang sama sudah aktif/i)).toBeInTheDocument();
    expect(repository.createPricingRule).not.toHaveBeenCalled();
  });

  it('edits package fields while preserving session, studio, priority, and effective window', async () => {
    const interaction = userEvent.setup();
    const effectiveFrom = new Date('2026-09-01T00:00:00.000Z');
    const effectiveUntil = new Date('2026-10-01T00:00:00.000Z');
    const existing = createPackageRule(180, { effectiveFrom, effectiveUntil });
    const { repository } = renderWorkspace({ pricingRules: [existing] });

    await interaction.click(screen.getByRole('button', { name: 'Edit paket Recording 3 jam' }));
    expect(screen.getByLabelText('Berlaku untuk')).toBeDisabled();
    const amountInput = screen.getByLabelText(/^Harga package/);
    await interaction.clear(amountInput);
    await interaction.type(amountInput, '475000');
    await interaction.click(screen.getByRole('button', { name: 'Simpan package' }));

    await waitFor(() => {
      expect(repository.updatePricingRule).toHaveBeenCalledWith(
        'package-180',
        expect.objectContaining({
          effectiveFrom,
          effectiveUntil,
          priority: 200,
          sessionTypeId: 'session-recording',
          studioId: 'studio-a',
          configuration: expect.objectContaining({ amountIdr: 475000, durationMinutes: 180 }),
        }),
        { actorUid: 'owner-1' },
      );
    });
  });

  it('soft-deactivates an active package without exposing hard delete yet', async () => {
    const interaction = userEvent.setup();
    const { repository } = renderWorkspace({ pricingRules: [createPackageRule(180)] });

    expect(screen.queryByRole('button', { name: 'Hapus paket Recording 3 jam' })).not.toBeInTheDocument();
    await interaction.click(
      screen.getByRole('button', { name: 'Nonaktifkan paket Recording 3 jam' }),
    );
    await interaction.click(screen.getByRole('button', { name: 'Nonaktifkan' }));

    await waitFor(() => {
      expect(repository.setPricingRuleStatus).toHaveBeenCalledWith('package-180', 'disabled', {
        actorUid: 'owner-1',
      });
    });
    expect(await screen.findByText('Paket dinonaktifkan')).toBeInTheDocument();
  });

  it('lets an Owner hard-delete a disabled package', async () => {
    const interaction = userEvent.setup();
    const disabledPackage = createPackageRule(180, { status: PRICING_RULE_STATUSES.DISABLED });
    const { onChanged, repository } = renderWorkspace({ pricingRules: [disabledPackage] });

    await interaction.click(screen.getByRole('button', { name: 'Hapus paket Recording 3 jam' }));
    expect(screen.getByText(/aksi ini tidak bisa dibatalkan/i)).toBeInTheDocument();
    await interaction.click(screen.getByRole('button', { name: 'Hapus permanen' }));

    await waitFor(() => {
      expect(repository.deletePricingRule).toHaveBeenCalledWith('package-180');
    });
    expect(onChanged).toHaveBeenCalledOnce();
    expect(await screen.findByText('Paket dihapus')).toBeInTheDocument();
  });

  it('does not expose hard delete to a non-owner editor', () => {
    renderWorkspace({
      access: createAccess('studio_operator'),
      pricingRules: [createPackageRule(180, { status: PRICING_RULE_STATUSES.DISABLED })],
    });

    expect(screen.queryByRole('button', { name: 'Hapus paket Recording 3 jam' })).not.toBeInTheDocument();
  });

  it('keeps package workspace read-only without mutation controls', () => {
    renderWorkspace({ canEdit: false, pricingRules: [createPackageRule(180)] });

    expect(screen.getByText('Recording 3 jam')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tambah paket' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tambah paket lain' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Edit paket Recording 3 jam' }),
    ).not.toBeInTheDocument();
  });
});
