import { toJavaScriptDate } from '../../lib/datetime/timestamps.js';
import { requireIntegerIdr } from '../../lib/money/idr.js';
import { OPERATOR_TYPES } from '../settings/operators.js';
import { resolveAndCalculateCompensation } from './compensationEngine.js';

export const BOOKING_COMPENSATION_SNAPSHOT_VERSION = 1;

export const COMMISSION_ENTRY_STATES = Object.freeze({
  PENDING: 'pending',
  EARNED: 'earned',
  PAID: 'paid',
  VOID: 'void',
});

export const COMMISSION_ENTRY_SOURCE_EVENTS = Object.freeze({
  BOOKING_CONFIRMATION: 'booking_confirmation',
});

export const BOOKING_COMPENSATION_DIAGNOSTIC_CODES = Object.freeze({
  NO_MATCHING_RULE: 'no_matching_rule',
});

const supportedOperatorTypes = new Set(Object.values(OPERATOR_TYPES));
const supportedCommissionStates = new Set(Object.values(COMMISSION_ENTRY_STATES));
const maxSafeIntegerBigInt = BigInt(Number.MAX_SAFE_INTEGER);

function requireRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return value;
}

function requireSingleSegmentId(value, label) {
  if (typeof value !== 'string') {
    throw new TypeError(`${label} must be a string.`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
  if (normalized.length > 128) {
    throw new RangeError(`${label} must be at most 128 characters.`);
  }
  if (normalized.includes('/')) {
    throw new TypeError(`${label} must be a Firestore document id.`);
  }

  return normalized;
}

function normalizeOptionalDisplayReference(value, label) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw new TypeError(`${label} must be a string or null.`);
  }

  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > 128) {
    throw new RangeError(`${label} must be at most 128 characters.`);
  }
  return normalized;
}

function normalizeAssignment(value, index) {
  const assignment = requireRecord(value, `assignments[${index}]`);
  const operatorId = requireSingleSegmentId(assignment.operatorId, `assignments[${index}].operatorId`);

  if (
    typeof assignment.operatorType !== 'string' ||
    !supportedOperatorTypes.has(assignment.operatorType)
  ) {
    throw new RangeError(`assignments[${index}].operatorType is not supported.`);
  }

  return Object.freeze({
    operatorId,
    operatorType: assignment.operatorType,
  });
}

function assignmentKey(assignment) {
  return JSON.stringify([assignment.operatorId, assignment.operatorType]);
}

export class DuplicateCompensationAssignmentError extends Error {
  constructor(operatorId, operatorType) {
    super(`Duplicate compensation assignment: ${operatorId} (${operatorType}).`);
    this.name = 'DuplicateCompensationAssignmentError';
    this.operatorId = operatorId;
    this.operatorType = operatorType;
  }
}

export class DuplicateCommissionSourceError extends Error {
  constructor(sourceKey) {
    super(`Duplicate commission source key: ${sourceKey}.`);
    this.name = 'DuplicateCommissionSourceError';
    this.sourceKey = sourceKey;
  }
}

export function createCommissionSourceKey({
  bookingId,
  operatorId,
  operatorType,
  ruleId,
  sourceEvent = COMMISSION_ENTRY_SOURCE_EVENTS.BOOKING_CONFIRMATION,
}) {
  return [bookingId, operatorId, operatorType, ruleId, sourceEvent]
    .map((value) => encodeURIComponent(value))
    .join('|');
}

function cloneCalculationSnapshot(snapshot) {
  return Object.freeze({
    ...snapshot,
    configuration: Object.freeze({ ...snapshot.configuration }),
    percentageBase:
      snapshot.percentageBase === null
        ? null
        : Object.freeze({ ...snapshot.percentageBase }),
  });
}

function sumSafeIdr(amounts, label) {
  let total = 0n;

  for (const [index, amount] of amounts.entries()) {
    total += BigInt(requireIntegerIdr(amount, { label: `${label}[${index}]` }));
    if (total > maxSafeIntegerBigInt) {
      throw new RangeError(`${label} total exceeds the safe integer IDR range.`);
    }
  }

  return Number(total);
}

