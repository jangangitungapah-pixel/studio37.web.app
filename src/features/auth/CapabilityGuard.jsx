import { canAccessPolicy } from './capabilities.js';
import { useAuth } from './useAuth.js';

export function CapabilityGuard({
  allOf = [],
  anyOf = [],
  children,
  fallback = null,
  ownerOnly = false,
}) {
  const access = useAuth();
  const allowed =
    access.status === 'authenticated' &&
    canAccessPolicy(access, {
      allOf,
      anyOf,
      ownerOnly,
    });

  return allowed ? children : fallback;
}
