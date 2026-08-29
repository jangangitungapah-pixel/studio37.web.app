# Pricing Snapshot Contract

## Purpose

Phase 5A12 introduces the pure historical pricing snapshot boundary for Studio37.

A confirmed booking must preserve enough pricing truth to explain the agreed amount even after Price Settings change later. References remain useful for navigation, but the snapshot owns the historical calculation facts.

The implementation lives in `src/features/pricing/pricingSnapshot.js` and exports:

- `buildPricingSnapshot()`
- `PRICING_SNAPSHOT_VERSION`
- `PRICING_CALCULATION_VERSION`

This phase does not persist a booking or implement manual price override.

## Pipeline Position

The intended pricing pipeline is:

1. filter active/session/effective pricing rules
2. resolve exact-studio versus general scope
3. resolve numeric priority
4. reject ambiguous equal-highest matches
5. calculate the selected base pricing model
6. calculate selected add-ons
7. calculate an explicit discount boundary
8. build the immutable pricing snapshot
9. optionally apply an authorized manual override in the later override phase
10. persist the resulting pricing history with the booking in the Booking phase

Phase 5A12 implements step 8 only.

## Public API

```js
buildPricingSnapshot({
  addOnCalculation,
  baseCalculation,
  discountCalculation,
  pricingRule,
  pricingTime,
});
```

All five fields are required. Unknown fields fail closed.

The caller must supply the normalized outputs produced by the existing pure pricing calculators. Empty add-ons and no discount are still explicit calculations rather than omitted fields.

## Selected Rule Binding

`pricingRule` must be a canonical persisted pricing-rule document.

At snapshot construction it must:

- be active
- be effective at `pricingTime`
- use a supported pricing model
- pass the canonical pricing-rule document decoder

The effective start is inclusive and the effective end is exclusive, matching Phase 5A7 rule eligibility semantics.

The builder replays the supplied base calculation against the configuration stored on this exact selected rule. A calculation that is mathematically valid for some other configuration is rejected.

Example:

- selected rule says fixed session = Rp500.000
- supplied calculation says fixed session = Rp600.000
- Rp600.000 is a valid fixed-session calculation by itself
- snapshot construction still fails because it does not match the selected rule configuration

This prevents a valid-but-unrelated calculation from being attached to the wrong historical rule.

## Calculator Replay Integrity

The snapshot builder does not invent new pricing algorithms. It reuses the quality-gated calculators to canonicalize and verify supplied results.

Base calculation replay supports:

- hourly
- fixed session
- duration package
- base + additional time

Add-on replay supports:

- fixed add-on
- quantity add-on
- time add-on

Discount replay supports:

- no discount
- fixed discount
- percentage discount

Derived values supplied by callers must exactly match the canonical replay. A tampered base total, add-on subtotal/item, or discount amount fails before snapshot creation.

## Cross-Engine Reconciliation

The builder reconciles the independently calculated components:

```text
subtotal = base amount + add-on amount
non-discountable amount = subtotal - discountable amount
final amount = discount calculator final amount + non-discountable amount
```

The discountable amount must not exceed the subtotal.

This supports both:

- discount on the full subtotal
- discount on only part of the subtotal, for example base price excluding add-ons

The builder does not guess which items are discountable. That policy remains explicit in the caller-owned `discountCalculation.discountableAmountIdr` established by Phase 5A9.

## Snapshot Output

The normalized snapshot has this top-level shape:

```js
{
  addOnCalculation,
  amounts,
  baseCalculation,
  calculationVersion,
  discountCalculation,
  pricingTimeIso,
  rule,
  snapshotVersion,
}
```

### `rule`

The historical rule context contains:

```js
{
  configuration,
  effectiveFromIso,
  effectiveUntilIso,
  id,
  name,
  pricingModel,
  priority,
  sessionTypeId,
  sourceUpdatedAtIso,
  sourceUpdatedByUid,
  studioId,
}
```

`sourceUpdatedAtIso` identifies the version of mutable rule state captured by the snapshot without relying on the rule document remaining unchanged later.

### `amounts`

The reconciled amount summary contains:

```js
{
  addOnAmountIdr,
  baseAmountIdr,
  discountAmountIdr,
  discountableAmountIdr,
  finalAmountIdr,
  nonDiscountableAmountIdr,
  subtotalAmountIdr,
}
```

All money remains integer IDR and checked against the existing safe-integer money boundary.

## Version Metadata

Phase 5A12 starts both constants at version `1`:

```js
PRICING_SNAPSHOT_VERSION = 1
PRICING_CALCULATION_VERSION = 1
```

`PRICING_SNAPSHOT_VERSION` identifies the stored snapshot schema.

`PRICING_CALCULATION_VERSION` identifies the calculation-contract generation that produced the snapshot. Future materially incompatible calculation semantics can increment this version without rewriting historical records.

## Immutable Historical Data

The builder returns a new frozen snapshot and does not retain caller-owned mutable objects.

Nested historical objects are copied and frozen, including:

- rule configuration
- base calculation
- add-on calculation
- add-on item array and items
- discount calculation
- reconciled amounts

Pricing and rule timestamps are stored in the snapshot as ISO-8601 strings. This avoids retaining mutable JavaScript `Date` objects inside the historical object while remaining deterministic and human-readable.

Changing the source rule or source calculation object after snapshot construction must not alter the snapshot.

## Historical Stability

Later edits to a pricing rule do not recalculate an existing snapshot.

For example, if a booking snapshot captured:

```text
rule-fixed / Rp500.000 / snapshot version 1
```

and Price Settings later changes that rule to Rp650.000, the existing booking snapshot remains Rp500.000.

Explicit repricing is a later Booking workflow and must create a newly reviewed pricing result rather than mutating history silently.

## Scope Boundary

Phase 5A12 intentionally does not implement:

- authorized manual price overrides
- override actor/time/reason metadata
- Firestore booking writes
- Booking model or booking confirmation
- Session/Studio/Customer snapshots
- add-on or discount persistence/editor models
- Price Settings UI
- human-readable pricing preview UI
- pre-save pricing-rule conflict prevention
- responsive Price Settings QA
- Firebase Hosting or production deployment

Manual override is the next Phase 5 domain checkpoint.

## Quality Expectations

Automated coverage verifies:

- base + add-on + partial-discount reconciliation
- all four supported base pricing models
- selected rule identity/configuration capture
- selected-rule configuration binding
- tampered base-calculation rejection
- tampered add-on rejection
- tampered discount rejection
- discountable amount cannot exceed subtotal
- active/effective rule enforcement
- exclusive effective-end behavior
- deterministic versioned output
- deep frozen output
- source-object mutation does not alter historical snapshot
- unsupported input-shape and invalid timestamp rejection

PRD-18 is updated only after the complete repository Quality workflow passes.
