import { useEffect, useId, useRef, useState } from 'react';

import { Button } from '../../components/ui/Button.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { useAuth } from './useAuth.js';
import { USER_PROFILE_ROLES } from './userProfile.js';

import './user-menu.css';

const roleLabels = Object.freeze({
  [USER_PROFILE_ROLES.OWNER]: 'Owner',
  [USER_PROFILE_ROLES.STUDIO_OPERATOR]: 'Studio Operator',
});

function getInitials(displayName) {
  const words = displayName.trim().split(/\s+/).filter(Boolean);

  if (!words.length) return '37';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();

  return `${words[0][0]}${words.at(-1)[0]}`.toUpperCase();
}

export function UserMenu() {
  const { profile, signOut, user } = useAuth();
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const panelId = useId();
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const displayName = profile?.displayName ?? user?.displayName ?? user?.email ?? 'Studio37 User';
  const email = profile?.email ?? user?.email ?? '';
  const roleLabel = roleLabels[profile?.role] ?? 'Studio37 User';
  const initials = getInitials(displayName);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key !== 'Escape') return;

      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function toggleMenu() {
    setError('');
    setOpen((currentOpen) => !currentOpen);
  }

  async function handleSignOut() {
    if (signingOut) return;

    setError('');
    setSigningOut(true);

    try {
      await signOut();
      setOpen(false);
      setSigningOut(false);
    } catch {
      setError('Sesi belum dapat ditutup. Periksa koneksi lalu coba lagi.');
      setSigningOut(false);
    }
  }

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="user-menu__trigger"
        aria-controls={panelId}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Buka menu pengguna: ${displayName}`}
        onClick={toggleMenu}
      >
        <span className="user-menu__avatar" aria-hidden="true">
          {initials}
        </span>
        <span className="user-menu__trigger-copy">
          <span className="user-menu__trigger-name">{displayName}</span>
          <span className="user-menu__trigger-role">{roleLabel}</span>
        </span>
        <span className="user-menu__chevron" data-open={open} aria-hidden="true">
          <Icon name="chevronDown" size={15} />
        </span>
      </button>

      {open ? (
        <section id={panelId} className="user-menu__panel" aria-label="Menu pengguna">
          <div className="user-menu__identity">
            <span className="user-menu__avatar user-menu__avatar--large" aria-hidden="true">
              {initials}
            </span>
            <div className="user-menu__identity-copy">
              <p className="user-menu__name">{displayName}</p>
              {email ? <p className="user-menu__email">{email}</p> : null}
            </div>
          </div>

          <div className="user-menu__context">
            <span className="user-menu__role-badge">{roleLabel}</span>
            <span className="user-menu__session-state">
              <i aria-hidden="true" /> Sesi aktif
            </span>
          </div>

          {error ? (
            <div className="user-menu__error" role="alert">
              {error}
            </div>
          ) : null}

          <Button
            className="user-menu__logout"
            loading={signingOut}
            onClick={handleSignOut}
            variant="secondary"
          >
            <Icon name="logout" size={15} />
            Keluar dari Studio37
          </Button>
        </section>
      ) : null}
    </div>
  );
}
