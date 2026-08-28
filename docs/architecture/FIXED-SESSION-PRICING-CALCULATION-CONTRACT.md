# Fixed-Session Pricing Calculation Contract

## Purpose

Define the Phase 5A4 pure fixed-session pricing boundary for Studio37. This slice turns one canonical
fixed-session pricing configuration into a deterministic integer-IDR calculation result. It performs
no Firestore access, rule selection, booking mutation, duration calculation, or React rendering.

## Source and public API

The calculator lives at:

```text
src/features/pricing/fixedSessionPricing.js
```

It exposes one operation:

```js
calculateFixedSessionPrice({ pricingModel, configuration });
```

The input contains exactly those two fields. A persisted pricing-rule document is intentionally not
accepted because status, effective dates, priority, session/studio scope, and winning-rule selection
belong to later Phase 5 slices.

## Canonical input

`pricingModel` must be `fixed_session`.

`configuration` contains exactly:

| Input path               | Contract                                 |
| ------------------------ | ---------------------------------------- |
| `configuration.amountIdr` | Non-negative JavaScript-safe integer IDR |

Zero is valid because the existing pricing-rule schema allows a zero-valued configured amount. This
slice does not invent a positive minimum that is absent from the source model.

## Duration independence

A fixed-session price is not multiplied by calendar duration and does not accept
`durationMinutes`. Supplying duration or any other extra calculation input is rejected as an
unsupported input shape.

This keeps the engine aligned with PRD-06: a fixed project/session amount remains constant when the
service's calendar duration is not itself a pricing input. Booking logic may still require or store a
duration for scheduling when the session type reserves a studio, but that duration does not alter
this calculation.

## Calculation order

1. Reject non-object or unsupported input shapes.
2. Reject a pricing model other than `fixed_session`.
3. Validate the exact one-field fixed-session configuration.
4. Validate `amountIdr` as a non-negative safe integer IDR value.
5. Return the configured amount unchanged as the final total.

No multiplication, rounding, increment, minimum-duration, package, or overtime behavior is applied.

## Deterministic output

The calculator returns one frozen object containing exactly:

| Field            | Meaning                                      |
| ---------------- | -------------------------------------------- |
| `pricingModel`   | Always `fixed_session`                       |
| `amountIdr`      | Canonical configured fixed-session amount    |
| `totalAmountIdr` | Final amount, identical to `amountIdr`       |

The object is a machine-readable calculation breakdown. It is not a booking pricing snapshot and
contains no rule ID, session ID, studio ID, actor, timestamp, or calculation-version metadata.

## Failure semantics

- `TypeError` reports non-object input/configuration, unsupported shapes, and non-safe-integer money.
- `RangeError` reports a wrong pricing model or negative configured amount.
- The calculator does not mutate its input and does not partially return a result after failure.

## Automated coverage

Focused unit tests cover:

- ordinary fixed amount
- zero amount
- maximum safe integer amount
- wrong pricing model
- unsupported top-level fields, including duration
- malformed/non-object configuration
- missing/extra configuration fields
- negative, fractional, unsafe, non-numeric, NaN, and infinite amounts
- deterministic frozen output
- input/configuration immutability

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
