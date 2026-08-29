import { toJavaScriptDate } from '../../lib/datetime/timestamps.js';
import { requireIntegerIdr, sumIntegerIdr } from '../../lib/money/idr.js';
import { CAPABILITIES, hasCapability } from '../auth/capabilities.js';
import { USER_PROFILE_ROLES, USER_PROFILE_STATUSES } from '../auth/userProfile.js';
import { PRICING_CALCULATION_VERSION, PRICING_SNAPSHOT_VERSION } from './pricingSnapshot.js';

export const MANUAL_PRICE_OVERRIDE_REASON_MAX_LENGTH = 500;

const overrideInputFieldNames = Object.freeze([
  'access',
  'overrideAmountIdr',
  'overrideTime',
  'pricingSnapshot',
  'reason',
]);
const pricingSnapshotFieldNames = Object.freeze([
  'addOnCalculation',
  'amounts',
  'baseCalculation',
  'calculationVersion',
  'discountCalculation',
  'pricingTimeIso',
  'rule',
  'snapshotVersion',
]);
const pricingSnapshotAmountFieldNames = Object.freeze([
  'addOnAmountIdr',
  'baseAmountIdr',
  'discountAmountIdr',
  'discountableAmountIdr',
  'finalAmountIdr',
  'nonDiscountableAmountIdr',
  'subtotalAmountIdr',
]);
const supportedActorRoles = new Set(Object.values(USER_PROFILE_ROLES));

function requireRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }

  return value;
}

function requireExactFields(value, expectedFields, label) {
  const actualFields = Object.keys(value).sort();
  const expected = [...expectedFields].sort();

  if (
    actualFields.length !== expected.length ||
    actualFields.some((field, index) => field !== expected[index])
  ) {
    throw new TypeError(`${label} has an unsupported input shape.`);
  }
}

function requireNonEmptyString(value, label, { maxLength = 128 } = {}) {
  if (typeof value !== 'string') {
    throw new TypeError(`${label} must be a string.`);
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }

  if (normalized.length > maxLength) {
    throw new RangeError(`${label} must be at most ${maxLength} characters.`);
  }

  return normalized;
}

