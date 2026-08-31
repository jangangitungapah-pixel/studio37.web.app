import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PRICING_RULE_MODELS } from '../pricing/pricingRules.js';
import { PricingRuleEditorDialog } from './PricingRuleEditorDialog.jsx';
import { SessionTypeEditorDialog } from './SessionTypeEditorDialog.jsx';

const activeSessionType = Object.freeze({
  code: 'REHEARSAL',
  id: 'session-rehearsal',
  name: 'Rehearsal',
  status: 'active',
});

describe('duration configuration dialogs', () => {
  it('writes hourly increment/minimum presets into the canonical pricing-rule payload', async () => {
    const interaction = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <PricingRuleEditorDialog
        dialogError=""
        editingRule={null}
        initialSessionTypeId="session-rehearsal"
        onClose={() => {}}
        onSubmit={onSubmit}
        open
        saving={false}
        sessionTypes={[activeSessionType]}
      />,
    );

    await interaction.type(screen.getByLabelText(/^Nama pricing rule/), 'Rehearsal hourly');
    await interaction.selectOptions(
      screen.getByLabelText(/^Model harga/),
      PRICING_RULE_MODELS.HOURLY,
    );
    await interaction.type(screen.getByLabelText(/^Harga per increment \(IDR\)/), '120000');

    await interaction.click(
      within(screen.getByRole('group', { name: 'Preset Increment harga' })).getByRole('button', {
        name: '1 jam',
      }),
    );
    await interaction.click(
      within(screen.getByRole('group', { name: 'Preset Durasi minimum' })).getByRole('button', {
        name: '1 jam 30 menit',
      }),
    );

    expect(
      screen.getByText(
        'Minimum 1 jam 30 menit. Durasi booking harus pas kelipatan 1 jam; pilihan pertama yang valid 2 jam.',
      ),
    ).toBeInTheDocument();

    await interaction.click(screen.getByRole('button', { name: 'Simpan pricing rule' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          configuration: expect.objectContaining({
            amountPerIncrementIdr: 120000,
            incrementMinutes: 60,
            minimumDurationMinutes: 90,
          }),
          pricingModel: PRICING_RULE_MODELS.HOURLY,
          sessionTypeId: 'session-rehearsal',
        }),
      );
    });
  });

  it('writes session default/minimum presets while preserving canonical minute storage', async () => {
    const interaction = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <SessionTypeEditorDialog
        dialogError=""
        editingSessionType={null}
        existingSessionTypes={[]}
        nextDisplayOrder={1}
        onClose={() => {}}
        onSubmit={onSubmit}
        open
        saving={false}
      />,
    );

    await interaction.type(screen.getByLabelText(/^Nama session type/), 'Recording');
    await interaction.type(screen.getByLabelText(/^Kode/), 'recording');
    await interaction.click(
      within(screen.getByRole('group', { name: 'Preset Durasi default' })).getByRole('button', {
        name: '2 jam',
      }),
    );
    await interaction.click(
      within(screen.getByRole('group', { name: 'Preset Durasi minimum' })).getByRole('button', {
        name: '30 menit',
      }),
    );

    expect(screen.getByText('Default 2 jam · minimum 30 menit.')).toBeInTheDocument();
    await interaction.click(screen.getByRole('button', { name: 'Simpan session type' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultDurationMinutes: 120,
          minimumDurationMinutes: 30,
          requiresStudioReservation: true,
        }),
      );
    });
  });
});
