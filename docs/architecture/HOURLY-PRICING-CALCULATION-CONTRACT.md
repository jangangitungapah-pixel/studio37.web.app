# Hourly Pricing Calculation Contract

## Purpose

Define the Phase 5A3 pure hourly calculation boundary for Studio37. This slice turns one canonical
Phase 5A2 hourly configuration and one explicit requested duration into a deterministic integer-IDR
breakdown. It performs no Firestore access, rule selection, booking mutation, or React rendering.

## Source and public API

The calculator lives at:

```text
src/features/pricing/hourlyPricing.js
```

It exposes one operation:

```js
calculateHourlyPrice({ pricingModel, configuration, durationMinutes });
```

The input contains exactly those three fields. A full persisted pricing-rule document is not
accepted because status, effective dates, priority, session/studio scope, and winning-rule
selection belong to later Phase 5 slices.

## Canonical input

`pricingModel` must be `hourly`. `configuration` must match the Phase 5A2 hourly shape exactly,
and the separate requested duration must satisfy this calculation boundary:

| Input path                             | Contract                                                       |
| -------------------------------------- | -------------------------------------------------------------- |
| `configuration.amountPerIncrementIdr`  | Non-negative JavaScript-safe integer IDR                       |
| `configuration.incrementMinutes`       | 15-minute increment from 15 through 1,440                      |
| `configuration.minimumDurationMinutes` | 15-minute increment from 15 through 1,440                      |
| `configuration.roundingMode`           | `exact` or `round_up`                                          |
| `durationMinutes`                      | Positive JavaScript-safe integer requested duration in minutes |

The requested duration has no additional Phase 5A3 maximum or booking-granularity restriction.
The current hourly schema defines a minimum but no configurable maximum, and future Booking logic
owns any calendar-granularity constraint.

## Calculation order

1. Reject a non-hourly model, unsupported input shape, malformed canonical configuration, or
   non-positive/non-integer duration.
2. Reject a requested duration below `minimumDurationMinutes`. The calculator never silently
   raises an invalid request to the minimum.
3. In `exact` mode, reject a duration that is not divisible by `incrementMinutes`.
4. In `round_up` mode, compute the billed increment count with a deterministic mathematical
   ceiling. An already aligned duration is unchanged.
5. Multiply the billed increment count by `amountPerIncrementIdr` with checked safe-integer IDR
   arithmetic. Reject an unsafe derived duration or amount instead of returning a rounded Number.

A canonical minimum does not need to be divisible by the pricing increment. For example, a
90-minute minimum with a 60-minute increment rejects 90 minutes in `exact` mode and bills two
increments in `round_up` mode.

## Deterministic output

The calculator returns one frozen object containing exactly:

| Field                     | Meaning                                           |
| ------------------------- | ------------------------------------------------- |
| `pricingModel`            | Always `hourly`                                   |
| `inputDurationMinutes`    | Requested duration, unchanged                     |
| `minimumDurationMinutes`  | Applied minimum from the canonical configuration  |
| `roundingMode`            | Applied `exact` or `round_up` behavior            |
| `incrementMinutes`        | Duration represented by one billed increment      |
| `billableDurationMinutes` | Duration represented by all billed increments     |
| `billedIncrementCount`    | Whole number of increments charged                |
| `amountPerIncrementIdr`   | Integer-IDR unit amount                           |
| `totalAmountIdr`          | Checked unit amount multiplied by increment count |

This is a machine-readable calculation explanation/breakdown. Human-facing localization can be
derived later without embedding display text in the business engine. The object is not a booking
pricing snapshot and contains no rule, session, studio, actor, timestamp, or version metadata.

## Failure semantics

- `TypeError` reports non-object/unsupported shapes and non-safe-integer duration or amount input.
- `RangeError` reports a wrong pricing model, invalid canonical values, below-minimum duration,
  exact-mode misalignment, and safe-integer overflow.
- The calculator does not mutate its input and does not partially return a result after failure.

## Automated coverage

Focused unit tests cover exact aligned duration, exact partial-increment rejection, minimum
rejection, round-up behavior, already-aligned round-up behavior, malformed shapes and values,
wrong pricing model, canonical configuration reuse, derived-duration overflow, money overflow,
safe boundary multiplication, zero-price configuration, deterministic output, and immutability.

## Deferred boundaries

Phase 5A3 does not implement fixed-session, duration-package, or base-plus-additional calculators;
Firestore reads or winning-rule resolution; effective-time, studio, priority, or ambiguity logic;
add-ons, discounts, snapshots, overrides, Pricing Settings UI, or Booking integration. Those
remain separate checklist items and quality gates in PRD-18.
