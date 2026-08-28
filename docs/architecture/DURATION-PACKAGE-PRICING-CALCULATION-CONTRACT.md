# Duration-Package Pricing Calculation Contract

## Purpose

Define the Phase 5A5 pure duration-package pricing boundary for Studio37. This slice turns one
canonical duration-package configuration plus one requested duration into a deterministic
integer-IDR calculation result. It performs no Firestore access, rule selection, package discovery,
booking mutation, snapshot generation, or React rendering.

## Source and public API

The calculator lives at:

```text
src/features/pricing/durationPackagePricing.js
```

It exposes one operation:

```js
calculateDurationPackagePrice({ pricingModel, configuration, durationMinutes });
```

The input contains exactly those three fields. A persisted pricing-rule document is intentionally
not accepted because status, effective dates, priority, session/studio scope, winning-rule
selection, and package discovery belong to later Phase 5 slices.

## Canonical package configuration

`pricingModel` must be `duration_package`.

The configuration contains exactly:

- `amountIdr`: non-negative JavaScript-safe integer IDR package amount.
- `durationMinutes`: configured package duration using the existing 15-minute pricing-rule step,
  from 15 through 1,440 minutes.
- `extraTimePolicy`: `blocked`, `additional`, or `another_package`.
- `additionalAmountPerIncrementIdr`: required only for `additional`; otherwise null.
- `additionalIncrementMinutes`: required only for `additional`; otherwise null.
- `roundingMode`: `exact` or `round_up` for `additional`; otherwise null.

The requested `durationMinutes` must be a positive JavaScript-safe integer. This calculation layer
does not invent an additional requested-duration maximum because the current pricing configuration
only defines the selected package duration and its overtime behavior.

## Package-duration boundary

A selected package represents an explicit duration and price. A requested duration shorter than the
selected package duration is rejected instead of silently charging a larger package for a smaller
request. The package-selection layer can later choose a different matching package when one exists.

A requested duration exactly equal to the package duration returns the configured package amount
without any overtime charge.

## Extra-time policies

### `blocked`

Any requested duration beyond the package duration is rejected.

### `additional`

Only the duration beyond the package duration is priced using the configured additional increment
and amount.

In `exact` mode, overtime must divide evenly by `additionalIncrementMinutes`. Partial overtime is
rejected.

In `round_up` mode, overtime is deterministically rounded upward to the next complete additional
increment. Already aligned overtime is not rounded again.

The calculator uses checked safe-integer multiplication for the overtime amount and checked
safe-integer addition for package amount plus overtime amount.

### `another_package`

Exact package duration is valid. Overtime is rejected with an explicit error stating that another
package is required.

Phase 5A5 deliberately does not silently choose or combine another package. Resolving another
package requires access to candidate rules/packages and belongs to the later deterministic rule and
package-resolution slices.

## Calculation order

1. Reject non-object or unsupported input shapes.
2. Reject a pricing model other than `duration_package`.
3. Validate the exact canonical package configuration.
4. Validate the requested duration as a positive safe integer minute value.
5. Reject requested duration shorter than the selected package duration.
6. If requested duration equals the package duration, return the package amount unchanged.
7. If overtime exists, apply the configured extra-time policy.
8. For `additional`, apply exact or round-up increment behavior.
9. Calculate overtime with checked safe-integer IDR multiplication.
10. Add package and overtime amounts with checked safe-integer IDR addition.
11. Return one frozen normalized calculation breakdown.

## Deterministic output

Successful calculation returns one frozen object containing:

- `pricingModel`
- `inputDurationMinutes`
- `packageDurationMinutes`
- `packageAmountIdr`
- `extraTimePolicy`
- `additionalDurationMinutes`
- `additionalIncrementMinutes`
- `additionalAmountPerIncrementIdr`
- `roundingMode`
- `billedAdditionalDurationMinutes`
- `billedAdditionalIncrementCount`
- `additionalAmountIdr`
- `billableDurationMinutes`
- `totalAmountIdr`

For non-`additional` policies, configuration fields that do not apply remain null. On an exact
package-duration calculation, overtime quantities and overtime amount are zero.

The output is a machine-readable calculation breakdown. It is not a booking pricing snapshot and
contains no rule ID, package ID, studio ID, session ID, actor, timestamp, or calculation-version
metadata.

## Failure semantics

- `TypeError` reports non-object input/configuration, unsupported shapes, policy-field mismatch, and
  non-safe-integer money or requested-duration values.
- `RangeError` reports a wrong pricing model, invalid configured duration/policy/rounding values,
  requested duration below the package duration, blocked overtime, another-package overtime,
  exact-mode overtime misalignment, and safe-integer overflow.
- The calculator never mutates input and never returns a partial result after failure.

## Automated coverage

Focused unit coverage includes:

- exact blocked package
- exact another-package policy
- exact additional-policy package
- additional round-up overtime
- additional exact overtime
- exact-mode partial overtime rejection
- blocked overtime rejection
- another-package overtime rejection
- requested duration below package rejection
- malformed input/configuration and unsupported fields
- policy/additional-field mismatch
- invalid configured amounts/durations
- invalid requested duration
- multiplication and total overflow
- safe integer boundary behavior
- deterministic frozen output and input immutability

The broader PRD-17 pricing matrix still requires multiple package choices such as 3-hour and 6-hour
packages. This slice provides the pure calculation primitive for one selected package; candidate
selection and ambiguity handling remain separate work.

## Deferred boundaries

Phase 5A5 does not implement:

- duration-package candidate discovery or package-to-package resolution
- base-plus-additional pricing
- studio/effective-time/priority winning-rule resolution
- equal-match ambiguity rejection
- add-ons or discounts
- pricing snapshots or manual overrides
- Price Settings UI
- Booking integration

Those remain separate PRD-18 checklist items and quality gates.
