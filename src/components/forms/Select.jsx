import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { Icon } from '../ui/Icon.jsx';
import { FieldFrame } from './Field.jsx';
import './select.css';

function normalizeOption(option) {
  if (typeof option === 'string') {
    return { label: option, value: option };
  }

  return option;
}

export function Select({
  description,
  disabled = false,
  error,
  id: providedId,
  label,
  onChange,
  options = [],
  placeholder = 'Pilih opsi',
  required = false,
  value = '',
  ...props
}) {
  const generatedId = useId();
  const id = providedId || `select-${generatedId.replaceAll(':', '')}`;
  const listboxId = `${id}-listbox`;
  const normalizedOptions = useMemo(() => options.map(normalizeOption), [options]);
  const selectedOption = normalizedOptions.find((option) => option.value === value);
  const nativeRef = useRef(null);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => {
    const selectedIndex = normalizedOptions.findIndex((option) => option.value === value);
    return Math.max(0, selectedIndex);
  });

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    const selectedIndex = normalizedOptions.findIndex((option) => option.value === value);
    if (selectedIndex >= 0) setActiveIndex(selectedIndex);
  }, [normalizedOptions, value]);

  const enabledIndexes = normalizedOptions.reduce((indexes, option, index) => {
    if (!option.disabled) indexes.push(index);
    return indexes;
  }, []);

  const moveActive = (direction) => {
    if (!enabledIndexes.length) return;

    const currentEnabledPosition = enabledIndexes.indexOf(activeIndex);
    const fallbackPosition = direction > 0 ? -1 : enabledIndexes.length;
    const startPosition = currentEnabledPosition >= 0 ? currentEnabledPosition : fallbackPosition;
    const nextPosition = Math.min(
      enabledIndexes.length - 1,
      Math.max(0, startPosition + direction),
    );
    setActiveIndex(enabledIndexes[nextPosition]);
  };

  const selectOption = (option) => {
    if (!option || option.disabled || disabled) return;

    const nativeSelect = nativeRef.current;
    if (nativeSelect) {
      const nativeValueSetter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        'value',
      )?.set;
      nativeValueSetter?.call(nativeSelect, option.value);
      nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleTriggerKeyDown = (event) => {
    if (disabled) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      moveActive(1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      moveActive(-1);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      setOpen(true);
      if (enabledIndexes.length) setActiveIndex(enabledIndexes[0]);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      setOpen(true);
      if (enabledIndexes.length) setActiveIndex(enabledIndexes.at(-1));
      return;
    }

    if ((event.key === 'Enter' || event.key === ' ') && open) {
      event.preventDefault();
      selectOption(normalizedOptions[activeIndex]);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen(true);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <FieldFrame description={description} error={error} id={id} label={label} required={required}>
      {({ describedBy }) => (
        <div className="ui-select-custom" ref={rootRef} data-open={open || undefined}>
          <select
            {...props}
            ref={nativeRef}
            id={id}
            value={value}
            onChange={onChange}
            required={required}
            disabled={disabled}
            tabIndex={-1}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={describedBy}
            className="sr-only ui-select__native-contract"
            onFocus={() => triggerRef.current?.focus()}
          >
            {placeholder ? (
              <option value="" disabled={required}>
                {placeholder}
              </option>
            ) : null}
            {normalizedOptions.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            ref={triggerRef}
            type="button"
            className="ui-field__control ui-select-trigger"
            disabled={disabled}
            aria-label={label}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-activedescendant={
              open && normalizedOptions[activeIndex] ? `${id}-option-${activeIndex}` : undefined
            }
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={describedBy}
            onClick={() => setOpen((current) => !current)}
            onKeyDown={handleTriggerKeyDown}
          >
            <span
              className={
                selectedOption ? 'ui-select-trigger__value' : 'ui-select-trigger__placeholder'
              }
            >
              {selectedOption?.label ?? placeholder}
            </span>
            <span className="ui-select-trigger__icon" data-open={open} aria-hidden="true">
              <Icon name="chevronDown" size={15} />
            </span>
          </button>

          {open ? (
            <div className="ui-select-popover" id={listboxId} role="listbox" aria-label={label}>
              {normalizedOptions.length ? (
                normalizedOptions.map((option, index) => (
                  <div
                    key={option.value}
                    id={`${id}-option-${index}`}
                    role="option"
                    aria-selected={option.value === value}
                    aria-disabled={option.disabled || undefined}
                    data-active={index === activeIndex || undefined}
                    data-disabled={option.disabled || undefined}
                    className="ui-select-option"
                    onMouseEnter={() => {
                      if (!option.disabled) setActiveIndex(index);
                    }}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectOption(option)}
                  >
                    <span className="ui-select-option__copy">
                      <span>{option.label}</span>
                      {option.description ? <small>{option.description}</small> : null}
                    </span>
                    {option.value === value ? (
                      <span className="ui-select-option__check" aria-hidden="true">
                        <Icon name="check" size={14} />
                      </span>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="ui-select-empty">Tidak ada pilihan tersedia.</p>
              )}
            </div>
          ) : null}
        </div>
      )}
    </FieldFrame>
  );
}

export function Combobox({
  description,
  disabled = false,
  emptyMessage = 'Tidak ada hasil.',
  error,
  id: providedId,
  label,
  onChange,
  options = [],
  placeholder = 'Cari dan pilih…',
  required = false,
  value = '',
}) {
  const generatedId = useId();
  const id = providedId || `combobox-${generatedId.replaceAll(':', '')}`;
  const listboxId = `${id}-listbox`;
  const normalizedOptions = useMemo(() => options.map(normalizeOption), [options]);
  const selectedOption = normalizedOptions.find((option) => option.value === value);
  const [query, setQuery] = useState(selectedOption?.label || '');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setQuery(selectedOption?.label || '');
  }, [selectedOption?.label]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('id-ID');

    if (!normalizedQuery || selectedOption?.label === query) {
      return normalizedOptions.filter((option) => !option.disabled);
    }

    return normalizedOptions.filter(
      (option) =>
        !option.disabled &&
        `${option.label} ${option.keywords || ''}`
          .toLocaleLowerCase('id-ID')
          .includes(normalizedQuery),
    );
  }, [normalizedOptions, query, selectedOption?.label]);

  useEffect(() => {
    if (activeIndex >= filteredOptions.length) {
      setActiveIndex(Math.max(0, filteredOptions.length - 1));
    }
  }, [activeIndex, filteredOptions.length]);

  const selectOption = (option) => {
    setQuery(option.label);
    setOpen(false);
    setActiveIndex(0);
    onChange?.(option.value, option);
  };

  const handleKeyDown = (event) => {
    if (disabled) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) =>
        filteredOptions.length ? Math.min(current + 1, filteredOptions.length - 1) : 0,
      );
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (filteredOptions.length ? Math.max(current - 1, 0) : 0));
    }

    if (event.key === 'Home' && open) {
      event.preventDefault();
      setActiveIndex(0);
    }

    if (event.key === 'End' && open) {
      event.preventDefault();
      setActiveIndex(Math.max(0, filteredOptions.length - 1));
    }

    if (event.key === 'Enter' && open && filteredOptions[activeIndex]) {
      event.preventDefault();
      selectOption(filteredOptions[activeIndex]);
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setQuery(selectedOption?.label || '');
    }
  };

  const activeOptionId =
    open && filteredOptions[activeIndex] ? `${id}-option-${activeIndex}` : undefined;

  return (
    <FieldFrame description={description} error={error} id={id} label={label} required={required}>
      {({ describedBy }) => (
        <div
          className="ui-combobox"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setOpen(false);
            }
          }}
        >
          <div className="ui-combobox__control">
            <input
              id={id}
              type="text"
              role="combobox"
              value={query}
              disabled={disabled}
              required={required}
              placeholder={placeholder}
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={open}
              aria-controls={listboxId}
              aria-activedescendant={activeOptionId}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={describedBy}
              className="ui-field__control ui-combobox__input"
              onFocus={() => setOpen(true)}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
            />
            <button
              type="button"
              className="ui-combobox__toggle"
              aria-label={open ? 'Tutup pilihan' : 'Buka pilihan'}
              aria-expanded={open}
              disabled={disabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setOpen((current) => !current)}
            >
              <Icon name="chevronDown" size={15} />
            </button>
          </div>

          {open ? (
            <div className="ui-combobox__menu" id={listboxId} role="listbox">
              {filteredOptions.length ? (
                filteredOptions.map((option, index) => (
                  <div
                    key={option.value}
                    id={`${id}-option-${index}`}
                    role="option"
                    aria-selected={option.value === value}
                    data-active={index === activeIndex || undefined}
                    className="ui-combobox__option"
                    onMouseEnter={() => setActiveIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectOption(option)}
                  >
                    <span>{option.label}</span>
                    {option.description ? <small>{option.description}</small> : null}
                  </div>
                ))
              ) : (
                <p className="ui-combobox__empty">{emptyMessage}</p>
              )}
            </div>
          ) : null}
        </div>
      )}
    </FieldFrame>
  );
}
