import { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '../../components/feedback/Badge.jsx';
import { Dialog } from '../../components/feedback/Dialog.jsx';
import { useToast } from '../../components/feedback/toast-context.js';
import { Button } from '../../components/ui/Button.jsx';
import { sessionTypeRepository } from '../../services/sessionTypeRepository.js';
import { CAPABILITIES, hasCapability } from '../auth/capabilities.js';
import { useAuth } from '../auth/useAuth.js';
import { SESSION_TYPE_LIST_LIMIT, SESSION_TYPE_STATUSES } from '../pricing/sessionTypes.js';
import { PricingRulesSection } from './PricingRulesSection.jsx';
import { SessionTypeEditorDialog } from './SessionTypeEditorDialog.jsx';
import { SettingsWorkspace } from './SettingsWorkspace.jsx';
import { getNextSessionTypeDisplayOrder } from './sessionTypeSettings.js';
import './price-settings.css';

function getSafeFirebaseMessage(error, action) {
  if (error?.code === 'permission-denied') {
    return `Akun ini tidak memiliki izin untuk ${action} session type.`;
  }

  if (error?.code === 'unavailable') {
    return `Firestore sedang tidak tersedia. Coba ${action} lagi setelah koneksi pulih.`;
  }

  return `Session type belum bisa ${action}. Coba lagi tanpa menghapus data form.`;
}

function formatDurationSummary(sessionType) {
  if (sessionType.defaultDurationMinutes === null) return 'Tanpa default durasi';

  if (sessionType.defaultDurationMinutes === sessionType.minimumDurationMinutes) {
    return `${sessionType.defaultDurationMinutes} menit`;
  }

  return `Default ${sessionType.defaultDurationMinutes} mnt · Min ${sessionType.minimumDurationMinutes} mnt`;
}

export function PriceSettingsPage({
  pricingRulesRepository,
  repository = sessionTypeRepository,
}) {
  const access = useAuth();
  const { pushToast } = useToast();
  const canEdit = hasCapability(access, CAPABILITIES.SETTINGS_PRICING_EDIT);
  const [dialogError, setDialogError] = useState('');
  const [editingSessionType, setEditingSessionType] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [loadState, setLoadState] = useState('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [sessionTypes, setSessionTypes] = useState([]);
  const [statusError, setStatusError] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null);

  const listLimit = repository.listLimit ?? SESSION_TYPE_LIST_LIMIT;
  const limitReached = sessionTypes.length >= listLimit;
  const nextDisplayOrder = useMemo(
    () => getNextSessionTypeDisplayOrder(sessionTypes),
    [sessionTypes],
  );
  const nextStatus =
    statusTarget?.status === SESSION_TYPE_STATUSES.ACTIVE
      ? SESSION_TYPE_STATUSES.DISABLED
      : SESSION_TYPE_STATUSES.ACTIVE;
  const nextStatusLabel = nextStatus === SESSION_TYPE_STATUSES.ACTIVE ? 'Aktifkan' : 'Nonaktifkan';

  useEffect(() => {
    let active = true;

    setLoadError('');
    setLoadState('loading');

    repository
      .listSessionTypes()
      .then((nextSessionTypes) => {
        if (!active) return;
        setSessionTypes([...nextSessionTypes]);
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
    if (!canEdit || limitReached) return;
    setEditingSessionType(null);
    setDialogError('');
    setEditorOpen(true);
  };

  const openEditDialog = (sessionType) => {
    if (!canEdit) return;
    setEditingSessionType(sessionType);
    setDialogError('');
    setEditorOpen(true);
  };

  const closeEditor = useCallback(() => {
    if (saving) return;
    setEditorOpen(false);
    setEditingSessionType(null);
    setDialogError('');
  }, [saving]);

  const saveSessionType = async (details) => {
    const actorUid = access.user?.uid;

    if (!canEdit || !actorUid) {
      setDialogError('Sesi ini tidak diizinkan menyimpan session type.');
      return;
    }

    setSaving(true);
    setDialogError('');

    try {
      if (editingSessionType) {
        await repository.updateSessionType(editingSessionType.id, details, { actorUid });
      } else {
        await repository.createSessionType(details, { actorUid });
      }

      pushToast({
        message: `${details.name} sudah ${editingSessionType ? 'diperbarui' : 'ditambahkan'}. Perubahan hanya memengaruhi booking baru atau repricing eksplisit.`,
        tone: 'success',
        title: editingSessionType ? 'Session type diperbarui' : 'Session type ditambahkan',
      });
      setEditorOpen(false);
      setEditingSessionType(null);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setDialogError(getSafeFirebaseMessage(error, 'menyimpan'));
    } finally {
      setSaving(false);
    }
  };

  const openStatusDialog = (sessionType) => {
    if (!canEdit) return;
    setStatusTarget(sessionType);
    setStatusError('');
  };

  const closeStatusDialog = useCallback(() => {
    if (statusSaving) return;
    setStatusTarget(null);
    setStatusError('');
  }, [statusSaving]);

  const changeStatus = async () => {
    const actorUid = access.user?.uid;

    if (!statusTarget || !canEdit || !actorUid) {
      setStatusError('Sesi ini tidak diizinkan mengubah status session type.');
      return;
    }

    setStatusSaving(true);
    setStatusError('');

    try {
      await repository.setSessionTypeStatus(statusTarget.id, nextStatus, { actorUid });
      pushToast({
        message:
          nextStatus === SESSION_TYPE_STATUSES.ACTIVE
            ? `${statusTarget.name} kembali tersedia untuk konfigurasi booking baru.`
            : `${statusTarget.name} tidak lagi tersedia untuk booking baru; snapshot dan referensi historis tetap aman.`,
        tone: 'success',
        title:
          nextStatus === SESSION_TYPE_STATUSES.ACTIVE
            ? 'Session type diaktifkan'
            : 'Session type dinonaktifkan',
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
    <SettingsWorkspace
      title="Price Settings"
      description="Kelola jenis layanan dan pricing rule tanpa menyentuh source code atau raw JSON."
      actions={
        <span className="settings-access-badge" data-editable={canEdit || undefined}>
          {canEdit ? 'Dapat mengedit' : 'Lihat saja'}
        </span>
      }
    >
      <div className="settings-notice" role="status">
        <strong>Snapshot historis tetap beku.</strong>
        <span>
          Perubahan di halaman ini berlaku untuk booking baru atau repricing eksplisit. Booking
          terkonfirmasi yang sudah menyimpan snapshot tidak dihitung ulang otomatis.
        </span>
      </div>

      {!canEdit ? (
        <div className="settings-notice" role="status">
          <strong>Mode lihat saja.</strong>
          <span>Perubahan memerlukan capability settings.pricing.edit.</span>
        </div>
      ) : null}

      <section className="settings-card" aria-labelledby="price-session-types-heading">
        <header className="settings-card__header settings-card__header--with-action">
          <div>
            <p className="settings-card__eyebrow">Layanan</p>
            <h2 id="price-session-types-heading">Session types</h2>
            <p className="settings-card__subtitle">
              Tentukan layanan, perilaku reservasi studio, default/minimum durasi, dan urutan
              tampil.
            </p>
          </div>
          {canEdit ? (
            <Button
              size="sm"
              disabled={loadState !== 'ready' || limitReached}
              onClick={openCreateDialog}
            >
              Tambah session type
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
              <p className="settings-state__title">Memuat session types</p>
              <p className="settings-state__description">
                Satu query terurut dibatasi maksimal {listLimit} dokumen.
              </p>
            </div>
          </div>
        ) : null}

        {loadState === 'error' ? (
          <div className="settings-state settings-state--embedded" data-tone="danger" role="alert">
            <div>
              <p className="settings-state__title">Session types gagal dimuat</p>
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

        {loadState === 'ready' && limitReached ? (
          <div className="settings-notice" data-tone="warning" role="status">
            <strong>Batas {listLimit} session type tercapai.</strong>
            <span>
              Edit atau aktifkan kembali konfigurasi yang ada; hard delete tidak tersedia.
            </span>
          </div>
        ) : null}

        {loadState === 'ready' && sessionTypes.length === 0 ? (
          <div className="price-session-empty">
            <span className="settings-placeholder__dot" aria-hidden="true" />
            <div>
              <p className="settings-placeholder__title">Belum ada session type</p>
              <p className="settings-placeholder__description">
                Tambahkan layanan pertama sebelum membuat pricing rule.
              </p>
            </div>
          </div>
        ) : null}

        {loadState === 'ready' && sessionTypes.length > 0 ? (
          <div className="price-session-list" aria-label="Daftar session type">
            {sessionTypes.map((sessionType) => {
              const isActive = sessionType.status === SESSION_TYPE_STATUSES.ACTIVE;

              return (
                <article
                  className="price-session-row"
                  data-disabled={!isActive || undefined}
                  key={sessionType.id}
                >
                  <div
                    className="price-session-row__order"
                    aria-label={`Urutan ${sessionType.displayOrder}`}
                  >
                    {sessionType.displayOrder}
                  </div>
                  <div className="price-session-row__content">
                    <div className="price-session-row__heading">
                      <h3>{sessionType.name}</h3>
                      <Badge tone={isActive ? 'success' : 'neutral'}>
                        {isActive ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                      <Badge tone="brand">{sessionType.code}</Badge>
                    </div>
                    <div className="price-session-row__meta">
                      <span>
                        {sessionType.requiresStudioReservation
                          ? 'Reservasi studio'
                          : 'Tanpa reservasi studio'}
                      </span>
                      <span>{formatDurationSummary(sessionType)}</span>
                    </div>
                    <p>{sessionType.description || 'Belum ada deskripsi layanan.'}</p>
                  </div>
                  {canEdit ? (
                    <div className="price-session-row__actions">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Edit ${sessionType.name}`}
                        onClick={() => openEditDialog(sessionType)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant={isActive ? 'ghost' : 'secondary'}
                        aria-label={`${isActive ? 'Nonaktifkan' : 'Aktifkan'} ${sessionType.name}`}
                        onClick={() => openStatusDialog(sessionType)}
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

      <PricingRulesSection
        access={access}
        canEdit={canEdit}
        repository={pricingRulesRepository}
        sessionTypes={loadState === 'ready' ? sessionTypes : []}
      />

      <SessionTypeEditorDialog
        dialogError={dialogError}
        editingSessionType={editingSessionType}
        existingSessionTypes={sessionTypes}
        nextDisplayOrder={nextDisplayOrder}
        onClose={closeEditor}
        onSubmit={saveSessionType}
        open={editorOpen}
        saving={saving}
      />

      <Dialog
        open={Boolean(statusTarget)}
        size="sm"
        title={`${nextStatusLabel} ${statusTarget?.name ?? 'session type'}?`}
        description={
          nextStatus === SESSION_TYPE_STATUSES.ACTIVE
            ? 'Layanan akan kembali tersedia untuk konfigurasi booking baru.'
            : 'Layanan tidak dipilih untuk booking baru, tetapi referensi dan snapshot historis tetap dipertahankan.'
        }
        onClose={closeStatusDialog}
        footer={
          <>
            <Button variant="ghost" disabled={statusSaving} onClick={closeStatusDialog}>
              Batal
            </Button>
            <Button
              variant={nextStatus === SESSION_TYPE_STATUSES.DISABLED ? 'danger' : 'primary'}
              loading={statusSaving}
              onClick={changeStatus}
            >
              {nextStatusLabel}
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
          <div className="price-session-status-summary">
            <strong>{statusTarget?.code}</strong>
            <span>
              {nextStatus === SESSION_TYPE_STATUSES.DISABLED
                ? 'Tidak ada hard delete. Histori dan referensi pricing tetap dipertahankan.'
                : 'Aktivasi tidak membuat pricing rule baru secara otomatis.'}
            </span>
          </div>
        )}
      </Dialog>
    </SettingsWorkspace>
  );
}
