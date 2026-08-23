import { Outlet } from 'react-router-dom';

import { AccessDeniedPage } from './AccessDeniedPage.jsx';
import { canAccessPolicy } from './capabilities.js';
import { useAuth } from './useAuth.js';

export function CapabilityRoute({ policy }) {
  const access = useAuth();

  if (access.status !== 'authenticated' || !canAccessPolicy(access, policy)) {
    return <AccessDeniedPage />;
  }

  return <Outlet />;
}
