import { Input } from '../../components/forms/Field.jsx';
import {
  DURATION_PRESET_MINUTES,
  formatDurationMinutes,
  getDurationPresetLabel,
} from './durationSettings.js';
import './duration-settings.css';

export function DurationMinutesField({
  description,
  disabled = false,
  error,
  label,
  onValueChange,
  presets = DURATION_PRESET_MINUTES,
  required = false,
  value,
}) {
  const formattedValue = formatDurationMinutes(value);
  const selectedMinutes = formattedValue === null ? null : Number(value);

  return (
    <div className="duration-field">
      <Input
        type="number"
        label={label}
        value={value}
        error={error}
        min={15}
        max={1440}
        step={15}
        required={required}
        disabled={disabled}
        description={description}
        onChange={(event) => onValueChange(event.target.value)}
      />

      <div className="duration-field__meta" aria-live="polite">
        <span>
          {formattedValue ? `Terbaca sebagai ${formattedValue}` : 'Gunakan kelipatan 15 menit.'}
        </span>
        <span>Grid 15 menit · maksimum 24 jam</span>
      </div>

      <div className="duration-field__presets" role="group" aria-label={`Preset ${label}`}>
        {presets.map((minutes) => (
          <button
            key={minutes}
            type="button"
            className="duration-field__preset"
            data-selected={selectedMinutes === minutes || undefined}
            disabled={disabled}
            aria-pressed={selectedMinutes === minutes}
            onClick={() => onValueChange(String(minutes))}
          >
            {getDurationPresetLabel(minutes)}
          </button>
        ))}
      </div>
    </div>
  );
}
