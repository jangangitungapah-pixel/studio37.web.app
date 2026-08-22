import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OPERATOR_TYPES } from './operators.js';
import { OperatorAccountInvitationDialog } from './OperatorAccountInvitationDialog.jsx';

const invitationId = 'invite-12345678901234567890';

function createOperator(overrides = {}) {
  return {
    displayName: 'Dina Studio',
    email: 'dina@studio37.id',
    id: 'operator-dina',
    linkedUserUid: null,
    operatorTypes: [OPERATOR_TYPES.STUDIO_OPERATOR],
    status: 'active',
    ...overrides,
  };
}

describe('OperatorAccountInvitationDialog', () => {
  it('creates one exact-path invitation and copies its opaque onboarding URL', async () => {
    const interaction = userEvent.setup();
    const copyText = vi.fn().mockResolvedValue(undefined);
    const repository = {
      createInvitation: vi.fn().mockResolvedValue({
        invitationId,
        operatorId: 'operator-dina',
      }),
    };

    render(
      <OperatorAccountInvitationDialog
        actorUid="owner-1"
        copyText={copyText}
        operator={createOperator()}
        origin="http://localhost:5173"
        repository={repository}
      />,
    );

    expect(screen.getByText('dina@studio37.id')).toBeInTheDocument();
    expect(screen.getByText('7 hari sejak dibuat')).toBeInTheDocument();
    await interaction.click(screen.getByRole('button', { name: 'Buat link undangan' }));

    expect(repository.createInvitation).toHaveBeenCalledWith('operator-dina', {
      actorUid: 'owner-1',
    });
    const expectedUrl = 'http://localhost:5173/invite/operator-dina/invite-12345678901234567890';
    expect(await screen.findByLabelText('Link undangan')).toHaveValue(expectedUrl);
    await interaction.click(screen.getByRole('button', { name: 'Salin link' }));

    await waitFor(() => expect(copyText).toHaveBeenCalledWith(expectedUrl));
    expect(screen.getByRole('button', { name: 'Link tersalin' })).toBeInTheDocument();
    expect(repository).not.toHaveProperty('listInvitations');
  });

  it('fails closed when the operator is no longer eligible', () => {
    const repository = { createInvitation: vi.fn() };
    render(
      <OperatorAccountInvitationDialog
        actorUid="owner-1"
        operator={createOperator({ status: 'disabled' })}
        repository={repository}
      />,
    );

    expect(screen.getByText('Operator belum memenuhi syarat.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buat link undangan' })).toBeDisabled();
    expect(repository.createInvitation).not.toHaveBeenCalled();
  });
});
