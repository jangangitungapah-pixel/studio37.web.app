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
  PRICING_RULE_MODEL_OPTIONS,
  PRICING_RULE_PACKAGE_EXTRA_TIME_OPTIONS,
  PRICING_RULE_ROUNDING_OPTIONS,
  toPricingRuleFormValues,
  validatePricingRuleForm,
} from './pricingRuleSettings.js';

function getUserFacingErrors(errors) {
  const translated = {};

  if (errors.name) translated.name = 'Nama rule wajib diisi dan maksimal 100 karakter.';
  if (errors.sessionTypeId) translated.sessionTypeId = 'Pilih session type yang valid.';
  if (errors.studioId) translated.studioId = 'Pilih studio scope yang valid.';
  if (errors.pricingModel) translated.pricingModel = 'Pilih model harga.';
  if (errors.priority) translated.priority = 'Priority harus berupa angka bulat 1–999.';
  if (errors.amountIdr) translated.amountIdr = 'Harga harus berupa integer IDR 0 atau lebih.';
  if (errors.amountPerIncrementIdr) {
    translated.amountPerIncrementIdr = 'Harga per increment harus berupa integer IDR 0 atau lebih.';
  }
  if (errors.baseAmountIdr) {
    translated.baseAmountIdr = 'Harga dasar harus berupa integer IDR 0 atau lebih.';
  }
  if (errors.additionalAmountPerIncrementIdr) {
    translated.additionalAmountPerIncrementIdr =
      'Harga waktu tambahan harus berupa integer IDR 0 atau lebih.';
  }
  if (errors.incrementMinutes) {
    translated.incrementMinutes = 'Increment harus kelipatan 15 menit antara 15–1440.';
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
    translated.additionalIncrementMinutes =
      'Increment tambahan harus kelipatan 15 menit antara 15–1440.';
  }
  if (errors.form) {
    translated.form = 'Konfigurasi belum memenuhi kontrak pricing rule. Periksa semua field.';
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
      label: `${sessionType.name} · ${sessionType.code}${
        sessionType.status === SESSION_TYPE_STATUSES.ACTIVE ? '' : ' · nonaktif'
      }`,
      value: sessionType.id,
    }));
}

function DurationBehaviorSummary({ children }) {
  if (!children) return null;

  return (
    <div className="duration-behavior-summary" role="status">
      <strong>Perilaku durasi</strong>
      <span>{children}</span>
    </div>
  );
}

