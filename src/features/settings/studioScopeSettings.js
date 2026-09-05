import { STUDIO_ROOM_STATUSES } from './studioRooms.js';

export const GENERAL_STUDIO_SCOPE_VALUE = '';

function normalizeCurrentStudioId(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.includes('/') || normalized.length > 128) return null;
  return normalized;
}

export function buildStudioScopeOptions(
  studioRooms,
  { currentStudioId = null, specificSelectionAvailable = true } = {},
) {
  if (!Array.isArray(studioRooms)) {
    throw new TypeError('studioRooms must be an array.');
  }

  const normalizedCurrentStudioId = normalizeCurrentStudioId(currentStudioId);
  const options = [
    Object.freeze({
      label: 'Semua studio',
      value: GENERAL_STUDIO_SCOPE_VALUE,
    }),
  ];
  const seenIds = new Set();

  studioRooms.forEach((room) => {
    if (!room || typeof room.id !== 'string' || seenIds.has(room.id)) return;
    seenIds.add(room.id);

    if (!specificSelectionAvailable && room.id !== normalizedCurrentStudioId) return;

    const active = room.status === STUDIO_ROOM_STATUSES.ACTIVE;
    options.push(
      Object.freeze({
        disabled: !active,
        label: `${room.name}${active ? '' : ' · nonaktif'}`,
        value: room.id,
      }),
    );
  });

  if (normalizedCurrentStudioId && !seenIds.has(normalizedCurrentStudioId)) {
    options.push(
      Object.freeze({
        disabled: true,
        label: `Studio tidak tersedia · ${normalizedCurrentStudioId}`,
        value: normalizedCurrentStudioId,
      }),
    );
  }

  return Object.freeze(options);
}

export function formatStudioScopeLabel(studioId, studioRooms) {
  if (studioId === null) return 'Semua studio';
  if (!Array.isArray(studioRooms)) return `Studio ${studioId}`;

  const room = studioRooms.find((candidate) => candidate?.id === studioId);
  if (!room) return `Studio ${studioId}`;

  return `${room.name}${room.status === STUDIO_ROOM_STATUSES.ACTIVE ? '' : ' · nonaktif'}`;
}

export function getStudioScopeFieldDescription({ currentStudioId = null, state = 'ready' } = {}) {
  if (state === 'loading') {
    return 'Daftar studio sedang dimuat.';
  }

  if (state === 'error') {
    return currentStudioId
      ? 'Daftar studio gagal dimuat. Pilihan studio yang tersimpan tetap dipertahankan.'
      : 'Daftar studio gagal dimuat. Sementara harga berlaku untuk semua studio.';
  }

  if (state === 'unavailable') {
    return currentStudioId
      ? 'Akun ini tidak dapat membaca daftar studio. Pilihan yang tersimpan tetap dipertahankan.'
      : 'Akun ini hanya dapat membuat harga yang berlaku untuk semua studio.';
  }

  return 'Pilih Semua studio, atau batasi harga ini ke satu studio tertentu.';
}
