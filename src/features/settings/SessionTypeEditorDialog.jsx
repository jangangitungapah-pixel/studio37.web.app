import { useEffect, useMemo, useState } from 'react';

import { Dialog } from '../../components/feedback/Dialog.jsx';
import { Input, Textarea } from '../../components/forms/Field.jsx';
import { Button } from '../../components/ui/Button.jsx';
import {
  DEFAULT_SESSION_TYPE_FORM_VALUES,
  toSessionTypeFormValues,
  validateSessionTypeForm,
} from './sessionTypeSettings.js';

function getUserFacingValidationErrors(errors) {
  const translated = {};

  if (errors.name) translated.name = 'Nama wajib diisi dan maksimal 80 karakter.';
  if (errors.code) {
    translated.code = 'Kode wajib memakai huruf, angka, atau tanda hubung; maksimal 24 karakter.';
  }
  if (errors.description) translated.description = 'Deskripsi maksimal 240 karakter.';
  if (errors.displayOrder)
    translated.displayOrder = 'Urutan tampil harus berupa angka bulat 1–999.';
  if (errors.defaultDurationMinutes) {
    translated.defaultDurationMinutes = 'Durasi default harus kelipatan 15 menit antara 15–1440.';
  }
  if (errors.minimumDurationMinutes) {
    translated.minimumDurationMinutes =
      'Durasi minimum harus kelipatan 15 menit, maksimal durasi default, dan tidak lebih dari 1440.';
  }

  return translated;
}

