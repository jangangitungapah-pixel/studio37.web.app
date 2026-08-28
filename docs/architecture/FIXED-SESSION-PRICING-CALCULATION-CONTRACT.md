# Fixed-Session Pricing Calculation Contract

## Purpose

Define the Phase 5A4 pure fixed-session pricing boundary for Studio37.

This slice converts one canonical fixed-session configuration into a deterministic
integer-IDR calculation result. It performs no Firestore access, rule selection,
booking mutation, duration calculation, or React rendering.

## Source and public API

The calculator lives at:

```text
src/features/pricing/fixedSessionPricing.js
```

It exposes one operation:

```js
calculateFixedSessionPrice({ pricingModel, configuration });
```

The input contains exactly those two fields. A persisted pricing-rule document is
not accepted because status, effective dates, priority, session scope, studio scope,
and winning-rule selection belong to later Phase 5 slices.

## Canonical input

The accepted input contract is:

- `pricingModel` must be exactly `fixed_session`.
- `configuration` must be an object containing exactly `amountIdr`.
- `configuration.amountIdr` must be a non-negative safe integer IDR amount.

Zero is valid because the existing pricing-rule schema allows a zero-valued amount.
This slice does not invent a positive minimum that is absent from the source model.

## Duration independence

A fixed-session price is not multiplied by calendar duration and does not accept
`durationMinutes`.

Supplying duration or another extra calculation field is rejected as an unsupported
input shape. Booking logic may still store duration for scheduling, but that duration
does not alter this calculator result.

## Calculation order

1. Reject non-object or unsupported input shapes.
2. Reject a pricing model other than `fixed_session`.
3. Validate the exact one-field configuration.
4. Validate `amountIdr` as a non-negative safe integer IDR value.
5. Return the configured amount unchanged as the final total.

No multiplication, rounding, increment, minimum-duration, package, or overtime logic
is applied.

## Deterministic output

The calculator returns one frozen object with exactly these fields:

- `pricingModel`: always `fixed_session`.
- `amountIdr`: the canonical configured amount.
- `totalAmountIdr`: the final amount, identical to `amountIdr`.

The result is a machine-readable calculation breakdown. It is not a booking pricing
snapshot and contains no rule ID, session ID, studio ID, actor, timestamp, or version
metadata.

## Failure semantics

- `TypeError` covers non-object input, unsupported shapes, and invalid safe-integer money.
- `RangeError` covers a wrong pricing model or negative configured amount.
- The calculator never mutates its input.
- The calculator never partially returns a result after failure.

## Automated coverage

Focused unit tests cover:

- ordinary fixed amounts
- zero amounts
- the maximum safe integer amount
- wrong pricing models
- unsupported top-level fields, including duration
- malformed or non-object configuration
- missing or extra configuration fields
- negative, fractional, unsafe, non-numeric, `NaN`, and infinite amounts
- deterministic frozen output
- input and nested-configuration immutability

## Deferred boundaries

Phase 5A4 does not implement:

- duration-package calculation
- base-plus-additional-time calculation
- Firestore rule reads or winning-rule resolution
- effective-time, studio, priority, or ambiguity logic
- add-ons or discounts
- pricing snapshots or manual overrides
- Price Settings UI
- Booking integration

Those remain separate checklist items and quality gates in PRD-18.
