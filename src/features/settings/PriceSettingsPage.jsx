import { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '../../components/feedback/Badge.jsx';
import { Dialog } from '../../components/feedback/Dialog.jsx';
import { useToast } from '../../components/feedback/toast-context.js';
import { Button } from '../../components/ui/Button.jsx';
import { sessionTypeRepository } from '../../services/sessionTypeRepository.js';
import { CAPABILITIES, hasCapability } from '../auth/capabilities.js';
import { useAuth } from '../auth/useAuth.js';
import { SESSION_TYPE_LIST_LIMIT, SESSION_TYPE_STATUSES } from '../pricing/sessionTypes.js';
import { AddOnsSection } from './AddOnsSection.jsx';
import { PricingPreviewSection } from './PricingPreviewSection.jsx';
import { PricingRulesSection } from './PricingRulesSection.jsx';
import { SessionTypeEditorDialog } from './SessionTypeEditorDialog.jsx';
import { SettingsWorkspace } from './SettingsWorkspace.jsx';
import { getNextSessionTypeDisplayOrder } from './sessionTypeSettings.js';
import './price-settings.css';

function getSafeFirebaseMessage(error, action) {
  if (error?.code === 'permission-denied') {
    return `Akun ini tidak memiliki izin untuk ${action} layanan.`;
  }

  if (error?.code === 'unavailable') {
    return `Data layanan sedang tidak tersedia. Coba ${action} lagi setelah koneksi pulih.`;
  }

  return `Layanan belum bisa ${action}. Coba lagi tanpa menghapus data form.`;
}

function formatDurationSummary(sessionType) {
  if (sessionType.defaultDurationMinutes === null) return 'Durasi fleksibel';

  if (sessionType.defaultDurationMinutes === sessionType.minimumDurationMinutes) {
    return `${sessionType.defaultDurationMinutes} menit`;
  }

  return `Default ${sessionType.defaultDurationMinutes} mnt · Min ${sessionType.minimumDurationMinutes} mnt`;
}

export function PriceSettingsPage({
  addOnsRepository,
  pricingRulesRepository,
  repository = sessionTypeRepository,
  studioRoomsRepository,
}) {
  const access = useAuth();
  const { pushToast } = useToast();
  const canEdit = hasCapability(access, CAPABILITIES.SETTINGS_PRICING_EDIT);
  const canDelete = canEdit && access.profile?.role === 'owner';
  const [configurationRevision, setConfigurationRevision] = useState(0);
  const [deleteError, setDeleteError] = useState('');
  const [deleteImpact, setDeleteImpact] = useState(null);
  const [deleteLoadState, setDeleteLoadState] = useState('idle');
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
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
      setDialogError('Sesi ini tidak diizinkan menyimpan layanan.');
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
        message: `${details.name} sudah ${editingSessionType ? 'diperbarui' : 'ditambahkan'}. Perubahan berlaku untuk booking baru.`,
        tone: 'success',
        title: editingSessionType ? 'Layanan diperbarui' : 'Layanan ditambahkan',
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
      setStatusError('Sesi ini tidak diizinkan mengubah status layanan.');
      return;
    }

    setStatusSaving(true);
    setStatusError('');

    try {
      await repository.setSessionTypeStatus(statusTarget.id, nextStatus, { actorUid });
      pushToast({
        message:
          nextStatus === SESSION_TYPE_STATUSES.ACTIVE
            ? `${statusTarget.name} kembali tersedia untuk booking baru.`
            : `${statusTarget.name} disembunyikan dari booking baru. Data booking lama tetap aman.`,
        tone: 'success',
        title:
          nextStatus === SESSION_TYPE_STATUSES.ACTIVE
            ? 'Layanan diaktifkan'
            : 'Layanan dinonaktifkan',
      });
      setStatusTarget(null);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setStatusError(getSafeFirebaseMessage(error, 'mengubah status'));
    } finally {
      setStatusSaving(false);
    }
  };

  const openDeleteDialog = async (sessionType) => {
    if (!canDelete) return;

    setDeleteTarget(sessionType);
    setDeleteImpact(null);
    setDeleteError('');
    setDeleteLoadState('loading');

    try {
      const impact = await repository.getSessionTypeDeleteImpact(sessionType.id);
      setDeleteImpact(impact);
      setDeleteLoadState('ready');
    } catch (error) {
      setDeleteError(getSafeFirebaseMessage(error, 'memeriksa sebelum menghapus'));
      setDeleteLoadState('error');
    }
  };

  const closeDeleteDialog = useCallback(() => {
    if (deleteSaving) return;
    setDeleteTarget(null);
    setDeleteImpact(null);
    setDeleteError('');
    setDeleteLoadState('idle');
  }, [deleteSaving]);

  const deleteSessionType = async () => {
    if (!canDelete || !deleteTarget || deleteLoadState !== 'ready') return;

    setDeleteSaving(true);
    setDeleteError('');

    try {
      const result = await repository.deleteSessionType(deleteTarget.id);
      pushToast({
        message: `${deleteTarget.name} dihapus permanen bersama ${result.pricingRulesDeleted} harga/paket dan ${result.addOnsDeleted} layanan tambahan terkait.`,
        tone: 'success',
        title: 'Layanan dihapus',
      });
      setDeleteTarget(null);
      setDeleteImpact(null);
      setDeleteLoadState('idle');
      setReloadKey((value) => value + 1);
      setConfigurationRevision((value) => value + 1);
    } catch (error) {
      setDeleteError(getSafeFirebaseMessage(error, 'menghapus'));
      setDeleteLoadState('error');
    } finally {
      setDeleteSaving(false);
    }
  };

  return (
    <SettingsWorkspace
      title="Harga"
      description="Atur layanan, harga, paket, dan tambahan yang akan dipakai saat membuat booking."
      actions={
        <span className="settings-access-badge" data-editable={canEdit || undefined}>
          {canEdit ? 'Dapat mengedit' : 'Lihat saja'}
        </span>
      }
    >
      <div className="settings-notice" role="status">
        <strong>Harga booking lama tetap aman.</strong>
        <span>
          Perubahan di halaman ini hanya berlaku untuk booking baru atau booking yang sengaja
          dihitung ulang.
        </span>
      </div>

      {!canEdit ? (
        <div className="settings-notice" role="status">
          <strong>Mode lihat saja.</strong>
          <span>Akun ini dapat melihat pengaturan harga, tetapi tidak dapat mengubahnya.</span>
        </div>
      ) : null}

      <section className="settings-card" aria-labelledby="price-session-types-heading">
        <header className="settings-card__header settings-card__header--with-action">
          <div>
            <p className="settings-card__eyebrow">Layanan</p>
            <h2 id="price-session-types-heading">Layanan studio</h2>
            <p className="settings-card__subtitle">
              Buat layanan seperti latihan studio, recording, mixing, atau layanan lain yang dijual.
            </p>
          </div>
          {canEdit ? (
            <Button
              size="sm"
              disabled={loadState !== 'ready' || limitReached}
              onClick={openCreateDialog}
            >
              Tambah layanan
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
              <p className="settings-state__title">Memuat layanan</p>
              <p className="settings-state__description">Menyiapkan daftar layanan studio.</p>
            </div>
          </div>
        ) : null}

        {loadState === 'error' ? (
          <div className="settings-state settings-state--embedded" data-tone="danger" role="alert">
            <div>
              <p className="settings-state__title">Layanan gagal dimuat</p>
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
            <strong>Batas layanan sudah tercapai.</strong>
            <span>Edit atau aktifkan kembali layanan yang sudah ada.</span>
          </div>
        ) : null}

        {loadState === 'ready' && sessionTypes.length === 0 ? (
          <div className="price-session-empty">
            <span className="settings-placeholder__dot" aria-hidden="true" />
            <div>
              <p className="settings-placeholder__title">Belum ada layanan</p>
              <p className="settings-placeholder__description">
                Tambahkan layanan pertama, lalu atur harganya di bagian berikutnya.
              </p>
            </div>
          </div>
        ) : null}

        {loadState === 'ready' && sessionTypes.length > 0 ? (
          <div className="price-session-list" aria-label="Daftar layanan">
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
                    </div>
                    <div className="price-session-row__meta">
                      <span>
                        {sessionType.requiresStudioReservation
                          ? 'Memesan slot studio'
                          : 'Tanpa slot studio'}
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
                      {canDelete ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Hapus ${sessionType.name}`}
                          onClick={() => openDeleteDialog(sessionType)}
                        >
                          Hapus
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : null}
      </section>

      <PricingRulesSection
        key={`pricing-rules-${configurationRevision}`}
        access={access}
        canEdit={canEdit}
        repository={pricingRulesRepository}
        sessionTypes={loadState === 'ready' ? sessionTypes : []}
        studioRepository={studioRoomsRepository}
      />

      <AddOnsSection
        key={`add-ons-${configurationRevision}`}
        access={access}
        canEdit={canEdit}
        repository={addOnsRepository}
        sessionTypes={loadState === 'ready' ? sessionTypes : []}
      />

      <PricingPreviewSection
        key={`pricing-preview-${configurationRevision}`}
        access={access}
        addOnsRepository={addOnsRepository}
        pricingRulesRepository={pricingRulesRepository}
        sessionTypes={loadState === 'ready' ? sessionTypes : []}
        studioRoomsRepository={studioRoomsRepository}
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
        title={`${nextStatusLabel} ${statusTarget?.name ?? 'layanan'}?`}
        description={
          nextStatus === SESSION_TYPE_STATUSES.ACTIVE
            ? 'Layanan akan kembali tersedia untuk booking baru.'
            : 'Layanan tidak akan ditawarkan untuk booking baru. Data booking lama tetap aman.'
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
            <strong>{statusTarget?.name}</strong>
            <span>
              {nextStatus === SESSION_TYPE_STATUSES.DISABLED
                ? 'Layanan bisa diaktifkan kembali kapan saja tanpa menghapus histori.'
                : 'Setelah aktif, layanan dapat kembali dipakai untuk pengaturan harga dan booking baru.'}
            </span>
          </div>
        )}
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        size="sm"
        title={`Hapus ${deleteTarget?.name ?? 'layanan'} permanen?`}
        description="Layanan dan seluruh harga, paket, serta layanan tambahan yang terikat akan dihapus permanen."
        onClose={closeDeleteDialog}
        footer={
          <>
            <Button variant="ghost" disabled={deleteSaving} onClick={closeDeleteDialog}>
              Batal
            </Button>
            <Button
              variant="danger"
              loading={deleteSaving}
              disabled={deleteLoadState !== 'ready'}
              onClick={deleteSessionType}
            >
              Hapus permanen
            </Button>
          </>
        }
      >
        {deleteLoadState === 'loading' ? (
          <div className="settings-state settings-state--embedded" aria-busy="true">
            <span className="settings-state__spinner" aria-hidden="true" />
            <div>
              <p className="settings-state__title">Memeriksa data terkait</p>
              <p className="settings-state__description">
                Menghitung harga, paket, dan layanan tambahan yang ikut dihapus.
              </p>
            </div>
          </div>
        ) : null}

        {deleteError ? (
          <div className="settings-notice" data-tone="danger" role="alert">
            <strong>Layanan belum bisa dihapus.</strong>
            <span>{deleteError}</span>
          </div>
        ) : null}

        {deleteLoadState === 'ready' && deleteImpact ? (
          <div className="price-session-status-summary">
            <strong>Aksi ini tidak bisa dibatalkan.</strong>
            <span>
              {deleteImpact.pricingRuleCount} harga/paket dan {deleteImpact.addOnCount} layanan
              tambahan yang terikat akan ikut dihapus.
            </span>
            <span>
              Jika layanan ini sudah pernah dipakai pada booking historis, gunakan Nonaktifkan
              sebagai gantinya agar referensi histori tetap tersedia.
            </span>
          </div>
        ) : null}
      </Dialog>
    </SettingsWorkspace>
  );
}
