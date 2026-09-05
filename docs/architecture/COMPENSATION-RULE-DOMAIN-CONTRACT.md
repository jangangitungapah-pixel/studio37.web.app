# Compensation Rule Domain Contract

## Status

Phase 6A/6A2 rule and Firestore foundation plus Phase 6B Owner-management foundation and Phase 6C pure resolver/calculation foundation for PRD-07. This contract defines configurable operator-compensation rules and their Owner-only persistence boundary. Deterministic resolution and arithmetic are defined by `COMPENSATION-RESOLUTION-CALCULATION-CONTRACT.md`. Booking integration, persisted commission entries, payout, adjustment, and settlement remain later work.

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

A non-null exact operator scope must refer to an operator that supports the rule's `operatorType`. Reference existence and relationship checks are enforced at the Firestore authorization boundary.

## Supported models

### `per_hour`

```text
configuration:
  amountPerHourIdr: integer IDR
```

Example: Studio Operator rehearsal compensation of Rp10.000 per compensated hour.

Phase 6C prorates partial hours by compensated minutes and rounds half-up to the nearest whole IDR. The exact contract is documented in `COMPENSATION-RESOLUTION-CALCULATION-CONTRACT.md`.

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

Represents a fixed fee whose earning trigger is defined by the later lifecycle contract.

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

The base is mandatory. The engine never guesses a percentage base. Phase 6C reads only the explicitly selected base amount and rounds the result half-up to the nearest whole IDR.

## Scope and deterministic resolution

The persisted scope required by PRD-07 includes:

- operator type
- optional exact operator
- optional session type
- optional studio
- package duration through package configuration
- effective period
- numeric priority

Phase 6C resolves matching rules with the following deterministic sequence:

1. active/effective/scope/package-duration eligibility
2. highest exact-scope specificity
3. highest numeric priority among equally specific candidates
4. ambiguity rejection when multiple candidates remain tied

The resolver never chooses by name, document ID, query order, insertion order, or update time. Package duration contributes one specificity dimension because PRD-07 explicitly treats duration/package as compensation scope.

## Repository boundary

The feature repository owns a strict single-document read, one bounded `priority desc + limit(200)` one-shot query, and focused writes:

- get one rule
- list rules
- create rule
- edit rule
- soft activate/deactivate

List decoding may skip malformed legacy/corrupt rows while returning diagnostics; strict single-document reads fail closed on invalid data.

The repository intentionally exposes no:

- generic unbounded `listAll()`
- listener
- hard delete
- compensation calculation operation
- rule-resolution operation
- booking mutation
- commission-entry generation
- payout operation

Calculation/resolution remain pure domain functions rather than persistence concerns.

## Firestore activation boundary

Phase 6A2 activates `compensationRules` persistence behind a strict active-Owner-only Firestore boundary.

The boundary requires:

- `get` only for an active Owner
- `list` only for an active Owner with an explicit query limit of at most 200
- `create` only for an active Owner with the exact canonical document/configuration shape
- new rules to start with `active` status
- server-owned create/update timestamps and actor UIDs
- `update` to preserve immutable creation metadata
- non-null `sessionTypeId`, `studioId`, and `operatorId` references to exist
- an exact `operatorId` to support the declared `operatorType`
- Studio Operators to remain denied even when delegated commission capabilities are present
- hard delete to remain denied

This activation does not broaden compensation-rate visibility to operators. The raw rule table remains sensitive Owner-only operational/financial configuration.

The emulator acceptance suite covers the authorization boundary, query bounds, all five canonical models, exact schema/configuration validation, reference checks, operator/type compatibility, metadata integrity, soft lifecycle, and hard-delete denial.

## Historical safety

Configuration is soft-disabled rather than hard-deleted. Phase 6C can produce a serialization-ready pure calculation snapshot containing the selected rule, normalized configuration, calculation inputs, expected amount, and source rule ID.

That snapshot is not persisted in Phase 6C. Later booking/commission integration must persist the relevant snapshot so editing a rule never silently changes historical compensation expectations.

## Owner-only administration

Initial rule configuration is Owner-only. Compensation rates are sensitive operational data. PRD-08 also defines the management workspace as Owner-only by default.

A later booking-integration design must not broaden rule-table visibility to every Studio Operator merely because they can create a booking. If a trusted/server-authoritative generation path is required, that should be designed explicitly.

## Daily meal allowance gap

Current Studio37 policy includes a Studio Operator meal allowance of Rp40.000 per worked day. PRD-07 does not currently define a daily/shift allowance model.

Do **not** encode this as a per-session or generic fixed booking fee. Doing so risks duplicate payment when one operator handles multiple bookings on the same day.

The missing semantics are tracked separately in GitHub issue #49 and require a deliberate `per_day`, `per_shift`, or equivalent eligibility/idempotency contract.

## Current non-goals after Phase 6C

- no persisted booking/commission snapshot integration yet
- no Pending/Earned/Paid/Void entries yet
- no cancellation/repricing reconciliation yet
- no already-paid protection flow yet
- no manual adjustments yet
- no payout settlement yet
- no complete commission-management UI yet
- no daily allowance approximation
- no customer pricing changes
