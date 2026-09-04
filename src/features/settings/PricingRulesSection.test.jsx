import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '../../components/feedback/ToastProvider.jsx';
import { CAPABILITIES } from '../auth/capabilities.js';
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

function createStudioRoom(id = 'studio-a', overrides = {}) {
  return {
    code: id === 'studio-a' ? 'A' : 'B',
    id,
    name: id === 'studio-a' ? 'Studio A' : 'Studio B',
    status: 'active',
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

function createStudioRepository(studioRooms = [createStudioRoom()]) {
  return {
    listLimit: 50,
    listStudioRooms: vi.fn(async () => studioRooms),
  };
}

function createAccess({ capabilities = [], role = 'owner', uid = 'owner-1' } = {}) {
  return {
    capabilities,
    profile: {
      displayName: role === 'owner' ? 'Studio37 Owner' : 'Pricing Editor',
      permissionSetId: role === 'owner' ? null : 'pricing-editor',
      role,
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
  studioRepository = createStudioRepository(),
} = {}) {
  return render(
    <ToastProvider>
      <PricingRulesSection
        access={access}
        canEdit={canEdit}
        repository={repository}
        sessionTypes={sessionTypes}
        studioRepository={studioRepository}
      />
    </ToastProvider>,
  );
}

async function selectStudioScope(interaction, optionName) {
  const studioScope = screen.getByLabelText('Studio scope');
  await interaction.click(studioScope);
  await interaction.click(screen.getByRole('option', { name: optionName }));
}

describe('PricingRulesSection', () => {
  it('loads bounded rules with human-readable session, studio, and validation context', async () => {
    const repository = createRepository([createPricingRule({ studioId: 'studio-a' })]);
    const studioRepository = createStudioRepository([createStudioRoom()]);
    renderSection({ repository, studioRepository });

    expect(await screen.findByRole('heading', { name: 'Rehearsal fixed' })).toBeInTheDocument();
    expect(screen.getByText('Rehearsal · REHEARSAL')).toBeInTheDocument();
    expect(screen.getByText('Studio A · A')).toBeInTheDocument();
    expect(screen.getByText(/500\.000/)).toBeInTheDocument();
    expect(await screen.findByText('Konfigurasi tervalidasi')).toBeInTheDocument();
    expect(screen.getByText('Valid')).toBeInTheDocument();
    expect(repository.listPricingRules).toHaveBeenCalledOnce();
    expect(studioRepository.listStudioRooms).toHaveBeenCalledOnce();
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

  it('creates an exact-studio rule from the bounded active room choices', async () => {
    const interaction = userEvent.setup();
    const repository = createRepository([]);
    renderSection({
      repository,
      studioRepository: createStudioRepository([
        createStudioRoom('studio-a'),
        createStudioRoom('studio-b'),
      ]),
    });

    await screen.findByText('Belum ada pricing rule');
    await interaction.click(screen.getByRole('button', { name: 'Tambah pricing rule' }));
    await interaction.type(screen.getByLabelText(/^Nama pricing rule/), 'Rehearsal Studio A');
    await interaction.selectOptions(
      screen.getByLabelText(/^Model harga/),
      PRICING_RULE_MODELS.FIXED_SESSION,
    );
    await selectStudioScope(interaction, 'Studio A · A');
    await interaction.type(screen.getByLabelText(/^Harga session \(IDR\)/), '375000');
    await interaction.click(screen.getByRole('button', { name: 'Simpan pricing rule' }));

    await waitFor(() => {
      expect(repository.createPricingRule).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Rehearsal Studio A',
          studioId: 'studio-a',
        }),
        { actorUid: 'owner-1' },
      );
    });
  });

  it('changes studio scope while preserving the existing effective window', async () => {
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
    renderSection({
      repository,
      studioRepository: createStudioRepository([
        createStudioRoom('studio-a'),
        createStudioRoom('studio-b'),
      ]),
    });

    await interaction.click(
      await screen.findByRole('button', { name: 'Edit pricing rule Rehearsal fixed' }),
    );
    expect(screen.getByText('Effective window dipertahankan.')).toBeInTheDocument();
    await selectStudioScope(interaction, 'Studio B · B');
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
          studioId: 'studio-b',
        }),
        { actorUid: 'owner-1' },
      );
    });
  });

  it('allows exact and general scope at the same priority because exact scope resolves first', async () => {
    const interaction = userEvent.setup();
    const repository = createRepository([createPricingRule()]);
    renderSection({ repository });

    await screen.findByRole('heading', { name: 'Rehearsal fixed' });
    await interaction.click(screen.getByRole('button', { name: 'Tambah pricing rule' }));
    await interaction.type(screen.getByLabelText(/^Nama pricing rule/), 'Studio A override');
    await interaction.selectOptions(
      screen.getByLabelText(/^Model harga/),
      PRICING_RULE_MODELS.FIXED_SESSION,
    );
    await selectStudioScope(interaction, 'Studio A · A');
    await interaction.type(screen.getByLabelText(/^Harga session \(IDR\)/), '400000');
    await interaction.click(screen.getByRole('button', { name: 'Simpan pricing rule' }));

    await waitFor(() => {
      expect(repository.createPricingRule).toHaveBeenCalledWith(
        expect.objectContaining({ studioId: 'studio-a' }),
        { actorUid: 'owner-1' },
      );
    });
  });

  it('blocks an overlapping equal-priority active candidate inside the same studio scope', async () => {
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

    expect(
      await screen.findByText(
        /overlap pada session, studio scope, priority, dan effective window yang sama/i,
      ),
    ).toBeInTheDocument();
    expect(repository.createPricingRule).not.toHaveBeenCalled();
  });

  it('surfaces blocking configuration health for a missing active session reference', async () => {
    const repository = createRepository([createPricingRule({ sessionTypeId: 'session-missing' })]);
    renderSection({ repository });

    expect(await screen.findByText('Konfigurasi perlu diperbaiki')).toBeInTheDocument();
    expect(screen.getByText(/mengarah ke session type yang tidak ditemukan/i)).toBeInTheDocument();
    expect(screen.getByText('Perlu diperbaiki')).toBeInTheDocument();
  });

  it('keeps exact-studio selection unavailable without settings.studio.view', async () => {
    const interaction = userEvent.setup();
    const studioRepository = createStudioRepository([createStudioRoom()]);
    renderSection({
      access: createAccess({
        capabilities: [CAPABILITIES.SETTINGS_PRICING_VIEW, CAPABILITIES.SETTINGS_PRICING_EDIT],
        role: 'studio_operator',
        uid: 'operator-1',
      }),
      studioRepository,
    });

    expect(
      await screen.findByText('Studio scope exact tidak tersedia untuk akun ini.'),
    ).toBeInTheDocument();
    expect(studioRepository.listStudioRooms).not.toHaveBeenCalled();

    await interaction.click(screen.getByRole('button', { name: 'Tambah pricing rule' }));
    expect(screen.getByLabelText('Studio scope')).toBeDisabled();
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

  it('blocks reactivation before write when the exact studio reference is missing', async () => {
    const interaction = userEvent.setup();
    const repository = createRepository([
      createPricingRule({
        status: PRICING_RULE_STATUSES.DISABLED,
        studioId: 'studio-missing',
      }),
    ]);
    renderSection({
      repository,
      studioRepository: createStudioRepository([createStudioRoom('studio-a')]),
    });

    await interaction.click(
      await screen.findByRole('button', { name: 'Aktifkan pricing rule Rehearsal fixed' }),
    );
    await interaction.click(screen.getByRole('button', { name: 'Aktifkan' }));

    expect(await screen.findByText(/mengarah ke studio yang tidak ditemukan/i)).toBeInTheDocument();
    expect(repository.setPricingRuleStatus).not.toHaveBeenCalled();
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
