import { useCallback, useMemo, useState } from 'react';

import { Badge } from '../../components/feedback/Badge.jsx';
import { Dialog } from '../../components/feedback/Dialog.jsx';
import { useToast } from '../../components/feedback/toast-context.js';
import { Button } from '../../components/ui/Button.jsx';
import { formatIntegerIdr } from '../../lib/money/idr.js';
import { PRICING_RULE_STATUSES } from '../pricing/pricingRules.js';
import { SESSION_TYPE_STATUSES } from '../pricing/sessionTypes.js';
import { DurationPackageEditorDialog } from './DurationPackageEditorDialog.jsx';
import {
  formatDurationPackageExtraTime,
  groupDurationPackageRules,
} from './durationPackageSettings.js';
import { hasPricingRuleWriteCollision } from './pricingRuleCollision.js';
import { formatStudioScopeLabel } from './studioScopeSettings.js';
import './duration-package-settings.css';

function getSafeFirebaseMessage(error, action) {
  if (error?.code === 'permission-denied') {
    return `Akun ini tidak memiliki izin untuk ${action} paket harga.`;
  }

  if (error?.code === 'unavailable') {
    return `Paket harga sedang tidak tersedia. Coba ${action} lagi setelah koneksi pulih.`;
  }

  return `Paket harga belum bisa ${action}. Coba lagi tanpa menghapus konfigurasi.`;
}

