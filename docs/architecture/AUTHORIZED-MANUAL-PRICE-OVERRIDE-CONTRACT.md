# Authorized Manual Price Override Contract

## Purpose

Phase 5A13 introduces the pure authorization and audit boundary for manually overriding a calculated Studio37 customer price.

The implementation lives in `src/features/pricing/manualPriceOverride.js` and exports:

- `applyAuthorizedManualPriceOverride()`
- `MANUAL_PRICE_OVERRIDE_REASON_MAX_LENGTH`

A manual override never edits the configured pricing rule and never erases the automatic calculation. The Phase 5A12 pricing snapshot remains the historical baseline, while this phase records an explicit authorized exception on top of that baseline.

## Source Requirements

PRD-06 requires a manual override to preserve:

- calculated original amount
- overridden final amount
- actor
- timestamp
- reason

PRD-03 defines `booking.override_price` as the capability for price override actions. Owner access is implicit through the existing capability resolver; a Studio Operator must receive the capability explicitly.

PRD-17 requires manual price override coverage in the pricing test matrix.

## Pipeline Position

The pricing domain pipeline is now:

1. filter active/session/effective rules
2. resolve studio scope
3. resolve numeric priority
4. reject equal-highest ambiguity
5. calculate base pricing
6. calculate add-ons
7. calculate discount
8. build immutable automatic pricing snapshot
9. optionally apply an authorized manual price override
10. later persist the automatic snapshot and optional override with the Booking workflow

Phase 5A13 implements step 9 only.

## Public API

```js
applyAuthorizedManualPriceOverride({
  access,
  overrideAmountIdr,
  overrideTime,
  pricingSnapshot,
  reason,
});
```

Unknown top-level fields fail closed.

The caller does not provide `actorUid` or `calculatedOriginalAmountIdr`. Those values are derived from trusted domain inputs:

- actor UID comes from the authenticated active user profile
- original calculated amount comes from the Phase 5A12 pricing snapshot

This prevents the domain API from accepting caller-authored audit identity or baseline price fields.

## Authorization

The override is allowed only when all of these are true:

- `access.status` is `authenticated`
- the application profile is active
- the profile role is canonical `owner | studio_operator`
- the Firebase authenticated UID matches the application profile UID
- `hasCapability(access, CAPABILITIES.BOOKING_OVERRIDE_PRICE)` returns true

Owner therefore has implicit override authority through the existing authorization model.

A Studio Operator must have explicit `booking.override_price` capability through the existing permission-set system.

This pure client/domain check does not replace later Firestore Security Rules for persisted Booking mutations. Booking persistence and server-side write authorization remain deferred to the Booking phase.

## Automatic Baseline Preservation

The automatic pricing snapshot remains unchanged.

The override function reads and validates its baseline but does not modify:

- selected pricing rule configuration
- base calculation
- add-on calculation
- discount calculation
- automatic final amount
- snapshot versions

The configured pricing rule therefore remains referenced through the original pricing snapshot exactly as required by PRD-06.

## Baseline Integrity Checks

Before an override is created, the snapshot must:

- have the exact Phase 5A12 top-level shape
- use the current supported snapshot version
- use the current supported calculation version
- contain a canonical ISO pricing timestamp
- contain a valid pricing-rule document ID
- contain non-negative safe-integer IDR amount fields
- satisfy `subtotal = base + add-ons`
- keep discountable amount within subtotal
- keep discount amount within discountable amount
- satisfy the recorded non-discountable amount
- satisfy the recorded automatic final amount

This is a focused baseline guard for override application. Full base/add-on/discount replay remains owned by the Phase 5A12 snapshot builder.

## Override Amount

`overrideAmountIdr` must be a non-negative JavaScript safe integer IDR amount.

The override may:

- reduce the total
- increase the total
- set the final total to Rp0

A manual override whose amount is identical to the calculated automatic amount is rejected. It would create audit noise without changing the pricing decision.

Negative, fractional, or unsafe-integer IDR values fail closed.

## Reason

Every override requires a non-empty reason.

The reason is trimmed and limited to `500` characters through `MANUAL_PRICE_OVERRIDE_REASON_MAX_LENGTH`.

The reason is mandatory because the override is an auditable exception to configured pricing rather than a hidden mutation.

## Timestamp

`overrideTime` accepts the shared timestamp boundary used elsewhere in the application: JavaScript `Date` or Firestore Timestamp-compatible input.

The stored override timestamp is converted to a deterministic ISO-8601 string.

An override cannot be timestamped before the automatic pricing snapshot's `pricingTimeIso`.

The pure domain model does not compare the supplied timestamp against wall-clock `now`; server-owned persisted timestamps remain a later repository/Booking concern.

## Output

A successful override returns:

```js
{
  calculationVersion,
  finalAmountIdr,
  manualOverride: {
    actorRole,
    actorUid,
    authorizationCapability,
    calculatedOriginalAmountIdr,
    overriddenAtIso,
    overriddenFinalAmountIdr,
    reason,
  },
  pricingRuleId,
  snapshotVersion,
}
```

`authorizationCapability` is always:

```text
booking.override_price
```

The result and nested `manualOverride` object are frozen.

## Actor Audit Semantics

`actorUid` is the canonical application/Firebase UID at override time.

`actorRole` records whether the authorized actor was an Owner or Studio Operator when the override model was created.

The function does not accept a display name as audit identity because display names are mutable. UI can resolve current human-readable identity from the UID, while persisted audit/history layers may later snapshot additional actor presentation fields if required.

## No Silent Repricing

The output keeps both amounts explicitly:

- `manualOverride.calculatedOriginalAmountIdr`
- `manualOverride.overriddenFinalAmountIdr`

`finalAmountIdr` equals the overridden amount only after successful authorization and validation.

Nothing inside the pricing rule or automatic pricing snapshot is rewritten to make the override appear like a normal calculated result.

## Scope Boundary

Phase 5A13 intentionally does not implement:

- Firestore Booking persistence
- Booking Security Rules for override writes
- Booking confirmation/repricing UI
- server-owned override timestamps
- audit-log document creation
- Price Settings UI
- discount/add-on persistence editors
- human-readable pricing preview
- Session/Studio/Customer booking snapshots
- final PRD-17 persisted historical-snapshot integration gate
- responsive Price Settings QA
- Firebase Hosting or production deployment

Those concerns remain with later phases.

## Quality Expectations

Automated coverage verifies:

- Owner implicit override authority
- Studio Operator explicit `booking.override_price` authority
- unauthorized operator rejection
- unauthenticated rejection
- disabled actor rejection
- Firebase UID/profile UID mismatch rejection
- unsupported actor-role rejection
- upward override
- downward override
- zero-IDR override
- negative/fractional/unsafe amount rejection
- no-op override rejection
- mandatory trimmed reason and maximum length
- override timestamp ordering
- original amount derivation from pricing snapshot
- pricing rule identity derivation from pricing snapshot
- unsupported snapshot version rejection
- malformed snapshot shape rejection
- internally inconsistent amount-summary rejection
- invalid pricing-rule identity rejection
- invalid pricing timestamp rejection
- caller-authored actor/audit field rejection
- frozen result and preservation of the original pricing snapshot

PRD-18 is updated only after the complete repository Quality workflow passes.
