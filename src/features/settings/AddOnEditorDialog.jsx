import { useEffect, useMemo, useState } from 'react';

import { Dialog } from '../../components/feedback/Dialog.jsx';
import { Input, Textarea } from '../../components/forms/Field.jsx';
import { Select } from '../../components/forms/Select.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ADD_ON_PRICING_TYPES } from '../pricing/addOnPricing.js';
import { SESSION_TYPE_STATUSES } from '../pricing/sessionTypes.js';
import { DurationMinutesField } from './DurationMinutesField.jsx';
import {
  ADD_ON_PRICING_TYPE_OPTIONS,
  ADD_ON_ROUNDING_OPTIONS,
  DEFAULT_ADD_ON_FORM_VALUES,
  toAddOnFormValues,
  validateAddOnForm,
} from './addOnSettings.js';

function getUserFacingErrors(errors) {
  const translated = {};
  if (errors.name) translated.name = 'Nama add-on wajib diisi dan maksimal 100 karakter.';
  if (errors.description) translated.description = 'Deskripsi maksimal 240 karakter.';
  if (errors.displayOrder) translated.displayOrder = 'Urutan harus angka bulat 1–999.';
  if (errors.sessionTypeId) translated.sessionTypeId = 'Session type reference tidak valid.';
  if (errors.pricingType) translated.pricingType = 'Pilih model harga add-on.';
  if (errors.amountIdr) translated.amountIdr = 'Harga harus integer IDR 0 atau lebih.';
  if (errors.amountPerUnitIdr) {
    translated.amountPerUnitIdr = 'Harga per unit harus integer IDR 0 atau lebih.';
  }
  if (errors.amountPerIncrementIdr) {
    translated.amountPerIncrementIdr = 'Harga per increment harus integer IDR 0 atau lebih.';
  }
  if (errors.incrementMinutes) {
    translated.incrementMinutes = 'Increment harus kelipatan 15 menit antara 15–1440.';
  }
  if (errors.form) translated.form = 'Konfigurasi add-on belum memenuhi kontrak canonical.';
  return translated;
}

function buildSessionOptions(sessionTypes, editingAddOn) {
  return [
    { label: 'Semua session type', value: '' },
    ...sessionTypes
      .filter(
        (sessionType) =>
          sessionType.status === SESSION_TYPE_STATUSES.ACTIVE ||
          sessionType.id === editingAddOn?.sessionTypeId,
      )
      .map((sessionType) => ({
        disabled: sessionType.status !== SESSION_TYPE_STATUSES.ACTIVE,
        label: `${sessionType.name} · ${sessionType.code}${
          sessionType.status === SESSION_TYPE_STATUSES.ACTIVE ? '' : ' · nonaktif'
        }`,
        value: sessionType.id,
      })),
  ];
}

function PricingFields({ fieldErrors, formValues, onChange, onDurationChange, saving }) {
  if (!formValues.pricingType) {
    return (
      <div className="pricing-rule-model-empty">
        <strong>Pilih model harga add-on dulu.</strong>
        <span>Field nominal akan mengikuti bentuk kalkulasi canonical 5A8.</span>
      </div>
    );
  }

  if (formValues.pricingType === ADD_ON_PRICING_TYPES.FIXED) {
    return (
      <div className="pricing-rule-config-panel">
        <div className="pricing-rule-config-panel__intro">
          <strong>Harga tetap</strong>
          <span>Nominal ditambahkan sekali ketika add-on dipilih.</span>
        </div>
        <Input
          type="number"
          label="Harga add-on (IDR)"
          value={formValues.amountIdr}
          error={fieldErrors.amountIdr}
          min={0}
          step={1}
          required
          disabled={saving}
          onChange={onChange('amountIdr')}
        />
      </div>
    );
  }

  if (formValues.pricingType === ADD_ON_PRICING_TYPES.QUANTITY) {
    return (
      <div className="pricing-rule-config-panel">
        <div className="pricing-rule-config-panel__intro">
          <strong>Harga per unit</strong>
          <span>Owner mengatur harga per unit; quantity aktual dipilih saat Booking.</span>
        </div>
        <Input
          type="number"
          label="Harga per unit (IDR)"
          value={formValues.amountPerUnitIdr}
          error={fieldErrors.amountPerUnitIdr}
          min={0}
          step={1}
          required
          disabled={saving}
          onChange={onChange('amountPerUnitIdr')}
        />
      </div>
    );
  }

  return (
    <div className="pricing-rule-config-panel">
      <div className="pricing-rule-config-panel__intro">
        <strong>Harga per waktu</strong>
        <span>Durasi aktual datang dari Booking; konfigurasi menentukan increment dan rounding.</span>
      </div>
      <div className="settings-form__grid">
        <Input
          type="number"
          label="Harga per increment (IDR)"
          value={formValues.amountPerIncrementIdr}
          error={fieldErrors.amountPerIncrementIdr}
          min={0}
          step={1}
          required
          disabled={saving}
          onChange={onChange('amountPerIncrementIdr')}
        />
        <DurationMinutesField
          label="Increment waktu"
          value={formValues.incrementMinutes}
          error={fieldErrors.incrementMinutes}
          required
          disabled={saving}
          description="Unit waktu untuk satu langkah tagihan add-on."
          onValueChange={onDurationChange('incrementMinutes')}
        />
      </div>
      <Select
        label="Rounding waktu"
        value={formValues.roundingMode}
        options={ADD_ON_ROUNDING_OPTIONS}
        required
        disabled={saving}
        onChange={onChange('roundingMode')}
      />
    </div>
  );
}

