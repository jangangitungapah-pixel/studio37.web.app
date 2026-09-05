import { useEffect, useMemo, useState } from 'react';

import { Badge } from '../../components/feedback/Badge.jsx';
import { Input } from '../../components/forms/Field.jsx';
import { Select } from '../../components/forms/Select.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { formatIntegerIdr } from '../../lib/money/idr.js';
import { addOnRepository } from '../../services/addOnRepository.js';
import { pricingRuleRepository } from '../../services/pricingRuleRepository.js';
import { studioRoomRepository } from '../../services/studioRoomRepository.js';
import { CAPABILITIES, hasCapability } from '../auth/capabilities.js';
import { ADD_ON_PRICING_TYPES } from '../pricing/addOnPricing.js';
import { ADD_ON_STATUSES } from '../pricing/addOns.js';
import { buildPricingPreview } from '../pricing/pricingPreview.js';
import {
  PRICING_RULE_MODELS,
  PRICING_RULE_ROUNDING_MODES,
  PRICING_RULE_STATUSES,
} from '../pricing/pricingRules.js';
import { DurationMinutesField } from './DurationMinutesField.jsx';
import { formatAddOnPricingSummary } from './addOnSettings.js';
import {
  formatPricingRuleConfigurationSummary,
  getPricingRuleModelLabel,
} from './pricingRuleSettings.js';
import { formatStudioScopeLabel } from './studioScopeSettings.js';

function getDefaultDurationMinutes(rule) {
  if (!rule || rule.pricingModel === PRICING_RULE_MODELS.FIXED_SESSION) {
    return '';
  }

  if (rule.pricingModel === PRICING_RULE_MODELS.DURATION_PACKAGE) {
    return String(rule.configuration.durationMinutes);
  }

  if (rule.pricingModel === PRICING_RULE_MODELS.BASE_PLUS_ADDITIONAL) {
    return String(rule.configuration.baseDurationMinutes);
  }

  const { incrementMinutes, minimumDurationMinutes, roundingMode } = rule.configuration;
  if (roundingMode === PRICING_RULE_ROUNDING_MODES.EXACT) {
    return String(Math.ceil(minimumDurationMinutes / incrementMinutes) * incrementMinutes);
  }

  return String(minimumDurationMinutes);
}

function getSafeLoadMessage(error) {
  if (error?.code === 'permission-denied') {
    return 'Akun ini tidak memiliki izin membaca data yang dibutuhkan untuk simulasi harga.';
  }
  if (error?.code === 'unavailable') {
    return 'Data harga sedang tidak tersedia. Coba lagi setelah koneksi pulih.';
  }
  return 'Simulasi harga belum bisa dimuat. Coba lagi tanpa mengubah pengaturan yang sudah ada.';
}

function getPreviewErrorMessage(error) {
  const message = String(error?.message ?? '');

  if (message.includes('minimum duration')) {
    return 'Durasi masih di bawah minimum booking untuk harga ini.';
  }
  if (message.includes('must align') || message.includes('align with')) {
    return 'Durasi belum sesuai dengan interval waktu yang dipakai harga ini.';
  }
  if (message.includes('extra time is blocked')) {
    return 'Durasi melebihi batas paket ini.';
  }
  if (message.includes('requires another package')) {
    return 'Durasi ini membutuhkan paket lain.';
  }
  if (message.includes('not available for the selected pricing-rule session')) {
    return 'Layanan tambahan tersebut tidak tersedia untuk layanan yang dipilih.';
  }
  if (message.includes('quantity')) {
    return 'Jumlah layanan tambahan harus lebih dari nol.';
  }
  if (message.includes('durationMinutes')) {
    return 'Durasi yang dipilih belum valid untuk harga ini.';
  }

  return 'Input simulasi belum sesuai dengan pengaturan harga yang dipilih.';
}

