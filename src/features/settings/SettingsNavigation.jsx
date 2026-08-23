import { NavLink } from 'react-router-dom';

import { canAccessPolicy } from '../auth/capabilities.js';
import { ROUTE_POLICIES } from '../auth/routePolicies.js';
import { useAuth } from '../auth/useAuth.js';

const settingsDestinations = Object.freeze([
  Object.freeze({ label: 'Account', policy: ROUTE_POLICIES.ACCOUNT, to: '/settings/account' }),
  Object.freeze({ label: 'Studio', policy: ROUTE_POLICIES.STUDIO, to: '/settings/studio' }),
  Object.freeze({ label: 'Harga', policy: ROUTE_POLICIES.PRICING, to: '/settings/pricing' }),
  Object.freeze({ label: 'Operator', policy: ROUTE_POLICIES.OPERATORS, to: '/settings/operators' }),
  Object.freeze({
    label: 'Hak Akses',
    policy: ROUTE_POLICIES.PERMISSIONS,
    to: '/settings/permissions',
  }),
  Object.freeze({
    label: 'Danger Zone',
    policy: ROUTE_POLICIES.DANGER_ZONE,
    to: '/settings/danger-zone',
  }),
]);

export function SettingsNavigation() {
  const access = useAuth();

  return (
    <nav className="settings-navigation" aria-label="Navigasi pengaturan">
      {settingsDestinations
        .filter(({ policy }) => canAccessPolicy(access, policy))
        .map(({ label, to }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              ['settings-navigation__link', isActive ? 'active' : ''].filter(Boolean).join(' ')
            }
          >
            {label}
          </NavLink>
        ))}
    </nav>
  );
}
