import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Badge } from '../feedback/Badge.jsx';
import { Input, Textarea } from '../forms/Field.jsx';
import { Button } from './Button.jsx';

describe('shared UI primitives', () => {
  it('keeps buttons safe by default and disables loading actions', () => {
    const { rerender } = render(<Button>Save booking</Button>);

    expect(screen.getByRole('button', { name: 'Save booking' })).toHaveAttribute('type', 'button');

    rerender(<Button loading>Saving booking</Button>);

    const loadingButton = screen.getByRole('button', { name: 'Saving booking' });
    expect(loadingButton).toBeDisabled();
    expect(loadingButton).toHaveAttribute('aria-busy', 'true');
  });

  it('connects input labels, descriptions, and errors accessibly', () => {
    render(
      <Input
        label="Phone number"
        description="WhatsApp-ready number."
        error="Nomor telepon belum valid."
        defaultValue="0812"
        required
      />,
    );

    const input = screen.getByRole('textbox', { name: /phone number/i });
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription(/WhatsApp-ready number.*Nomor telepon belum valid/i);
    expect(screen.getByRole('alert')).toHaveTextContent('Nomor telepon belum valid.');
  });

  it('renders a labelled textarea with a configurable row count', () => {
    render(<Textarea label="Booking notes" rows={6} />);

    expect(screen.getByRole('textbox', { name: 'Booking notes' })).toHaveAttribute('rows', '6');
  });

  it('applies semantic badge tones with a safe neutral fallback', () => {
    const { rerender } = render(<Badge tone="success">Lunas</Badge>);

    expect(screen.getByText('Lunas')).toHaveClass('ui-badge--success');

    rerender(<Badge tone="unknown">Custom</Badge>);

    expect(screen.getByText('Custom')).toHaveClass('ui-badge--neutral');
  });
});
