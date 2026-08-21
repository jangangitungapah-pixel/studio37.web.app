import { useEffect, useId, useMemo, useRef, useState } from 'react';

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
  const normalizedOptions = options.map(normalizeOption);

  return (
    <FieldFrame description={description} error={error} id={id} label={label} required={required}>
      {({ describedBy }) => (
        <div className="ui-select-wrap">
          <select
            {...props}
            id={id}
            value={value}
            onChange={onChange}
            required={required}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={describedBy}
            className="ui-field__control ui-select"
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
          <span className="ui-select__chevron" aria-hidden="true">
            ▾
          </span>
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
  const rootRef = useRef(null);
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
        `${option.label} ${option.keywords || ''}`.toLocaleLowerCase('id-ID').includes(normalizedQuery),
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
          ref={rootRef}
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
              ▾
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
