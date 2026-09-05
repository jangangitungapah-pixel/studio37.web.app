# Booking Compensation Snapshot & Commission Entry Contract

## Status

Phase 6D pure-domain foundation for PRD-07 and PRD-08, stacked on the Phase 6C deterministic compensation resolver/calculation engine.

This slice converts explicit booking/operator assignment context plus canonical compensation rules into:

- a historical booking compensation snapshot
- zero or more canonical commission-entry drafts
- explicit diagnostics for assigned operators that have no matching compensation rule
- a pure base lifecycle transition contract

Phase 6D does **not** persist `bookings` or `commissionEntries`. Firestore activation is intentionally deferred until the booking persistence boundary exists and the transaction/idempotency boundary can be implemented atomically.

## Why persistence is deferred

The current codebase does not yet expose an active booking repository/persistence boundary. Writing commission entries directly from this slice would create a parallel write path with no authoritative booking transaction.

Phase 6D therefore keeps generation pure. A later Phase 6D2-style activation can persist the booking compensation snapshot and generated commission entries together under an explicit transaction/batch contract.

## Inputs

`buildBookingCompensationProjection()` receives:

- `bookingId`
- optional display `bookingNumber`
- explicit `effectiveAt`
- `durationMinutes`
- nullable `sessionTypeId`
- nullable `studioId`
- explicitly named `percentageBaseAmounts`
- assigned operator tuples
- already-decoded canonical compensation rules

Each operator assignment contains:

- `operatorId`
- `operatorType`

The same person may appear once as `studio_operator` and once as `recording_engineer` on one booking. Those are distinct compensation assignments.

The same `operatorId + operatorType` tuple may not be submitted twice.

## Effective instant

Phase 6D does not guess which booking timestamp should govern compensation rule effectiveness.

The caller must pass `effectiveAt` explicitly. The projection stores the exact normalized instant in the historical booking snapshot and forwards it to the Phase 6C resolver.

A future booking workflow should define whether this value is the scheduled service start, confirmation instant, or another business-approved timestamp. That policy must be explicit rather than inferred inside the compensation engine.

## Projection behavior

For every normalized assignment, Phase 6D calls the Phase 6C resolver/calculator with the same booking calculation context plus the assignment's exact operator identity/type.

### Matching rule

When a rule resolves, Phase 6D creates one commission-entry draft with:

- `bookingId`
- optional `bookingNumber`
- `operatorId`
- `operatorType`
- `ruleId`
- `compensationModel`
- detached calculation snapshot
- expected integer-IDR amount
- `sourceEvent = booking_confirmation`
- deterministic source/idempotency key
- `state = pending`
- `payoutId = null`

### No matching rule

When an assigned operator has no matching rule, Phase 6D does **not** silently create a zero-value commission entry.

It returns a `no_matching_rule` diagnostic containing the operator ID and operator type.

A later booking workflow must explicitly decide whether such diagnostics:

- block booking confirmation
- require Owner acknowledgement
- are allowed for intentionally uncompensated assignments

Phase 6D does not make that product-policy decision.

### Ambiguous rule

Ambiguity remains a hard failure from Phase 6C. Phase 6D does not catch or downgrade `CompensationRuleAmbiguityError`.

## Historical booking snapshot

The booking compensation snapshot is a detached immutable pure value containing:

- `schemaVersion`
- normalized `effectiveAtIso`
- one snapshot entry per generated commission entry
- generated entry summary
- no-match diagnostics

Each snapshot entry contains:

- operator ID/type
- rule ID
- compensation model
- source event/key
- expected amount
- detached Phase 6C calculation snapshot

The summary contains:

- total generated entry count
- total expected amount
- entry count and amount by operator type

All money remains whole integer IDR. Aggregate totals fail closed if they exceed JavaScript's safe integer range.

## Historical detachment

The snapshot must not retain mutable references to live rule configuration.

Rule edits after projection must not change:

- stored configuration evidence
- percentage-base evidence
- source rule ID
- expected amount
- operator/session/studio calculation context

This is the foundation for PRD-07's requirement that later compensation-setting changes must not silently rewrite historical booking expectations.

## Source/idempotency key

Each generated entry receives a deterministic source key composed from:

- booking ID
- operator ID
- operator type
- rule ID
- source event

Current source event:

`booking_confirmation`

The logical uniqueness target follows PRD-07's duplicate-generation requirement:

`booking + operator + operatorType + rule + event`

The source key is **opaque idempotency data**, not a Firestore document ID. Phase 6D2 may either:

- persist it as a validated unique/idempotency field, or
- hash/transform it into a deterministic document ID

That persistence decision is deliberately deferred.

## Commission entry states

Canonical states:

- `pending`
- `earned`
- `paid`
- `void`

Generated booking-confirmation entries always start as `pending`.

Phase 6D defines only the pure transition contract. It does not write transitions.

## Base lifecycle transition contract

Allowed transitions:

### `pending -> earned`

Represents entitlement confirmation. No payout reference is allowed at this step.

PRD-07 recommends booking completion as the default earning trigger, but the actual booking workflow/exception policy is deferred.

### `pending -> void`

Allowed only with a non-empty reason.

Typical future use: cancellation before entitlement.

### `earned -> void`

Allowed only with a non-empty reason.

This remains a pre-settlement correction path. A later persistence layer must audit actor/time/reason.

### `earned -> paid`

Requires an explicit `payoutId`.

The transition validator only defines the invariant. Actual payout settlement must later perform entry updates atomically with the payout record.

### Terminal states

`paid` and `void` are terminal in the base lifecycle.

A paid entry is not changed back to earned/pending/void merely because a booking changes later. PRD-07/08 require a separate adjustment/reversal record when settled history is affected.

A void entry is not silently reactivated.

## Explicitly rejected transitions

Examples rejected by the base contract:

- `pending -> paid`
- `pending -> pending`
- `earned -> earned`
- `paid -> void`
- `paid -> earned`
- `void -> earned`

## Persistence requirements for the later activation slice

A future Firestore activation must preserve these invariants:

1. booking compensation snapshot and initial commission entries are committed under one authoritative booking workflow
2. duplicate source generation is prevented under concurrent/retried writes
3. source booking/operator/rule traceability is preserved
4. entry amount/calculation evidence is immutable after creation except through explicit adjustment/reversal records
5. state transitions are validated and audited
6. `earned -> paid` occurs only with a real payout record
7. paid entries cannot be silently rewritten, deleted, or voided
8. ordinary booking edits cannot mutate historical compensation evidence directly
9. authorization remains Owner-sensitive per PRD-08 unless a narrower explicit operator self-view is designed later

## Current non-goals

- no Firestore `bookings` write
- no Firestore `commissionEntries` write
- no booking transaction/batch yet
- no automatic `pending -> earned` trigger
- no persisted cancellation/repricing reconciliation
- no payout creation/settlement
- no adjustment/reversal records
- no bookkeeping/ledger integration
- no Fee & Commission management table UI
- no operator self-compensation view
- no daily/shift allowance approximation
- no customer pricing changes

## Phase 6D acceptance

- one booking can produce independent Studio Operator and Recording Engineer entries
- duplicate operator/type assignments are rejected
- each matched assignment creates one pending commission-entry draft
- no-match assignments produce diagnostics instead of zero-value entries
- calculation evidence is detached from mutable rule objects
- booking snapshot carries total and operator-type summaries
- source keys are deterministic and include booking/operator/type/rule/event identity
- pending/earned/paid/void transition invariants are explicit and testable
- paid/void entries are terminal in the base lifecycle
- persistence remains deferred until the booking transaction boundary exists
