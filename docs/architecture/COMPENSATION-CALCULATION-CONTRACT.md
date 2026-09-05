# Compensation Calculation Contract

## Status

Phase 6B1 pure calculation slice for PRD-07. This contract defines deterministic arithmetic for the five canonical compensation models after a rule has already been selected. It does not select a rule, mutate a booking, create compensation entries, settle payouts, or render management UI.

## Separation from rule resolution

Calculation answers:

> Given one already-selected compensation model/configuration and explicit transaction inputs, what integer-IDR amount results?

Resolution answers:

> Which active/effective compensation rule uniquely wins for an operator and booking context?

Phase 6B1 implements only the first question. A later resolver must apply specificity, effective periods, priority, package eligibility, and ambiguity rejection before calling the calculator.

## General guarantees

- Calculators are pure and have no Firestore dependency.
- Inputs use exact supported shapes. Unknown fields fail closed.
- Monetary values remain non-negative safe integer IDR.
- No customer pricing configuration is read or mutated.
- No percentage base is inferred.
- No partial-hour policy is invented.
- No package duration fallback is invented.

## `per_hour`

Configuration:

```text
amountPerHourIdr
```

Calculation input:

```text
compensatedHours
```

Current Phase 6B1 contract requires `compensatedHours` to be a positive whole safe integer.

```text
amountIdr = amountPerHourIdr * compensatedHours
```

Example:

```text
Rp10.000/hour * 6 compensated hours = Rp60.000
```

### Partial-hour boundary

PRD-07 does not define whether partial hours should be prorated, rounded up, rounded down, or quantized to a smaller increment. Therefore a fractional `compensatedHours` value is rejected. A later policy may extend the model deliberately, but Phase 6B1 must not guess.

## `per_session`

Configuration:

```text
amountIdr
```

Calculation input is an empty object.

The configured amount is returned once for one already-qualified session event.

## `fixed`

Configuration:

```text
amountIdr
```

Calculation input is an empty object.

The configured amount is returned once for one already-qualified fixed-fee event.

The event/earning trigger remains outside this calculator.

## `package`

Configuration:

```text
durationMinutes
amountIdr
```

Calculation input:

```text
durationMinutes
```

Phase 6B1 requires the supplied duration to exactly equal the configured package duration. Both durations must be positive and 15-minute aligned.

A mismatch is rejected. The calculator does not choose a different package, prorate a package, or combine packages. Package winner selection belongs to the later resolver.

Examples from the current configurable policy:

```text
Recording Pro, 360 minutes -> Rp450.000 Recording Engineer compensation
Recording Live, 180 minutes -> Rp285.000 Recording Engineer compensation
```

These are configuration examples, not hardcoded constants.

## `percentage`

Configuration:

```text
basisPoints
base
```

Supported explicit bases remain:

- `booking_subtotal_before_discount`
- `booking_total_after_discount`
- `service_amount`

Calculation input:

```text
base
baseAmountIdr
```

The input `base` must exactly equal the configured `base`. This forces the caller to identify the monetary source explicitly and prevents the calculator from guessing.

One percent is 100 basis points. The amount uses integer floor semantics:

```text
amountIdr = floor(baseAmountIdr * basisPoints / 10000)
```

Implementation uses decomposed integer arithmetic to avoid unsafe intermediate multiplication where practical, matching the deterministic integer-IDR philosophy already used by the pricing engine.

## Result shape

Every calculation returns:

```text
amountIdr
compensationModel
inputs
```

`inputs` records the normalized arithmetic inputs used by the pure calculator. This is not yet the PRD-07 historical compensation snapshot. The later snapshot slice must additionally bind the source rule ID, operator assignment, normalized rule configuration, booking context, expected amount, and versioned snapshot contract.

## Fail-closed cases

Reject at minimum:

- unsupported model
- unknown request/configuration/input fields
- invalid or negative monetary amount
- unsafe integer overflow
- zero/fractional/negative compensated whole-hour count
- package duration mismatch
- non-15-minute-aligned package duration
- unsupported percentage base
- percentage base mismatch
- basis points outside `0..10000`

## Phase 6B1 non-goals

- no compensation rule resolution
- no specificity or priority winner selection
- no active/effective filtering
- no booking integration
- no compensation snapshots
- no Pending/Earned/Paid/Void lifecycle
- no cancellation/repricing recalculation
- no manual adjustment records
- no payout settlement
- no management UI
- no daily meal allowance approximation
- no customer pricing changes
