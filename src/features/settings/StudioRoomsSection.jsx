import { useCallback, useEffect, useMemo, useState } from 'react';

import { useToast } from '../../components/feedback/toast-context.js';
import { Badge } from '../../components/feedback/Badge.jsx';
import { Dialog } from '../../components/feedback/Dialog.jsx';
import { Input, Textarea } from '../../components/forms/Field.jsx';
import { Button } from '../../components/ui/Button.jsx';
import {
  DEFAULT_STUDIO_ROOM_FORM_VALUES,
  STUDIO_ROOM_LIST_LIMIT,
  STUDIO_ROOM_STATUSES,
  toStudioRoomFormValues,
  validateStudioRoomForm,
} from './studioRooms.js';

function getSafeFirebaseMessage(error, action) {
  if (error?.code === 'permission-denied') {
    return `Akun ini tidak memiliki izin untuk ${action} ruang studio.`;
  }

  if (error?.code === 'unavailable') {
    return `Firestore sedang tidak tersedia. Coba ${action} ruang lagi setelah koneksi pulih.`;
  }

  return `Ruang studio belum bisa ${action}. Coba lagi tanpa menghapus data form.`;
}

function getUserFacingValidationErrors(errors) {
  const translated = {};

  if (errors.code) {
    translated.code =
      'Kode wajib diisi dengan huruf, angka, atau tanda hubung; maksimal 24 karakter.';
  }

  if (errors.name) {
    translated.name = 'Nama ruang wajib diisi dan maksimal 80 karakter.';
  }

  if (errors.description) {
    translated.description = 'Deskripsi maksimal 240 karakter.';
  }

  if (errors.displayOrder) {
    translated.displayOrder = 'Urutan tampil harus berupa angka bulat dari 1 sampai 999.';
  }

  return translated;
}

function getNextDisplayOrder(rooms) {
  if (!rooms.length) return 1;
  return Math.min(999, Math.max(...rooms.map(({ displayOrder }) => displayOrder)) + 1);
}

