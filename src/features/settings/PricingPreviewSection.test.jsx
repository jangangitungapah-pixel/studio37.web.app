import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { formatIntegerIdr } from '../../lib/money/idr.js';
import { CAPABILITIES } from '../auth/capabilities.js';
import { ADD_ON_PRICING_TYPES } from '../pricing/addOnPricing.js';
import { PRICING_RULE_MODELS, PRICING_RULE_ROUNDING_MODES } from '../pricing/pricingRules.js';
import { PricingPreviewSection } from './PricingPreviewSection.jsx';

const FIXTURE_TIME = new Date('2026-09-02T02:00:00.000Z');

function createAccess({ capabilities = [], role = 'owner' } = {}) {
  return {
    capabilities,
    profile: {
      displayName: 'Studio37 Owner',
      permissionSetId: role === 'owner' ? null : 'pricing-viewer',
      role,
      status: 'active',
      uid: 'owner-1',
    },
    status: 'authenticated',
    user: { email: 'owner@studio37.test', uid: 'owner-1' },
  };
}

function createSessionType(overrides = {}) {
  return {
    code: 'REHEARSAL',
    id: 'session-rehearsal',
    name: 'Rehearsal',
    status: 'active',
    ...overrides,
  };
}

function createPricingRule(overrides = {}) {
  return {
    configuration: {
      amountPerIncrementIdr: 120_000,
      incrementMinutes: 60,
      minimumDurationMinutes: 60,
      roundingMode: PRICING_RULE_ROUNDING_MODES.ROUND_UP,
    },
    createdAt: FIXTURE_TIME,
    createdByUid: 'owner-1',
    effectiveFrom: null,
    effectiveUntil: null,
    id: 'rule-hourly',
    name: 'Rehearsal hourly',
    pricingModel: PRICING_RULE_MODELS.HOURLY,
    priority: 100,
    sessionTypeId: 'session-rehearsal',
    status: 'active',
    studioId: null,
    updatedAt: FIXTURE_TIME,
    updatedByUid: 'owner-1',
    ...overrides,
  };
}

function createAddOn(overrides = {}) {
  return {
    configuration: { amountIdr: 50_000 },
    createdAt: FIXTURE_TIME,
    createdByUid: 'owner-1',
    description: 'Extra microphone',
    displayOrder: 1,
    id: 'addon-mic',
    name: 'Extra microphone',
    pricingType: ADD_ON_PRICING_TYPES.FIXED,
    sessionTypeId: null,
    status: 'active',
    updatedAt: FIXTURE_TIME,
    updatedByUid: 'owner-1',
    ...overrides,
  };
}

function createPricingRulesRepository(rules = []) {
  return { listPricingRules: vi.fn(async () => rules) };
}

function createAddOnsRepository(addOns = []) {
  return { listAddOns: vi.fn(async () => addOns) };
}

function createStudioRoomsRepository(rooms = []) {
  return { listStudioRooms: vi.fn(async () => rooms) };
}

function renderPreview({
  access = createAccess(),
  addOns = [],
  pricingRules = [createPricingRule()],
  sessionTypes = [createSessionType()],
  studios = [],
} = {}) {
  const addOnsRepository = createAddOnsRepository(addOns);
  const pricingRulesRepository = createPricingRulesRepository(pricingRules);
  const studioRoomsRepository = createStudioRoomsRepository(studios);

  render(
    <PricingPreviewSection
      access={access}
      addOnsRepository={addOnsRepository}
      pricingRulesRepository={pricingRulesRepository}
      sessionTypes={sessionTypes}
      studioRoomsRepository={studioRoomsRepository}
    />,
  );

  return { addOnsRepository, pricingRulesRepository, studioRoomsRepository };
}

