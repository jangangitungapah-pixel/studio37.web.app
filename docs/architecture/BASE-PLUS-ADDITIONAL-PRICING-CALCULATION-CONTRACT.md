# Base + Additional Pricing Calculation Contract

## Purpose

Phase 5A6 implements one pure business-calculation boundary for the existing
`base_plus_additional` pricing model. It consumes a canonical pricing configuration plus one explicit
requested duration and returns a deterministic machine-readable result.

This calculator performs no Firestore reads/writes, pricing-rule selection, studio/effective-time
resolution, add-on/discount logic, snapshot creation, authorization, React rendering, or booking
mutation.

## Input

`calculateBaseAdditionalPrice()` accepts exactly:

- `pricingModel`: must be `base_plus_additional`
- `configuration`
  - `baseAmountIdr`
  - `baseDurationMinutes`
  - `additionalAmountPerIncrementIdr`
  - `additionalIncrementMinutes`
  - `roundingMode`: `exact | round_up`
- `durationMinutes`: explicit requested duration as a positive safe integer number of minutes

Unknown top-level or configuration fields are rejected instead of being silently ignored.

## Base coverage

The configured `baseAmountIdr` covers the first `baseDurationMinutes`.

A requested duration shorter than or equal to the base duration still costs the configured base
amount. The calculator therefore does not interpret the base duration as a minimum booking duration;
booking/session availability and minimum-duration policy remain separate concerns.

For requests within the base window:

- additional duration = `0`
- billed additional increments = `0`
- additional amount = `0`
- billable duration reported by this pricing model = the configured base duration
- total = base amount

## Additional-time calculation

Only requested minutes beyond the configured base duration are considered additional time.

For `exact` rounding:

- additional duration must divide evenly by `additionalIncrementMinutes`
- a partial increment fails clearly

For `round_up` rounding:

- additional duration is rounded upward to the next configured increment
- already aligned additional duration is not given an extra increment

The additional amount is:

`additionalAmountPerIncrementIdr * billedAdditionalIncrementCount`

The final total is:

`baseAmountIdr + additionalAmountIdr`

All IDR arithmetic uses checked safe-integer helpers. Overflow fails rather than producing an unsafe
financial value.

## Output

The calculator returns a frozen object containing:

- `pricingModel`
- `inputDurationMinutes`
- `baseAmountIdr`
- `baseDurationMinutes`
- `additionalAmountPerIncrementIdr`
- `additionalIncrementMinutes`
- `additionalDurationMinutes`
- `billedAdditionalIncrementCount`
- `billedAdditionalDurationMinutes`
- `billableDurationMinutes`
- `additionalAmountIdr`
- `roundingMode`
- `totalAmountIdr`

This is a calculation result only, not a booking pricing snapshot.

## Validation boundaries

The calculator rejects:

- non-object inputs/configuration
- unsupported input/configuration fields
- pricing models other than `base_plus_additional`
- unsupported rounding modes
- negative or unsafe-integer IDR values
- invalid configured durations outside the pricing-rule duration contract
- zero, negative, fractional, or unsafe requested durations
- partial additional increments in `exact` mode
- unsafe integer multiplication or final-total overflow

Zero-priced base/additional amounts remain valid because the existing pricing-rule schema permits
non-negative integer IDR amounts.

## Explicitly deferred

Phase 5A6 does not implement:

- studio-specific or general-scope rule resolution
- effective-time filtering
- deterministic winning-rule priority
- equal-match ambiguity rejection
- duration-package discovery or selection
- add-ons
- discounts
- pricing snapshots
- authorized manual overrides
- Price Settings UI
- Booking integration

Those remain later Phase 5 workplan items.
