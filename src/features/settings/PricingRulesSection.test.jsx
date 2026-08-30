import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '../../components/feedback/ToastProvider.jsx';
import {
  PRICING_RULE_MODELS,
  PRICING_RULE_ROUNDING_MODES,
  PRICING_RULE_STATUSES,
} from '../pricing/pricingRules.js';
import { PricingRulesSection } from './PricingRulesSection.jsx';

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

function createPricingRule(overrides = {}) {
  return {
    configuration: { amountIdr: 500000 },
    createdAt: new Date('2026-08-24T03:00:00.000Z'),
    createdByUid: 'owner-1',
    effectiveFrom: null,
    effectiveUntil: null,
    id: 'rule-fixed',
    name: 'Rehearsal fixed',
    pricingModel: PRICING_RULE_MODELS.FIXED_SESSION,
    priority: 100,
    sessionTypeId: 'session-rehearsal',
    status: PRICING_RULE_STATUSES.ACTIVE,
    studioId: null,
    updatedAt: new Date('2026-08-24T04:00:00.000Z'),
    updatedByUid: 'owner-1',
    ...overrides,
  };
}

function createRepository(pricingRules = []) {
  return {
    createPricingRule: vi.fn(async () => 'rule-created'),
    listLimit: 200,
    listPricingRules: vi.fn(async () => pricingRules),
    setPricingRuleStatus: vi.fn(async (pricingRuleId) => pricingRuleId),
    updatePricingRule: vi.fn(async (pricingRuleId) => pricingRuleId),
  };
}

function createAccess(uid = 'owner-1') {
  return {
    profile: {
      displayName: 'Studio37 Owner',
      permissionSetId: null,
      role: 'owner',
      status: 'active',
      uid,
    },
    status: 'authenticated',
    user: { email: `${uid}@studio37.test`, uid },
  };
}

function renderSection({
  access = createAccess(),
  canEdit = true,
  repository = createRepository(),
  sessionTypes = [createSessionType()],
} = {}) {
  return render(
    <ToastProvider>
      <PricingRulesSection
        access={access}
        canEdit={canEdit}
        repository={repository}
        sessionTypes={sessionTypes}
      />
    </ToastProvider>,
  );
}