function requireCanonicalIsoDateTime(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${label} must be a canonical ISO-8601 string.`);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime()) || date.toISOString() !== value) {
    throw new TypeError(`${label} must be a canonical ISO-8601 string.`);
  }

  return date;
}

function normalizeReason(value) {
  return requireNonEmptyString(value, 'manualPriceOverride.reason', {
    maxLength: MANUAL_PRICE_OVERRIDE_REASON_MAX_LENGTH,
  });
}

function normalizePricingRuleId(value) {
  const id = requireNonEmptyString(value, 'manualPriceOverride.pricingSnapshot.rule.id');

  if (id.includes('/')) {
    throw new TypeError(
      'manualPriceOverride.pricingSnapshot.rule.id must be a Firestore document id.',
    );
  }

  return id;
}

function normalizePricingSnapshot(value) {
  const snapshot = requireRecord(value, 'manualPriceOverride.pricingSnapshot');
  requireExactFields(snapshot, pricingSnapshotFieldNames, 'manualPriceOverride.pricingSnapshot');

  if (snapshot.snapshotVersion !== PRICING_SNAPSHOT_VERSION) {
    throw new RangeError(
      `manualPriceOverride.pricingSnapshot.snapshotVersion must be ${PRICING_SNAPSHOT_VERSION}.`,
    );
  }

  if (snapshot.calculationVersion !== PRICING_CALCULATION_VERSION) {
    throw new RangeError(
      `manualPriceOverride.pricingSnapshot.calculationVersion must be ${PRICING_CALCULATION_VERSION}.`,
    );
  }

  const pricingTime = requireCanonicalIsoDateTime(
    snapshot.pricingTimeIso,
    'manualPriceOverride.pricingSnapshot.pricingTimeIso',
  );
  const amounts = requireRecord(snapshot.amounts, 'manualPriceOverride.pricingSnapshot.amounts');
  requireExactFields(
    amounts,
    pricingSnapshotAmountFieldNames,
    'manualPriceOverride.pricingSnapshot.amounts',
  );

  const normalizedAmounts = Object.fromEntries(
    pricingSnapshotAmountFieldNames.map((field) => [
      field,
      requireIntegerIdr(amounts[field], {
        label: `manualPriceOverride.pricingSnapshot.amounts.${field}`,
      }),
    ]),
  );
  const canonicalSubtotalAmountIdr = sumIntegerIdr(
    [normalizedAmounts.baseAmountIdr, normalizedAmounts.addOnAmountIdr],
    { label: 'manualPriceOverride.pricingSnapshot.subtotalAmounts' },
  );

  if (normalizedAmounts.subtotalAmountIdr !== canonicalSubtotalAmountIdr) {
    throw new RangeError(
      'manualPriceOverride.pricingSnapshot.amounts.subtotalAmountIdr is inconsistent.',
    );
  }

  if (normalizedAmounts.discountableAmountIdr > normalizedAmounts.subtotalAmountIdr) {
    throw new RangeError(
      'manualPriceOverride.pricingSnapshot.amounts.discountableAmountIdr exceeds subtotalAmountIdr.',
    );
  }

  if (normalizedAmounts.discountAmountIdr > normalizedAmounts.discountableAmountIdr) {
    throw new RangeError(
      'manualPriceOverride.pricingSnapshot.amounts.discountAmountIdr exceeds discountableAmountIdr.',
    );
  }

  const canonicalNonDiscountableAmountIdr =
    normalizedAmounts.subtotalAmountIdr - normalizedAmounts.discountableAmountIdr;
  const canonicalFinalAmountIdr =
    normalizedAmounts.subtotalAmountIdr - normalizedAmounts.discountAmountIdr;

  if (
    normalizedAmounts.nonDiscountableAmountIdr !== canonicalNonDiscountableAmountIdr ||
    normalizedAmounts.finalAmountIdr !== canonicalFinalAmountIdr
  ) {
    throw new RangeError('manualPriceOverride.pricingSnapshot.amounts is internally inconsistent.');
  }

  const rule = requireRecord(snapshot.rule, 'manualPriceOverride.pricingSnapshot.rule');
  const pricingRuleId = normalizePricingRuleId(rule.id);

  return Object.freeze({
    calculatedOriginalAmountIdr: normalizedAmounts.finalAmountIdr,
    calculationVersion: snapshot.calculationVersion,
    pricingRuleId,
    pricingTime,
    snapshotVersion: snapshot.snapshotVersion,
  });
}

function normalizeAuthorizedActor(accessValue) {
  const access = requireRecord(accessValue, 'manualPriceOverride.access');

  if (access.status !== 'authenticated') {
    throw new RangeError('manualPriceOverride.access must be an authenticated session.');
  }

  const profile = requireRecord(access.profile, 'manualPriceOverride.access.profile');

  if (profile.status !== USER_PROFILE_STATUSES.ACTIVE) {
    throw new RangeError('manualPriceOverride actor profile must be active.');
  }

  const actorUid = requireNonEmptyString(profile.uid, 'manualPriceOverride.access.profile.uid');
  const actorRole = requireNonEmptyString(profile.role, 'manualPriceOverride.access.profile.role');

  if (!supportedActorRoles.has(actorRole)) {
    throw new RangeError('manualPriceOverride actor role is not supported.');
  }

  const user = requireRecord(access.user, 'manualPriceOverride.access.user');
  const authenticatedUid = requireNonEmptyString(user.uid, 'manualPriceOverride.access.user.uid');

  if (authenticatedUid !== actorUid) {
    throw new RangeError('manualPriceOverride authenticated user must match the actor profile.');
  }

  if (!hasCapability(access, CAPABILITIES.BOOKING_OVERRIDE_PRICE)) {
    throw new RangeError(
      `manualPriceOverride requires the ${CAPABILITIES.BOOKING_OVERRIDE_PRICE} capability.`,
    );
  }

  return Object.freeze({ actorRole, actorUid });
}

export function applyAuthorizedManualPriceOverride(value) {
  const input = requireRecord(value, 'manualPriceOverride input');
  requireExactFields(input, overrideInputFieldNames, 'manualPriceOverride input');

  const actor = normalizeAuthorizedActor(input.access);
  const snapshot = normalizePricingSnapshot(input.pricingSnapshot);
  const overriddenFinalAmountIdr = requireIntegerIdr(input.overrideAmountIdr, {
    label: 'manualPriceOverride.overrideAmountIdr',
  });
  const reason = normalizeReason(input.reason);
  const overrideTime = toJavaScriptDate(input.overrideTime, {
    label: 'manualPriceOverride.overrideTime',
  });

  if (overrideTime.getTime() < snapshot.pricingTime.getTime()) {
    throw new RangeError('manualPriceOverride.overrideTime cannot be earlier than pricingTime.');
  }

  if (overriddenFinalAmountIdr === snapshot.calculatedOriginalAmountIdr) {
    throw new RangeError(
      'manualPriceOverride.overrideAmountIdr must differ from the calculated original amount.',
    );
  }

  const manualOverride = Object.freeze({
    actorRole: actor.actorRole,
    actorUid: actor.actorUid,
    authorizationCapability: CAPABILITIES.BOOKING_OVERRIDE_PRICE,
    calculatedOriginalAmountIdr: snapshot.calculatedOriginalAmountIdr,
    overriddenAtIso: overrideTime.toISOString(),
    overriddenFinalAmountIdr,
    reason,
  });

  return Object.freeze({
    calculationVersion: snapshot.calculationVersion,
    finalAmountIdr: overriddenFinalAmountIdr,
    manualOverride,
    pricingRuleId: snapshot.pricingRuleId,
    snapshotVersion: snapshot.snapshotVersion,
  });
}
