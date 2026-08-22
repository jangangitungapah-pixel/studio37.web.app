import { useCallback, useEffect, useState } from 'react';

import { useToast } from '../../components/feedback/toast-context.js';
import { Badge } from '../../components/feedback/Badge.jsx';
import { Dialog } from '../../components/feedback/Dialog.jsx';
import { Input } from '../../components/forms/Field.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { operatorRepository } from '../../services/operatorRepository.js';
import { CAPABILITIES, hasCapability, isOwner } from '../auth/capabilities.js';
import { useAuth } from '../auth/useAuth.js';
import { OperatorAccountLinkDialog } from './OperatorAccountLinkDialog.jsx';
import { SettingsWorkspace } from './SettingsWorkspace.jsx';
import {
  DEFAULT_OPERATOR_FORM_VALUES,
  OPERATOR_LIST_LIMIT,
  OPERATOR_STATUSES,
  OPERATOR_TYPES,
  toOperatorFormValues,
  validateOperatorForm,
} from './operators.js';

const operatorTypeLabels = Object.freeze({
  [OPERATOR_TYPES.RECORDING_ENGINEER]: 'Recording Engineer',
  [OPERATOR_TYPES.STUDIO_OPERATOR]: 'Studio Operator',
});

function getSafeFirebaseMessage(error, action) {
  if (error?.code === 'permission-denied') {
    return `Akun ini tidak memiliki izin untuk ${action} operator.`;
  }

  if (error?.code === 'unavailable') {
    return `Firestore sedang tidak tersedia. Coba ${action} operator lagi setelah koneksi pulih.`;
  }

  return `Data operator belum bisa ${action}. Coba lagi tanpa menghapus data form.`;
}

function getUserFacingValidationErrors(errors) {
  const translated = {};

  if (errors.displayName) {
    translated.displayName = 'Nama operator wajib diisi dan maksimal 100 karakter.';
  }

  if (errors.email) {
    translated.email = 'Masukkan alamat email yang valid atau kosongkan field ini.';
  }

  if (errors.phone) {
    translated.phone = 'Gunakan nomor Indonesia yang valid, misalnya 0812 3456 7890.';
  }

  if (errors.operatorTypes) {
    translated.operatorTypes = 'Pilih minimal satu jenis operator.';
  }

  return translated;
}

