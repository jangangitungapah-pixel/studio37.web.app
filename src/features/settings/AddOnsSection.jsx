import { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '../../components/feedback/Badge.jsx';
import { Dialog } from '../../components/feedback/Dialog.jsx';
import { useToast } from '../../components/feedback/toast-context.js';
import { Button } from '../../components/ui/Button.jsx';
import { addOnRepository } from '../../services/addOnRepository.js';
import { ADD_ON_LIST_LIMIT, ADD_ON_STATUSES } from '../pricing/addOns.js';
import { AddOnEditorDialog } from './AddOnEditorDialog.jsx';
import { formatAddOnPricingSummary, getAddOnPricingTypeLabel } from './addOnSettings.js';

function getSafeFirebaseMessage(error, action) {
  if (error?.code === 'permission-denied') {
    return `Akun ini tidak memiliki izin untuk ${action} layanan tambahan.`;
  }
  if (error?.code === 'unavailable') {
    return `Layanan tambahan sedang tidak tersedia. Coba ${action} lagi setelah koneksi pulih.`;
  }
  return `Layanan tambahan belum bisa ${action}. Coba lagi tanpa menghapus konfigurasi.`;
}

function getNextDisplayOrder(addOns) {
  if (!addOns.length) return 1;
  return Math.min(999, Math.max(...addOns.map((addOn) => addOn.displayOrder)) + 1);
}

export function AddOnsSection({ access, canEdit, repository = addOnRepository, sessionTypes }) {
  const { pushToast } = useToast();
  const [addOns, setAddOns] = useState([]);
  const [dialogError, setDialogError] = useState('');
  const [editingAddOn, setEditingAddOn] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [loadState, setLoadState] = useState('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null);

  const listLimit = repository.listLimit ?? ADD_ON_LIST_LIMIT;
  const limitReached = addOns.length >= listLimit;
  const nextDisplayOrder = getNextDisplayOrder(addOns);
  const sessionTypeById = useMemo(
    () => new Map(sessionTypes.map((sessionType) => [sessionType.id, sessionType])),
    [sessionTypes],
  );
  const nextStatus =
    statusTarget?.status === ADD_ON_STATUSES.ACTIVE
      ? ADD_ON_STATUSES.DISABLED
      : ADD_ON_STATUSES.ACTIVE;
  const nextStatusLabel = nextStatus === ADD_ON_STATUSES.ACTIVE ? 'Aktifkan' : 'Nonaktifkan';

  useEffect(() => {
    let active = true;
    setLoadError('');
    setLoadState('loading');

    repository
      .listAddOns()
      .then((nextAddOns) => {
        if (!active) return;
        setAddOns([...nextAddOns]);
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
    setEditingAddOn(null);
    setDialogError('');
    setEditorOpen(true);
  };

  const openEditDialog = (addOn) => {
    if (!canEdit || limitReached) return;
    setEditingAddOn(addOn);
    setDialogError('');
    setEditorOpen(true);
  };

  const closeEditor = useCallback(() => {
    if (saving) return;
    setEditorOpen(false);
    setEditingAddOn(null);
    setDialogError('');
  }, [saving]);

  const saveAddOn = async (details) => {
    const actorUid = access.user?.uid;
    if (!canEdit || !actorUid) {
      setDialogError('Sesi ini tidak diizinkan menyimpan layanan tambahan.');
      return;
    }
    if (limitReached) {
      setDialogError(`Batas ${listLimit} layanan tambahan sudah tercapai.`);
      return;
    }

    setSaving(true);
    setDialogError('');
    try {
      if (editingAddOn) {
        await repository.updateAddOn(editingAddOn.id, details, { actorUid });
      } else {
        await repository.createAddOn(details, { actorUid });
      }
      pushToast({
        message: `${details.name} sudah ${editingAddOn ? 'diperbarui' : 'ditambahkan'}. Booking lama tetap memakai data sebelumnya.`,
        tone: 'success',
        title: editingAddOn ? 'Layanan tambahan diperbarui' : 'Layanan tambahan ditambahkan',
      });
      setEditorOpen(false);
      setEditingAddOn(null);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setDialogError(getSafeFirebaseMessage(error, 'menyimpan'));
    } finally {
      setSaving(false);
    }
  };

  const openStatusDialog = (addOn) => {
    if (!canEdit) return;
    setStatusTarget(addOn);
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
      setStatusError('Sesi ini tidak diizinkan mengubah status layanan tambahan.');
      return;
    }

    setStatusSaving(true);
    setStatusError('');
    try {
      await repository.setAddOnStatus(statusTarget.id, nextStatus, { actorUid });
      pushToast({
        message:
          nextStatus === ADD_ON_STATUSES.ACTIVE
            ? `${statusTarget.name} kembali tersedia untuk booking baru.`
            : `${statusTarget.name} tidak lagi ditawarkan untuk booking baru.`,
        tone: 'success',
        title:
          nextStatus === ADD_ON_STATUSES.ACTIVE
            ? 'Layanan tambahan diaktifkan'
            : 'Layanan tambahan dinonaktifkan',
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
    <section className="settings-card" aria-labelledby="price-add-ons-heading">
      <header className="settings-card__header settings-card__header--with-action">
        <div>
          <p className="settings-card__eyebrow">Tambahan</p>
          <h2 id="price-add-ons-heading">Layanan tambahan</h2>
          <p className="settings-card__subtitle">
            Tambahkan item seperti extra microphone, sewa instrumen, engineer, atau layanan ekstra
            lain yang bisa dipilih saat booking.
          </p>
        </div>
        {canEdit ? (
          <Button
            size="sm"
            disabled={loadState !== 'ready' || limitReached}
            onClick={openCreateDialog}
          >
            Tambah layanan tambahan
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
            <p className="settings-state__title">Memuat layanan tambahan</p>
            <p className="settings-state__description">Menyiapkan daftar layanan tambahan.</p>
          </div>
        </div>
      ) : null}

      {loadState === 'error' ? (
        <div className="settings-state settings-state--embedded" data-tone="danger" role="alert">
          <div>
            <p className="settings-state__title">Layanan tambahan gagal dimuat</p>
            <p className="settings-state__description">{loadError}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setReloadKey((value) => value + 1)}>
            Coba lagi
          </Button>
        </div>
      ) : null}

      {loadState === 'ready' && limitReached ? (
        <div className="settings-notice" data-tone="warning" role="status">
          <strong>Batas layanan tambahan sudah tercapai.</strong>
          <span>Edit atau aktifkan kembali item yang sudah ada.</span>
        </div>
      ) : null}

      {loadState === 'ready' && addOns.length === 0 ? (
        <div className="price-session-empty">
          <span className="settings-placeholder__dot" aria-hidden="true" />
          <div>
            <p className="settings-placeholder__title">Belum ada layanan tambahan</p>
            <p className="settings-placeholder__description">
              Tambahkan layanan ekstra jika studio memang menjualnya. Bagian ini boleh dibiarkan
              kosong.
            </p>
          </div>
        </div>
      ) : null}

      {loadState === 'ready' && addOns.length > 0 ? (
        <div className="price-session-list" aria-label="Daftar layanan tambahan">
          {addOns.map((addOn) => {
            const isActive = addOn.status === ADD_ON_STATUSES.ACTIVE;
            const sessionType = addOn.sessionTypeId
              ? sessionTypeById.get(addOn.sessionTypeId)
              : null;
            const sessionLabel = addOn.sessionTypeId
              ? sessionType
                ? sessionType.name
                : 'Layanan tertentu'
              : 'Semua layanan';

            return (
              <article
                className="price-session-row"
                data-disabled={!isActive || undefined}
                key={addOn.id}
              >
                <div
                  className="price-session-row__order"
                  aria-label={`Urutan ${addOn.displayOrder}`}
                >
                  {addOn.displayOrder}
                </div>
                <div className="price-session-row__content">
                  <div className="price-session-row__heading">
                    <h3>{addOn.name}</h3>
                    <Badge tone={isActive ? 'success' : 'neutral'}>
                      {isActive ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </div>
                  <div className="price-session-row__meta">
                    <span>{sessionLabel}</span>
                    <span>{formatAddOnPricingSummary(addOn)}</span>
                  </div>
                  <p>{addOn.description || 'Belum ada deskripsi layanan tambahan.'}</p>
                </div>
                {canEdit ? (
                  <div className="price-session-row__actions">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={limitReached}
                      aria-label={`Edit ${addOn.name}`}
                      onClick={() => openEditDialog(addOn)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant={isActive ? 'ghost' : 'secondary'}
                      aria-label={`${isActive ? 'Nonaktifkan' : 'Aktifkan'} ${addOn.name}`}
                      onClick={() => openStatusDialog(addOn)}
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

      <AddOnEditorDialog
        dialogError={dialogError}
        editingAddOn={editingAddOn}
        nextDisplayOrder={nextDisplayOrder}
        onClose={closeEditor}
        onSubmit={saveAddOn}
        open={editorOpen}
        saving={saving}
        sessionTypes={sessionTypes}
      />

      <Dialog
        open={Boolean(statusTarget)}
        size="sm"
        title={`${nextStatusLabel} ${statusTarget?.name ?? 'layanan tambahan'}?`}
        description={
          nextStatus === ADD_ON_STATUSES.ACTIVE
            ? 'Layanan tambahan akan kembali tersedia untuk booking baru.'
            : 'Layanan tambahan tidak lagi ditawarkan untuk booking baru. Booking lama tetap aman.'
        }
        onClose={closeStatusDialog}
        footer={
          <>
            <Button variant="ghost" disabled={statusSaving} onClick={closeStatusDialog}>
              Batal
            </Button>
            <Button
              variant={nextStatus === ADD_ON_STATUSES.DISABLED ? 'danger' : 'primary'}
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
            <strong>
              {statusTarget ? getAddOnPricingTypeLabel(statusTarget.pricingType) : ''}
            </strong>
            <span>
              Layanan tambahan bisa diaktifkan kembali kapan saja tanpa mengubah booking lama.
            </span>
          </div>
        )}
      </Dialog>
    </section>
  );
}