function buildSummary(entries) {
  const studioOperatorAmounts = entries
    .filter((entry) => entry.operatorType === OPERATOR_TYPES.STUDIO_OPERATOR)
    .map((entry) => entry.amountIdr);
  const recordingEngineerAmounts = entries
    .filter((entry) => entry.operatorType === OPERATOR_TYPES.RECORDING_ENGINEER)
    .map((entry) => entry.amountIdr);

  return Object.freeze({
    byOperatorType: Object.freeze({
      [OPERATOR_TYPES.RECORDING_ENGINEER]: Object.freeze({
        amountIdr: sumSafeIdr(recordingEngineerAmounts, 'recordingEngineerAmounts'),
        entryCount: recordingEngineerAmounts.length,
      }),
      [OPERATOR_TYPES.STUDIO_OPERATOR]: Object.freeze({
        amountIdr: sumSafeIdr(studioOperatorAmounts, 'studioOperatorAmounts'),
        entryCount: studioOperatorAmounts.length,
      }),
    }),
    entryCount: entries.length,
    totalAmountIdr: sumSafeIdr(
      entries.map((entry) => entry.amountIdr),
      'commissionEntryAmounts',
    ),
  });
}

function normalizeAssignments(assignments) {
  if (!Array.isArray(assignments)) {
    throw new TypeError('assignments must be an array.');
  }

  const normalized = assignments.map(normalizeAssignment);
  const seen = new Set();

  for (const assignment of normalized) {
    const key = assignmentKey(assignment);
    if (seen.has(key)) {
      throw new DuplicateCompensationAssignmentError(
        assignment.operatorId,
        assignment.operatorType,
      );
    }
    seen.add(key);
  }

  return normalized;
}

export function buildBookingCompensationProjection({
  assignments,
  bookingId,
  bookingNumber = null,
  durationMinutes,
  effectiveAt,
  percentageBaseAmounts = {},
  rules,
  sessionTypeId = null,
  studioId = null,
}) {
  const normalizedBookingId = requireSingleSegmentId(bookingId, 'bookingId');
  const normalizedBookingNumber = normalizeOptionalDisplayReference(bookingNumber, 'bookingNumber');
  const normalizedEffectiveAt = toJavaScriptDate(effectiveAt, { label: 'effectiveAt' });
  const normalizedAssignments = normalizeAssignments(assignments);

  if (!Array.isArray(rules)) {
    throw new TypeError('rules must be an array.');
  }

  const sourceKeys = new Set();
  const entryDrafts = [];
  const diagnostics = [];

  for (const assignment of normalizedAssignments) {
    const result = resolveAndCalculateCompensation(rules, {
      durationMinutes,
      effectiveAt: normalizedEffectiveAt,
      operatorId: assignment.operatorId,
      operatorType: assignment.operatorType,
      percentageBaseAmounts,
      sessionTypeId,
      studioId,
    });

    if (result === null) {
      diagnostics.push(
        Object.freeze({
          code: BOOKING_COMPENSATION_DIAGNOSTIC_CODES.NO_MATCHING_RULE,
          operatorId: assignment.operatorId,
          operatorType: assignment.operatorType,
        }),
      );
      continue;
    }

    const calculationSnapshot = cloneCalculationSnapshot(result.snapshot);
    const sourceEvent = COMMISSION_ENTRY_SOURCE_EVENTS.BOOKING_CONFIRMATION;
    const sourceKey = createCommissionSourceKey({
      bookingId: normalizedBookingId,
      operatorId: assignment.operatorId,
      operatorType: assignment.operatorType,
      ruleId: calculationSnapshot.ruleId,
      sourceEvent,
    });

    if (sourceKeys.has(sourceKey)) {
      throw new DuplicateCommissionSourceError(sourceKey);
    }
    sourceKeys.add(sourceKey);

    entryDrafts.push(
      Object.freeze({
        amountIdr: result.expectedAmountIdr,
        bookingId: normalizedBookingId,
        bookingNumber: normalizedBookingNumber,
        calculationSnapshot,
        compensationModel: calculationSnapshot.compensationModel,
        operatorId: assignment.operatorId,
        operatorType: assignment.operatorType,
        payoutId: null,
        ruleId: calculationSnapshot.ruleId,
        sourceEvent,
        sourceKey,
        state: COMMISSION_ENTRY_STATES.PENDING,
      }),
    );
  }

  const snapshotEntries = entryDrafts.map((entry) =>
    Object.freeze({
      amountIdr: entry.amountIdr,
      calculationSnapshot: entry.calculationSnapshot,
      compensationModel: entry.compensationModel,
      operatorId: entry.operatorId,
      operatorType: entry.operatorType,
      ruleId: entry.ruleId,
      sourceEvent: entry.sourceEvent,
      sourceKey: entry.sourceKey,
    }),
  );

  return Object.freeze({
    bookingSnapshot: Object.freeze({
      diagnostics: Object.freeze([...diagnostics]),
      effectiveAtIso: normalizedEffectiveAt.toISOString(),
      entries: Object.freeze(snapshotEntries),
      schemaVersion: BOOKING_COMPENSATION_SNAPSHOT_VERSION,
      summary: buildSummary(entryDrafts),
    }),
    commissionEntryDrafts: Object.freeze([...entryDrafts]),
    diagnostics: Object.freeze([...diagnostics]),
  });
}

