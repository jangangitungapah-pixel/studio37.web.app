import { useEffect, useMemo, useState } from 'react';

import { useToast } from '../../components/feedback/toast-context.js';
import { Input } from '../../components/forms/Field.jsx';
import { Select } from '../../components/forms/Select.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { formatDateTimeInTimeZone } from '../../lib/datetime/timestamps.js';
import { studioRoomRepository } from '../../services/studioRoomRepository.js';
import { studioSettingsRepository } from '../../services/studioSettingsRepository.js';
import { CAPABILITIES, hasCapability } from '../auth/capabilities.js';
import { useAuth } from '../auth/useAuth.js';
import { StudioRoomsSection } from './StudioRoomsSection.jsx';
import { SettingsWorkspace } from './SettingsWorkspace.jsx';
import {
  STUDIO_BOOKING_INTERVALS,
  STUDIO_TIME_ZONE_OPTIONS,
  toStudioSettingsFormValues,
  validateStudioSettingsForm,
} from './studioSettings.js';

const bookingIntervalOptions = STUDIO_BOOKING_INTERVALS.map((minutes) => ({
  label: `${minutes} menit`,
  value: String(minutes),
}));

function getSafeFirebaseMessage(error, action) {
  if (error?.code === 'permission-denied') {
    return 'Akun ini tidak memiliki izin untuk mengubah konfigurasi studio.';
  }

  if (error?.code === 'unavailable') {
    return `Firestore sedang tidak tersedia. Coba ${action} lagi setelah koneksi pulih.`;
  }

  return `Konfigurasi studio belum bisa ${action}. Coba lagi tanpa menghapus perubahan form.`;
}

function getUserFacingValidationErrors(errors) {
  const translated = {};

  if (errors.businessName) {
    translated.businessName = 'Nama studio wajib diisi dan maksimal 120 karakter.';
  }

  if (errors.timeZone) {
    translated.timeZone = 'Pilih zona waktu Indonesia yang didukung.';
  }

  if (errors.bookingIntervalMinutes) {
    translated.bookingIntervalMinutes = 'Pilih interval booking 15, 30, atau 60 menit.';
  }

  if (errors.opensAt) {
    translated.opensAt = 'Masukkan jam buka yang valid.';
  }

  if (errors.closesAt) {
    translated.closesAt =
      'Jam tutup harus setelah jam buka dan keduanya harus sejajar dengan interval booking.';
  }

  return translated;
}

function formValuesEqual(left, right) {
  return Object.keys(left).every((key) => left[key] === right[key]);
}