function ConfigurationFields({ fieldErrors, formValues, onChange, onDurationChange, saving }) {
  if (!formValues.pricingModel) {
    return (
      <div className="pricing-rule-model-empty">
        <strong>Pilih model harga dulu.</strong>
        <span>Field konfigurasi akan mengikuti model yang dipilih, bukan raw JSON.</span>
      </div>
    );
  }

  if (formValues.pricingModel === PRICING_RULE_MODELS.FIXED_SESSION) {
    return (
      <div className="pricing-rule-config-panel">
        <div className="pricing-rule-config-panel__intro">
          <strong>Harga tetap per session</strong>
          <span>Nominal tidak berubah karena durasi booking.</span>
        </div>
        <Input
          type="number"
          label="Harga session (IDR)"
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

    return (
      <div className="pricing-rule-config-panel">
        <div className="pricing-rule-config-panel__intro">
          <strong>Per jam / increment</strong>
          <span>Harga dihitung per increment dengan minimum dan rounding eksplisit.</span>
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
            label="Increment harga"
            value={formValues.incrementMinutes}
            error={fieldErrors.incrementMinutes}
            required
            disabled={saving}
            description="Unit waktu yang dipakai untuk satu langkah penagihan."
            onValueChange={onDurationChange('incrementMinutes')}
          />
        </div>
        <div className="settings-form__grid">
          <DurationMinutesField
            label="Durasi minimum"
            value={formValues.minimumDurationMinutes}
            error={fieldErrors.minimumDurationMinutes}
            required
            disabled={saving}
            description="Booking di bawah durasi ini ditolak pricing engine."
            onValueChange={onDurationChange('minimumDurationMinutes')}
          />
          <Select
            label="Rounding"
            value={formValues.roundingMode}
            options={PRICING_RULE_ROUNDING_OPTIONS}
            required
            disabled={saving}
            onChange={onChange('roundingMode')}
          />
        </div>
        <DurationBehaviorSummary>{durationBehavior?.text}</DurationBehaviorSummary>
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
          <strong>Satu paket durasi</strong>
          <span>
            Satu pricing rule mewakili satu paket. Dedicated Package Workspace mengelola beberapa
            durasi sebagai satu set.
          </span>
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
        <Select
          label="Jika melewati durasi paket"
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
              label="Harga tambahan / increment (IDR)"
              value={formValues.additionalAmountPerIncrementIdr}
              error={fieldErrors.additionalAmountPerIncrementIdr}
              min={0}
              step={1}
              required
              disabled={saving}
              onChange={onChange('additionalAmountPerIncrementIdr')}
            />
            <DurationMinutesField
              label="Increment tambahan"
              value={formValues.additionalIncrementMinutes}
              error={fieldErrors.additionalIncrementMinutes}
              required
              disabled={saving}
              onValueChange={onDurationChange('additionalIncrementMinutes')}
            />
            <Select
              label="Rounding tambahan"
              value={formValues.roundingMode}
              options={PRICING_RULE_ROUNDING_OPTIONS}
              required
              disabled={saving}
              onChange={onChange('roundingMode')}
            />
          </div>
        ) : null}
        <DurationBehaviorSummary>{durationBehavior}</DurationBehaviorSummary>
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
        <strong>Harga dasar + waktu tambahan</strong>
        <span>Harga dasar menutup window awal; kelebihannya dihitung per increment tambahan.</span>
      </div>
      <div className="settings-form__grid">
        <DurationMinutesField
          label="Durasi dasar"
          value={formValues.baseDurationMinutes}
          error={fieldErrors.baseDurationMinutes}
          required
          disabled={saving}
          description="Window waktu yang sudah tercakup oleh harga dasar."
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
          label="Increment tambahan"
          value={formValues.additionalIncrementMinutes}
          error={fieldErrors.additionalIncrementMinutes}
          required
          disabled={saving}
          description="Unit waktu untuk setiap tagihan setelah window dasar lewat."
          onValueChange={onDurationChange('additionalIncrementMinutes')}
        />
        <Input
          type="number"
          label="Harga tambahan / increment (IDR)"
          value={formValues.additionalAmountPerIncrementIdr}
          error={fieldErrors.additionalAmountPerIncrementIdr}
          min={0}
          step={1}
          required
          disabled={saving}
          onChange={onChange('additionalAmountPerIncrementIdr')}
        />
      </div>
      <Select
        label="Rounding tambahan"
        value={formValues.roundingMode}
        options={PRICING_RULE_ROUNDING_OPTIONS}
        required
        disabled={saving}
        onChange={onChange('roundingMode')}
      />
      <DurationBehaviorSummary>{durationBehavior}</DurationBehaviorSummary>
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
    const validation = validatePricingRuleForm(formValues, { editingRule });
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
      title={editingRule ? 'Edit pricing rule' : 'Tambah pricing rule'}
      description="Kelola rule lewat field bisnis yang terbaca manusia; JSON internal tidak perlu disentuh."
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" disabled={saving} onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" form="pricing-rule-editor-form" loading={saving}>
            Simpan pricing rule
          </Button>
        </>
      }
    >
      {dialogError || fieldErrors.form ? (
        <div className="settings-notice" data-tone="danger" role="alert">
          <strong>Pricing rule belum tersimpan.</strong>
          <span>{dialogError || fieldErrors.form}</span>
        </div>
      ) : null}

      <div className="settings-notice" role="status">
        <strong>Studio scope 5B5 aktif.</strong>
        <span>
          Scope general berlaku ke semua studio. Scope studio tertentu menang atas general setelah
          session dan effective-time eligibility cocok; priority baru dibandingkan di dalam scope
          yang terpilih.
        </span>
      </div>

      {preservesEffectiveMetadata ? (
        <div className="settings-notice" data-tone="warning" role="status">
          <strong>Effective window dipertahankan.</strong>
          <span>
            Rule ini sudah memiliki effective window. 5B5 tidak mengubah tanggal tersebut; workflow
            effective-period tetap checkpoint terpisah.
          </span>
        </div>
      ) : null}

      <form
        id="pricing-rule-editor-form"
        className="pricing-rule-form"
        onSubmit={submit}
        noValidate
      >
        <div className="settings-form__grid">
          <Input
            label="Nama pricing rule"
            value={formValues.name}
            error={fieldErrors.name}
            maxLength={100}
            required
            disabled={saving}
            data-autofocus="true"
            placeholder="Rehearsal reguler"
            onChange={changeField('name')}
          />
          <Input
            type="number"
            label="Priority"
            value={formValues.priority}
            error={fieldErrors.priority}
            min={1}
            max={999}
            step={1}
            required
            disabled={saving}
            description="Angka lebih besar menang setelah studio scope cocok."
            onChange={changeField('priority')}
          />
        </div>

        <div className="settings-form__grid">
          <Select
            label="Session type"
            value={formValues.sessionTypeId}
            error={fieldErrors.sessionTypeId}
            options={sessionOptions}
            placeholder="Pilih session type"
            required
            disabled={saving}
            onChange={changeField('sessionTypeId')}
          />
          <Select
            label="Model harga"
            value={formValues.pricingModel}
            error={fieldErrors.pricingModel}
            options={PRICING_RULE_MODEL_OPTIONS}
            placeholder="Pilih model harga"
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
      </form>
    </Dialog>
  );
}
