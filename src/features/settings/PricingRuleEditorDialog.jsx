import { useEffect, useMemo, useState } from 'react';

import { Dialog } from '../../components/feedback/Dialog.jsx';
import { Input } from '../../components/forms/Field.jsx';
import { Select } from '../../components/forms/Select.jsx';
import { Button } from '../../components/ui/Button.jsx';
import {
  PRICING_RULE_MODELS,
  PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES,
} from '../pricing/pricingRules.js';
import { SESSION_TYPE_STATUSES } from '../pricing/sessionTypes.js';
import { DurationMinutesField } from './DurationMinutesField.jsx';
import { StudioScopeField } from './StudioScopeField.jsx';
import {
  getBaseAdditionalDurationBehavior,
  getHourlyDurationBehavior,
  getPackageDurationBehavior,
} from './durationSettings.js';
import {
  DEFAULT_PRICING_RULE_FORM_VALUES,
  PRICING_RULE_PACKAGE_EXTRA_TIME_OPTIONS,
  PRICING_RULE_ROUNDING_OPTIONS,
  toPricingRuleFormValues,
  validatePricingRuleForm,
} from './pricingRuleSettings.js';

const SIMPLE_PRICING_MODEL_OPTIONS = Object.freeze([
  Object.freeze({ label: 'Per jam', value: PRICING_RULE_MODELS.HOURLY }),
  Object.freeze({ label: 'Harga tetap', value: PRICING_RULE_MODELS.FIXED_SESSION }),
  Object.freeze({ label: 'Paket durasi', value: PRICING_RULE_MODELS.DURATION_PACKAGE }),
  Object.freeze({
    label: 'Harga dasar + tambahan',
    value: PRICING_RULE_MODELS.BASE_PLUS_ADDITIONAL,
  }),
]);

function getUserFacingErrors(errors) {
  const translated = {};

  if (errors.name) translated.name = 'Nama pengaturan maksimal 100 karakter.';
  if (errors.sessionTypeId) translated.sessionTypeId = 'Pilih layanan yang valid.';
  if (errors.studioId) translated.studioId = 'Pilih studio yang valid.';
  if (errors.pricingModel) translated.pricingModel = 'Pilih cara menghitung harga.';
  if (errors.priority) translated.priority = 'Prioritas harus berupa angka bulat 1–999.';
  if (errors.amountIdr) translated.amountIdr = 'Harga harus berupa angka rupiah 0 atau lebih.';
  if (errors.amountPerIncrementIdr) {
    translated.amountPerIncrementIdr = 'Harga harus berupa angka rupiah 0 atau lebih.';
  }
  if (errors.baseAmountIdr) {
    translated.baseAmountIdr = 'Harga dasar harus berupa angka rupiah 0 atau lebih.';
  }
  if (errors.additionalAmountPerIncrementIdr) {
    translated.additionalAmountPerIncrementIdr = 'Harga tambahan harus berupa angka rupiah 0 atau lebih.';
  }
  if (errors.incrementMinutes) {
    translated.incrementMinutes = 'Interval harga harus kelipatan 15 menit antara 15–1440.';
  }
  if (errors.minimumDurationMinutes) {
    translated.minimumDurationMinutes = 'Durasi minimum harus kelipatan 15 menit antara 15–1440.';
  }
  if (errors.durationMinutes) {
    translated.durationMinutes = 'Durasi paket harus kelipatan 15 menit antara 15–1440.';
  }
  if (errors.baseDurationMinutes) {
    translated.baseDurationMinutes = 'Durasi dasar harus kelipatan 15 menit antara 15–1440.';
  }
  if (errors.additionalIncrementMinutes) {
    translated.additionalIncrementMinutes = 'Interval tambahan harus kelipatan 15 menit antara 15–1440.';
  }
  if (errors.form) {
    translated.form = 'Masih ada pengaturan yang belum valid. Periksa field yang ditandai.';
  }

  return translated;
}

function buildSessionOptions(sessionTypes, editingRule) {
  return sessionTypes
    .filter(
      (sessionType) =>
        sessionType.status === SESSION_TYPE_STATUSES.ACTIVE ||
        sessionType.id === editingRule?.sessionTypeId,
    )
    .map((sessionType) => ({
      disabled: sessionType.status !== SESSION_TYPE_STATUSES.ACTIVE,
      label: `${sessionType.name}${
        sessionType.status === SESSION_TYPE_STATUSES.ACTIVE ? '' : ' · nonaktif'
      }`,
      value: sessionType.id,
    }));
}

