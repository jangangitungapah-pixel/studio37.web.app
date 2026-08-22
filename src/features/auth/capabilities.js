import { USER_PROFILE_ROLES } from './userProfile.js';

export const CAPABILITIES = Object.freeze({
  BOOKING_CANCEL: 'booking.cancel',
  BOOKING_CREATE: 'booking.create',
  BOOKING_EDIT: 'booking.edit',
  BOOKING_OVERRIDE_PRICE: 'booking.override_price',
  BOOKING_VIEW: 'booking.view',
  BOOKKEEPING_CREATE: 'bookkeeping.create',
  BOOKKEEPING_VIEW: 'bookkeeping.view',
  COMMISSION_ADJUST: 'commission.adjust',
  COMMISSION_PAYOUT: 'commission.payout',
  COMMISSION_VIEW_ALL: 'commission.view_all',
  COMMISSION_VIEW_OWN: 'commission.view_own',
  CUSTOMER_EDIT: 'customer.edit',
  CUSTOMER_VIEW: 'customer.view',
  DANGER_ZONE_EXECUTE: 'danger_zone.execute',
  DASHBOARD_VIEW: 'dashboard.view',
  PAYMENT_ADJUST: 'payment.adjust',
  PAYMENT_CREATE: 'payment.create',
  PAYMENT_VIEW: 'payment.view',
  PERMISSIONS_MANAGE: 'permissions.manage',
  SETTINGS_OPERATORS_MANAGE: 'settings.operators.manage',
  SETTINGS_OPERATORS_VIEW: 'settings.operators.view',
  SETTINGS_PRICING_EDIT: 'settings.pricing.edit',
  SETTINGS_PRICING_VIEW: 'settings.pricing.view',
  SETTINGS_STUDIO_EDIT: 'settings.studio.edit',
  SETTINGS_STUDIO_VIEW: 'settings.studio.view',
});

export const ALL_CAPABILITIES = Object.freeze(Object.values(CAPABILITIES).sort());

export const NON_DELEGABLE_CAPABILITIES = Object.freeze([
  CAPABILITIES.DANGER_ZONE_EXECUTE,
  CAPABILITIES.PERMISSIONS_MANAGE,
]);

const supportedCapabilities = new Set(ALL_CAPABILITIES);
const nonDelegableCapabilities = new Set(NON_DELEGABLE_CAPABILITIES);

function normalizeCapability(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }

  const capability = value.trim();

  if (!supportedCapabilities.has(capability)) {
    throw new RangeError(`${label} is not supported.`);
  }

  return capability;
}

export function normalizeDelegatedCapabilities(value) {
  if (!Array.isArray(value)) {
    throw new TypeError('permissionSet.capabilities must be an array.');
  }

  const capabilities = value.map((capability, index) => {
    const normalized = normalizeCapability(capability, `permissionSet.capabilities[${index}]`);

    if (nonDelegableCapabilities.has(normalized)) {
      throw new RangeError(`${normalized} cannot be delegated to a Studio Operator.`);
    }

    return normalized;
  });

  return Object.freeze([...new Set(capabilities)].sort());
}

export function isOwner(profile) {
  return profile?.role === USER_PROFILE_ROLES.OWNER;
}

export function hasCapability(access, capability) {
  if (!supportedCapabilities.has(capability)) return false;
  if (isOwner(access?.profile)) return true;

  return Array.isArray(access?.capabilities) && access.capabilities.includes(capability);
}

export function hasAllCapabilities(access, capabilities) {
  return capabilities.every((capability) => hasCapability(access, capability));
}

export function hasAnyCapability(access, capabilities) {
  return capabilities.some((capability) => hasCapability(access, capability));
}

export function canAccessPolicy(access, policy = {}) {
  if (policy.ownerOnly) return isOwner(access?.profile);

  const allOf = policy.allOf ?? [];
  const anyOf = policy.anyOf ?? [];

  if (!hasAllCapabilities(access, allOf)) return false;
  if (anyOf.length > 0 && !hasAnyCapability(access, anyOf)) return false;

  return true;
}
