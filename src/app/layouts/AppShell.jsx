import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { Icon } from '../../components/ui/Icon.jsx';
import { canAccessPolicy } from '../../features/auth/capabilities.js';
import { ROUTE_POLICIES } from '../../features/auth/routePolicies.js';
import { UserMenu } from '../../features/auth/UserMenu.jsx';
import { useAuth } from '../../features/auth/useAuth.js';
import './app-shell.css';

const navigationItems = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard', policy: ROUTE_POLICIES.DASHBOARD },
  {
    to: '/calendar',
    label: 'Booking Calendar',
    icon: 'calendar',
    policy: ROUTE_POLICIES.CALENDAR,
  },
  {
    to: '/fees-commissions',
    label: 'Fee & Commission',
    icon: 'coins',
    policy: ROUTE_POLICIES.FEES_COMMISSIONS,
  },
  { to: '/bookkeeping', label: 'Pembukuan', icon: 'book', policy: ROUTE_POLICIES.BOOKKEEPING },
  { to: '/settings/account', label: 'Settings', icon: 'settings', policy: ROUTE_POLICIES.ACCOUNT },
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
        <span>37</span>
        <i />
      </div>
      <div className="app-brand__copy min-w-0">
        <p className="app-brand__name">Studio37 OS</p>
        <p className="app-brand__meta">Production workspace</p>
      </div>
    </div>
  );
}

function Navigation({ ariaLabel, onNavigate }) {
  const access = useAuth();

  return (
    <nav aria-label={ariaLabel} className="app-nav">
      {navigationItems
        .filter((item) => canAccessPolicy(access, item.policy))
        .map((item) => (
          <NavLink key={item.to} to={item.to} className="app-nav__link" onClick={onNavigate}>
            <span className="app-nav__icon" aria-hidden="true">
              <Icon name={item.icon} size={17} />
            </span>
            <span className="app-nav__label">{item.label}</span>
            <span className="app-nav__active-rail" aria-hidden="true" />
          </NavLink>
        ))}
    </nav>
  );
}

export function AppShell() {
  const location = useLocation();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const pageLabel = getPageLabel(location.pathname);

  return (
    <div className="app-shell" data-route={location.pathname}>
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
            <div className="app-shell__environment">
              <span className="app-shell__environment-dot" aria-hidden="true" />
              <div>
                <p>Studio workspace</p>
                <span>Operational console</span>
              </div>
            </div>
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
          <aside
            className="app-shell__mobile-drawer"
            data-open="true"
            aria-label="Menu aplikasi mobile"
          >
            <div className="app-shell__mobile-drawer-inner">
              <div className="app-shell__mobile-drawer-header">
                <Brand />
                <button
                  className="app-shell__close-button"
                  type="button"
                  aria-label="Tutup menu"
                  onClick={() => setMobileNavigationOpen(false)}
                >
                  <Icon name="close" size={18} />
                </button>
              </div>

              <div className="app-shell__navigation">
                <p className="app-shell__navigation-label">Workspace</p>
                <Navigation
                  ariaLabel="Navigasi utama mobile"
                  onNavigate={() => setMobileNavigationOpen(false)}
                />
              </div>

              <div className="app-shell__mobile-drawer-footer">
                <span className="app-shell__environment-dot" aria-hidden="true" />
                Studio37 operational console
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
                <Icon name="menu" size={18} />
              </button>

              <div className="app-shell__page-label">
                <p className="app-shell__page-kicker">Studio37 / Workspace</p>
                <p className="app-shell__page-title">{pageLabel}</p>
              </div>
            </div>

            <UserMenu />
          </div>
        </header>

        <main id="main-content" className="app-shell__content" tabIndex="-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