export function StudioRoomsSection({ actorUid, canEdit, repository }) {
  const { pushToast } = useToast();
  const [dialogError, setDialogError] = useState('');
  const [editingRoom, setEditingRoom] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formValues, setFormValues] = useState(() => ({ ...DEFAULT_STUDIO_ROOM_FORM_VALUES }));
  const [loadError, setLoadError] = useState('');
  const [loadState, setLoadState] = useState('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [roomDialogMode, setRoomDialogMode] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [saving, setSaving] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null);

  const roomLimit = repository.listLimit ?? STUDIO_ROOM_LIST_LIMIT;
  const roomLimitReached = rooms.length >= roomLimit;
  const dialogTitle = roomDialogMode === 'edit' ? 'Edit ruang studio' : 'Tambah ruang studio';
  const nextStatus =
    statusTarget?.status === STUDIO_ROOM_STATUSES.ACTIVE
      ? STUDIO_ROOM_STATUSES.DISABLED
      : STUDIO_ROOM_STATUSES.ACTIVE;
  const nextStatusLabel = nextStatus === STUDIO_ROOM_STATUSES.ACTIVE ? 'Aktifkan' : 'Nonaktifkan';

  const duplicateCode = useMemo(() => {
    const candidateCode = formValues.code.trim().toUpperCase();
    if (!candidateCode) return false;

    return rooms.some(
      (room) => room.id !== editingRoom?.id && room.code.toUpperCase() === candidateCode,
    );
  }, [editingRoom?.id, formValues.code, rooms]);

  useEffect(() => {
    let active = true;

    setLoadError('');
    setLoadState('loading');

    repository
      .listStudioRooms()
      .then((nextRooms) => {
        if (!active) return;
        setRooms([...nextRooms]);
        setLoadState('ready');
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(getSafeFirebaseMessage(error, 'memuat'));
        setLoadState('error');
      });

    return () => {
      active = false;
    };
  }, [reloadKey, repository]);

  const openCreateDialog = () => {
    if (!canEdit || roomLimitReached) return;

    setEditingRoom(null);
    setFormValues({
      ...DEFAULT_STUDIO_ROOM_FORM_VALUES,
      displayOrder: String(getNextDisplayOrder(rooms)),
    });
    setFieldErrors({});
    setDialogError('');
    setRoomDialogMode('create');
  };

  const openEditDialog = (room) => {
    if (!canEdit) return;

    setEditingRoom(room);
    setFormValues(toStudioRoomFormValues(room));
    setFieldErrors({});
    setDialogError('');
    setRoomDialogMode('edit');
  };

  const closeRoomDialog = useCallback(() => {
    if (saving) return;
    setRoomDialogMode(null);
    setEditingRoom(null);
    setDialogError('');
    setFieldErrors({});
  }, [saving]);

  const changeField = (fieldName) => (event) => {
    const nextValue = fieldName === 'code' ? event.target.value.toUpperCase() : event.target.value;
    setFormValues((current) => ({ ...current, [fieldName]: nextValue }));
    setFieldErrors((current) => {
      if (!current[fieldName]) return current;
      const nextErrors = { ...current };
      delete nextErrors[fieldName];
      return nextErrors;
    });
    setDialogError('');
  };

  const saveRoom = async (event) => {
    event.preventDefault();
    const validation = validateStudioRoomForm(formValues);
    const translatedErrors = getUserFacingValidationErrors(validation.errors);

    if (duplicateCode) {
      translatedErrors.code = 'Kode ruang sudah digunakan. Gunakan kode unik lain.';
    }

    setFieldErrors(translatedErrors);
    setDialogError('');

    if (!validation.value || duplicateCode) return;

    if (!canEdit || !actorUid) {
      setDialogError('Sesi ini tidak diizinkan menyimpan ruang studio.');
      return;
    }

    setSaving(true);

    try {
      if (editingRoom) {
        await repository.updateStudioRoom(editingRoom.id, validation.value, { actorUid });
      } else {
        await repository.createStudioRoom(validation.value, { actorUid });
      }

      pushToast({
        message: `${validation.value.name} sudah ${editingRoom ? 'diperbarui' : 'ditambahkan'} tanpa mengubah booking historis.`,
        tone: 'success',
        title: editingRoom ? 'Ruang diperbarui' : 'Ruang ditambahkan',
      });
      setRoomDialogMode(null);
      setEditingRoom(null);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setDialogError(getSafeFirebaseMessage(error, 'menyimpan'));
    } finally {
      setSaving(false);
    }
  };

  const openStatusDialog = (room) => {
    if (!canEdit) return;
    setStatusTarget(room);
    setStatusError('');
  };

  const closeStatusDialog = useCallback(() => {
    if (statusSaving) return;
    setStatusTarget(null);
    setStatusError('');
  }, [statusSaving]);

  const changeRoomStatus = async () => {
    if (!statusTarget || !canEdit || !actorUid) {
      setStatusError('Sesi ini tidak diizinkan mengubah status ruang.');
      return;
    }

    setStatusSaving(true);
    setStatusError('');

    try {
      await repository.setStudioRoomStatus(statusTarget.id, nextStatus, { actorUid });
      pushToast({
        message:
          nextStatus === STUDIO_ROOM_STATUSES.ACTIVE
            ? `${statusTarget.name} kembali tersedia untuk konfigurasi booking berikutnya.`
            : `${statusTarget.name} tidak lagi tersedia untuk booking baru; riwayat tetap aman.`,
        tone: 'success',
        title:
          nextStatus === STUDIO_ROOM_STATUSES.ACTIVE ? 'Ruang diaktifkan' : 'Ruang dinonaktifkan',
      });
      setStatusTarget(null);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setStatusError(getSafeFirebaseMessage(error, 'mengubah status'));
    } finally {
      setStatusSaving(false);
    }
  };

  return (
    <>
      <section className="settings-card" aria-labelledby="studio-rooms-heading">
        <header className="settings-card__header settings-card__header--with-action">
          <div>
            <p className="settings-card__eyebrow">Ruang & resource</p>
            <h2 id="studio-rooms-heading">Ruang studio</h2>
            <p className="settings-card__subtitle">
              Urutan ini menjadi sumber daftar ruang untuk workflow booking berikutnya.
            </p>
          </div>
          {canEdit ? (
            <Button
              size="sm"
              disabled={loadState !== 'ready' || roomLimitReached}
              onClick={openCreateDialog}
            >
              Tambah ruang
            </Button>
          ) : null}
        </header>

        {loadState === 'loading' ? (
          <div
            className="settings-state settings-state--embedded"
            aria-busy="true"
            aria-live="polite"
          >
            <span className="settings-state__spinner" aria-hidden="true" />
            <div>
              <p className="settings-state__title">Memuat ruang studio</p>
              <p className="settings-state__description">
                Satu query terurut dibatasi maksimal {roomLimit} dokumen.
              </p>
            </div>
          </div>
        ) : null}

        {loadState === 'error' ? (
          <div className="settings-state settings-state--embedded" data-tone="danger" role="alert">
            <div>
              <p className="settings-state__title">Daftar ruang gagal dimuat</p>
              <p className="settings-state__description">{loadError}</p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setReloadKey((value) => value + 1)}
            >
              Coba lagi
            </Button>
          </div>
        ) : null}

        {loadState === 'ready' && roomLimitReached ? (
          <div className="settings-notice" data-tone="warning" role="status">
            <strong>Batas {roomLimit} ruang tercapai.</strong>
            <span>
              Edit atau gunakan kembali konfigurasi yang sudah ada; hard delete tidak tersedia.
            </span>
          </div>
        ) : null}

        {loadState === 'ready' && rooms.length === 0 ? (
          <div className="settings-room-empty">
            <span className="settings-placeholder__dot" aria-hidden="true" />
            <div>
              <p className="settings-placeholder__title">Belum ada ruang studio</p>
              <p className="settings-placeholder__description">
                Tambahkan ruang pertama agar konfigurasi booking tidak bergantung pada kode
                aplikasi.
              </p>
            </div>
          </div>
        ) : null}

        {loadState === 'ready' && rooms.length > 0 ? (
          <div className="settings-room-list" aria-label="Daftar ruang studio">
            {rooms.map((room) => {
              const isActive = room.status === STUDIO_ROOM_STATUSES.ACTIVE;

              return (
                <article
                  className="settings-room-row"
                  data-disabled={!isActive || undefined}
                  key={room.id}
                >
                  <div
                    className="settings-room-row__order"
                    aria-label={`Urutan ${room.displayOrder}`}
                  >
                    {room.displayOrder}
                  </div>
                  <div className="settings-room-row__content">
                    <div className="settings-room-row__heading">
                      <h3>{room.name}</h3>
                      <Badge tone={isActive ? 'success' : 'neutral'}>
                        {isActive ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                      <Badge tone="brand">{room.code}</Badge>
                    </div>
                    <p>{room.description || 'Belum ada deskripsi ruang.'}</p>
                  </div>
                  {canEdit ? (
                    <div className="settings-room-row__actions">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Edit ${room.name}`}
                        onClick={() => openEditDialog(room)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant={isActive ? 'ghost' : 'secondary'}
                        aria-label={`${isActive ? 'Nonaktifkan' : 'Aktifkan'} ${room.name}`}
                        onClick={() => openStatusDialog(room)}
                      >
                        {isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      </Button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : null}
      </section>

      <Dialog
        open={Boolean(roomDialogMode)}
        title={dialogTitle}
        description="Kode, nama, dan urutan tampil digunakan oleh workspace operasional."
        onClose={closeRoomDialog}
        footer={
          <>
            <Button variant="ghost" disabled={saving} onClick={closeRoomDialog}>
              Batal
            </Button>
            <Button type="submit" form="studio-room-form" loading={saving}>
              Simpan ruang
            </Button>
          </>
        }
      >
        {dialogError ? (
          <div className="settings-notice" data-tone="danger" role="alert">
            <strong>Ruang belum tersimpan.</strong>
            <span>{dialogError}</span>
          </div>
        ) : null}

        <form id="studio-room-form" className="settings-room-form" onSubmit={saveRoom} noValidate>
          <div className="settings-form__grid">
            <Input
              label="Nama ruang"
              value={formValues.name}
              error={fieldErrors.name}
              maxLength={80}
              required
              disabled={saving}
              data-autofocus="true"
              onChange={changeField('name')}
            />
            <Input
              label="Kode ruang"
              value={formValues.code}
              error={fieldErrors.code}
              maxLength={24}
              placeholder="ST-A"
              required
              disabled={saving}
              onChange={changeField('code')}
            />
          </div>
          <Textarea
            label="Deskripsi"
            value={formValues.description}
            error={fieldErrors.description}
            maxLength={240}
            rows={3}
            disabled={saving}
            onChange={changeField('description')}
          />
          <Input
            type="number"
            label="Urutan tampil"
            value={formValues.displayOrder}
            error={fieldErrors.displayOrder}
            min={1}
            max={999}
            required
            disabled={saving}
            description="Angka lebih kecil tampil lebih dahulu. Nilai yang sama diurutkan berdasarkan nama."
            onChange={changeField('displayOrder')}
          />
        </form>
      </Dialog>

      <Dialog
        open={Boolean(statusTarget)}
        size="sm"
        title={`${nextStatusLabel} ${statusTarget?.name ?? 'ruang'}?`}
        description={
          nextStatus === STUDIO_ROOM_STATUSES.ACTIVE
            ? 'Ruang akan kembali tersedia untuk konfigurasi booking baru.'
            : 'Ruang tidak dipilih untuk booking baru, tetapi referensi dan snapshot historis tetap dipertahankan.'
        }
        onClose={closeStatusDialog}
        footer={
          <>
            <Button variant="ghost" disabled={statusSaving} onClick={closeStatusDialog}>
              Batal
            </Button>
            <Button
              variant={nextStatus === STUDIO_ROOM_STATUSES.DISABLED ? 'danger' : 'primary'}
              loading={statusSaving}
              onClick={changeRoomStatus}
            >
              {nextStatusLabel} ruang
            </Button>
          </>
        }
      >
        {statusError ? (
          <div className="settings-notice" data-tone="danger" role="alert">
            <strong>Status belum berubah.</strong>
            <span>{statusError}</span>
          </div>
        ) : (
          <div className="settings-dialog-note">
            Tidak ada hard delete pada workflow ini. Riwayat booking tidak ikut diubah.
          </div>
        )}
      </Dialog>
    </>
  );
}
