import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

import './app-shell.css';

const navigationItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/calendar', label: 'Booking Calendar' },
  { to: '/fees-commissions', label: 'Fee & Commission' },
  { to: '/bookkeeping', label: 'Pembukuan' },
  { to: '/settings/account', label: 'Settings' },
];

const pageLabels = [
  { match: '/bookings/', label: 'Booking Detail' },
  { match: '/fees-commissions', label: 'Fee & Commission' },
  { match: '/bookkeeping', label: 'Pembukuan' },
  { match: '/calendar', label: 'Booking Calendar' },
  { match: '/settings', label: 'Settings' },
  { match: '/dashboard', label: 'Dashboard' },
];

function getPageLabel(pathname) {
  return pageLabels.find((item) => pathname.startsWith(item.match))?.label ?? 'Studio37';
}

function Brand() {
  return (
    <div className="app-brand">
      <div className="app-brand__mark" aria-hidden="true">
        37
      </div>
      <div className="min-w-0">
        <p className="app-brand__name">Studio37 OS</p>
        <p className="app-brand__meta">Studio Management</p>
      </div>
    </div>
  );
}

function Navigation({ ariaLabel, onNavigate }) {
  return (
    <nav aria-label={ariaLabel} className="app-nav">
      {navigationItems.map((item) => (
        <NavLink key={item.to} to={item.to} className="app-nav__link" onClick={onNavigate}>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m6.5 6.5 11 11m0-11-11 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function AppShell() {
  const location = useLocation();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const pageLabel = getPageLabel(location.pathname);

  return (
    <div className="app-shell">
      <a className="app-shell__skip-link" href="#main-content">
        Lewati ke konten utama
      </a>

      <aside className="app-shell__sidebar" aria-label="Sidebar aplikasi">
        <div className="app-shell__sidebar-inner">
          <Brand />

          <div className="app-shell__navigation">
            <p className="app-shell__navigation-label">Workspace</p>
            <Navigation ariaLabel="Navigasi utama" />
          </div>

          <div className="app-shell__sidebar-footer">
            <p className="app-shell__role">Studio37 Management</p>
          </div>
        </div>
      </aside>

      {mobileNavigationOpen ? (
        <>
          <button
            className="app-shell__mobile-overlay"
            type="button"
            aria-label="Tutup navigasi"
            onClick={() => setMobileNavigationOpen(false)}
          />
          <aside className="app-shell__mobile-drawer" data-open="true" aria-label="Menu aplikasi mobile">
            <div className="app-shell__mobile-drawer-inner">
              <div className="app-shell__mobile-drawer-header">
                <Brand />
                <button
                  className="app-shell__close-button"
                  type="button"
                  aria-label="Tutup menu"
                  onClick={() => setMobileNavigationOpen(false)}
                >
                  <CloseIcon />
                </button>
              </div>

              <div className="app-shell__navigation">
                <p className="app-shell__navigation-label">Workspace</p>
                <Navigation
                  ariaLabel="Navigasi utama mobile"
                  onNavigate={() => setMobileNavigationOpen(false)}
                />
              </div>
            </div>
          </aside>
        </>
      ) : null}

      <div className="app-shell__workspace">
        <header className="app-shell__topbar">
          <div className="app-shell__topbar-inner">
            <div className="app-shell__topbar-start">
              <button
                className="app-shell__menu-button"
                type="button"
                aria-label="Buka menu"
                aria-expanded={mobileNavigationOpen}
                onClick={() => setMobileNavigationOpen(true)}
              >
                <MenuIcon />
              </button>

              <div className="app-shell__page-label">
                <p className="app-shell__page-kicker">Studio37</p>
                <p className="app-shell__page-title">{pageLabel}</p>
              </div>
            </div>

            <div className="app-shell__status" aria-label="Status aplikasi">
              <span className="app-shell__status-dot" aria-hidden="true" />
              Foundation ready
            </div>
          </div>
        </header>

        <main id="main-content" className="app-shell__content" tabIndex="-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
