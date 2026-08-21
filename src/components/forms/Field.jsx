import { useId } from 'react';

import './field.css';

function FieldFrame({ children, description, error, id, label, required = false }) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="ui-field" data-invalid={Boolean(error) || undefined}>
      <label className="ui-field__label" htmlFor={id}>
        <span>{label}</span>
        {required ? <span className="ui-field__required">Required</span> : null}
      </label>

      {children({ describedBy, errorId })}

      {description ? (
        <p className="ui-field__description" id={descriptionId}>
          {description}
        </p>
      ) : null}

      {error ? (
        <p className="ui-field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input({
  className = '',
  description,
  error,
  id: providedId,
  label,
  required = false,
  ...props
}) {
  const generatedId = useId();
  const id = providedId || `field-${generatedId.replaceAll(':', '')}`;

  return (
    <FieldFrame description={description} error={error} id={id} label={label} required={required}>
      {({ describedBy }) => (
        <input
          {...props}
          id={id}
          required={required}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          className={['ui-field__control', className].filter(Boolean).join(' ')}
        />
      )}
    </FieldFrame>
  );
}

export function Textarea({
  className = '',
  description,
  error,
  id: providedId,
  label,
  required = false,
  rows = 4,
  ...props
}) {
  const generatedId = useId();
  const id = providedId || `field-${generatedId.replaceAll(':', '')}`;

  return (
    <FieldFrame description={description} error={error} id={id} label={label} required={required}>
      {({ describedBy }) => (
        <textarea
          {...props}
          id={id}
          rows={rows}
          required={required}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={describedBy}
          className={['ui-field__control', 'ui-field__textarea', className]
            .filter(Boolean)
            .join(' ')}
        />
      )}
    </FieldFrame>
  );
}