function getBaseBreakdown(preview) {
  const calculation = preview.baseCalculation;

  if (preview.pricingModel === PRICING_RULE_MODELS.HOURLY) {
    return [
      {
        amountIdr: calculation.totalAmountIdr,
        detail:
          `${calculation.inputDurationMinutes} mnt dipilih · ` +
          `${calculation.billableDurationMinutes} mnt dihitung`,
        label: 'Harga layanan',
      },
    ];
  }

  if (preview.pricingModel === PRICING_RULE_MODELS.FIXED_SESSION) {
    return [
      {
        amountIdr: calculation.totalAmountIdr,
        detail: 'Harga tetap untuk satu booking.',
        label: 'Harga layanan',
      },
    ];
  }

  if (preview.pricingModel === PRICING_RULE_MODELS.DURATION_PACKAGE) {
    const lines = [
      {
        amountIdr: calculation.packageAmountIdr,
        detail: `${calculation.packageDurationMinutes} menit`,
        label: 'Harga paket',
      },
    ];

    if (calculation.additionalAmountIdr > 0) {
      lines.push({
        amountIdr: calculation.additionalAmountIdr,
        detail: `${calculation.billedAdditionalDurationMinutes} menit tambahan`,
        label: 'Waktu tambahan',
      });
    }

    return lines;
  }

  const lines = [
    {
      amountIdr: calculation.baseAmountIdr,
      detail: `${calculation.baseDurationMinutes} menit pertama`,
      label: 'Harga dasar',
    },
  ];

  if (calculation.additionalAmountIdr > 0) {
    lines.push({
      amountIdr: calculation.additionalAmountIdr,
      detail: `${calculation.billedAdditionalDurationMinutes} menit tambahan`,
      label: 'Waktu tambahan',
    });
  }

  return lines;
}

function getAddOnDetail(item) {
  if (item.pricingType === ADD_ON_PRICING_TYPES.FIXED) {
    return 'Dipilih 1 kali';
  }
  if (item.pricingType === ADD_ON_PRICING_TYPES.QUANTITY) {
    return `${item.quantity} × ${formatIntegerIdr(item.unitAmountIdr)}`;
  }
  return `${item.billedDurationMinutes} menit`;
}

function PricingPreviewRuleCard({ rule, sessionType, studioLoadState, studioRooms }) {
  const active = rule.status === PRICING_RULE_STATUSES.ACTIVE;

  return (
    <>
      <div className="pricing-preview__rule-card">
        <div className="pricing-preview__rule-heading">
          <div>
            <strong>{sessionType?.name ?? rule.name}</strong>
            <span>{formatPricingRuleConfigurationSummary(rule)}</span>
          </div>
          <Badge tone={active ? 'success' : 'neutral'}>{active ? 'Aktif' : 'Nonaktif'}</Badge>
        </div>

        <dl className="pricing-preview__facts">
          <div>
            <dt>Layanan</dt>
            <dd>{sessionType?.name ?? 'Layanan'}</dd>
          </div>
          <div>
            <dt>Berlaku untuk</dt>
            <dd>{formatStudioScopeLabel(rule.studioId, studioRooms)}</dd>
          </div>
        </dl>

        {rule.studioId !== null && studioLoadState !== 'ready' ? (
          <small>Nama studio belum tersedia, tetapi simulasi tetap memakai studio yang tersimpan.</small>
        ) : null}
      </div>

      {!active ? (
        <div className="settings-notice" data-tone="warning" role="status">
          <strong>Harga ini sedang nonaktif.</strong>
          <span>Simulasi tetap boleh dipakai untuk mengecek hasil sebelum harga diaktifkan.</span>
        </div>
      ) : null}
    </>
  );
}