export function AddOnEditorDialog({
  dialogError,
  editingAddOn,
  nextDisplayOrder,
  onClose,
  onSubmit,
  open,
  saving,
  sessionTypes,
}) {
  const [fieldErrors, setFieldErrors] = useState({});
  const [formValues, setFormValues] = useState(() => ({ ...DEFAULT_ADD_ON_FORM_VALUES }));

  useEffect(() => {
    if (!open) return;
    setFieldErrors({});
    setFormValues(
      editingAddOn
        ? toAddOnFormValues(editingAddOn)
        : { ...DEFAULT_ADD_ON_FORM_VALUES, displayOrder: String(nextDisplayOrder) },
    );
  }, [editingAddOn, nextDisplayOrder, open]);

  const sessionOptions = useMemo(
    () => buildSessionOptions(sessionTypes, editingAddOn),
    [editingAddOn, sessionTypes],
  );

  const setFieldValue = (fieldName, nextValue) => {
    setFormValues((current) => ({ ...current, [fieldName]: nextValue }));
    setFieldErrors((current) => {
      if (!current[fieldName] && !current.form) return current;
      const nextErrors = { ...current };
      delete nextErrors[fieldName];
      delete nextErrors.form;
      return nextErrors;
    });
  };
  const changeField = (fieldName) => (event) => setFieldValue(fieldName, event.target.value);
  const changeDurationField = (fieldName) => (nextValue) => setFieldValue(fieldName, nextValue);

  const submit = (event) => {
    event.preventDefault();
    const validation = validateAddOnForm(formValues);
    const errors = getUserFacingErrors(validation.errors);
    setFieldErrors(errors);
    if (!validation.value) return;
    onSubmit(validation.value);
  };

  return (
    <Dialog
      open={open}
      size="lg"
      title={editingAddOn ? 'Edit add-on' : 'Tambah add-on'}
      description="Konfigurasikan layanan tambahan tanpa menulis JSON atau memasukkan data transaksi Booking."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" disabled={saving} onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" form="add-on-editor-form" loading={saving}>
            Simpan add-on
          </Button>
        </>
      }
    >
      {dialogError || fieldErrors.form ? (
        <div className="settings-notice" data-tone="danger" role="alert">
          <strong>Add-on belum tersimpan.</strong>
          <span>{dialogError || fieldErrors.form}</span>
        </div>
      ) : null}

      <div className="settings-notice" role="status">
        <strong>Konfigurasi, bukan transaksi.</strong>
        <span>
          Quantity dan durasi aktual baru dipilih di Booking. Perubahan konfigurasi tidak menghitung
          ulang snapshot booking historis.
        </span>
      </div>

      <form id="add-on-editor-form" className="pricing-rule-form" onSubmit={submit} noValidate>
        <div className="settings-form__grid">
          <Input
            label="Nama add-on"
            value={formValues.name}
            error={fieldErrors.name}
            maxLength={100}
            required
            disabled={saving}
            data-autofocus="true"
            placeholder="Extra microphone"
            onChange={changeField('name')}
          />
          <Input
            type="number"
            label="Urutan tampil"
            value={formValues.displayOrder}
            error={fieldErrors.displayOrder}
            min={1}
            max={999}
            step={1}
            required
            disabled={saving}
            onChange={changeField('displayOrder')}
          />
        </div>

        <Textarea
          label="Deskripsi"
          value={formValues.description}
          error={fieldErrors.description}
          maxLength={240}
          rows={3}
          disabled={saving}
          placeholder="Opsional. Jelaskan layanan atau item tambahan."
          onChange={changeField('description')}
        />

        <div className="settings-form__grid">
          <Select
            label="Tersedia untuk"
            value={formValues.sessionTypeId}
            error={fieldErrors.sessionTypeId}
            options={sessionOptions}
            placeholder=""
            disabled={saving}
            description="Semua session type = general; pilih satu session untuk membatasi availability."
            onChange={changeField('sessionTypeId')}
          />
          <Select
            label="Model harga add-on"
            value={formValues.pricingType}
            error={fieldErrors.pricingType}
            options={ADD_ON_PRICING_TYPE_OPTIONS}
            placeholder="Pilih model harga"
            required
            disabled={saving}
            onChange={changeField('pricingType')}
          />
        </div>

        <PricingFields
          fieldErrors={fieldErrors}
          formValues={formValues}
          onChange={changeField}
          onDurationChange={changeDurationField}
          saving={saving}
        />
      </form>
    </Dialog>
  );
}
