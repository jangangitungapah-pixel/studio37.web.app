import { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '../../components/feedback/Badge.jsx';
import { Dialog } from '../../components/feedback/Dialog.jsx';
import { useToast } from '../../components/feedback/toast-context.js';
import { Button } from '../../components/ui/Button.jsx';
import { pricingRuleRepository } from '../../services/pricingRuleRepository.js';
import { studioRoomRepository } from '../../services/studioRoomRepository.js';
import { CAPABILITIES, hasCapability } from '../auth/capabilities.js';
import { PRICING_RULE_LIST_LIMIT, PRICING_RULE_STATUSES } from '../pricing/pricingRules.js';
import { SESSION_TYPE_STATUSES } from '../pricing/sessionTypes.js';
import { DurationPackagesWorkspace } from './DurationPackagesWorkspace.jsx';
import {
  PRICING_CONFIGURATION_ISSUE_SEVERITIES,
  validatePricingConfiguration,
  validatePricingRuleCandidate,
} from './pricingConfigurationValidation.js';
import { PricingRuleEditorDialog } from './PricingRuleEditorDialog.jsx';
import {
  formatPricingRuleConfigurationSummary,
  getPricingRuleModelLabel,
} from './pricingRuleSettings.js';
import { formatStudioScopeLabel } from './studioScopeSettings.js';
import './pricing-rule-settings.css';

function getSafeFirebaseMessage(error, action) {
  if (error?.code === 'permission-denied') {
    return `Akun ini tidak memiliki izin untuk ${action} harga.`;
  }

  if (error?.code === 'unavailable') {
    return `Data harga sedang tidak tersedia. Coba ${action} lagi setelah koneksi pulih.`;
  }

  return `Harga belum bisa ${action}. Coba lagi tanpa menghapus konfigurasi.`;
}

function getSafeStudioMessage(error) {
  if (error?.code === 'permission-denied') {
    return 'Daftar studio tidak dapat dibaca oleh akun ini. Harga untuk semua studio tetap dapat dikelola.';
  }

  if (error?.code === 'unavailable') {
    return 'Daftar studio belum tersedia. Harga khusus studio akan tersedia lagi setelah koneksi pulih.';
  }

  return 'Daftar studio belum bisa dimuat. Harga untuk studio tertentu sementara dikunci agar tidak salah pilih.';
}

function formatEffectiveWindow(rule) {
  if (rule.effectiveFrom === null && rule.effectiveUntil === null) return 'Selalu berlaku';

  const formatDate = (value) =>
    value
      ? new Intl.DateTimeFormat('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }).format(value)
      : 'tanpa batas';

  return `${formatDate(rule.effectiveFrom)} sampai ${formatDate(rule.effectiveUntil)}`;
}

function getConfigurationHealthView(validation) {
  if (validation.blocking) {
    return {
      badge: 'Perlu diperbaiki',
      title: 'Ada pengaturan harga yang bentrok',
      tone: 'danger',
    };
  }

  if (!validation.complete || validation.warnings.length > 0) {
    return {
      badge: validation.complete ? 'Perlu perhatian' : 'Belum lengkap',
      title: validation.complete ? 'Ada catatan pada pengaturan harga' : 'Pemeriksaan belum lengkap',
      tone: 'warning',
    };
  }

  return {
    badge: 'Siap digunakan',
    title: 'Semua pengaturan harga siap digunakan',
    tone: 'success',
  };
}

function getCandidateBlockingMessage(validation, fallback) {
  return validation.errors[0]?.message ?? fallback;
}

export function PricingRulesSection({
  access,
  canEdit,
  repository = pricingRuleRepository,
  sessionTypes,
  studioRepository = studioRoomRepository,
}) {
  const { pushToast } = useToast();
  const [dialogError, setDialogError] = useState('');
  const [editingRule, setEditingRule] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [loadState, setLoadState] = useState('loading');
  const [pricingRules, setPricingRules] = useState([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null);
  const [studioLoadError, setStudioLoadError] = useState('');
  const [studioLoadState, setStudioLoadState] = useState('loading');
  const [studioReloadKey, setStudioReloadKey] = useState(0);
  const [studioRooms, setStudioRooms] = useState([]);

  const listLimit = repository.listLimit ?? PRICING_RULE_LIST_LIMIT;
  const limitReached = pricingRules.length >= listLimit;
  const canViewStudioRooms = hasCapability(access, CAPABILITIES.SETTINGS_STUDIO_VIEW);
  const studioReferencesAvailable = studioLoadState === 'ready';
  const activeSessionTypes = useMemo(
    () => sessionTypes.filter((sessionType) => sessionType.status === SESSION_TYPE_STATUSES.ACTIVE),
    [sessionTypes],
  );
  const sessionTypeById = useMemo(
    () => new Map(sessionTypes.map((sessionType) => [sessionType.id, sessionType])),
    [sessionTypes],
  );
  const configurationValidation = useMemo(() => {
    if (loadState !== 'ready') return null;

    return validatePricingConfiguration({
      limitReached,
      pricingRules,
      sessionTypes,
      studioReferencesAvailable,
      studioRooms,
    });
  }, [limitReached, loadState, pricingRules, sessionTypes, studioReferencesAvailable, studioRooms]);
  const configurationHealth = configurationValidation
    ? getConfigurationHealthView(configurationValidation)
    : null;
  const nextStatus =
    statusTarget?.status === PRICING_RULE_STATUSES.ACTIVE
      ? PRICING_RULE_STATUSES.DISABLED
      : PRICING_RULE_STATUSES.ACTIVE;
  const nextStatusLabel = nextStatus === PRICING_RULE_STATUSES.ACTIVE ? 'Aktifkan' : 'Nonaktifkan';

  useEffect(() => {
    let active = true;

    setLoadError('');
    setLoadState('loading');

    repository
      .listPricingRules()
      .then((nextPricingRules) => {
        if (!active) return;
        setPricingRules([...nextPricingRules]);
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

  useEffect(() => {
    let active = true;

    if (!canViewStudioRooms) {
      setStudioRooms([]);
      setStudioLoadError('');
      setStudioLoadState('unavailable');
      return () => {
        active = false;
      };
    }

    setStudioLoadError('');
    setStudioLoadState('loading');

    studioRepository
      .listStudioRooms()
      .then((nextStudioRooms) => {
        if (!active) return;
        setStudioRooms([...nextStudioRooms]);
        setStudioLoadState('ready');
      })
      .catch((error) => {
        if (!active) return;
        setStudioRooms([]);
        setStudioLoadError(getSafeStudioMessage(error));
        setStudioLoadState('error');
      });

    return () => {
      active = false;
    };
  }, [canViewStudioRooms, studioReloadKey, studioRepository]);

  const openCreateDialog = () => {
    if (!canEdit || limitReached || activeSessionTypes.length === 0) return;
    setEditingRule(null);
    setDialogError('');
    setEditorOpen(true);
  };

  const openEditDialog = (rule) => {
    if (!canEdit || limitReached) return;
    setEditingRule(rule);
    setDialogError('');
    setEditorOpen(true);
  };

  const closeEditor = useCallback(() => {
    if (saving) return;
    setEditorOpen(false);
    setEditingRule(null);
    setDialogError('');
  }, [saving]);

  const savePricingRule = async (details) => {
    const actorUid = access.user?.uid;
    const createsActiveRule = editingRule === null;
    const editsActiveRule = editingRule?.status === PRICING_RULE_STATUSES.ACTIVE;

    if (!canEdit || !actorUid) {
      setDialogError('Sesi ini tidak diizinkan menyimpan harga.');
      return;
    }

    if (limitReached) {
      setDialogError(`Batas ${listLimit} pengaturan harga sudah tercapai.`);
      return;
    }

    const candidateValidation = validatePricingRuleCandidate({
      candidateDetails: details,
      candidateId: editingRule?.id,
      candidateStatus:
        createsActiveRule || editsActiveRule
          ? PRICING_RULE_STATUSES.ACTIVE
          : PRICING_RULE_STATUSES.DISABLED,
      limitReached,
      pricingRules,
      sessionTypes,
      studioReferencesAvailable,
      studioRooms,
    });

    if (candidateValidation.blocking) {
      setDialogError(
        getCandidateBlockingMessage(
          candidateValidation,
          'Harga ini bentrok dengan pengaturan lain. Periksa pilihan layanan, studio, atau paket.',
        ),
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
        message: `${details.name} sudah ${editingRule ? 'diperbarui' : 'ditambahkan'}. Booking lama tetap memakai harga tersimpan sebelumnya.`,
        tone: 'success',
        title: editingRule ? 'Harga diperbarui' : 'Harga ditambahkan',
      });
      setEditorOpen(false);
      setEditingRule(null);
      setReloadKey((value) => value + 1);
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
      setStatusError('Sesi ini tidak diizinkan mengubah status harga.');
      return;
    }

    if (nextStatus === PRICING_RULE_STATUSES.ACTIVE) {
      const activationValidation = validatePricingRuleCandidate({
        candidateDetails: statusTarget,
        candidateId: statusTarget.id,
        candidateStatus: PRICING_RULE_STATUSES.ACTIVE,
        limitReached,
        pricingRules,
        sessionTypes,
        studioReferencesAvailable,
        studioRooms,
      });

      if (activationValidation.blocking || !activationValidation.complete) {
        setStatusError(
          activationValidation.blocking
            ? getCandidateBlockingMessage(
                activationValidation,
                'Harga belum dapat diaktifkan karena masih bentrok dengan pengaturan lain.',
              )
            : (activationValidation.warnings[0]?.message ??
                'Harga belum dapat diaktifkan sampai seluruh referensi dapat diperiksa.'),
        );
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
            ? `${statusTarget.name} kembali digunakan untuk booking baru.`
            : `${statusTarget.name} tidak lagi digunakan untuk booking baru.`,
        tone: 'success',
        title: nextStatus === PRICING_RULE_STATUSES.ACTIVE ? 'Harga diaktifkan' : 'Harga dinonaktifkan',
      });
      setStatusTarget(null);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setStatusError(getSafeFirebaseMessage(error, 'mengubah status'));
    } finally {
      setStatusSaving(false);
    }
  };

  const defaultSessionTypeId = activeSessionTypes.length === 1 ? activeSessionTypes[0].id : '';

  return (
    <section className="settings-card" aria-labelledby="price-rules-heading">
      <header className="settings-card__header settings-card__header--with-action">
        <div>
          <p className="settings-card__eyebrow">Harga</p>
          <h2 id="price-rules-heading">Harga layanan</h2>
          <p className="settings-card__subtitle">
            Tentukan harga setiap layanan. Pilih apakah dihitung per jam, harga tetap, paket durasi,
            atau harga dasar dengan waktu tambahan.
          </p>
        </div>
        {canEdit ? (
          <Button
            size="sm"
            disabled={loadState !== 'ready' || limitReached || activeSessionTypes.length === 0}
            onClick={openCreateDialog}
          >
            Atur harga
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
            <p className="settings-state__title">Memuat harga layanan</p>
            <p className="settings-state__description">Menyiapkan harga yang sudah tersimpan.</p>
          </div>
        </div>
      ) : null}

      {loadState === 'error' ? (
        <div className="settings-state settings-state--embedded" data-tone="danger" role="alert">
          <div>
            <p className="settings-state__title">Harga layanan gagal dimuat</p>
            <p className="settings-state__description">{loadError}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setReloadKey((value) => value + 1)}>
            Coba lagi
          </Button>
        </div>
      ) : null}

      {canEdit && studioLoadState === 'error' ? (
        <div className="settings-notice" data-tone="warning" role="status">
          <strong>Harga khusus studio sementara tidak tersedia.</strong>
          <span>{studioLoadError}</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setStudioReloadKey((value) => value + 1)}
          >
            Coba lagi
          </Button>
        </div>
      ) : null}

      {canEdit && studioLoadState === 'unavailable' ? (
        <div className="settings-notice" data-tone="warning" role="status">
          <strong>Harga khusus studio tidak tersedia untuk akun ini.</strong>
          <span>Harga yang berlaku untuk semua studio tetap dapat dikelola.</span>
        </div>
      ) : null}

      {loadState === 'ready' && activeSessionTypes.length === 0 ? (
        <div className="settings-notice" data-tone="warning" role="status">
          <strong>Belum ada layanan aktif.</strong>
          <span>Tambahkan atau aktifkan layanan sebelum mengatur harga.</span>
        </div>
      ) : null}

      {loadState === 'ready' && limitReached ? (
        <div className="settings-notice" data-tone="warning" role="status">
          <strong>Batas pengaturan harga sudah tercapai.</strong>
          <span>Edit atau nonaktifkan harga yang ada sebelum menambah pengaturan baru.</span>
        </div>
      ) : null}

      {configurationValidation?.blocking ? (
        <div className="settings-notice" data-tone="danger" role="alert">
          <strong>Ada harga yang perlu diperbaiki.</strong>
          <span>
            Beberapa pengaturan saling bentrok. Detail tersedia di Pengaturan lanjutan di bawah.
          </span>
        </div>
      ) : null}

      {loadState === 'ready' && pricingRules.length === 0 ? (
        <div className="pricing-rule-empty">
          <span className="settings-placeholder__dot" aria-hidden="true" />
          <div>
            <p className="settings-placeholder__title">Belum ada harga</p>
            <p className="settings-placeholder__description">
              Pilih layanan lalu tentukan cara menghitung harganya.
            </p>
          </div>
        </div>
      ) : null}

      {loadState === 'ready' && pricingRules.length > 0 ? (
        <div className="pricing-rule-list" aria-label="Daftar harga layanan">
          {pricingRules.map((rule) => {
            const isActive = rule.status === PRICING_RULE_STATUSES.ACTIVE;
            const sessionType = sessionTypeById.get(rule.sessionTypeId);
            const ruleIssues =
              configurationValidation?.issues.filter((issue) => issue.ruleIds.includes(rule.id)) ??
              [];
            const hasBlockingIssue = ruleIssues.some(
              (issue) => issue.severity === PRICING_CONFIGURATION_ISSUE_SEVERITIES.ERROR,
            );

            return (
              <article
                className="pricing-rule-row pricing-rule-row--simple"
                data-disabled={!isActive || undefined}
                key={rule.id}
              >
                <div className="pricing-rule-row__content">
                  <div className="pricing-rule-row__heading">
                    <h3>{sessionType?.name ?? rule.name}</h3>
                    <Badge tone={isActive ? 'success' : 'neutral'}>
                      {isActive ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                    <Badge tone="brand">{getPricingRuleModelLabel(rule.pricingModel)}</Badge>
                    {ruleIssues.length > 0 ? (
                      <Badge tone={hasBlockingIssue ? 'danger' : 'warning'}>
                        {hasBlockingIssue ? 'Perlu diperbaiki' : 'Perlu perhatian'}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="pricing-rule-row__meta">
                    <span>{formatStudioScopeLabel(rule.studioId, studioRooms)}</span>
                  </div>
                  <p>{formatPricingRuleConfigurationSummary(rule)}</p>
                </div>
                {canEdit ? (
                  <div className="pricing-rule-row__actions">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={limitReached}
                      aria-label={`Edit harga ${rule.name}`}
                      onClick={() => openEditDialog(rule)}
                    >
                      Edit harga
                    </Button>
                    <Button
                      size="sm"
                      variant={isActive ? 'ghost' : 'secondary'}
                      aria-label={`${isActive ? 'Nonaktifkan' : 'Aktifkan'} harga ${rule.name}`}
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
      ) : null}

      {loadState === 'ready' ? (
        <DurationPackagesWorkspace
          access={access}
          canEdit={canEdit}
          limitReached={limitReached}
          listLimit={listLimit}
          onChanged={() => setReloadKey((value) => value + 1)}
          pricingRules={pricingRules}
          repository={repository}
          sessionTypes={sessionTypes}
          studioRooms={studioRooms}
          studioScopeState={studioLoadState}
        />
      ) : null}

      {configurationValidation && configurationHealth ? (
        <details className="pricing-advanced">
          <summary>Pengaturan lanjutan</summary>
          <div className="pricing-advanced__content">
            <div
              className="pricing-configuration-health"
              data-tone={configurationHealth.tone}
              role={configurationValidation.blocking ? 'alert' : 'status'}
              aria-live="polite"
            >
              <div className="pricing-configuration-health__header">
                <div>
                  <span className="pricing-configuration-health__eyebrow">Pemeriksaan sistem</span>
                  <h3>{configurationHealth.title}</h3>
                </div>
                <Badge tone={configurationHealth.tone}>{configurationHealth.badge}</Badge>
              </div>
              <p className="pricing-configuration-health__summary">
                {configurationValidation.blocking
                  ? `${configurationValidation.errors.length} pengaturan perlu diperbaiki sebelum dapat dipakai dengan aman.`
                  : configurationValidation.issues.length > 0
                    ? `${configurationValidation.warnings.length} catatan perlu perhatian.`
                    : 'Tidak ada benturan pada harga aktif.'}
              </p>
              {configurationValidation.issues.length > 0 ? (
                <ul className="pricing-configuration-health__issues">
                  {configurationValidation.issues.map((issue, index) => (
                    <li key={`${issue.code}-${issue.ruleIds.join('-')}-${index}`}>
                      <Badge
                        tone={
                          issue.severity === PRICING_CONFIGURATION_ISSUE_SEVERITIES.ERROR
                            ? 'danger'
                            : 'warning'
                        }
                      >
                        {issue.severity === PRICING_CONFIGURATION_ISSUE_SEVERITIES.ERROR
                          ? 'Perbaiki'
                          : 'Periksa'}
                      </Badge>
                      <span>{issue.message}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {!configurationValidation.complete ? (
                <p className="pricing-configuration-health__footnote">
                  Pemeriksaan belum lengkap karena sebagian referensi belum dapat dibaca.
                </p>
              ) : null}
            </div>

            {pricingRules.length > 0 ? (
              <div className="pricing-advanced__rules" aria-label="Detail teknis harga">
                {pricingRules.map((rule) => (
                  <div className="pricing-advanced__rule" key={rule.id}>
                    <strong>{rule.name}</strong>
                    <span>Prioritas {rule.priority}</span>
                    <span>{formatEffectiveWindow(rule)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </details>
      ) : null}

      <PricingRuleEditorDialog
        dialogError={dialogError}
        editingRule={editingRule}
        initialSessionTypeId={defaultSessionTypeId}
        onClose={closeEditor}
        onSubmit={savePricingRule}
        open={editorOpen}
        saving={saving}
        sessionTypes={sessionTypes}
        studioRooms={studioRooms}
        studioScopeState={studioLoadState}
      />

      <Dialog
        open={Boolean(statusTarget)}
        size="sm"
        title={`${nextStatusLabel} ${statusTarget?.name ?? 'harga'}?`}
        description={
          nextStatus === PRICING_RULE_STATUSES.ACTIVE
            ? 'Harga akan kembali digunakan untuk booking baru setelah pemeriksaan selesai.'
            : 'Harga tidak lagi digunakan untuk booking baru. Booking lama tetap memakai harga tersimpan sebelumnya.'
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
            <strong>Status belum berubah.</strong>
            <span>{statusError}</span>
          </div>
        ) : (
          <div className="pricing-rule-status-summary">
            <strong>{statusTarget ? getPricingRuleModelLabel(statusTarget.pricingModel) : ''}</strong>
            <span>
              {nextStatus === PRICING_RULE_STATUSES.DISABLED
                ? 'Harga bisa diaktifkan kembali kapan saja tanpa mengubah booking lama.'
                : 'Sistem akan memastikan harga tidak bentrok dengan pengaturan lain sebelum diaktifkan.'}
            </span>
          </div>
        )}
      </Dialog>
    </section>
  );
}
