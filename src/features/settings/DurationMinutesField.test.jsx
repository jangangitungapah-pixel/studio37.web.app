import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DurationMinutesField } from './DurationMinutesField.jsx';

describe('DurationMinutesField', () => {
  it('shows a human-readable duration and selected preset state', () => {
    render(
      <DurationMinutesField
        label="Durasi minimum"
        value="90"
        required
        onValueChange={() => {}}
      />,
    );

    expect(screen.getByText('Terbaca sebagai 1 jam 30 menit')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1 jam 30 menit' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('emits canonical minute strings from quick presets', async () => {
    const interaction = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <DurationMinutesField label="Increment harga" value="60" onValueChange={onValueChange} />,
    );

    await interaction.click(screen.getByRole('button', { name: '2 jam' }));
    expect(onValueChange).toHaveBeenCalledWith('120');
  });

  it('keeps custom aligned minute entry available alongside presets', () => {
    const onValueChange = vi.fn();
    render(
      <DurationMinutesField label="Durasi package" value="60" onValueChange={onValueChange} />,
    );

    fireEvent.change(screen.getByLabelText(/^Durasi package/), { target: { value: '150' } });
    expect(onValueChange).toHaveBeenCalledWith('150');
  });

  it('disables both manual entry and presets when the parent form is saving', () => {
    render(
      <DurationMinutesField
        label="Durasi dasar"
        value="120"
        disabled
        onValueChange={() => {}}
      />,
    );

    expect(screen.getByLabelText(/^Durasi dasar/)).toBeDisabled();
    expect(screen.getByRole('button', { name: '2 jam' })).toBeDisabled();
  });
});
