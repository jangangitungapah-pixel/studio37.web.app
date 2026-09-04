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
    return `Akun ini tidak memiliki izin untuk ${action} pricing rule.`;
  }

  if (error?.code === 'unavailable') {
    return `Firestore sedang tidak tersedia. Coba ${action} lagi setelah koneksi pulih.`;
  }

  return `Pricing rule belum bisa ${action}. Coba lagi tanpa menghapus konfigurasi.`;
}

function getSafeStudioMessage(error) {
  if (error?.code === 'permission-denied') {
    return 'Daftar studio tidak dapat dibaca oleh akun ini. Scope exact dikunci, tetapi rule general tetap dapat dikelola.';
  }

  if (error?.code === 'unavailable') {
    return 'Daftar studio belum tersedia karena koneksi Firestore. Scope exact dikunci sampai daftar berhasil dimuat.';
  }

  return 'Daftar studio belum bisa dimuat. Scope exact dikunci agar referensi studio tidak berubah tanpa konteks room.';
}

function formatEffectiveWindow(rule) {
  if (rule.effectiveFrom === null && rule.effectiveUntil === null) return 'Tanpa batas waktu';

  const formatDate = (value) =>
    value
      ? new Intl.DateTimeFormat('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }).format(value)
      : '∞';

  return `${formatDate(rule.effectiveFrom)} → ${formatDate(rule.effectiveUntil)}`;
}

function getConfigurationHealthView(validation) {
  if (validation.blocking) {
    return {
      badge: 'Blocking',
      title: 'Konfigurasi perlu diperbaiki',
      tone: 'danger',
    };
  }

  if (!validation.complete || validation.warnings.length > 0) {
    return {
      badge: validation.complete ? 'Warning' : 'Belum lengkap',
      title: validation.complete ? 'Konfigurasi perlu perhatian' : 'Validasi belum lengkap',
      tone: 'warning',
    };
  }

  return {
    badge: 'Valid',
    title: 'Konfigurasi tervalidasi',
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
  }, [
    limitReached,
    loadState,
    pricingRules,
    sessionTypes,
    studioReferencesAvailable,
    studioRooms,
  ]);
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
      setDialogError('Sesi ini tidak diizinkan menyimpan pricing rule.');
      return;
    }

    if (limitReached) {
      setDialogError(
        `Batas ${listLimit} pricing rule tercapai. Edit diblok karena candidate set mungkin tidak lengkap.`,
      );
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
          'Pricing rule belum lolos validasi konfigurasi sebelum disimpan.',
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
        message: `${details.name} sudah ${editingRule ? 'diperbarui' : 'ditambahkan'}. Snapshot booking historis tidak dihitung ulang.`,
        tone: 'success',
        title: editingRule ? 'Pricing rule diperbarui' : 'Pricing rule ditambahkan',
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
      setStatusError('Sesi ini tidak diizinkan mengubah status pricing rule.');
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
                'Aktivasi diblok karena konfigurasi rule belum valid.',
              )
            : activationValidation.warnings[0]?.message ??
                'Aktivasi diblok sampai seluruh referensi rule dapat diverifikasi.',
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
            ? `${statusTarget.name} kembali aktif untuk resolusi harga booking baru.`
            : `${statusTarget.name} tidak lagi dipilih untuk pricing baru; snapshot historis tetap aman.`,
        tone: 'success',
        title:
          nextStatus === PRICING_RULE_STATUSES.ACTIVE
            ? 'Pricing rule diaktifkan'
            : 'Pricing rule dinonaktifkan',
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
          <p className="settings-card__eyebrow">Aturan harga</p>
          <h2 id="price-rules-heading">Pricing rules</h2>
          <p className="settings-card__subtitle">
            Kelola rule per session type dengan scope general atau studio tertentu. Exact studio
            diprioritaskan sebelum fallback ke rule general.
          </p>
        </div>
        {canEdit ? (
          <Button
            size="sm"
            disabled={loadState !== 'ready' || limitReached || activeSessionTypes.length === 0}
            onClick={openCreateDialog}
          >
            Tambah pricing rule
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
            <p className="settings-state__title">Memuat pricing rules</p>
            <p className="settings-state__description">
              Satu query priority-desc dibatasi maksimal {listLimit} dokumen.
            </p>
          </div>
        </div>
      ) : null}

      {loadState === 'error' ? (
        <div className="settings-state settings-state--embedded" data-tone="danger" role="alert">
          <div>
            <p className="settings-state__title">Pricing rules gagal dimuat</p>
            <p className="settings-state__description">{loadError}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setReloadKey((value) => value + 1)}>
            Coba lagi pricing rules
          </Button>
        </div>
      ) : null}

      {canEdit && studioLoadState === 'error' ? (
        <div className="settings-notice" data-tone="warning" role="status">
          <strong>Studio scope exact sementara dikunci.</strong>
          <span>{studioLoadError}</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setStudioReloadKey((value) => value + 1)}
          >
            Coba lagi studio
          </Button>
        </div>
      ) : null}

      {canEdit && studioLoadState === 'unavailable' ? (
        <div className="settings-notice" data-tone="warning" role="status">
          <strong>Studio scope exact tidak tersedia untuk akun ini.</strong>
          <span>
            Pemilihan room tertentu memerlukan capability settings.studio.view. Rule general tetap
            dapat dibuat dan existing exact scope dipertahankan tanpa perubahan.
          </span>
        </div>
      ) : null}

      {loadState === 'ready' && activeSessionTypes.length === 0 ? (
        <div className="settings-notice" data-tone="warning" role="status">
          <strong>Belum ada session type aktif.</strong>
          <span>Aktifkan atau buat session type sebelum menambahkan pricing rule baru.</span>
        </div>
      ) : null}

      {loadState === 'ready' && limitReached ? (
        <div className="settings-notice" data-tone="warning" role="status">
          <strong>Batas {listLimit} pricing rule tercapai.</strong>
          <span>
            Create/edit/reactivate diblok agar UI tidak mengambil keputusan dari candidate set yang
            mungkin terpotong. Deaktivasi tetap tersedia karena mengurangi match aktif.
          </span>
        </div>
      ) : null}

      {configurationValidation && configurationHealth ? (
        <div
          className="pricing-configuration-health"
          data-tone={configurationHealth.tone}
          role={configurationValidation.blocking ? 'alert' : 'status'}
          aria-live="polite"
        >
          <div className="pricing-configuration-health__header">
            <div>
              <span className="pricing-configuration-health__eyebrow">Configuration health</span>
              <h3>{configurationHealth.title}</h3>
            </div>
            <Badge tone={configurationHealth.tone}>{configurationHealth.badge}</Badge>
          </div>
          <p className="pricing-configuration-health__summary">
            {configurationValidation.blocking
              ? `${configurationValidation.errors.length} issue memblok save atau aktivasi yang akan memperburuk konfigurasi.`
              : configurationValidation.issues.length > 0
                ? `${configurationValidation.warnings.length} catatan perlu perhatian. Rule historis tetap tidak diubah.`
                : 'Rule aktif lolos validasi shape, reference, package, priority, dan effective window.'}
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
                      ? 'Error'
                      : 'Warning'}
                  </Badge>
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {!configurationValidation.complete ? (
            <p className="pricing-configuration-health__footnote">
              Validasi belum lengkap. Create/edit/reactivate yang membutuhkan candidate set atau
              exact-studio reference yang belum dapat diverifikasi tetap fail-closed sesuai aksi.
            </p>
          ) : null}
        </div>
      ) : null}

      {loadState === 'ready' && pricingRules.length === 0 ? (
        <div className="pricing-rule-empty">
          <span className="settings-placeholder__dot" aria-hidden="true" />
          <div>
            <p className="settings-placeholder__title">Belum ada pricing rule</p>
            <p className="settings-placeholder__description">
              Tambahkan rule pertama setelah session type siap. Pilih scope general atau studio
              tertentu sesuai konfigurasi harga yang dibutuhkan.
            </p>
          </div>
        </div>
      ) : null}

      {loadState === 'ready' && pricingRules.length > 0 ? (
        <div className="pricing-rule-list" aria-label="Daftar pricing rule">
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
                className="pricing-rule-row"
                data-disabled={!isActive || undefined}
                key={rule.id}
              >
                <div
                  className="pricing-rule-row__priority"
                  aria-label={`Priority ${rule.priority}`}
                >
                  <span>Priority</span>
                  <strong>{rule.priority}</strong>
                </div>
                <div className="pricing-rule-row__content">
                  <div className="pricing-rule-row__heading">
                    <h3>{rule.name}</h3>
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
                    <span>
                      {sessionType
                        ? `${sessionType.name} · ${sessionType.code}`
                        : `Session ${rule.sessionTypeId}`}
                    </span>
                    <span>{formatStudioScopeLabel(rule.studioId, studioRooms)}</span>
                    <span>{formatEffectiveWindow(rule)}</span>
                  </div>
                  <p>{formatPricingRuleConfigurationSummary(rule)}</p>
                </div>
                {canEdit ? (
                  <div className="pricing-rule-row__actions">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={limitReached}
                      aria-label={`Edit pricing rule ${rule.name}`}
                      onClick={() => openEditDialog(rule)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant={isActive ? 'ghost' : 'secondary'}
                      aria-label={`${isActive ? 'Nonaktifkan' : 'Aktifkan'} pricing rule ${rule.name}`}
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

      <div className="pricing-rule-scope-note">
        <strong>Boundary Phase 5B8</strong>
        <span>
          Effective period editor, discount administration, Booking integration, final PRD-17
          pricing matrix, dan responsive browser acceptance tetap checkpoint terpisah.
        </span>
      </div>

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
        title={`${nextStatusLabel} ${statusTarget?.name ?? 'pricing rule'}?`}
        description={
          nextStatus === PRICING_RULE_STATUSES.ACTIVE
            ? 'Rule akan kembali ikut resolusi harga untuk booking baru hanya setelah candidate validation lolos.'
            : 'Rule tidak lagi dipilih untuk pricing baru, tetapi snapshot dan referensi historis tetap dipertahankan.'
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
            <strong>
              {statusTarget ? getPricingRuleModelLabel(statusTarget.pricingModel) : ''}
            </strong>
            <span>
              {nextStatus === PRICING_RULE_STATUSES.DISABLED
                ? 'Tidak ada hard delete. Histori pricing yang sudah tersnapshot tetap utuh.'
                : 'Aktivasi memvalidasi kembali session, studio scope, priority, package, dan effective window tanpa mengubah rule.'}
            </span>
          </div>
        )}
      </Dialog>
    </section>
  );
}