async function expectPreviewTotal(amountIdr) {
  const totalLabel = await screen.findByText('Total preview');
  const totalContainer = totalLabel.closest('.pricing-preview__total');
  const normalizedExpectedAmount = formatIntegerIdr(amountIdr).replace(/\s/g, '');

  expect(totalContainer).not.toBeNull();
  expect(
    within(totalContainer).getByText(
      (content) => content.replace(/\s/g, '') === normalizedExpectedAmount,
    ),
  ).toBeInTheDocument();
}

describe('PricingPreviewSection', () => {
  it('previews a persisted hourly rule with canonical round-up billing', async () => {
    const interaction = userEvent.setup();
    renderPreview();

    const ruleSelect = await screen.findByLabelText(/^Pricing rule \/ package/);
    await interaction.selectOptions(ruleSelect, 'rule-hourly');

    await expectPreviewTotal(120_000);
    const durationInput = screen.getByLabelText(/^Contoh durasi session/);
    await interaction.clear(durationInput);
    await interaction.type(durationInput, '125');

    await expectPreviewTotal(360_000);
    expect(screen.getByText(/125 mnt diminta · 180 mnt ditagih · 3 increment/)).toBeInTheDocument();
  });

  it('adds an applicable persisted add-on without changing configuration', async () => {
    const interaction = userEvent.setup();
    const repositories = renderPreview({ addOns: [createAddOn()] });

    await interaction.selectOptions(
      await screen.findByLabelText(/^Pricing rule \/ package/),
      'rule-hourly',
    );
    await interaction.click(screen.getByLabelText('Pilih add-on Extra microphone'));

    await expectPreviewTotal(170_000);
    expect(screen.getByText('Add-on · Extra microphone')).toBeInTheDocument();
    expect(repositories.pricingRulesRepository.listPricingRules).toHaveBeenCalledOnce();
    expect(repositories.addOnsRepository.listAddOns).toHaveBeenCalledOnce();
  });

  it('can simulate a disabled rule before activation and explains that it stays unavailable', async () => {
    const interaction = userEvent.setup();
    renderPreview({ pricingRules: [createPricingRule({ status: 'disabled' })] });

    await interaction.selectOptions(
      await screen.findByLabelText(/^Pricing rule \/ package/),
      'rule-hourly',
    );

    expect(await screen.findByText('Rule ini nonaktif.')).toBeInTheDocument();
    expect(screen.getByText(/tidak membuat rule tersedia untuk booking baru/i)).toBeInTheDocument();
    await expectPreviewTotal(120_000);
  });

  it('surfaces canonical exact-increment failure as a human-readable preview state', async () => {
    const interaction = userEvent.setup();
    renderPreview({
      pricingRules: [
        createPricingRule({
          configuration: {
            amountPerIncrementIdr: 120_000,
            incrementMinutes: 60,
            minimumDurationMinutes: 60,
            roundingMode: PRICING_RULE_ROUNDING_MODES.EXACT,
          },
        }),
      ],
    });

    await interaction.selectOptions(
      await screen.findByLabelText(/^Pricing rule \/ package/),
      'rule-hourly',
    );
    const durationInput = screen.getByLabelText(/^Contoh durasi session/);
    await interaction.clear(durationInput);
    await interaction.type(durationInput, '90');

    expect(await screen.findByText('Preview belum dapat dihitung.')).toBeInTheDocument();
    expect(screen.getByText(/harus pas dengan increment/i)).toBeInTheDocument();
  });

  it('does not request studio data for a pricing-only viewer', async () => {
    const interaction = userEvent.setup();
    const repositories = renderPreview({
      access: createAccess({
        capabilities: [CAPABILITIES.SETTINGS_PRICING_VIEW],
        role: 'studio_operator',
      }),
    });

    await interaction.selectOptions(
      await screen.findByLabelText(/^Pricing rule \/ package/),
      'rule-hourly',
    );

    await waitFor(() => {
      expect(repositories.studioRoomsRepository.listStudioRooms).not.toHaveBeenCalled();
    });
    await expectPreviewTotal(120_000);
  });
});
