import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '../../components/feedback/ToastProvider.jsx';
import { StudioRoomsSection } from './StudioRoomsSection.jsx';

function createRoom(overrides = {}) {
  return {
    code: 'ST-A',
    createdAt: new Date('2026-08-22T01:00:00.000Z'),
    createdByUid: 'owner-1',
    description: 'Ruang latihan utama',
    displayOrder: 1,
    id: 'room-a',
    name: 'Studio A',
    status: 'active',
    updatedAt: new Date('2026-08-22T02:00:00.000Z'),
    updatedByUid: 'owner-1',
    ...overrides,
  };
}

function createRepository(rooms = []) {
  return {
    createStudioRoom: vi.fn(async () => 'room-created'),
    listLimit: 50,
    listStudioRooms: vi.fn(async () => rooms),
    setStudioRoomStatus: vi.fn(async (roomId) => roomId),
    updateStudioRoom: vi.fn(async (roomId) => roomId),
  };
}

function renderSection({
  actorUid = 'owner-1',
  canEdit = true,
  repository = createRepository(),
} = {}) {
  return render(
    <ToastProvider>
      <StudioRoomsSection actorUid={actorUid} canEdit={canEdit} repository={repository} />
    </ToastProvider>,
  );
}

describe('StudioRoomsSection', () => {
  it('loads and renders active and inactive rooms in repository order', async () => {
    const repository = createRepository([
      createRoom(),
      createRoom({ code: 'ST-B', id: 'room-b', name: 'Studio B', status: 'disabled' }),
    ]);
    renderSection({ repository });

    expect(await screen.findByRole('heading', { name: 'Studio A' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Studio B' })).toBeInTheDocument();
    expect(screen.getByText('Aktif')).toBeInTheDocument();
    expect(screen.getByText('Nonaktif')).toBeInTheDocument();
    expect(repository.listStudioRooms).toHaveBeenCalledOnce();
  });

  it('creates a normalized room and refreshes the bounded list', async () => {
    const interaction = userEvent.setup();
    const repository = createRepository([]);
    renderSection({ repository });

    await screen.findByText('Belum ada ruang studio');
    await interaction.click(screen.getByRole('button', { name: 'Tambah ruang' }));
    await interaction.type(screen.getByLabelText(/Nama ruang/), 'Studio B');
    await interaction.type(screen.getByLabelText(/Kode ruang/), 'st-b');
    await interaction.type(screen.getByLabelText(/Deskripsi/), 'Ruang rekaman');
    await interaction.click(screen.getByRole('button', { name: 'Simpan ruang' }));

    await waitFor(() => {
      expect(repository.createStudioRoom).toHaveBeenCalledWith(
        {
          code: 'ST-B',
          description: 'Ruang rekaman',
          displayOrder: 1,
          name: 'Studio B',
        },
        { actorUid: 'owner-1' },
      );
    });
    expect(await screen.findByText('Ruang ditambahkan')).toBeInTheDocument();
    expect(repository.listStudioRooms).toHaveBeenCalledTimes(2);
  });

  it('edits room details while preserving status changes as a separate action', async () => {
    const interaction = userEvent.setup();
    const repository = createRepository([createRoom()]);
    renderSection({ repository });

    await interaction.click(await screen.findByRole('button', { name: 'Edit Studio A' }));
    const roomName = screen.getByLabelText(/Nama ruang/);
    await interaction.clear(roomName);
    await interaction.type(roomName, 'Studio Utama');
    await interaction.click(screen.getByRole('button', { name: 'Simpan ruang' }));

    await waitFor(() => {
      expect(repository.updateStudioRoom).toHaveBeenCalledWith(
        'room-a',
        expect.objectContaining({ name: 'Studio Utama' }),
        { actorUid: 'owner-1' },
      );
    });
    expect(repository.setStudioRoomStatus).not.toHaveBeenCalled();
  });

  it('requires confirmation before soft-disabling a room', async () => {
    const interaction = userEvent.setup();
    const repository = createRepository([createRoom()]);
    renderSection({ repository });

    await interaction.click(await screen.findByRole('button', { name: 'Nonaktifkan Studio A' }));
    expect(screen.getByRole('dialog')).toHaveTextContent(/Riwayat booking tidak ikut diubah/);
    await interaction.click(screen.getByRole('button', { name: 'Nonaktifkan ruang' }));

    await waitFor(() => {
      expect(repository.setStudioRoomStatus).toHaveBeenCalledWith('room-a', 'disabled', {
        actorUid: 'owner-1',
      });
    });
    expect(await screen.findByText('Ruang dinonaktifkan')).toBeInTheDocument();
  });

  it('blocks duplicate room codes and preserves the attempted form', async () => {
    const interaction = userEvent.setup();
    const repository = createRepository([createRoom()]);
    renderSection({ repository });

    await interaction.click(await screen.findByRole('button', { name: 'Tambah ruang' }));
    await interaction.type(screen.getByLabelText(/Nama ruang/), 'Studio Duplikat');
    await interaction.type(screen.getByLabelText(/Kode ruang/), 'st-a');
    await interaction.click(screen.getByRole('button', { name: 'Simpan ruang' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Kode ruang sudah digunakan/);
    expect(screen.getByLabelText(/Kode ruang/)).toHaveValue('ST-A');
    expect(repository.createStudioRoom).not.toHaveBeenCalled();
  });

  it('keeps read-only users away from mutations and supports a recoverable reload', async () => {
    const interaction = userEvent.setup();
    const repository = createRepository([createRoom()]);
    repository.listStudioRooms
      .mockRejectedValueOnce(Object.assign(new Error('offline'), { code: 'unavailable' }))
      .mockResolvedValueOnce([createRoom()]);
    renderSection({ canEdit: false, repository });

    expect(await screen.findByText('Daftar ruang gagal dimuat')).toBeInTheDocument();
    await interaction.click(screen.getByRole('button', { name: 'Coba lagi' }));

    expect(await screen.findByRole('heading', { name: 'Studio A' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tambah ruang' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Studio A' })).not.toBeInTheDocument();
    expect(repository.createStudioRoom).not.toHaveBeenCalled();
    expect(repository.updateStudioRoom).not.toHaveBeenCalled();
    expect(repository.setStudioRoomStatus).not.toHaveBeenCalled();
  });
});