export function StudioSettingsPage({
  repository = studioSettingsRepository,
  roomRepository = studioRoomRepository,
}) {
  const access = useAuth();
  const { pushToast } = useToast();
  const canEdit = hasCapability(access, CAPABILITIES.SETTINGS_STUDIO_EDIT);
  const [baselineValues, setBaselineValues] = useState(() => toStudioSettingsFormValues());
  const [formValues, setFormValues] = useState(() => toStudioSettingsFormValues());
  const [fieldErrors, setFieldErrors] = useState({});
  const [loadError, setLoadError] = useState('');
  const [loadState, setLoadState] = useState('loading');
  const [reloadKey, setReloadKey] = useState(0);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [settingsDocument, setSettingsDocument] = useState(null);

  const dirty = useMemo(
    () => !formValuesEqual(formValues, baselineValues),
    [baselineValues, formValues],
  );
  const canSave = dirty || !settingsDocument;

  useEffect(() => {
    let active = true;

    setLoadError('');
    setLoadState('loading');

    repository
      .getStudioSettings()
      .then((settings) => {
        if (!active) return;

        const nextValues = toStudioSettingsFormValues(settings);
        setSettingsDocument(settings);
        setBaselineValues(nextValues);
        setFormValues(nextValues);
        setFieldErrors({});
        setLoadState('ready');
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(getSafeFirebaseMessage(error, 'dimuat'));
        setLoadState('error');
      });

    return () => {
      active = false;
    };
  }, [reloadKey, repository]);

  useEffect(() => {
    if (!dirty) return undefined;

    const warnBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [dirty]);

  const changeField = (fieldName) => (event) => {
    const nextValue = event.target.value;
    setFormValues((current) => ({ ...current, [fieldName]: nextValue }));
    setFieldErrors((current) => {
      if (!current[fieldName]) return current;
      const nextErrors = { ...current };
      delete nextErrors[fieldName];
      return nextErrors;
    });
    setSaveError('');
  };

  const resetForm = () => {
    setFormValues({ ...baselineValues });
    setFieldErrors({});
    setSaveError('');
  };

  const saveSettings = async (event) => {
    event.preventDefault();
    const validation = validateStudioSettingsForm(formValues);
    const translatedErrors = getUserFacingValidationErrors(validation.errors);
    setFieldErrors(translatedErrors);
    setSaveError('');

    if (!validation.value) return;

    const actorUid = access.user?.uid;

    if (!canEdit || !actorUid) {
      setSaveError('Sesi ini tidak diizinkan menyimpan konfigurasi studio.');
      return;
    }

    setSaving(true);

    try {
      if (settingsDocument) {
        await repository.updateStudioSettings(validation.value, { actorUid });
      } else {
        await repository.createStudioSettings(validation.value, { actorUid });
      }

      const nextValues = toStudioSettingsFormValues(validation.value);
      const savedAt = new Date();
      setBaselineValues(nextValues);
      setFormValues(nextValues);
      setSettingsDocument((current) => ({
        ...current,
        ...validation.value,
        createdAt: current?.createdAt ?? savedAt,
        createdByUid: current?.createdByUid ?? actorUid,
        id: repository.documentId,
        updatedAt: savedAt,
        updatedByUid: actorUid,
      }));
      pushToast({
        message: 'Profil, jam operasional, zona waktu, dan interval booking sudah diperbarui.',
        tone: 'success',
        title: 'Studio Settings tersimpan',
      });
    } catch (error) {
      setSaveError(getSafeFirebaseMessage(error, 'disimpan'));
    } finally {
      setSaving(false);
    }
  };

  const accessLabel = canEdit ? 'Dapat mengedit' : 'Lihat saja';

  return (
    <SettingsWorkspace
      title="Studio Settings"
      description="Atur identitas, ruang, dan batas waktu yang menjadi sumber konfigurasi booking berikutnya."
      actions={
        <span className="settings-access-badge" data-editable={canEdit || undefined}>
          {accessLabel}
        </span>
      }
    >
      {loadState === 'loading' ? (
        <div className="settings-state" aria-busy="true" aria-live="polite">
          <span className="settings-state__spinner" aria-hidden="true" />
          <div>
            <p className="settings-state__title">Memuat konfigurasi studio</p>
            <p className="settings-state__description">Membaca satu dokumen appSettings/studio.</p>
          </div>
        </div>
      ) : null}

      {loadState === 'error' ? (
        <div className="settings-state" data-tone="danger" role="alert">
          <div>
            <p className="settings-state__title">Konfigurasi gagal dimuat</p>
            <p className="settings-state__description">{loadError}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setReloadKey((value) => value + 1)}>
            Coba lagi
          </Button>
        </div>
      ) : null}

      {loadState === 'ready' ? (
        <>
          {!settingsDocument ? (
            <div className="settings-notice" data-tone="warning" role="status">
              <strong>Konfigurasi awal belum tersimpan.</strong>
              <span>
                Nilai 10:00–22:00 dan Asia/Jakarta hanya draft awal sampai pengguna berizin menekan
                Simpan.
              </span>
            </div>
          ) : null}

          {!canEdit ? (
            <div className="settings-notice" role="status">
              <strong>Mode lihat saja.</strong>
              <span>Perubahan memerlukan capability settings.studio.edit.</span>
            </div>
          ) : null}

          {saveError ? (
            <div className="settings-notice" data-tone="danger" role="alert">
              <strong>Perubahan belum tersimpan.</strong>
              <span>{saveError}</span>
            </div>
          ) : null}

          <form className="settings-form" onSubmit={saveSettings} noValidate>
            <section className="settings-card" aria-labelledby="studio-profile-heading">
              <header className="settings-card__header">
                <div>
                  <p className="settings-card__eyebrow">Profil</p>
                  <h2 id="studio-profile-heading">Identitas studio</h2>
                </div>
                <p>Nama ini menjadi label bisnis utama pada workspace operasional.</p>
              </header>

              <div className="settings-form__grid">
                <Input
                  label="Nama studio / bisnis"
                  value={formValues.businessName}
                  error={fieldErrors.businessName}
                  maxLength={120}
                  required
                  disabled={!canEdit || saving}
                  onChange={changeField('businessName')}
                />
                <Select
                  label="Zona waktu"
                  value={formValues.timeZone}
                  error={fieldErrors.timeZone}
                  options={STUDIO_TIME_ZONE_OPTIONS}
                  placeholder=""
                  required
                  disabled={!canEdit || saving}
                  onChange={changeField('timeZone')}
                />
              </div>
            </section>

            <section className="settings-card" aria-labelledby="studio-schedule-heading">
              <header className="settings-card__header">
                <div>
                  <p className="settings-card__eyebrow">Booking defaults</p>
                  <h2 id="studio-schedule-heading">Jam operasional</h2>
                </div>
                <p>
                  Calendar dan validasi booking akan membaca nilai tersimpan, bukan jam hardcoded.
                </p>
              </header>

              <div className="settings-form__grid settings-form__grid--three">
                <Input
                  type="time"
                  label="Jam buka"
                  value={formValues.opensAt}
                  error={fieldErrors.opensAt}
                  required
                  disabled={!canEdit || saving}
                  onChange={changeField('opensAt')}
                />
                <Input
                  type="time"
                  label="Jam tutup"
                  value={formValues.closesAt}
                  error={fieldErrors.closesAt}
                  required
                  disabled={!canEdit || saving}
                  onChange={changeField('closesAt')}
                />
                <Select
                  label="Interval booking"
                  value={formValues.bookingIntervalMinutes}
                  error={fieldErrors.bookingIntervalMinutes}
                  options={bookingIntervalOptions}
                  placeholder=""
                  required
                  disabled={!canEdit || saving}
                  onChange={changeField('bookingIntervalMinutes')}
                />
              </div>
            </section>

            <div className="settings-save-bar">
              <div className="settings-save-bar__status" aria-live="polite">
                <strong>
                  {dirty
                    ? 'Ada perubahan belum disimpan'
                    : settingsDocument
                      ? 'Form sudah sinkron'
                      : 'Konfigurasi awal siap disimpan'}
                </strong>
                <span>
                  {settingsDocument?.updatedAt
                    ? `Pembaruan terakhir ${formatDateTimeInTimeZone(settingsDocument.updatedAt, {
                        timeZone: settingsDocument.timeZone,
                      })}`
                    : 'Dokumen akan dibuat saat penyimpanan pertama.'}
                </span>
              </div>

              {canEdit ? (
                <div className="settings-save-bar__actions">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={!dirty || saving}
                    onClick={resetForm}
                  >
                    Reset
                  </Button>
                  <Button type="submit" loading={saving} disabled={!canSave}>
                    Simpan perubahan
                  </Button>
                </div>
              ) : null}
            </div>
          </form>
        </>
      ) : null}

      <StudioRoomsSection
        actorUid={access.user?.uid}
        canEdit={canEdit}
        repository={roomRepository}
      />
    </SettingsWorkspace>
  );
}
