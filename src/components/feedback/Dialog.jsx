import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

import { Icon } from '../ui/Icon.jsx';
import './dialog.css';

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function Dialog({
  children,
  closeLabel = 'Tutup dialog',
  description,
  footer,
  onClose,
  open,
  size = 'md',
  title,
}) {
  const generatedId = useId();
  const titleId = `dialog-title-${generatedId.replaceAll(':', '')}`;
  const descriptionId = description
    ? `dialog-description-${generatedId.replaceAll(':', '')}`
    : undefined;
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const previousActiveElement = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusInitialElement = () => {
      const dialog = dialogRef.current;
      if (!dialog) return;

      const autofocusTarget = dialog.querySelector('[data-autofocus="true"]');
      const firstFocusable = dialog.querySelector(focusableSelector);
      (autofocusTarget || firstFocusable || dialog).focus();
    };

    focusInitialElement();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
        return;
      }

      if (event.key !== 'Tab') return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusableElements = [...dialog.querySelectorAll(focusableSelector)];
      if (!focusableElements.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements.at(-1);

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActiveElement?.focus?.();
    };
  }, [onClose, open]);

  if (!open) return null;

  return createPortal(
    <div
      className="ui-dialog-backdrop"
      data-open="true"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <section
        ref={dialogRef}
        className="ui-dialog"
        data-size={size}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <header className="ui-dialog__header">
          <div className="ui-dialog__heading">
            <span className="ui-dialog__kicker" aria-hidden="true">
              Studio37 workspace
            </span>
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <button
            type="button"
            className="ui-dialog__close"
            aria-label={closeLabel}
            onClick={onClose}
          >
            <Icon name="close" size={17} />
          </button>
        </header>

        <div className="ui-dialog__body">{children}</div>
        {footer ? <footer className="ui-dialog__footer">{footer}</footer> : null}
      </section>
    </div>,
    document.body,
  );
}