function getOperatorInitials(displayName) {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function OperatorSettingsPage({ accountRepository, repository = operatorRepository }) {
  const access = useAuth();
  const { pushToast } = useToast();
  const canManage = hasCapability(access, CAPABILITIES.SETTINGS_OPERATORS_MANAGE);
  const canManageAccountLinks = isOwner(access.profile);
  const actorUid = access.user?.uid;
  const [accountTarget, setAccountTarget] = useState(null);
  const [dialogError, setDialogError] = useState('');
  const [editingOperator, setEditingOperator] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formValues, setFormValues] = useState(() => ({ ...DEFAULT_OPERATOR_FORM_VALUES }));
  const [loadError, setLoadError] = useState('');
  const [loadState, setLoadState] = useState('loading');
  const [operatorDialogMode, setOperatorDialogMode] = useState(null);
  const [operators, setOperators] = useState([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null);

  const operatorLimit = repository.listLimit ?? OPERATOR_LIST_LIMIT;
  const operatorLimitReached = operators.length >= operatorLimit;
  const dialogTitle = operatorDialogMode === 'edit' ? 'Edit operator' : 'Tambah operator';
  const nextStatus =
    statusTarget?.status === OPERATOR_STATUSES.ACTIVE
      ? OPERATOR_STATUSES.DISABLED
      : OPERATOR_STATUSES.ACTIVE;
  const nextStatusLabel = nextStatus === OPERATOR_STATUSES.ACTIVE ? 'Aktifkan' : 'Nonaktifkan';

  useEffect(() => {
    let active = true;

    setLoadError('');
    setLoadState('loading');

    repository
      .listOperators()
      .then((nextOperators) => {
        if (!active) return;
        setOperators([...nextOperators]);
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

  const openAccountDialog = (operator) => {
    if (!canManageAccountLinks) return;
    setAccountTarget(operator);
  };

  const closeAccountDialog = useCallback(() => setAccountTarget(null), []);

  const finishAccountMutation = useCallback(() => {
    setAccountTarget(null);
    setReloadKey((value) => value + 1);
  }, []);

  const openCreateDialog = () => {
    if (!canManage || operatorLimitReached) return;

    setEditingOperator(null);
    setFormValues({ ...DEFAULT_OPERATOR_FORM_VALUES });
    setFieldErrors({});
    setDialogError('');
    setOperatorDialogMode('create');
  };

  const openEditDialog = (operator) => {
    if (!canManage) return;

    setEditingOperator(operator);
    setFormValues(toOperatorFormValues(operator));
    setFieldErrors({});
    setDialogError('');
    setOperatorDialogMode('edit');
  };

  const closeOperatorDialog = useCallback(() => {
    if (saving) return;
    setOperatorDialogMode(null);
    setEditingOperator(null);
    setDialogError('');
    setFieldErrors({});
  }, [saving]);

  const clearFieldError = (fieldName) => {
    setFieldErrors((current) => {
      if (!current[fieldName]) return current;
      const nextErrors = { ...current };
      delete nextErrors[fieldName];
      return nextErrors;
    });
  };

  const changeField = (fieldName) => (event) => {
    setFormValues((current) => ({ ...current, [fieldName]: event.target.value }));
    clearFieldError(fieldName);
    setDialogError('');
  };

  const changeOperatorType = (fieldName) => (event) => {
    setFormValues((current) => ({ ...current, [fieldName]: event.target.checked }));
    clearFieldError('operatorTypes');
    setDialogError('');
  };

  const saveOperator = async (event) => {
    event.preventDefault();
    const validation = validateOperatorForm(formValues);
    const translatedErrors = getUserFacingValidationErrors(validation.errors);
    setFieldErrors(translatedErrors);
    setDialogError('');

    if (!validation.value) return;

    if (!canManage || !actorUid) {
      setDialogError('Sesi ini tidak diizinkan menyimpan operator.');
      return;
    }

    setSaving(true);

    try {
      if (editingOperator) {
        await repository.updateOperator(editingOperator.id, validation.value, { actorUid });
      } else {
        await repository.createOperator(validation.value, { actorUid });
      }

      pushToast({
        message: `${validation.value.displayName} sudah ${editingOperator ? 'diperbarui' : 'ditambahkan'} tanpa mengubah akun login atau referensi historis.`,
        tone: 'success',
        title: editingOperator ? 'Operator diperbarui' : 'Operator ditambahkan',
      });
      setOperatorDialogMode(null);
      setEditingOperator(null);
      setReloadKey((value) => value + 1);
    } catch (error) {
      setDialogError(getSafeFirebaseMessage(error, 'menyimpan'));
    } finally {
      setSaving(false);
    }
  };

  const openStatusDialog = (operator) => {
    if (!canManage) return;
    setStatusTarget(operator);
    setStatusError('');
  };

  const closeStatusDialog = useCallback(() => {
    if (statusSaving) return;
    setStatusTarget(null);
    setStatusError('');
  }, [statusSaving]);

  const changeOperatorStatus = async () => {
    if (!statusTarget || !canManage || !actorUid) {
      setStatusError('Sesi ini tidak diizinkan mengubah status operator.');
      return;
    }

    setStatusSaving(true);
    setStatusError('');

    try {
      await repository.setOperatorStatus(statusTarget.id, nextStatus, { actorUid });
      pushToast({
        message:
          nextStatus === OPERATOR_STATUSES.ACTIVE
            ? `${statusTarget.displayName} kembali aktif untuk konfigurasi operasional berikutnya.`
            : `${statusTarget.displayName} dinonaktifkan untuk assignment baru; riwayat tetap aman.`,
        tone: 'success',
        title:
          nextStatus === OPERATOR_STATUSES.ACTIVE
            ? 'Operator diaktifkan'
            : 'Operator dinonaktifkan',
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
      title="Operator Settings"
      description="Kelola profil operasional, status, dan hubungan akun login tanpa mencampurkannya dengan permission."
      actions={
        <span className="settings-access-badge" data-editable={canManage || undefined}>
          {canManage ? 'Dapat mengelola' : 'Lihat saja'}
        </span>
      }
    >
      <div className="settings-notice" role="status">
        <strong>Jenis operator bukan hak akses.</strong>
        <span>
          Studio Operator dan Recording Engineer hanya menentukan fungsi operasional. Owner dapat
          menghubungkan profil user yang sudah ada; permission tetap dikelola terpisah.
        </span>
      </div>

      {!canManage ? (
        <div className="settings-notice" role="status">
          <strong>Mode lihat saja.</strong>
          <span>Perubahan memerlukan capability settings.operators.manage.</span>
        </div>
      ) : null}

      <section className="settings-card" aria-labelledby="operators-heading">
        <header className="settings-card__header settings-card__header--with-action">
          <div>
            <p className="settings-card__eyebrow">People & assignment</p>
            <h2 id="operators-heading">Daftar operator</h2>
            <p className="settings-card__subtitle">
              Profil aktif akan menjadi sumber assignment booking dan perhitungan komisi pada phase
              berikutnya.
            </p>
          </div>
          {canManage ? (
            <Button
              size="sm"
              disabled={loadState !== 'ready' || operatorLimitReached}
              onClick={openCreateDialog}
            >
              Tambah operator
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
              <p className="settings-state__title">Memuat operator</p>
              <p className="settings-state__description">
                Satu query nama terurut dibatasi maksimal {operatorLimit} dokumen.
              </p>
            </div>
          </div>
        ) : null}

        {loadState === 'error' ? (
          <div className="settings-state settings-state--embedded" data-tone="danger" role="alert">
            <div>
              <p className="settings-state__title">Daftar operator gagal dimuat</p>
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

        {loadState === 'ready' && operatorLimitReached ? (
          <div className="settings-notice" data-tone="warning" role="status">
            <strong>Batas {operatorLimit} operator tercapai.</strong>
            <span>
              Edit atau aktifkan kembali profil yang ada; hard delete tidak tersedia pada workflow
              operasional.
            </span>
          </div>
        ) : null}

        {loadState === 'ready' && operators.length === 0 ? (
          <div className="settings-operator-empty">
            <span className="settings-placeholder__dot" aria-hidden="true" />
            <div>
              <p className="settings-placeholder__title">Belum ada profil operator</p>
              <p className="settings-placeholder__description">
                Tambahkan Studio Operator atau Recording Engineer pertama tanpa harus membuat akun
                login.
              </p>
            </div>
          </div>
        ) : null}

        {loadState === 'ready' && operators.length > 0 ? (
          <div className="settings-operator-list" aria-label="Daftar operator">
            {operators.map((operator) => {
              const isActive = operator.status === OPERATOR_STATUSES.ACTIVE;
              const contacts = [operator.email, operator.phone].filter(Boolean);

              return (
                <article
                  className="settings-operator-row"
                  data-disabled={!isActive || undefined}
                  key={operator.id}
                >
                  <div className="settings-operator-row__avatar" aria-hidden="true">
                    {getOperatorInitials(operator.displayName)}
                  </div>
                  <div className="settings-operator-row__content">
                    <div className="settings-operator-row__heading">
                      <h3>{operator.displayName}</h3>
                      <Badge tone={isActive ? 'success' : 'neutral'}>
                        {isActive ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                      <Badge tone={operator.linkedUserUid ? 'info' : 'neutral'}>
                        {operator.linkedUserUid ? 'Login terhubung' : 'Tanpa login'}
                      </Badge>
                    </div>
                    <div className="settings-operator-row__types">
                      {operator.operatorTypes.map((operatorType) => (
                        <Badge key={operatorType} tone="brand">
                          {operatorTypeLabels[operatorType]}
                        </Badge>
                      ))}
                    </div>
                    <p>{contacts.length ? contacts.join(' · ') : 'Kontak belum ditambahkan.'}</p>
                  </div>
                  {canManage ? (
                    <div className="settings-operator-row__actions">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Edit ${operator.displayName}`}
                        onClick={() => openEditDialog(operator)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant={isActive ? 'ghost' : 'secondary'}
                        aria-label={`${isActive ? 'Nonaktifkan' : 'Aktifkan'} ${operator.displayName}`}
                        onClick={() => openStatusDialog(operator)}
                      >
                        {isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      </Button>
                      {canManageAccountLinks ? (
                        <Button
                          size="sm"
                          variant={operator.linkedUserUid ? 'secondary' : 'ghost'}
                          aria-label={`${operator.linkedUserUid ? 'Kelola akun' : 'Hubungkan akun'} ${operator.displayName}`}
                          onClick={() => openAccountDialog(operator)}
                        >
                          {operator.linkedUserUid ? 'Kelola akun' : 'Hubungkan akun'}
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

      {accountTarget ? (
        <OperatorAccountLinkDialog
          actorUid={actorUid}
          operator={accountTarget}
          repository={accountRepository}
          onClose={closeAccountDialog}
          onSaved={finishAccountMutation}
        />
      ) : null}

      <Dialog
        open={Boolean(operatorDialogMode)}
        title={dialogTitle}
        description="Profil ini dipakai untuk assignment operasional; akun login tidak dibuat atau diubah di sini."
        onClose={closeOperatorDialog}
        footer={
          <>
            <Button variant="ghost" disabled={saving} onClick={closeOperatorDialog}>
              Batal
            </Button>
            <Button type="submit" form="operator-settings-form" loading={saving}>
              Simpan operator
            </Button>
          </>
        }
      >
        {dialogError ? (
          <div className="settings-notice" data-tone="danger" role="alert">
            <strong>Operator belum tersimpan.</strong>
            <span>{dialogError}</span>
          </div>
        ) : null}

        <form
          id="operator-settings-form"
          className="settings-operator-form"
          onSubmit={saveOperator}
          noValidate
        >
          <Input
            label="Nama operator"
            value={formValues.displayName}
            error={fieldErrors.displayName}
            maxLength={100}
            required
            disabled={saving}
            data-autofocus="true"
            onChange={changeField('displayName')}
          />
          <div className="settings-form__grid">
            <Input
              type="email"
              label="Email kontak"
              value={formValues.email}
              error={fieldErrors.email}
              maxLength={254}
              placeholder="operator@studio37.id"
              disabled={saving}
              onChange={changeField('email')}
            />
            <Input
              type="tel"
              label="Nomor WhatsApp / telepon"
              value={formValues.phone}
              error={fieldErrors.phone}
              placeholder="0812 3456 7890"
              disabled={saving}
              onChange={changeField('phone')}
            />
          </div>

          <fieldset
            className="settings-operator-types"
            aria-describedby={fieldErrors.operatorTypes ? 'operator-types-error' : undefined}
            data-invalid={Boolean(fieldErrors.operatorTypes) || undefined}
          >
            <legend>
              Jenis operator <span>Required</span>
            </legend>
            <div className="settings-operator-types__grid">
              <label data-selected={formValues.studioOperator || undefined}>
                <input
                  type="checkbox"
                  checked={formValues.studioOperator}
                  disabled={saving}
                  onChange={changeOperatorType('studioOperator')}
                />
                <span>
                  <strong>Studio Operator</strong>
                  <small>Untuk penjagaan sesi, room, dan workflow studio.</small>
                </span>
              </label>
              <label data-selected={formValues.recordingEngineer || undefined}>
                <input
                  type="checkbox"
                  checked={formValues.recordingEngineer}
                  disabled={saving}
                  onChange={changeOperatorType('recordingEngineer')}
                />
                <span>
                  <strong>Recording Engineer</strong>
                  <small>Untuk recording, mixing, atau peran teknis produksi.</small>
                </span>
              </label>
            </div>
            {fieldErrors.operatorTypes ? (
              <p id="operator-types-error" role="alert">
                {fieldErrors.operatorTypes}
              </p>
            ) : null}
          </fieldset>

          <div className="settings-operator-account-note">
            <strong>Status akun aplikasi</strong>
            <span>
              {editingOperator?.linkedUserUid
                ? 'Akun login sudah terhubung. Gunakan aksi Kelola akun pada daftar operator untuk memutuskan hubungan.'
                : canManageAccountLinks
                  ? 'Profil ini tersimpan tanpa login. Gunakan aksi Hubungkan akun setelah profil operator disimpan.'
                  : 'Profil ini tersimpan tanpa login. Hanya Owner yang dapat menghubungkan akun.'}
            </span>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(statusTarget)}
        size="sm"
        title={`${nextStatusLabel} ${statusTarget?.displayName ?? 'operator'}?`}
        description={
          nextStatus === OPERATOR_STATUSES.ACTIVE
            ? 'Operator kembali tersedia untuk konfigurasi assignment baru.'
            : 'Operator dikecualikan dari assignment baru, tetapi referensi booking dan komisi historis tetap dipertahankan.'
        }
        onClose={closeStatusDialog}
        footer={
          <>
            <Button variant="ghost" disabled={statusSaving} onClick={closeStatusDialog}>
              Batal
            </Button>
            <Button
              variant={nextStatus === OPERATOR_STATUSES.DISABLED ? 'danger' : 'primary'}
              loading={statusSaving}
              onClick={changeOperatorStatus}
            >
              {nextStatusLabel} operator
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
            Tidak ada hard delete. Akun login, permission, booking, dan riwayat komisi tidak diubah
            oleh aksi ini.
          </div>
        )}
      </Dialog>
    </SettingsWorkspace>
  );
}