function normalizeOptionalReason(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') {
    throw new TypeError('reason must be a string or null.');
  }
  const normalized = value.trim();
  return normalized || null;
}

export function buildCommissionEntryTransition(
  entryValue,
  { payoutId = null, reason = null, toState } = {},
) {
  const entry = requireRecord(entryValue, 'entry');
  if (!supportedCommissionStates.has(entry.state)) {
    throw new RangeError('entry.state is not supported.');
  }
  if (!supportedCommissionStates.has(toState)) {
    throw new RangeError('toState is not supported.');
  }

  const normalizedPayoutId =
    payoutId === null ? null : requireSingleSegmentId(payoutId, 'payoutId');
  const normalizedReason = normalizeOptionalReason(reason);
  const fromState = entry.state;

  if (fromState === COMMISSION_ENTRY_STATES.PAID || fromState === COMMISSION_ENTRY_STATES.VOID) {
    throw new RangeError(`${fromState} commission entries are terminal in the base lifecycle.`);
  }

  if (fromState === COMMISSION_ENTRY_STATES.PENDING && toState === COMMISSION_ENTRY_STATES.EARNED) {
    if (normalizedPayoutId !== null) {
      throw new RangeError('Pending-to-earned transition must not attach a payout.');
    }
  } else if (
    fromState === COMMISSION_ENTRY_STATES.EARNED &&
    toState === COMMISSION_ENTRY_STATES.PAID
  ) {
    if (normalizedPayoutId === null) {
      throw new RangeError('Earned-to-paid transition requires a payoutId.');
    }
  } else if (
    (fromState === COMMISSION_ENTRY_STATES.PENDING ||
      fromState === COMMISSION_ENTRY_STATES.EARNED) &&
    toState === COMMISSION_ENTRY_STATES.VOID
  ) {
    if (normalizedReason === null) {
      throw new RangeError('Void transition requires a reason.');
    }
    if (normalizedPayoutId !== null) {
      throw new RangeError('Void transition must not attach a payout.');
    }
  } else {
    throw new RangeError(`Unsupported commission transition: ${fromState} -> ${toState}.`);
  }

  return Object.freeze({
    fromState,
    payoutId: normalizedPayoutId,
    reason: normalizedReason,
    sourceKey: requireSingleSegmentId(entry.sourceKey, 'entry.sourceKey'),
    toState,
  });
}