function DurationBehaviorSummary({ children }) {
  if (!children) return null;

  return (
    <div className="duration-behavior-summary" role="status">
      <strong>Ringkasan</strong>
      <span>{children}</span>
    </div>
  );
}

function AdvancedPricingFields({ children }) {
  return (
    <details className="pricing-advanced pricing-rule-editor-advanced">
      <summary>Pengaturan lanjutan</summary>
      <div className="pricing-advanced__content">{children}</div>
    </details>
  );
}

function ConfigurationFields({ fieldErrors, formValues, onChange, onDurationChange, saving }) {
  if (!formValues.pricingModel) {
    return (
      <div className="pricing-rule-model-empty">
        <strong>Pilih cara menghitung harga.</strong>
        <span>Field yang dibutuhkan akan muncul otomatis.</span>
      </div>
    );
  }

  if (formValues.pricingModel === PRICING_RULE_MODELS.FIXED_SESSION) {
    return (
      <div className="pricing-rule-config-panel">
        <div className="pricing-rule-config-panel__intro">
          <strong>Harga tetap</strong>
          <span>Nominal tetap sama berapa pun durasi booking.</span>
        </div>
        <Input
          type="number"
          label="Harga (IDR)"
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

  if (formValues.pricingModel === PRICING_RULE_MODELS.HOURLY) {
    const durationBehavior = getHourlyDurationBehavior({
      incrementMinutes: formValues.incrementMinutes,
      minimumDurationMinutes: formValues.minimumDurationMinutes,
      roundingMode: formValues.roundingMode,
    });
    const unitLabel =
      formValues.incrementMinutes === '60'
        ? 'Harga per jam (IDR)'
        : `Harga per ${formValues.incrementMinutes || 'interval'} menit (IDR)`;

    return (
      <div className="pricing-rule-config-panel">
        <div className="pricing-rule-config-panel__intro">
          <strong>Harga per jam</strong>
          <span>Masukkan harga utama dan minimum durasi booking.</span>
        </div>
        <div className="settings-form__grid">
          <Input
            type="number"
            label={unitLabel}
            value={formValues.amountPerIncrementIdr}
            error={fieldErrors.amountPerIncrementIdr}
            min={0}
            step={1}
            required
            disabled={saving}
            onChange={onChange('amountPerIncrementIdr')}
          />
          <DurationMinutesField
            label="Minimum booking"
            value={formValues.minimumDurationMinutes}
            error={fieldErrors.minimumDurationMinutes}
            required
            disabled={saving}
            description="Durasi minimum yang boleh dipilih customer."
            onValueChange={onDurationChange('minimumDurationMinutes')}
          />
        </div>
        <DurationBehaviorSummary>{durationBehavior?.text}</DurationBehaviorSummary>
        <AdvancedPricingFields>
          <div className="settings-form__grid">
            <DurationMinutesField
              label="Interval perhitungan"
              value={formValues.incrementMinutes}
              error={fieldErrors.incrementMinutes}
              required
              disabled={saving}
              description="Default 60 menit untuk harga per jam."
              onValueChange={onDurationChange('incrementMinutes')}
            />
            <Select
              label="Pembulatan durasi"
              value={formValues.roundingMode}
              options={PRICING_RULE_ROUNDING_OPTIONS}
              required
              disabled={saving}
              onChange={onChange('roundingMode')}
            />
          </div>
        </AdvancedPricingFields>
      </div>
    );
  }

  if (formValues.pricingModel === PRICING_RULE_MODELS.DURATION_PACKAGE) {
    const usesAdditional =
      formValues.extraTimePolicy === PRICING_RULE_PACKAGE_EXTRA_TIME_POLICIES.ADDITIONAL;
    const durationBehavior = getPackageDurationBehavior({
      durationMinutes: formValues.durationMinutes,
      additionalIncrementMinutes: usesAdditional ? formValues.additionalIncrementMinutes : null,
    });

    return (
      <div className="pricing-rule-config-panel">
        <div className="pricing-rule-config-panel__intro">
          <strong>Paket durasi</strong>
          <span>Contoh: 3 jam Rp400.000.</span>
        </div>
        <div className="settings-form__grid">
          <DurationMinutesField
            label="Durasi paket"
            value={formValues.durationMinutes}
            error={fieldErrors.durationMinutes}
            required
            disabled={saving}
            onValueChange={onDurationChange('durationMinutes')}
          />
          <Input
            type="number"
            label="Harga paket (IDR)"
            value={formValues.amountIdr}
            error={fieldErrors.amountIdr}
            min={0}
            step={1}
            required
            disabled={saving}
            onChange={onChange('amountIdr')}
          />
        </div>
        <DurationBehaviorSummary>{durationBehavior}</DurationBehaviorSummary>
        <AdvancedPricingFields>
          <Select
            label="Jika durasi melebihi paket"
            value={formValues.extraTimePolicy}
            options={PRICING_RULE_PACKAGE_EXTRA_TIME_OPTIONS}
            required
            disabled={saving}
            onChange={onChange('extraTimePolicy')}
          />
          {usesAdditional ? (
            <div className="settings-form__grid">
              <Input
                type="number"
                label="Harga tambahan (IDR)"
                value={formValues.additionalAmountPerIncrementIdr}
                error={fieldErrors.additionalAmountPerIncrementIdr}
                min={0}
                step={1}
                required
                disabled={saving}
                onChange={onChange('additionalAmountPerIncrementIdr')}
              />
              <DurationMinutesField
                label="Interval tambahan"
                value={formValues.additionalIncrementMinutes}
                error={fieldErrors.additionalIncrementMinutes}
                required
                disabled={saving}
                onValueChange={onDurationChange('additionalIncrementMinutes')}
              />
              <Select
                label="Pembulatan tambahan"
                value={formValues.roundingMode}
                options={PRICING_RULE_ROUNDING_OPTIONS}
                required
                disabled={saving}
                onChange={onChange('roundingMode')}
              />
            </div>
          ) : null}
        </AdvancedPricingFields>
      </div>
    );
  }

  const durationBehavior = getBaseAdditionalDurationBehavior({
    additionalIncrementMinutes: formValues.additionalIncrementMinutes,
    baseDurationMinutes: formValues.baseDurationMinutes,
  });

  return (
    <div className="pricing-rule-config-panel">
      <div className="pricing-rule-config-panel__intro">
        <strong>Harga dasar + tambahan</strong>
        <span>Contoh: Rp200.000 termasuk 1 jam, lalu Rp100.000 per jam berikutnya.</span>
      </div>
      <div className="settings-form__grid">
        <DurationMinutesField
          label="Durasi yang sudah termasuk"
          value={formValues.baseDurationMinutes}
          error={fieldErrors.baseDurationMinutes}
          required
          disabled={saving}
          onValueChange={onDurationChange('baseDurationMinutes')}
        />
        <Input
          type="number"
          label="Harga dasar (IDR)"
          value={formValues.baseAmountIdr}
          error={fieldErrors.baseAmountIdr}
          min={0}
          step={1}
          required
          disabled={saving}
          onChange={onChange('baseAmountIdr')}
        />
      </div>
      <div className="settings-form__grid">
        <DurationMinutesField
          label="Interval waktu tambahan"
          value={formValues.additionalIncrementMinutes}
          error={fieldErrors.additionalIncrementMinutes}
          required
          disabled={saving}
          onValueChange={onDurationChange('additionalIncrementMinutes')}
        />
        <Input
          type="number"
          label="Harga waktu tambahan (IDR)"
          value={formValues.additionalAmountPerIncrementIdr}
          error={fieldErrors.additionalAmountPerIncrementIdr}
          min={0}
          step={1}
          required
          disabled={saving}
          onChange={onChange('additionalAmountPerIncrementIdr')}
        />
      </div>
      <DurationBehaviorSummary>{durationBehavior}</DurationBehaviorSummary>
      <AdvancedPricingFields>
        <Select
          label="Pembulatan waktu tambahan"
          value={formValues.roundingMode}
          options={PRICING_RULE_ROUNDING_OPTIONS}
          required
          disabled={saving}
          onChange={onChange('roundingMode')}
        />
      </AdvancedPricingFields>
    </div>
  );
}

export function PricingRuleEditorDialog({
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
}) {
  const [fieldErrors, setFieldErrors] = useState({});
  const [formValues, setFormValues] = useState(() => ({ ...DEFAULT_PRICING_RULE_FORM_VALUES }));

  useEffect(() => {
    if (!open) return;

    setFieldErrors({});
    setFormValues(
      editingRule
        ? toPricingRuleFormValues(editingRule)
        : {
            ...DEFAULT_PRICING_RULE_FORM_VALUES,
            sessionTypeId: initialSessionTypeId ?? '',
          },
    );
  }, [editingRule, initialSessionTypeId, open]);

  const sessionOptions = useMemo(
    () => buildSessionOptions(sessionTypes, editingRule),
    [editingRule, sessionTypes],
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
    const sessionType = sessionTypes.find((item) => item.id === formValues.sessionTypeId);
    const pricingModel = SIMPLE_PRICING_MODEL_OPTIONS.find(
      (option) => option.value === formValues.pricingModel,
    );
    const submissionValues = {
      ...formValues,
      name:
        formValues.name.trim() ||
        `${sessionType?.name ?? 'Harga'} · ${pricingModel?.label ?? 'Pengaturan'}`,
    };
    const validation = validatePricingRuleForm(submissionValues, { editingRule });
    const errors = getUserFacingErrors(validation.errors);
    setFieldErrors(errors);
    if (!validation.value) return;
    onSubmit(validation.value);
  };

  const preservesEffectiveMetadata = Boolean(
    editingRule && (editingRule.effectiveFrom !== null || editingRule.effectiveUntil !== null),
  );

  return (
    <Dialog
      open={open}
      size="lg"
      title={editingRule ? 'Edit harga' : 'Atur harga'}
      description="Pilih layanan, cara menghitung harga, lalu isi nominal yang dibutuhkan."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" disabled={saving} onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" form="pricing-rule-editor-form" loading={saving}>
            Simpan harga
          </Button>
        </>
      }
    >
      {dialogError || fieldErrors.form ? (
        <div className="settings-notice" data-tone="danger" role="alert">
          <strong>Harga belum tersimpan.</strong>
          <span>{dialogError || fieldErrors.form}</span>
        </div>
      ) : null}

      <form
        id="pricing-rule-editor-form"
        className="pricing-rule-form"
        onSubmit={submit}
        noValidate
      >
        <div className="settings-form__grid">
          <Select
            label="Layanan"
            value={formValues.sessionTypeId}
            error={fieldErrors.sessionTypeId}
            options={sessionOptions}
            placeholder="Pilih layanan"
            required
            disabled={saving}
            onChange={changeField('sessionTypeId')}
          />
          <Select
            label="Cara menghitung harga"
            value={formValues.pricingModel}
            error={fieldErrors.pricingModel}
            options={SIMPLE_PRICING_MODEL_OPTIONS}
            placeholder="Pilih cara menghitung"
            required
            disabled={saving}
            onChange={changeField('pricingModel')}
          />
        </div>

        <StudioScopeField
          value={formValues.studioId}
          error={fieldErrors.studioId}
          state={studioScopeState}
          studioRooms={studioRooms}
          disabled={saving}
          onValueChange={(nextValue) => setFieldValue('studioId', nextValue)}
        />

        <ConfigurationFields
          fieldErrors={fieldErrors}
          formValues={formValues}
          onChange={changeField}
          onDurationChange={changeDurationField}
          saving={saving}
        />

        <details className="pricing-advanced pricing-rule-editor-advanced">
          <summary>Detail pengaturan</summary>
          <div className="pricing-advanced__content">
            <div className="settings-form__grid">
              <Input
                label="Nama pengaturan (opsional)"
                value={formValues.name}
                error={fieldErrors.name}
                maxLength={100}
                disabled={saving}
                placeholder="Dibuat otomatis jika dikosongkan"
                description="Kosongkan agar sistem membuat nama dari layanan dan cara harga."
                onChange={changeField('name')}
              />
              <Input
                type="number"
                label="Prioritas"
                value={formValues.priority}
                error={fieldErrors.priority}
                min={1}
                max={999}
                step={1}
                required
                disabled={saving}
                description="Biarkan 100 kecuali memang ada beberapa harga yang saling tumpang tindih."
                onChange={changeField('priority')}
              />
            </div>

            {preservesEffectiveMetadata ? (
              <div className="settings-notice" data-tone="warning" role="status">
                <strong>Periode harga khusus tetap dipertahankan.</strong>
                <span>Editor sederhana ini tidak mengubah tanggal mulai atau berakhir yang sudah ada.</span>
              </div>
            ) : null}
          </div>
        </details>
      </form>
    </Dialog>
  );
}
