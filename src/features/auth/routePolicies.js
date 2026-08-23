import { CAPABILITIES } from './capabilities.js';

function createPolicy({ allOf = [], anyOf = [], ownerOnly = false } = {}) {
  return Object.freeze({
    allOf: Object.freeze([...allOf]),
    anyOf: Object.freeze([...anyOf]),
    ownerOnly,
  });
}

export const ROUTE_POLICIES = Object.freeze({
  ACCOUNT: createPolicy(),
  BOOKING: createPolicy({ allOf: [CAPABILITIES.BOOKING_VIEW] }),
  BOOKKEEPING: createPolicy({ allOf: [CAPABILITIES.BOOKKEEPING_VIEW] }),
  CALENDAR: createPolicy({ allOf: [CAPABILITIES.BOOKING_VIEW] }),
  DASHBOARD: createPolicy({ allOf: [CAPABILITIES.DASHBOARD_VIEW] }),
  DANGER_ZONE: createPolicy({ ownerOnly: true }),
  DEVELOPMENT: createPolicy({ ownerOnly: true }),
  FEES_COMMISSIONS: createPolicy({
    anyOf: [CAPABILITIES.COMMISSION_VIEW_OWN, CAPABILITIES.COMMISSION_VIEW_ALL],
  }),
  OPERATORS: createPolicy({ allOf: [CAPABILITIES.SETTINGS_OPERATORS_VIEW] }),
  PERMISSIONS: createPolicy({ ownerOnly: true }),
  PRICING: createPolicy({ allOf: [CAPABILITIES.SETTINGS_PRICING_VIEW] }),
  STUDIO: createPolicy({ allOf: [CAPABILITIES.SETTINGS_STUDIO_VIEW] }),
});
