# Compensation Rule Domain Contract

## Status

Phase 6A foundation for PRD-07. This contract defines configurable operator-compensation rules only. It does not implement calculation, rule resolution, booking integration, commission entries, payout, adjustment, or management UI.

## Separation from customer pricing

`pricingRules` answer: **what does the customer pay?**

`compensationRules` answer: **what compensation policy applies to an assigned operator?**

The two domains must not share mutable monetary configuration. A customer price change must not implicitly rewrite an operator rate, and an operator-rate change must not alter customer pricing.

## Collection

`compensationRules/{compensationRuleId}`

Rules use immutable auto-generated document IDs, soft status, deterministic priority, optional effective periods, and server-owned actor/timestamp metadata.

## Canonical fields

- `name`
- `operatorType`: `studio_operator | recording_engineer`
- `operatorId`: nullable exact operator scope
- `sessionTypeId`: nullable exact session-type scope
- `studioId`: nullable exact studio scope
- `compensationModel`
- `configuration`
- `priority`: integer `1..999`
- `effectiveFrom`: nullable timestamp
- `effectiveUntil`: nullable timestamp, strictly later than `effectiveFrom` when both exist
- `status`: `active | disabled`
- `createdAt`, `createdByUid`, `updatedAt`, `updatedByUid`

A non-null exact operator scope must refer to an operator that supports the rule's `operatorType`. Reference existence and relationship checks belong at the Firestore authorization boundary.

## Supported models

### `per_hour`

```text
configuration:
  amountPerHourIdr: integer IDR
```

Example: Studio Operator rehearsal compensation of Rp10.000 per compensated hour.

The exact partial-hour arithmetic is intentionally deferred to the Phase 6 calculation slice and must be specified/tested before booking integration.

### `per_session`

```text
configuration:
  amountIdr: integer IDR
```

Represents one compensation amount for one qualifying session event.

### `fixed`

```text
configuration:
  amountIdr: integer IDR
```

Represents a fixed fee whose earning trigger is defined by the later calculation/lifecycle contract.

### `package`

```text
configuration:
  durationMinutes: 15-minute-aligned integer, 15..1440
  amountIdr: integer IDR
```

Examples from current Studio37 policy can be represented as:

- Recording Pro, 360 minutes -> Rp450.000 for the Recording Engineer.
- Recording Live, 180 minutes -> Rp285.000 for the Recording Engineer.

These values are examples, not hardcoded engine constants.

### `percentage`

```text
configuration:
  basisPoints: integer 0..10000
  base: booking_subtotal_before_discount |
        booking_total_after_discount |
        service_amount
```

The base is mandatory. The engine must never guess a percentage base.

## Scope and later resolution

Phase 6A persists the scope required by PRD-07:

- operator type
- optional exact operator
- optional session type
- optional studio
- package duration through package configuration
- effective period
- numeric priority

Phase 6A does **not** declare the final precedence algorithm. A later pure resolver must define specificity and priority sequencing, then reject equal-winning ambiguous rules rather than choosing by name, ID, query order, or insertion order.

## Repository boundary

The feature repository owns one bounded `priority desc + limit(200)` one-shot query and focused operations:

- list rules
- create rule
- edit rule
- soft activate/deactivate

It intentionally exposes no:

- generic `listAll()`
- listener
- hard delete
- compensation calculation
- rule resolution
- booking mutation
- commission-entry generation
- payout operation

## Firestore activation boundary

Phase 6A intentionally leaves `compensationRules` under the repository-wide Firestore default-deny fallback. The client repository and domain model exist, but production/client Firestore access is not enabled yet.

This fail-closed state is deliberate. Compensation rates are sensitive and should not become live-readable or writable before the exact Owner-only rules, reference checks, metadata preservation, bounded list query, and emulator tests land together.

The follow-up activation slice must allow only an active Owner to get/list/create/update compensation rules, cap list queries at 200, validate exact operator/session/studio references, verify an exact operator supports the declared operator type, preserve creation metadata, require server-time update metadata, and continue denying hard delete. No Studio Operator capability should implicitly grant access to the rule table.

## Historical safety

Configuration is soft-disabled rather than hard-deleted. Later booking/commission integration must snapshot the selected rule, normalized configuration, calculation inputs, expected amount, and source rule ID. Editing a rule must never silently change historical compensation expectations.

## Owner-only administration

Initial rule configuration is Owner-only. Compensation rates are sensitive operational data. PRD-08 also defines the management workspace as Owner-only by default.

A later booking-integration design must not broaden rule-table visibility to every Studio Operator merely because they can create a booking. If a trusted/server-authoritative generation path is required, that should be designed explicitly.

## Daily meal allowance gap

Current Studio37 policy includes a Studio Operator meal allowance of Rp40.000 per worked day. PRD-07 does not currently define a daily/shift allowance model.

Do **not** encode this as a per-session or generic fixed booking fee. Doing so risks duplicate payment when one operator handles multiple bookings on the same day.

The missing semantics are tracked separately in GitHub issue #49 and require a deliberate `per_day`, `per_shift`, or equivalent eligibility/idempotency contract.

## Phase 6A non-goals

- no live Firestore access to compensation rules yet
- no compensation calculation yet
- no rule winner/resolver yet
- no snapshots yet
- no Pending/Earned/Paid/Void entries yet
- no manual adjustments yet
- no payout settlement yet
- no commission-management UI yet
- no daily allowance approximation
- no customer pricing changes