export function DurationPackagesWorkspace({
  access,
  canEdit,
  limitReached,
  listLimit,
  onChanged,
  pricingRules,
  repository,
  sessionTypes,
  studioRooms = [],
  studioScopeState = 'ready',
}) {
  const { pushToast } = useToast();
  const [dialogError, setDialogError] = useState('');
  const [editingRule, setEditingRule] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null);
  const [templateRule, setTemplateRule] = useState(null);

  const groups = useMemo(() => groupDurationPackageRules(pricingRules), [pricingRules]);
  const activeSessionTypes = useMemo(
    () => sessionTypes.filter((sessionType) => sessionType.status === SESSION_TYPE_STATUSES.ACTIVE),
    [sessionTypes],
  );
  const sessionTypeById = useMemo(
    () => new Map(sessionTypes.map((sessionType) => [sessionType.id, sessionType])),
    [sessionTypes],
  );
  const defaultSessionTypeId = activeSessionTypes.length === 1 ? activeSessionTypes[0].id : '';
  const nextStatus =
    statusTarget?.status === PRICING_RULE_STATUSES.ACTIVE
      ? PRICING_RULE_STATUSES.DISABLED
      : PRICING_RULE_STATUSES.ACTIVE;
  const nextStatusLabel = nextStatus === PRICING_RULE_STATUSES.ACTIVE ? 'Aktifkan' : 'Nonaktifkan';

  const openCreateDialog = () => {
    if (!canEdit || limitReached || activeSessionTypes.length === 0) return;
    setEditingRule(null);
    setTemplateRule(null);
    setDialogError('');
    setEditorOpen(true);
  };

  const openSiblingDialog = (rule) => {
    const sessionType = sessionTypeById.get(rule.sessionTypeId);
    if (!canEdit || limitReached || sessionType?.status !== SESSION_TYPE_STATUSES.ACTIVE) return;
    setEditingRule(null);
    setTemplateRule(rule);
    setDialogError('');
    setEditorOpen(true);
  };

  const openEditDialog = (rule) => {
    if (!canEdit || limitReached) return;
    setEditingRule(rule);
    setTemplateRule(null);
    setDialogError('');
    setEditorOpen(true);
  };

  const closeEditor = useCallback(() => {
    if (saving) return;
    setEditorOpen(false);
    setEditingRule(null);
    setTemplateRule(null);
    setDialogError('');
  }, [saving]);

  const savePackage = async (details) => {
    const actorUid = access.user?.uid;
    const createsActiveRule = editingRule === null;
    const editsActiveRule = editingRule?.status === PRICING_RULE_STATUSES.ACTIVE;

    if (!canEdit || !actorUid) {
      setDialogError('Sesi ini tidak diizinkan menyimpan paket harga.');
      return;
    }

    if (limitReached) {
      setDialogError(`Batas ${listLimit} pengaturan harga sudah tercapai.`);
      return;
    }

    if (
      (createsActiveRule || editsActiveRule) &&
      hasPricingRuleWriteCollision(pricingRules, details, { excludeId: editingRule?.id ?? null })
    ) {
      setDialogError(
        'Paket dengan durasi yang sama sudah aktif untuk layanan dan studio ini, atau bentrok dengan harga lain.',
      );
      return;
    }

    setSaving(true);
    setDialogError('');

    try {
      if (editingRule) {
        await repository.updatePricingRule(editingRule.id, details, { actorUid });
      } else {
        await repository.createPricingRule(details, { actorUid });
      }

      pushToast({
        message: `${details.name} sudah ${editingRule ? 'diperbarui' : 'ditambahkan'}. Booking lama tetap memakai harga sebelumnya.`,
        tone: 'success',
        title: editingRule ? 'Paket diperbarui' : 'Paket ditambahkan',
      });
      setEditorOpen(false);
      setEditingRule(null);
      setTemplateRule(null);
      onChanged();
    } catch (error) {
      setDialogError(getSafeFirebaseMessage(error, 'menyimpan'));
    } finally {
      setSaving(false);
    }
  };

  const openStatusDialog = (rule) => {
    if (!canEdit) return;
    setStatusTarget(rule);
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
      setStatusError('Sesi ini tidak diizinkan mengubah status paket harga.');
      return;
    }

    if (nextStatus === PRICING_RULE_STATUSES.ACTIVE) {
      if (limitReached) {
        setStatusError(`Paket belum bisa diaktifkan saat batas ${listLimit} harga sudah tercapai.`);
        return;
      }

      if (
        hasPricingRuleWriteCollision(pricingRules, statusTarget, { excludeId: statusTarget.id })
      ) {
        setStatusError('Paket ini bentrok dengan harga lain untuk layanan dan studio yang sama.');
        return;
      }
    }

    setStatusSaving(true);
    setStatusError('');

    try {
      await repository.setPricingRuleStatus(statusTarget.id, nextStatus, { actorUid });
      pushToast({
        message:
          nextStatus === PRICING_RULE_STATUSES.ACTIVE
            ? `${statusTarget.name} kembali tersedia untuk booking baru.`
            : `${statusTarget.name} tidak lagi ditawarkan untuk booking baru.`,
        tone: 'success',
        title:
          nextStatus === PRICING_RULE_STATUSES.ACTIVE
            ? 'Paket diaktifkan'
            : 'Paket dinonaktifkan',
      });
      setStatusTarget(null);
      onChanged();
    } catch (error) {
      setStatusError(getSafeFirebaseMessage(error, 'mengubah status'));
    } finally {
      setStatusSaving(false);
    }
  };

  return (
    <div className="duration-package-workspace" aria-labelledby="duration-packages-heading">
      <header className="duration-package-workspace__header">
        <div>
          <p className="settings-card__eyebrow">Paket</p>
          <h3 id="duration-packages-heading">Paket harga</h3>
          <p>
            Gunakan paket kalau layanan punya harga khusus untuk durasi tertentu, misalnya 3 jam
            Rp400.000 atau 6 jam Rp750.000.
          </p>
        </div>
        {canEdit ? (
          <Button
            size="sm"
            disabled={limitReached || activeSessionTypes.length === 0}
            onClick={openCreateDialog}
          >
            Tambah paket
          </Button>
        ) : null}
      </header>

      {groups.length === 0 ? (
        <div className="duration-package-empty">
          <span className="settings-placeholder__dot" aria-hidden="true" />
          <div>
            <p className="settings-placeholder__title">Belum ada paket harga</p>
            <p className="settings-placeholder__description">
              Bagian ini opsional. Tambahkan paket hanya jika studio memang punya harga khusus untuk
              durasi tertentu.
            </p>
          </div>
        </div>
      ) : (
        <div className="duration-package-groups">
          {groups.map((group) => {
            const sessionType = sessionTypeById.get(group.sessionTypeId);
            const canAddSibling =
              canEdit && !limitReached && sessionType?.status === SESSION_TYPE_STATUSES.ACTIVE;
            const template = group.rules[0];

            return (
              <section className="duration-package-group" key={group.key}>
                <header className="duration-package-group__header">
                  <div>
                    <div className="duration-package-group__title-row">
                      <h4>{sessionType?.name ?? 'Layanan'}</h4>
                    </div>
                    <div className="duration-package-group__meta">
                      <span>{formatStudioScopeLabel(group.studioId, studioRooms)}</span>
                    </div>
                  </div>
                  {canEdit ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!canAddSibling}
                      onClick={() => openSiblingDialog(template)}
                    >
                      Tambah paket lain
                    </Button>
                  ) : null}
                </header>

                <div
                  className="duration-package-list"
                  aria-label={`Paket ${sessionType?.name ?? group.sessionTypeId}`}
                >
                  {group.rules.map((rule) => {
                    const isActive = rule.status === PRICING_RULE_STATUSES.ACTIVE;

                    return (
                      <article
                        className="duration-package-row"
                        data-disabled={!isActive || undefined}
                        key={rule.id}
                      >
                        <div className="duration-package-row__duration">
                          <strong>{rule.configuration.durationMinutes}</strong>
                          <span>menit</span>
                        </div>
                        <div className="duration-package-row__content">
                          <div className="duration-package-row__heading">
                            <h5>{rule.name}</h5>
                            <Badge tone={isActive ? 'success' : 'neutral'}>
                              {isActive ? 'Aktif' : 'Nonaktif'}
                            </Badge>
                          </div>
                          <strong className="duration-package-row__price">
                            {formatIntegerIdr(rule.configuration.amountIdr)}
                          </strong>
                          <span className="duration-package-row__overtime">
                            {formatDurationPackageExtraTime(rule)}
                          </span>
                        </div>
                        {canEdit ? (
                          <div className="duration-package-row__actions">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={limitReached}
                              aria-label={`Edit paket ${rule.name}`}
                              onClick={() => openEditDialog(rule)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant={isActive ? 'ghost' : 'secondary'}
                              aria-label={`${isActive ? 'Nonaktifkan' : 'Aktifkan'} paket ${rule.name}`}
                              onClick={() => openStatusDialog(rule)}
                            >
                              {isActive ? 'Nonaktifkan' : 'Aktifkan'}
                            </Button>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <DurationPackageEditorDialog
        dialogError={dialogError}
        editingRule={editingRule}
        initialSessionTypeId={defaultSessionTypeId}
        onClose={closeEditor}
        onSubmit={savePackage}
        open={editorOpen}
        saving={saving}
        sessionTypes={sessionTypes}
        studioRooms={studioRooms}
        studioScopeState={studioScopeState}
        templateRule={templateRule}
      />

      <Dialog
        open={Boolean(statusTarget)}
        size="sm"
        title={`${nextStatusLabel} ${statusTarget?.name ?? 'paket'}?`}
        description={
          nextStatus === PRICING_RULE_STATUSES.ACTIVE
            ? 'Paket akan kembali tersedia untuk booking baru.'
            : 'Paket tidak lagi ditawarkan untuk booking baru. Booking lama tetap aman.'
        }
        onClose={closeStatusDialog}
        footer={
          <>
            <Button variant="ghost" disabled={statusSaving} onClick={closeStatusDialog}>
              Batal
            </Button>
            <Button
              variant={nextStatus === PRICING_RULE_STATUSES.DISABLED ? 'danger' : 'primary'}
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
            <strong>Status paket belum berubah.</strong>
            <span>{statusError}</span>
          </div>
        ) : (
          <div className="pricing-rule-status-summary">
            <strong>
              {statusTarget
                ? `${statusTarget.configuration.durationMinutes} menit · ${formatIntegerIdr(statusTarget.configuration.amountIdr)}`
                : ''}
            </strong>
            <span>Paket bisa diaktifkan kembali kapan saja tanpa mengubah booking lama.</span>
          </div>
        )}
      </Dialog>
    </div>
  );
}
