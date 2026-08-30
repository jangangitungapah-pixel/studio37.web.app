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
    setPricingRuleStatus: vi.fn(async (pricingRuleId) => pricingRuleId),
    updatePricingRule: vi.fn(async (pricingRuleId) => pricingRuleId),
  };
}

function createAccess() {
  return {
    user: { email: 'owner@studio37.test', uid: 'owner-1' },
  };
}

function renderWorkspace({
  canEdit = true,
  limitReached = false,
  pricingRules = [],
  repository = createRepository(),
  sessionTypes = [createSessionType()],
} = {}) {
  const onChanged = vi.fn();
  render(
    <ToastProvider>
      <DurationPackagesWorkspace
        access={createAccess()}
        canEdit={canEdit}
        limitReached={limitReached}
        listLimit={200}
        onChanged={onChanged}
        pricingRules={pricingRules}
        repository={repository}
        sessionTypes={sessionTypes}
      />
    </ToastProvider>,
  );

  return { onChanged, repository };
}

describe('DurationPackagesWorkspace', () => {
  it('groups sibling packages into one set and renders them in duration order', () => {
    renderWorkspace({ pricingRules: [createPackageRule(360), createPackageRule(180)] });

    const packageList = screen.getByRole('generic', { name: 'Package Recording' });
    const rows = within(packageList).getAllByRole('article');

    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('180')).toBeInTheDocument();
    expect(within(rows[1]).getByText('360')).toBeInTheDocument();
    expect(screen.getByText('Studio studio-a')).toBeInTheDocument();
    expect(screen.getByText('Priority 200')).toBeInTheDocument();
  });

  it('creates a sibling package while inheriting the package-set envelope', async () => {
    const interaction = userEvent.setup();
    const effectiveFrom = new Date('2026-09-01T00:00:00.000Z');
    const effectiveUntil = new Date('2026-10-01T00:00:00.000Z');
    const template = createPackageRule(180, { effectiveFrom, effectiveUntil });
    const { onChanged, repository } = renderWorkspace({ pricingRules: [template] });

    await interaction.click(screen.getByRole('button', { name: 'Tambah ke set ini' }));
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
    expect(await screen.findByText('Package ditambahkan')).toBeInTheDocument();
  });

  it('blocks duplicate active duration inside the same package set before repository write', async () => {
    const interaction = userEvent.setup();
    const repository = createRepository();
    renderWorkspace({ pricingRules: [createPackageRule(180)], repository });

    await interaction.click(screen.getByRole('button', { name: 'Tambah ke set ini' }));
    await interaction.type(screen.getByLabelText(/^Nama package/), 'Recording 3 jam duplicate');
    await interaction.type(screen.getByLabelText(/^Harga package/), '460000');
    await interaction.click(screen.getByRole('button', { name: 'Simpan package' }));

    expect(await screen.findByText(/durasi yang sama sudah ada/i)).toBeInTheDocument();
    expect(repository.createPricingRule).not.toHaveBeenCalled();
  });

  it('edits package fields while preserving session, studio, priority, and effective window', async () => {
    const interaction = userEvent.setup();
    const effectiveFrom = new Date('2026-09-01T00:00:00.000Z');
    const effectiveUntil = new Date('2026-10-01T00:00:00.000Z');
    const existing = createPackageRule(180, { effectiveFrom, effectiveUntil });
    const { repository } = renderWorkspace({ pricingRules: [existing] });

    await interaction.click(screen.getByRole('button', { name: 'Edit package Recording 3 jam' }));
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

  it('soft-deactivates a package without delete semantics', async () => {
    const interaction = userEvent.setup();
    const { repository } = renderWorkspace({ pricingRules: [createPackageRule(180)] });

    await interaction.click(
      screen.getByRole('button', { name: 'Nonaktifkan package Recording 3 jam' }),
    );
    await interaction.click(screen.getByRole('button', { name: 'Nonaktifkan' }));

    await waitFor(() => {
      expect(repository.setPricingRuleStatus).toHaveBeenCalledWith('package-180', 'disabled', {
        actorUid: 'owner-1',
      });
    });
    expect(await screen.findByText('Package dinonaktifkan')).toBeInTheDocument();
  });

  it('keeps package workspace read-only without mutation controls', () => {
    renderWorkspace({ canEdit: false, pricingRules: [createPackageRule(180)] });

    expect(screen.getByText('Recording 3 jam')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tambah package' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tambah ke set ini' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Edit package Recording 3 jam' }),
    ).not.toBeInTheDocument();
  });
});