export function SessionTypeEditorDialog({
  dialogError,
  editingSessionType,
  existingSessionTypes,
  nextDisplayOrder,
  onClose,
  onSubmit,
  open,
  saving,
}) {
  const [fieldErrors, setFieldErrors] = useState({});
  const [formValues, setFormValues] = useState(() => ({ ...DEFAULT_SESSION_TYPE_FORM_VALUES }));

  useEffect(() => {
    if (!open) return;

    setFieldErrors({});
    setFormValues(
      editingSessionType
        ? toSessionTypeFormValues(editingSessionType)
        : {
            ...DEFAULT_SESSION_TYPE_FORM_VALUES,
            displayOrder: String(nextDisplayOrder),
          },
    );
  }, [editingSessionType, nextDisplayOrder, open]);

  const duplicateCode = useMemo(() => {
    const code = formValues.code.trim().toUpperCase();
    if (!code) return false;

    return existingSessionTypes.some(
      (sessionType) =>
        sessionType.id !== editingSessionType?.id && sessionType.code.toUpperCase() === code,
    );
  }, [editingSessionType?.id, existingSessionTypes, formValues.code]);

  const changeTextField =
    (fieldName, { uppercase = false } = {}) =>
    (event) => {
      const nextValue = uppercase ? event.target.value.toUpperCase() : event.target.value;
      setFormValues((current) => ({ ...current, [fieldName]: nextValue }));
      setFieldErrors((current) => {
        if (!current[fieldName]) return current;
        const nextErrors = { ...current };
        delete nextErrors[fieldName];
        return nextErrors;
      });
    };

  const changeReservation = (event) => {
    const checked = event.target.checked;
    setFormValues((current) => ({
      ...current,
      defaultDurationMinutes:
        checked && !current.defaultDurationMinutes ? '60' : current.defaultDurationMinutes,
      minimumDurationMinutes:
        checked && !current.minimumDurationMinutes ? '60' : current.minimumDurationMinutes,
      requiresStudioReservation: checked,
      useDurationConfiguration: checked ? true : current.useDurationConfiguration,
    }));
    setFieldErrors((current) => {
      if (!current.defaultDurationMinutes && !current.minimumDurationMinutes) return current;
      const nextErrors = { ...current };
      delete nextErrors.defaultDurationMinutes;
      delete nextErrors.minimumDurationMinutes;
      return nextErrors;
    });
  };

  const changeDurationConfiguration = (event) => {
    if (formValues.requiresStudioReservation) return;

    const checked = event.target.checked;
    setFormValues((current) => ({
      ...current,
      defaultDurationMinutes:
        checked && !current.defaultDurationMinutes ? '60' : current.defaultDurationMinutes,
      minimumDurationMinutes:
        checked && !current.minimumDurationMinutes ? '60' : current.minimumDurationMinutes,
      useDurationConfiguration: checked,
    }));
    setFieldErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors.defaultDurationMinutes;
      delete nextErrors.minimumDurationMinutes;
      return nextErrors;
    });
  };

  const submit = (event) => {
    event.preventDefault();
    const validation = validateSessionTypeForm(formValues);
    const errors = getUserFacingValidationErrors(validation.errors);

    if (duplicateCode) errors.code = 'Kode session type sudah digunakan. Gunakan kode unik lain.';

    setFieldErrors(errors);
    if (!validation.value || duplicateCode) return;

    onSubmit(validation.value);
  };

  const durationConfigurationEnabled =
    formValues.requiresStudioReservation || formValues.useDurationConfiguration;
  const title = editingSessionType ? 'Edit session type' : 'Tambah session type';

  return (
    <Dialog
      open={open}
      title={title}
      description="Session type menjadi pintu masuk pemilihan layanan dan aturan harga berikutnya."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" disabled={saving} onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" form="session-type-editor-form" loading={saving}>
            Simpan session type
          </Button>
        </>
      }
    >
      {dialogError ? (
        <div className="settings-notice" data-tone="danger" role="alert">
          <strong>Session type belum tersimpan.</strong>
          <span>{dialogError}</span>
        </div>
      ) : null}

      <div className="settings-notice" role="status">
        <strong>Dampak konfigurasi.</strong>
        <span>
          Perubahan berlaku untuk booking baru atau booking yang memang direprice. Snapshot booking
          historis tidak ditulis ulang.
        </span>
      </div>

      <form
        id="session-type-editor-form"
        className="price-session-form"
        onSubmit={submit}
        noValidate
      >
        <div className="settings-form__grid">
          <Input
            label="Nama session type"
            value={formValues.name}
            error={fieldErrors.name}
            maxLength={80}
            required
            disabled={saving}
            data-autofocus="true"
            onChange={changeTextField('name')}
          />
          <Input
            label="Kode"
            value={formValues.code}
            error={fieldErrors.code}
            maxLength={24}
            placeholder="REHEARSAL"
            required
            disabled={saving}
            onChange={changeTextField('code', { uppercase: true })}
          />
        </div>

        <Textarea
          label="Deskripsi"
          value={formValues.description}
          error={fieldErrors.description}
          maxLength={240}
          rows={3}
          disabled={saving}
          onChange={changeTextField('description')}
        />

        <div className="settings-form__grid">
          <Input
            type="number"
            label="Urutan tampil"
            value={formValues.displayOrder}
            error={fieldErrors.displayOrder}
            min={1}
            max={999}
            required
            disabled={saving}
            description="Angka kecil tampil lebih dulu pada pilihan layanan."
            onChange={changeTextField('displayOrder')}
          />
          <div className="price-session-switches" aria-label="Perilaku session type">
            <label className="price-session-switch">
              <input
                type="checkbox"
                checked={formValues.requiresStudioReservation}
                disabled={saving}
                onChange={changeReservation}
              />
              <span>
                <strong>Memesan slot studio</strong>
                <small>Aktifkan jika layanan membutuhkan ruang dan waktu pada calendar.</small>
              </span>
            </label>
            <label className="price-session-switch">
              <input
                type="checkbox"
                checked={durationConfigurationEnabled}
                disabled={saving || formValues.requiresStudioReservation}
                onChange={changeDurationConfiguration}
              />
              <span>
                <strong>Gunakan default & minimum durasi</strong>
                <small>
                  Wajib untuk layanan yang memesan studio; opsional untuk layanan non-studio.
                </small>
              </span>
            </label>
          </div>
        </div>

        {durationConfigurationEnabled ? (
          <div className="price-session-duration-panel">
            <div>
              <strong>Durasi layanan</strong>
              <span>Gunakan kelipatan 15 menit. Minimum tidak boleh melebihi default.</span>
            </div>
            <div className="settings-form__grid">
              <Input
                type="number"
                label="Durasi default (menit)"
                value={formValues.defaultDurationMinutes}
                error={fieldErrors.defaultDurationMinutes}
                min={15}
                max={1440}
                step={15}
                required
                disabled={saving}
                onChange={changeTextField('defaultDurationMinutes')}
              />
              <Input
                type="number"
                label="Durasi minimum (menit)"
                value={formValues.minimumDurationMinutes}
                error={fieldErrors.minimumDurationMinutes}
                min={15}
                max={1440}
                step={15}
                required
                disabled={saving}
                onChange={changeTextField('minimumDurationMinutes')}
              />
            </div>
          </div>
        ) : null}
      </form>
    </Dialog>
  );
}
