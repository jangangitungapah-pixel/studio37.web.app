import { useEffect, useMemo, useState } from 'react';

import { Dialog } from '../../components/feedback/Dialog.jsx';
import { Input } from '../../components/forms/Field.jsx';
import { Select } from '../../components/forms/Select.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES } from '../pricing/pricingRules.js';
import { SESSION_TYPE_STATUSES } from '../pricing/sessionTypes.js';
import { DurationMinutesField } from './DurationMinutesField.jsx';
import { StudioScopeField } from './StudioScopeField.jsx';
import { getPackageDurationBehavior } from './durationSettings.js';
import {
  DEFAULT_DURATION_PACKAGE_FORM_VALUES,
  toDurationPackageFormValues,
  validateDurationPackageForm,
} from './durationPackageSettings.js';
import {
  PRICING_RULE_PACKAGE_EXTRA_TIME_OPTIONS,
  PRICING_RULE_ROUNDING_OPTIONS,
} from './pricingRuleSettings.js';

function getUserFacingErrors(errors) {
  const translated = {};

  if (errors.name) translated.name = 'Nama paket wajib diisi dan maksimal 100 karakter.';
  if (errors.sessionTypeId) translated.sessionTypeId = 'Pilih session type aktif yang valid.';
  if (errors.studioId) translated.studioId = 'Pilih studio scope yang valid.';
  if (errors.durationMinutes) {
    translated.durationMinutes = 'Durasi paket harus kelipatan 15 menit antara 15–1440.';
  }
  if (errors.amountIdr) translated.amountIdr = 'Harga paket harus berupa integer IDR 0 atau lebih.';
  if (errors.extraTimePolicy) translated.extraTimePolicy = 'Pilih kebijakan extra time yang valid.';
  if (errors.additionalAmountPerIncrementIdr) {
    translated.additionalAmountPerIncrementIdr =
      'Harga tambahan harus berupa integer IDR 0 atau lebih.';
  }
  if (errors.additionalIncrementMinutes) {
    translated.additionalIncrementMinutes =
      'Increment tambahan harus kelipatan 15 menit antara 15–1440.';
  }
  if (errors.roundingMode) translated.roundingMode = 'Pilih rounding tambahan yang valid.';
  if (errors.form) translated.form = 'Konfigurasi paket belum memenuhi kontrak pricing rule.';

  return translated;
}

function buildSessionOptions(sessionTypes, sourceRule) {
  return sessionTypes
    .filter(
      (sessionType) =>
        sessionType.status === SESSION_TYPE_STATUSES.ACTIVE ||
        sessionType.id === sourceRule?.sessionTypeId,
    )
    .map((sessionType) => ({
      disabled: sessionType.status !== SESSION_TYPE_STATUSES.ACTIVE,
      label: `${sessionType.name} · ${sessionType.code}${
        sessionType.status === SESSION_TYPE_STATUSES.ACTIVE ? '' : ' · nonaktif'
      }`,
      value: sessionType.id,
    }));
}

