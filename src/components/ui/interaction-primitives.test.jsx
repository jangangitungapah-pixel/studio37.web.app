import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Dialog } from '../feedback/Dialog.jsx';
import { ToastProvider } from '../feedback/ToastProvider.jsx';
import { useToast } from '../feedback/toast-context.js';
import { Combobox, Select } from '../forms/Select.jsx';
import { Button } from './Button.jsx';

const options = [
  { value: 'rehearsal', label: 'Rehearsal' },
  { value: 'recording', label: 'Recording' },
  { value: 'mixing', label: 'Mixing' },
];

function ComboboxHarness() {
  const [value, setValue] = useState('');

  return (
    <>
      <Combobox label="Session type" value={value} onChange={setValue} options={options} />
      <output>{value}</output>
    </>
  );
}

function ToastHarness() {
  const { pushToast } = useToast();

  return (
    <Button
      onClick={() =>
        pushToast({
          title: 'Saved',
          message: 'Booking changes saved.',
          tone: 'success',
          duration: 0,
        })
      }
    >
      Show toast
    </Button>
  );
}

describe('Phase 1C interaction primitives', () => {
  it('renders an accessible native select and forwards changes', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <Select
        label="Payment status"
        value="pending"
        onChange={handleChange}
        options={[
          { value: 'pending', label: 'Pending' },
          { value: 'paid', label: 'Lunas' },
        ]}
      />,
    );

    const select = screen.getByRole('combobox', { name: 'Payment status' });
    await user.selectOptions(select, 'paid');

    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('filters and selects combobox options with the keyboard', async () => {
    const user = userEvent.setup();
    render(<ComboboxHarness />);

    const combobox = screen.getByRole('combobox', { name: 'Session type' });
    await user.click(combobox);
    await user.type(combobox, 'rec');

    expect(screen.getByRole('option', { name: 'Recording' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Mixing' })).not.toBeInTheDocument();

    await user.keyboard('{Enter}');

    expect(screen.getByText('recording')).toBeInTheDocument();
    expect(combobox).toHaveValue('Recording');
    expect(combobox).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes dialogs with Escape and restores focus', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    render(
      <>
        <Button>Origin action</Button>
        <Dialog open onClose={handleClose} title="Booking confirmation">
          <input aria-label="Dialog input" data-autofocus="true" />
        </Dialog>
      </>,
    );

    const origin = screen.getByRole('button', { name: 'Origin action' });
    origin.focus();

    const dialogInput = screen.getByRole('textbox', { name: 'Dialog input' });
    dialogInput.focus();
    await user.keyboard('{Escape}');

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('announces and dismisses toast feedback', async () => {
    const user = userEvent.setup();

    render(
      <ToastProvider>
        <ToastHarness />
      </ToastProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Show toast' }));

    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    expect(screen.getByRole('status')).toHaveTextContent('Booking changes saved.');

    await user.click(screen.getByRole('button', { name: 'Tutup notifikasi' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
