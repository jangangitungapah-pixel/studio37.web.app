import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

import { ToastContext } from './toast-context.js';
import './toast.css';

function ToastItem({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast.duration || toast.duration <= 0) return undefined;

    const timer = window.setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => window.clearTimeout(timer);
  }, [onDismiss, toast.duration, toast.id]);

  const isAssertive = toast.tone === 'danger';

  return (
    <article
      className="ui-toast"
      data-tone={toast.tone}
      role={isAssertive ? 'alert' : 'status'}
      aria-live={isAssertive ? 'assertive' : 'polite'}
    >
      <div className="ui-toast__content">
        <strong>{toast.title}</strong>
        {toast.message ? <p>{toast.message}</p> : null}
        {toast.action ? (
          <button
            type="button"
            className="ui-toast__action"
            onClick={() => {
              toast.action.onClick?.();
              onDismiss(toast.id);
            }}
          >
            {toast.action.label}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        className="ui-toast__dismiss"
        aria-label="Tutup notifikasi"
        onClick={() => onDismiss(toast.id)}
      >
        ×
      </button>
    </article>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback((toast) => {
    const id = `toast-${nextId.current}`;
    nextId.current += 1;

    setToasts((current) => [
      ...current,
      {
        duration: 4500,
        message: '',
        tone: 'info',
        title: 'Notification',
        ...toast,
        id,
      },
    ]);

    return id;
  }, []);

  const contextValue = useMemo(
    () => ({ dismissToast, pushToast }),
    [dismissToast, pushToast],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {createPortal(
        <div className="ui-toast-viewport" aria-label="Notifications">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
