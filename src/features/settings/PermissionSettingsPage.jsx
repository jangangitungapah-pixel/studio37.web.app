import { useCallback, useEffect, useMemo, useState } from 'react';

import { useToast } from '../../components/feedback/toast-context.js';
import { Badge } from '../../components/feedback/Badge.jsx';
import { Dialog } from '../../components/feedback/Dialog.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { operatorRepository as defaultOperatorRepository } from '../../services/operatorRepository.js';
import { permissionAdministrationRepository } from '../../services/permissionAdministrationRepository.js';
import { isOwner } from '../auth/capabilities.js';
import { PERMISSION_SET_STATUSES } from '../auth/permissionSet.js';
import { useAuth } from '../auth/useAuth.js';
import { OperatorPermissionAssignmentDialog } from './OperatorPermissionAssignmentDialog.jsx';
import { PermissionSetEditorDialog } from './PermissionSetEditorDialog.jsx';
import {
  getPermissionSetDomainLabels,
  isLoginLinkedStudioOperator,
} from './permissionAdministrationUi.js';
import { OPERATOR_STATUSES } from './operators.js';
import './permission-settings.css';
import { SettingsWorkspace } from './SettingsWorkspace.jsx';

function getLoadErrorMessage(error, subject) {
  if (error?.code === 'permission-denied') {
    return `Hanya Owner aktif yang dapat memuat ${subject}.`;
  }

  if (error?.code === 'unavailable') {
    return `Firestore sedang tidak tersedia. Coba muat ${subject} lagi setelah koneksi pulih.`;
  }

  return `${subject} belum dapat dimuat. Coba lagi tanpa mengubah data lain.`;
}

function getStatusErrorMessage(error) {
  if (error?.code === 'permission-denied') {
    return 'Hanya Owner aktif yang dapat mengubah status template.';
  }
  if (error?.code === 'unavailable') {
    return 'Firestore sedang tidak tersedia. Coba lagi setelah koneksi pulih.';
  }

  return 'Status template belum berubah. Muat ulang data lalu coba lagi.';
}