function PricingPreviewAddOn({ addOn, input, onFieldChange, onToggle }) {
  const selected = Boolean(input?.selected);
  const inactive = addOn.status !== ADD_ON_STATUSES.ACTIVE;

  return (
    <div className="pricing-preview__addon" data-disabled={inactive || undefined}>
      <label className="price-session-switch">
        <input
          type="checkbox"
          checked={selected}
          aria-label={`Pilih tambahan ${addOn.name}`}
          onChange={onToggle}
        />
        <span>
          <strong>
            {addOn.name}
            {inactive ? ' · nonaktif' : ''}
          </strong>
          <small>{formatAddOnPricingSummary(addOn)}</small>
        </span>
      </label>

      {selected && addOn.pricingType === ADD_ON_PRICING_TYPES.QUANTITY ? (
        <Input
          type="number"
          label={`Jumlah ${addOn.name}`}
          value={input?.quantity ?? '1'}
          min={1}
          step={1}
          required
          onChange={(event) => onFieldChange('quantity', event.target.value)}
        />
      ) : null}

      {selected && addOn.pricingType === ADD_ON_PRICING_TYPES.TIME ? (
        <DurationMinutesField
          label={`Durasi ${addOn.name}`}
          value={input?.durationMinutes ?? ''}
          required
          description="Masukkan durasi layanan tambahan untuk simulasi ini."
          onValueChange={(value) => onFieldChange('durationMinutes', value)}
        />
      ) : null}
    </div>
  );
}

function PricingPreviewResult({ addOnById, error, preview }) {
  if (error) {
    return (
      <div className="settings-notice" data-tone="warning" role="status">
        <strong>Harga belum dapat dihitung.</strong>
        <span>{error}</span>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="pricing-preview__placeholder">
        <strong>Pilih harga untuk mulai simulasi.</strong>
        <span>Perkiraan total akan muncul di sini.</span>
      </div>
    );
  }

  return (
    <>
      <div className="pricing-preview__total">
        <span>Perkiraan total</span>
        <strong>{formatIntegerIdr(preview.totalAmountIdr)}</strong>
      </div>

      <div className="pricing-preview__breakdown" aria-label="Rincian harga">
        {getBaseBreakdown(preview).map((line) => (
          <div className="pricing-preview__line" key={`${line.label}-${line.amountIdr}`}>
            <div>
              <strong>{line.label}</strong>
              <span>{line.detail}</span>
            </div>
            <b>{formatIntegerIdr(line.amountIdr)}</b>
          </div>
        ))}

        {preview.addOnCalculation.items.map((item) => {
          const addOn = addOnById.get(item.addOnId);
          return (
            <div className="pricing-preview__line" key={item.addOnId}>
              <div>
                <strong>Tambahan · {addOn?.name ?? item.addOnId}</strong>
                <span>{getAddOnDetail(item)}</span>
              </div>
              <b>{formatIntegerIdr(item.totalAmountIdr)}</b>
            </div>
          );
        })}
      </div>

      <div className="pricing-preview__footnote">
        <strong>Hasil simulasi saja.</strong>
        <span>Simulasi ini tidak membuat booking dan tidak mengubah pengaturan harga.</span>
      </div>
    </>
  );
}

