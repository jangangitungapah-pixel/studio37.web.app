import { Combobox } from '../../components/forms/Select.jsx';
import { buildStudioScopeOptions, getStudioScopeFieldDescription } from './studioScopeSettings.js';

export function StudioScopeField({
  disabled = false,
  error,
  onValueChange,
  state = 'ready',
  studioRooms = [],
  value = '',
}) {
  const specificSelectionAvailable = state === 'ready';
  const currentStudioId = value || null;
  const options = buildStudioScopeOptions(studioRooms, {
    currentStudioId,
    specificSelectionAvailable,
  });
  const scopeLocked = !specificSelectionAvailable;

  return (
    <Combobox
      label="Berlaku untuk"
      value={value}
      error={error}
      options={options}
      disabled={disabled || scopeLocked}
      placeholder="Pilih studio"
      description={getStudioScopeFieldDescription({ currentStudioId, state })}
      onChange={(nextValue) => onValueChange(nextValue)}
    />
  );
}