function getOperatorInitials(displayName) {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function PermissionSettingsPage({
  operatorRepository = defaultOperatorRepository,
  repository = permissionAdministrationRepository,
}) {
  const access = useAuth();
  const { pushToast } = useToast();
  const canManage = isOwner(access.profile);
  const [assignmentTarget, setAssignmentTarget] = useState(null);
  const [editorState, setEditorState] = useState(null);
  const [operatorLoadError, setOperatorLoadError] = useState('');
  const [operatorLoadState, setOperatorLoadState] = useState(canManage ? 'loading' : 'blocked');
  const [operatorReloadKey, setOperatorReloadKey] = useState(0);
  const [operators, setOperators] = useState([]);
  const [permissionLoadError, setPermissionLoadError] = useState('');
  const [permissionLoadState, setPermissionLoadState] = useState(canManage ? 'loading' : 'blocked');
  const [permissionReloadKey, setPermissionReloadKey] = useState(0);
  const [permissionSets, setPermissionSets] = useState([]);
  const [statusError, setStatusError] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null);

  const permissionLimit = repository.listLimit ?? 50;
  const operatorLimit = operatorRepository.listLimit ?? 100;
  const permissionLimitReached = permissionSets.length >= permissionLimit;
  const linkedStudioOperators = useMemo(
    () => operators.filter(isLoginLinkedStudioOperator),
    [operators],
  );
  const activePermissionSetCount = permissionSets.filter(
    ({ status }) => status === PERMISSION_SET_STATUSES.ACTIVE,
  ).length;
  const nextStatus =
    statusTarget?.status === PERMISSION_SET_STATUSES.ACTIVE
      ? PERMISSION_SET_STATUSES.DISABLED
      : PERMISSION_SET_STATUSES.ACTIVE;
  const nextStatusLabel =
    nextStatus === PERMISSION_SET_STATUSES.ACTIVE ? 'Aktifkan' : 'Nonaktifkan';

  useEffect(() => {
    if (!canManage) {
      setPermissionLoadState('blocked');
      return undefined;
    }

    let active = true;
    setPermissionLoadError('');
    setPermissionLoadState('loading');

    repository
      .listPermissionSets()
      .then((nextPermissionSets) => {
        if (!active) return;
        setPermissionSets([...nextPermissionSets]);
        setPermissionLoadState('ready');
      })
      .catch((error) => {
        if (!active) return;
        setPermissionLoadError(getLoadErrorMessage(error, 'template permission'));
        setPermissionLoadState('error');
      });

    return () => {
      active = false;
    };
  }, [canManage, permissionReloadKey, repository]);

  useEffect(() => {
    if (!canManage) {
      setOperatorLoadState('blocked');
      return undefined;
    }

    let active = true;
    setOperatorLoadError('');
    setOperatorLoadState('loading');

    operatorRepository
      .listOperators()
      .then((nextOperators) => {
        if (!active) return;
        setOperators([...nextOperators]);
        setOperatorLoadState('ready');
      })
      .catch((error) => {
        if (!active) return;
        setOperatorLoadError(getLoadErrorMessage(error, 'operator login-linked'));
        setOperatorLoadState('error');
      });

    return () => {
      active = false;
    };
  }, [canManage, operatorReloadKey, operatorRepository]);

  const closeEditor = useCallback(() => setEditorState(null), []);
  const closeAssignment = useCallback(() => setAssignmentTarget(null), []);

  const finishEditor = useCallback(() => {
    setEditorState(null);
    setPermissionReloadKey((value) => value + 1);
  }, []);

  const finishAssignment = useCallback(() => setAssignmentTarget(null), []);

  const closeStatusDialog = useCallback(() => {
    if (statusSaving) return;
    setStatusTarget(null);
    setStatusError('');
  }, [statusSaving]);

  const changePermissionSetStatus = async () => {
    if (!statusTarget || !canManage) {
      setStatusError('Sesi ini tidak diizinkan mengubah status template.');
      return;
    }

    setStatusSaving(true);
    setStatusError('');

    try {
      await repository.setPermissionSetStatus(statusTarget.id, nextStatus);
      pushToast({
        message:
          nextStatus === PERMISSION_SET_STATUSES.ACTIVE
            ? `${statusTarget.name} kembali tersedia untuk assignment baru.`
            : `${statusTarget.name} berhenti memberi capability efektif, tetapi referensi user tetap dipertahankan.`,
        tone: 'success',
        title:
          nextStatus === PERMISSION_SET_STATUSES.ACTIVE
            ? 'Template diaktifkan'
            : 'Template dinonaktifkan',
      });
      setStatusTarget(null);
      setPermissionReloadKey((value) => value + 1);
    } catch (error) {
      setStatusError(getStatusErrorMessage(error));
    } finally {
      setStatusSaving(false);
    }
  };

  return (
    <SettingsWorkspace
      title="Hak Akses"
      description="Buat template capability dan tetapkan ke akun Studio Operator tanpa membuka authority Owner."
      actions={
        <span className="settings-access-badge" data-editable={canManage || undefined}>
          Owner only
        </span>
      }
    >
      <div className="settings-notice" data-tone="warning" role="status">
        <strong>Authority Owner tidak dapat didelegasikan.</strong>
        <span>
          Pengelolaan permission dan Danger Zone selalu Owner-only. Menyembunyikan UI bukan batas
          keamanan; Firestore Rules tetap memvalidasi setiap write.
        </span>
      </div>

      {!canManage ? (
        <div className="settings-state" data-tone="danger" role="alert">
          <div>
            <p className="settings-state__title">Halaman khusus Owner</p>
            <p className="settings-state__description">
              Sesi Studio Operator tidak menjalankan query atau mutation dari halaman ini.
            </p>
          </div>
        </div>
      ) : null}

      {canManage ? (
        <>
          <section className="settings-card" aria-labelledby="permission-templates-heading">
            <header className="settings-card__header settings-card__header--with-action">
              <div>
                <p className="settings-card__eyebrow">Capability templates</p>
                <h2 id="permission-templates-heading">Template permission</h2>
                <p className="settings-card__subtitle">
                  {activePermissionSetCount} aktif dari {permissionSets.length} template. Query
                  diurutkan berdasarkan nama dan dibatasi {permissionLimit} dokumen.
                </p>
              </div>
              <Button
                size="sm"
                disabled={permissionLoadState !== 'ready' || permissionLimitReached}
                onClick={() => setEditorState({ mode: 'create', permissionSet: null })}
              >
                Buat template
              </Button>
            </header>

            {permissionLoadState === 'loading' ? (
              <div
                className="settings-state settings-state--embedded"
                aria-busy="true"
                aria-live="polite"
              >
                <span className="settings-state__spinner" aria-hidden="true" />
                <div>
                  <p className="settings-state__title">Memuat template permission</p>
                  <p className="settings-state__description">
                    Satu query name asc dengan limit {permissionLimit}.
                  </p>
                </div>
              </div>
            ) : null}

            {permissionLoadState === 'error' ? (
              <div
                className="settings-state settings-state--embedded"
                data-tone="danger"
                role="alert"
              >
                <div>
                  <p className="settings-state__title">Template gagal dimuat</p>
                  <p className="settings-state__description">{permissionLoadError}</p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setPermissionReloadKey((value) => value + 1)}
                >
                  Coba lagi
                </Button>
              </div>
            ) : null}

            {permissionLoadState === 'ready' && permissionLimitReached ? (
              <div className="settings-notice" data-tone="warning" role="status">
                <strong>Batas {permissionLimit} template tercapai.</strong>
                <span>
                  Edit atau aktifkan kembali template yang ada; hard delete tidak tersedia.
                </span>
              </div>
            ) : null}

            {permissionLoadState === 'ready' && permissionSets.length === 0 ? (
              <div className="permission-empty-state">
                <span className="settings-placeholder__dot" aria-hidden="true" />
                <div>
                  <p className="settings-placeholder__title">Belum ada template permission</p>
                  <p className="settings-placeholder__description">
                    Buat template pertama, pilih capability per domain, lalu tetapkan ke akun Studio
                    Operator.
                  </p>
                </div>
              </div>
            ) : null}

            {permissionLoadState === 'ready' && permissionSets.length > 0 ? (
              <div className="permission-template-list" aria-label="Daftar template permission">
                {permissionSets.map((permissionSet) => {
                  const active = permissionSet.status === PERMISSION_SET_STATUSES.ACTIVE;
                  const domainLabels = getPermissionSetDomainLabels(permissionSet);

                  return (
                    <article
                      className="permission-template-row"
                      data-disabled={!active || undefined}
                      key={permissionSet.id}
                    >
                      <div className="permission-template-row__content">
                        <div className="permission-template-row__heading">
                          <h3>{permissionSet.name}</h3>
                          <Badge tone={active ? 'success' : 'neutral'}>
                            {active ? 'Aktif' : 'Nonaktif'}
                          </Badge>
                          <Badge tone="info">{permissionSet.capabilities.length} capability</Badge>
                        </div>
                        <p>
                          {domainLabels.length
                            ? domainLabels.join(' · ')
                            : 'Tanpa capability operasional'}
                        </p>
                      </div>
                      <div className="permission-template-row__actions">
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Edit ${permissionSet.name}`}
                          onClick={() => setEditorState({ mode: 'edit', permissionSet })}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant={active ? 'ghost' : 'secondary'}
                          aria-label={`${active ? 'Nonaktifkan' : 'Aktifkan'} ${permissionSet.name}`}
                          onClick={() => {
                            setStatusTarget(permissionSet);
                            setStatusError('');
                          }}
                        >
                          {active ? 'Nonaktifkan' : 'Aktifkan'}
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </section>

          <section className="settings-card" aria-labelledby="permission-assignments-heading">
            <header className="settings-card__header">
              <div>
                <p className="settings-card__eyebrow">Login-linked operators</p>
                <h2 id="permission-assignments-heading">Assignment akun operator</h2>
                <p className="settings-card__subtitle">
                  Hanya operator bertipe Studio Operator dengan UID terhubung yang ditampilkan.
                  Profil user baru dibaca setelah aksi eksplisit.
                </p>
              </div>
            </header>

            {operatorLoadState === 'loading' ? (
              <div
                className="settings-state settings-state--embedded"
                aria-busy="true"
                aria-live="polite"
              >
                <span className="settings-state__spinner" aria-hidden="true" />
                <div>
                  <p className="settings-state__title">Memuat operator login-linked</p>
                  <p className="settings-state__description">
                    Memakai query operator yang sudah dibatasi {operatorLimit} dokumen.
                  </p>
                </div>
              </div>
            ) : null}

            {operatorLoadState === 'error' ? (
              <div
                className="settings-state settings-state--embedded"
                data-tone="danger"
                role="alert"
              >
                <div>
                  <p className="settings-state__title">Operator gagal dimuat</p>
                  <p className="settings-state__description">{operatorLoadError}</p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setOperatorReloadKey((value) => value + 1)}
                >
                  Coba lagi
                </Button>
              </div>
            ) : null}

            {operatorLoadState === 'ready' && linkedStudioOperators.length === 0 ? (
              <div className="permission-empty-state">
                <span className="settings-placeholder__dot" aria-hidden="true" />
                <div>
                  <p className="settings-placeholder__title">
                    Belum ada akun Studio Operator terhubung
                  </p>
                  <p className="settings-placeholder__description">
                    Buat atau link akun dari Operator Settings terlebih dahulu. Recording Engineer
                    tanpa login tidak membutuhkan permission aplikasi.
                  </p>
                </div>
              </div>
            ) : null}

            {operatorLoadState === 'ready' && linkedStudioOperators.length > 0 ? (
              <div className="permission-operator-list" aria-label="Akun Studio Operator">
                {linkedStudioOperators.map((operator) => {
                  const active = operator.status === OPERATOR_STATUSES.ACTIVE;

                  return (
                    <article
                      className="permission-operator-row"
                      data-disabled={!active || undefined}
                      key={operator.id}
                    >
                      <div className="permission-operator-row__avatar" aria-hidden="true">
                        {getOperatorInitials(operator.displayName)}
                      </div>
                      <div className="permission-operator-row__content">
                        <div className="permission-operator-row__heading">
                          <h3>{operator.displayName}</h3>
                          <Badge tone={active ? 'success' : 'neutral'}>
                            {active ? 'Operator aktif' : 'Operator nonaktif'}
                          </Badge>
                          <Badge tone="brand">Login terhubung</Badge>
                        </div>
                        <p>UID {operator.linkedUserUid} · permission dibaca saat dialog dibuka</p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        aria-label={`Kelola akses ${operator.displayName}`}
                        onClick={() => setAssignmentTarget(operator)}
                      >
                        Kelola akses
                      </Button>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </section>
        </>
      ) : null}

      {editorState ? (
        <PermissionSetEditorDialog
          key={`${editorState.mode}-${editorState.permissionSet?.id ?? 'new'}`}
          permissionSet={editorState.permissionSet}
          repository={repository}
          onClose={closeEditor}
          onSaved={finishEditor}
        />
      ) : null}

      {assignmentTarget ? (
        <OperatorPermissionAssignmentDialog
          key={assignmentTarget.id}
          operator={assignmentTarget}
          permissionSets={permissionSets}
          repository={repository}
          onClose={closeAssignment}
          onSaved={finishAssignment}
        />
      ) : null}

      <Dialog
        open={Boolean(statusTarget)}
        size="sm"
        title={`${nextStatusLabel} ${statusTarget?.name ?? 'template'}?`}
        description={
          nextStatus === PERMISSION_SET_STATUSES.ACTIVE
            ? 'Template kembali tersedia untuk assignment baru dan referensi existing akan aktif lagi.'
            : 'Capability efektif template langsung dicabut dari semua user yang mereferensikannya, tanpa menghapus dokumen atau riwayat.'
        }
        onClose={closeStatusDialog}
        footer={
          <>
            <Button variant="ghost" disabled={statusSaving} onClick={closeStatusDialog}>
              Batal
            </Button>
            <Button
              variant={nextStatus === PERMISSION_SET_STATUSES.DISABLED ? 'danger' : 'primary'}
              loading={statusSaving}
              onClick={changePermissionSetStatus}
            >
              {nextStatusLabel} template
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
            Tidak ada hard delete. Perubahan status mempertahankan ID, timestamp pembuatan, dan
            seluruh referensi user.
          </div>
        )}
      </Dialog>
    </SettingsWorkspace>
  );
}