export function PricingPreviewSection({
  access,
  addOnsRepository = addOnRepository,
  pricingRulesRepository = pricingRuleRepository,
  sessionTypes,
  studioRoomsRepository = studioRoomRepository,
}) {
  const [addOns, setAddOns] = useState([]);
  const [durationMinutes, setDurationMinutes] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loadState, setLoadState] = useState('loading');
  const [pricingRules, setPricingRules] = useState([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedAddOns, setSelectedAddOns] = useState({});
  const [selectedRuleId, setSelectedRuleId] = useState('');
  const [studioLoadState, setStudioLoadState] = useState('loading');
  const [studioRooms, setStudioRooms] = useState([]);

  const canViewStudios = hasCapability(access, CAPABILITIES.SETTINGS_STUDIO_VIEW);

  useEffect(() => {
    let active = true;
    setLoadError('');
    setLoadState('loading');

    Promise.all([pricingRulesRepository.listPricingRules(), addOnsRepository.listAddOns()])
      .then(([nextRules, nextAddOns]) => {
        if (!active) return;
        setPricingRules([...nextRules]);
        setAddOns([...nextAddOns]);
        setLoadState('ready');
      })
      .catch((error) => {
        if (!active) return;
        setPricingRules([]);
        setAddOns([]);
        setLoadError(getSafeLoadMessage(error));
        setLoadState('error');
      });

    return () => {
      active = false;
    };
  }, [addOnsRepository, pricingRulesRepository, reloadKey]);

  useEffect(() => {
    let active = true;

    if (!canViewStudios) {
      setStudioRooms([]);
      setStudioLoadState('unavailable');
      return () => {
        active = false;
      };
    }

    setStudioLoadState('loading');
    studioRoomsRepository
      .listStudioRooms()
      .then((nextRooms) => {
        if (!active) return;
        setStudioRooms([...nextRooms]);
        setStudioLoadState('ready');
      })
      .catch(() => {
        if (!active) return;
        setStudioRooms([]);
        setStudioLoadState('error');
      });

    return () => {
      active = false;
    };
  }, [canViewStudios, reloadKey, studioRoomsRepository]);

  const selectedRule = useMemo(
    () => pricingRules.find((rule) => rule.id === selectedRuleId) ?? null,
    [pricingRules, selectedRuleId],
  );
  const sessionTypeById = useMemo(
    () => new Map(sessionTypes.map((sessionType) => [sessionType.id, sessionType])),
    [sessionTypes],
  );
  const addOnById = useMemo(() => new Map(addOns.map((addOn) => [addOn.id, addOn])), [addOns]);
  const applicableAddOns = useMemo(
    () =>
      selectedRule
        ? addOns.filter(
            (addOn) =>
              addOn.sessionTypeId === null || addOn.sessionTypeId === selectedRule.sessionTypeId,
          )
        : [],
    [addOns, selectedRule],
  );
  const ruleOptions = useMemo(
    () =>
      pricingRules.map((rule) => {
        const sessionType = sessionTypeById.get(rule.sessionTypeId);
        return {
          label:
            `${sessionType?.name ?? rule.name} · ${getPricingRuleModelLabel(rule.pricingModel)} · ` +
            `${rule.status === PRICING_RULE_STATUSES.ACTIVE ? 'aktif' : 'nonaktif'}`,
          value: rule.id,
        };
      }),
    [pricingRules, sessionTypeById],
  );

  useEffect(() => {
    if (selectedRuleId && !pricingRules.some((rule) => rule.id === selectedRuleId)) {
      setSelectedRuleId('');
    }
  }, [pricingRules, selectedRuleId]);

  useEffect(() => {
    setDurationMinutes(getDefaultDurationMinutes(selectedRule));
    setSelectedAddOns({});
  }, [selectedRule]);

  const previewState = useMemo(() => {
    if (!selectedRule) return { error: null, value: null };

    try {
      const addOnSelections = applicableAddOns
        .filter((addOn) => selectedAddOns[addOn.id]?.selected)
        .map((addOn) => {
          const input = selectedAddOns[addOn.id];
          return {
            addOn,
            durationMinutes:
              addOn.pricingType === ADD_ON_PRICING_TYPES.TIME
                ? Number(input.durationMinutes)
                : null,
            quantity:
              addOn.pricingType === ADD_ON_PRICING_TYPES.QUANTITY ? Number(input.quantity) : null,
          };
        });

      return {
        error: null,
        value: buildPricingPreview({
          addOns: addOnSelections,
          durationMinutes:
            selectedRule.pricingModel === PRICING_RULE_MODELS.FIXED_SESSION
              ? null
              : Number(durationMinutes),
          pricingRule: selectedRule,
        }),
      };
    } catch (error) {
      return { error: getPreviewErrorMessage(error), value: null };
    }
  }, [applicableAddOns, durationMinutes, selectedAddOns, selectedRule]);

  const toggleAddOn = (addOn) => {
    setSelectedAddOns((current) => {
      const existing = current[addOn.id];
      if (existing?.selected) {
        return { ...current, [addOn.id]: { ...existing, selected: false } };
      }

      return {
        ...current,
        [addOn.id]: {
          durationMinutes:
            addOn.pricingType === ADD_ON_PRICING_TYPES.TIME
              ? durationMinutes || String(addOn.configuration.incrementMinutes)
              : '',
          quantity: addOn.pricingType === ADD_ON_PRICING_TYPES.QUANTITY ? '1' : '',
          selected: true,
        },
      };
    });
  };

  const setAddOnField = (addOnId, fieldName, value) => {
    setSelectedAddOns((current) => ({
      ...current,
      [addOnId]: {
        ...current[addOnId],
        [fieldName]: value,
      },
    }));
  };

  const sessionType = selectedRule ? sessionTypeById.get(selectedRule.sessionTypeId) : null;

  return (
    <section className="settings-card pricing-preview" aria-labelledby="pricing-preview-heading">
      <header className="settings-card__header settings-card__header--with-action">
        <div>
          <p className="settings-card__eyebrow">Simulasi</p>
          <h2 id="pricing-preview-heading">Coba hitung harga</h2>
          <p className="settings-card__subtitle">
            Pilih harga, ubah durasi, tambahkan layanan ekstra, lalu lihat perkiraan total sebelum
            dipakai pada booking.
          </p>
        </div>
        <Badge tone="brand">Simulasi</Badge>
      </header>

      {loadState === 'loading' ? (
        <div
          className="settings-state settings-state--embedded"
          aria-busy="true"
          aria-live="polite"
        >
          <span className="settings-state__spinner" aria-hidden="true" />
          <div>
            <p className="settings-state__title">Menyiapkan simulasi harga</p>
            <p className="settings-state__description">Memuat harga dan layanan tambahan.</p>
          </div>
        </div>
      ) : null}

      {loadState === 'error' ? (
        <div className="settings-state settings-state--embedded" data-tone="danger" role="alert">
          <div>
            <p className="settings-state__title">Simulasi harga belum tersedia</p>
            <p className="settings-state__description">{loadError}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => setReloadKey((value) => value + 1)}>
            Coba lagi
          </Button>
        </div>
      ) : null}

      {loadState === 'ready' && pricingRules.length === 0 ? (
        <div className="price-session-empty">
          <span className="settings-placeholder__dot" aria-hidden="true" />
          <div>
            <p className="settings-placeholder__title">Belum ada harga untuk dicoba</p>
            <p className="settings-placeholder__description">
              Atur harga layanan terlebih dahulu, lalu kembali ke simulasi ini.
            </p>
          </div>
        </div>
      ) : null}

      {loadState === 'ready' && pricingRules.length > 0 ? (
        <div className="pricing-preview__workspace">
          <div className="pricing-preview__controls">
            <Select
              label="Harga yang ingin dicoba"
              value={selectedRuleId}
              options={ruleOptions}
              placeholder="Pilih harga"
              description="Harga nonaktif tetap dapat dicoba sebelum diaktifkan."
              onChange={(event) => setSelectedRuleId(event.target.value)}
            />

            {selectedRule ? (
              <PricingPreviewRuleCard
                rule={selectedRule}
                sessionType={sessionType}
                studioLoadState={studioLoadState}
                studioRooms={studioRooms}
              />
            ) : null}

            {selectedRule && selectedRule.pricingModel !== PRICING_RULE_MODELS.FIXED_SESSION ? (
              <DurationMinutesField
                label="Contoh durasi booking"
                value={durationMinutes}
                required
                description="Ubah durasi untuk melihat perkiraan total."
                onValueChange={setDurationMinutes}
              />
            ) : null}

            {selectedRule ? (
              <div className="pricing-preview__addons">
                <div className="pricing-preview__subheading">
                  <strong>Layanan tambahan</strong>
                  <span>Pilih tambahan yang ingin dimasukkan ke simulasi.</span>
                </div>

                {applicableAddOns.length === 0 ? (
                  <p className="pricing-preview__muted">
                    Tidak ada layanan tambahan untuk layanan ini.
                  </p>
                ) : (
                  applicableAddOns.map((addOn) => (
                    <PricingPreviewAddOn
                      key={addOn.id}
                      addOn={addOn}
                      input={selectedAddOns[addOn.id]}
                      onToggle={() => toggleAddOn(addOn)}
                      onFieldChange={(fieldName, value) =>
                        setAddOnField(addOn.id, fieldName, value)
                      }
                    />
                  ))
                )}
              </div>
            ) : null}
          </div>

          <div className="pricing-preview__result" aria-live="polite">
            <PricingPreviewResult
              addOnById={addOnById}
              error={selectedRule ? previewState.error : null}
              preview={previewState.value}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