describe('PricingRulesSection', () => {
  it('loads bounded rules with human-readable session and configuration context', async () => {
    const repository = createRepository([createPricingRule()]);
    renderSection({ repository });

    expect(await screen.findByRole('heading', { name: 'Rehearsal fixed' })).toBeInTheDocument();
    expect(screen.getByText('Rehearsal · REHEARSAL')).toBeInTheDocument();
    expect(screen.getByText('Semua studio')).toBeInTheDocument();
    expect(screen.getByText(/500\.000/)).toBeInTheDocument();
    expect(repository.listPricingRules).toHaveBeenCalledOnce();
  });

  it('creates a general-scope fixed-session rule through the Phase 5A2 repository', async () => {
    const interaction = userEvent.setup();
    const repository = createRepository([]);
    renderSection({ repository });

    await screen.findByText('Belum ada pricing rule');
    await interaction.click(screen.getByRole('button', { name: 'Tambah pricing rule' }));
    await interaction.type(screen.getByLabelText(/^Nama pricing rule/), 'Rehearsal sore');
    await interaction.selectOptions(
      screen.getByLabelText(/^Model harga/),
      PRICING_RULE_MODELS.FIXED_SESSION,
    );
    await interaction.type(screen.getByLabelText(/^Harga session \(IDR\)/), '350000');
    await interaction.click(screen.getByRole('button', { name: 'Simpan pricing rule' }));

    await waitFor(() => {
      expect(repository.createPricingRule).toHaveBeenCalledWith(
        expect.objectContaining({
          configuration: { amountIdr: 350000 },
          effectiveFrom: null,
          effectiveUntil: null,
          name: 'Rehearsal sore',
          pricingModel: PRICING_RULE_MODELS.FIXED_SESSION,
          priority: 100,
          sessionTypeId: 'session-rehearsal',
          studioId: null,
        }),
        { actorUid: 'owner-1' },
      );
    });
    expect(await screen.findByText('Pricing rule ditambahkan')).toBeInTheDocument();
  });

  it('preserves existing studio scope and effective window when editing', async () => {
    const interaction = userEvent.setup();
    const effectiveFrom = new Date('2026-09-01T00:00:00.000Z');
    const effectiveUntil = new Date('2026-10-01T00:00:00.000Z');
    const existingRule = createPricingRule({
      configuration: {
        amountPerIncrementIdr: 120000,
        incrementMinutes: 60,
        minimumDurationMinutes: 60,
        roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT,
      },
      effectiveFrom,
      effectiveUntil,
      pricingModel: PRICING_RULE_MODELS.HOURLY,
      studioId: 'studio-a',
    });
    const repository = createRepository([existingRule]);
    renderSection({ repository });

    await interaction.click(
      await screen.findByRole('button', { name: 'Edit pricing rule Rehearsal fixed' }),
    );
    expect(screen.getByText('Metadata advanced dipertahankan.')).toBeInTheDocument();
    const amountInput = screen.getByLabelText(/^Harga per increment \(IDR\)/);
    await interaction.clear(amountInput);
    await interaction.type(amountInput, '130000');
    await interaction.click(screen.getByRole('button', { name: 'Simpan pricing rule' }));

    await waitFor(() => {
      expect(repository.updatePricingRule).toHaveBeenCalledWith(
        'rule-fixed',
        expect.objectContaining({
          configuration: expect.objectContaining({ amountPerIncrementIdr: 130000 }),
          effectiveFrom,
          effectiveUntil,
          studioId: 'studio-a',
        }),
        { actorUid: 'owner-1' },
      );
    });
  });

  it('blocks an obvious equal-priority active collision before Firestore write', async () => {
    const interaction = userEvent.setup();
    const repository = createRepository([createPricingRule()]);
    renderSection({ repository });

    await screen.findByRole('heading', { name: 'Rehearsal fixed' });
    await interaction.click(screen.getByRole('button', { name: 'Tambah pricing rule' }));
    await interaction.type(screen.getByLabelText(/^Nama pricing rule/), 'Duplicate priority');
    await interaction.selectOptions(
      screen.getByLabelText(/^Model harga/),
      PRICING_RULE_MODELS.FIXED_SESSION,
    );
    await interaction.type(screen.getByLabelText(/^Harga session \(IDR\)/), '400000');
    await interaction.click(screen.getByRole('button', { name: 'Simpan pricing rule' }));

    expect(await screen.findByText(/session, studio scope, dan priority yang sama/i)).toBeInTheDocument();
    expect(repository.createPricingRule).not.toHaveBeenCalled();
  });

  it('soft-deactivates an active pricing rule', async () => {
    const interaction = userEvent.setup();
    const repository = createRepository([createPricingRule()]);
    renderSection({ repository });

    await interaction.click(
      await screen.findByRole('button', { name: 'Nonaktifkan pricing rule Rehearsal fixed' }),
    );
    await interaction.click(screen.getByRole('button', { name: 'Nonaktifkan' }));

    await waitFor(() => {
      expect(repository.setPricingRuleStatus).toHaveBeenCalledWith('rule-fixed', 'disabled', {
        actorUid: 'owner-1',
      });
    });
    expect(await screen.findByText('Pricing rule dinonaktifkan')).toBeInTheDocument();
  });

  it('renders view-only rules without mutation controls', async () => {
    const repository = createRepository([createPricingRule()]);
    renderSection({ canEdit: false, repository });

    expect(await screen.findByRole('heading', { name: 'Rehearsal fixed' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tambah pricing rule' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Edit pricing rule Rehearsal fixed' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Nonaktifkan pricing rule Rehearsal fixed' }),
    ).not.toBeInTheDocument();
  });

  it('shows a recoverable list error and retries the bounded pricing-rule query', async () => {
    const interaction = userEvent.setup();
    const repository = createRepository();
    repository.listPricingRules
      .mockRejectedValueOnce(Object.assign(new Error('offline'), { code: 'unavailable' }))
      .mockResolvedValueOnce([createPricingRule()]);
    renderSection({ repository });

    expect(await screen.findByText('Pricing rules gagal dimuat')).toBeInTheDocument();
    await interaction.click(screen.getByRole('button', { name: 'Coba lagi pricing rules' }));

    expect(await screen.findByRole('heading', { name: 'Rehearsal fixed' })).toBeInTheDocument();
    expect(repository.listPricingRules).toHaveBeenCalledTimes(2);
  });
});