export function DurationPackageEditorDialog({
  dialogError,
  editingRule,
  initialSessionTypeId,
  onClose,
  onSubmit,
  open,
  saving,
  sessionTypes,
  studioRooms = [],
  studioScopeState = 'ready',
  templateRule,
}) {
  const [fieldErrors, setFieldErrors] = useState({});
  const [formValues, setFormValues] = useState(() => ({
    ...DEFAULT_DURATION_PACKAGE_FORM_VALUES,
  }));
  const sourceRule = editingRule ?? templateRule;

  useEffect(() => {
    if (!open) return;

    setFieldErrors({});
    setFormValues(
      editingRule
        ? toDurationPackageFormValues(editingRule)
        : {
            ...DEFAULT_DURATION_PACKAGE_FORM_VALUES,
            sessionTypeId: templateRule?.sessionTypeId ?? initialSessionTypeId ?? '',
            studioId: templateRule?.studioId ?? '',
          },
    );
  }, [editingRule, initialSessionTypeId, open, templateRule]);

  const sessionOptions = useMemo(
    () => buildSessionOptions(sessionTypes, sourceRule),
    [sessionTypes, sourceRule],
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

  const submit = (event) => {
    event.preventDefault();
    const validation = validateDurationPackageForm(formValues, { editingRule, templateRule });
    const errors = getUserFacingErrors(validation.errors);
    setFieldErrors(errors);
    if (!validation.value) return;
    onSubmit(validation.value);
  };

  const usesAdditional =
    formValues.extraTimePolicy === PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.ADDITIONAL;
  const locksEnvelope = Boolean(sourceRule);
  const durationBehavior = getPackageDurationBehavior({
    durationMinutes: formValues.durationMinutes,
    additionalIncrementMinutes: usesAdditional ? formValues.additionalIncrementMinutes : null,
  });

  return (
    <Dialog
      open={open}
      size="lg"
      title={
        editingRule ? 'Edit package' : templateRule ? 'Tambah package ke set' : 'Tambah package'
      }
      description="Kelola satu pilihan durasi tanpa menyentuh JSON pricing rule atau metadata resolusi di belakangnya."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" disabled={saving} onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" form="duration-package-editor-form" loading={saving}>
            Simpan package
          </Button>
        </>
      }
    >
      {dialogError || fieldErrors.form ? (
        <div className="settings-notice" data-tone="danger" role="alert">
          <strong>Package belum tersimpan.</strong>
          <span>{dialogError || fieldErrors.form}</span>
        </div>
      ) : null}

      <div className="settings-notice" role="status">
        <strong>Satu package = satu pricing rule.</strong>
        <span>
          Package baru dapat memakai scope general atau studio tertentu. Sibling package tetap
          mewarisi scope set agar pilihan durasi tidak pecah menjadi envelope berbeda.
        </span>
      </div>

      {locksEnvelope ? (
        <div className="settings-notice" data-tone="warning" role="status">
          <strong>Envelope package set dikunci.</strong>
          <span>
            Session, studio scope, priority, dan effective window diwarisi dari package set ini.
            Ubah metadata tersebut lewat workflow yang menjaga seluruh set, bukan satu sibling saja.
          </span>
        </div>
      ) : null}

      <form
        id="duration-package-editor-form"
        className="pricing-rule-form"
        onSubmit={submit}
        noValidate
      >
        <div className="settings-form__grid">
          <Input
            label="Nama package"
            value={formValues.name}
            error={fieldErrors.name}
            maxLength={100}
            required
            disabled={saving}
            data-autofocus="true"
            placeholder="Recording 3 jam"
            onChange={changeField('name')}
          />
          <Select
            label="Session type"
            value={formValues.sessionTypeId}
            error={fieldErrors.sessionTypeId}
            options={sessionOptions}
            placeholder="Pilih session type"
            required
            disabled={saving || locksEnvelope}
            onChange={changeField('sessionTypeId')}
          />
        </div>

        <StudioScopeField
          value={formValues.studioId}
          error={fieldErrors.studioId}
          state={studioScopeState}
          studioRooms={studioRooms}
          disabled={saving || locksEnvelope}
          onValueChange={(nextValue) => setFieldValue('studioId', nextValue)}
        />

        <div className="settings-form__grid">
          <DurationMinutesField
            label="Durasi package"
            value={formValues.durationMinutes}
            error={fieldErrors.durationMinutes}
            required
            disabled={saving}
            onValueChange={(nextValue) => setFieldValue('durationMinutes', nextValue)}
          />
          <Input
            type="number"
            label="Harga package (IDR)"
            value={formValues.amountIdr}
            error={fieldErrors.amountIdr}
            min={0}
            step={1}
            required
            disabled={saving}
            onChange={changeField('amountIdr')}
          />
        </div>

        <Select
          label="Jika melewati durasi package"
          value={formValues.extraTimePolicy}
          error={fieldErrors.extraTimePolicy}
          options={PRICING_RULE_PACKAGE_EXTRA_TIME_OPTIONS}
          required
          disabled={saving}
          onChange={changeField('extraTimePolicy')}
        />

        {usesAdditional ? (
          <div className="pricing-rule-config-panel">
            <div className="pricing-rule-config-panel__intro">
              <strong>Extra time berbayar</strong>
              <span>
                Tentukan nominal, increment, dan rounding setelah durasi package terlewati.
              </span>
            </div>
            <div className="settings-form__grid">
              <Input
                type="number"
                label="Harga tambahan / increment (IDR)"
                value={formValues.additionalAmountPerIncrementIdr}
                error={fieldErrors.additionalAmountPerIncrementIdr}
                min={0}
                step={1}
                required
                disabled={saving}
                onChange={changeField('additionalAmountPerIncrementIdr')}
              />
              <DurationMinutesField
                label="Increment tambahan"
                value={formValues.additionalIncrementMinutes}
                error={fieldErrors.additionalIncrementMinutes}
                required
                disabled={saving}
                onValueChange={(nextValue) =>
                  setFieldValue('additionalIncrementMinutes', nextValue)
                }
              />
            </div>
            <Select
              label="Rounding tambahan"
              value={formValues.roundingMode}
              error={fieldErrors.roundingMode}
              options={PRICING_RULE_ROUNDING_OPTIONS}
              required
              disabled={saving}
              onChange={changeField('roundingMode')}
            />
          </div>
        ) : null}

        {durationBehavior ? (
          <div className="duration-behavior-summary" role="status">
            <strong>Perilaku durasi package</strong>
            <span>{durationBehavior}</span>
          </div>
        ) : null}
      </form>
    </Dialog>
  );
}
