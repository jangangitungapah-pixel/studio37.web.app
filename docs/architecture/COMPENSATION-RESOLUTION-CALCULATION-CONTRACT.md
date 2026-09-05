# Compensation Resolution & Calculation Contract

## Status

Phase 6C pure-domain foundation for PRD-07. This contract builds on the canonical `compensationRules` model from Phase 6A/6A2 and the Owner management boundary from Phase 6B.

This slice resolves one compensation rule for one booking/operator calculation context and calculates the expected amount. It does not persist booking snapshots, create commission entries, transition earning state, settle payouts, apply manual adjustments, or modify customer pricing.

## Calculation context

A compensation calculation context contains:

- `operatorId`
- `operatorType`
- nullable `sessionTypeId`
- nullable `studioId`
- `durationMinutes`
- `effectiveAt`
- zero or more explicitly named `percentageBaseAmounts`

The engine never queries Firestore. Callers must provide already-decoded canonical rules and the calculation context.

## Eligibility

A rule is eligible only when all of the following are true:

1. rule status is `active`
2. `operatorType` matches exactly
3. a non-null rule `operatorId` matches exactly
4. a non-null rule `sessionTypeId` matches exactly
5. a non-null rule `studioId` matches exactly
6. `effectiveAt` is inside the rule effective window
7. for `package`, rule duration matches `durationMinutes` exactly

Effective windows use an inclusive start and exclusive end:

```text
effectiveFrom <= effectiveAt < effectiveUntil
```

A null boundary is unbounded on that side.

## Deterministic winner resolution

Rule resolution is independent of query order, document ID, rule name, or creation time.

### Step 1 — specificity

Each matching exact scope contributes one specificity point:

- exact `operatorId`: +1
- exact `sessionTypeId`: +1
- exact `studioId`: +1
- exact package duration: +1 for `package` rules

The candidate with the highest specificity wins this step.

Specificity is evaluated before numeric priority. A more-specific rule therefore beats a generic rule even when the generic rule has a larger `priority` value.

### Step 2 — priority

Among candidates with equal highest specificity, the highest numeric `priority` wins.

### Step 3 — ambiguity rejection

If two or more candidates still have equal winning specificity and priority, the configuration is ambiguous. The engine throws `CompensationRuleAmbiguityError` and includes the conflicting rule IDs.

It must never silently break a tie by:

- name
- document ID
- query order
- insertion order
- update time

This implements PRD-07's requirement to resolve deterministically and reject ambiguous configuration.

## Per-hour calculation

`per_hour` compensation is prorated by compensated minutes:

```text
amountPerHourIdr * durationMinutes / 60
```

The result is rounded **half-up to the nearest whole IDR**.

Examples:

- Rp20.000/hour x 90 minutes = Rp30.000
- Rp1/hour x 30 minutes = Rp1 after half-up rounding

Integer/BigInt arithmetic is used internally so intermediate multiplication does not introduce floating-point drift.

## Per-session calculation

`per_session` returns the configured `amountIdr` unchanged for the resolved qualifying rule.

## Fixed calculation

`fixed` returns the configured `amountIdr` unchanged for the resolved qualifying rule.

The event/lifecycle condition that ultimately earns a fixed amount is still outside this slice.

## Package calculation

`package` requires exact duration equality with `configuration.durationMinutes` and returns the configured `amountIdr` unchanged.

A package rule whose duration does not match is not an eligible resolver candidate. Direct package calculation also fails closed on duration mismatch.

## Percentage calculation

A percentage rule declares both:

- `basisPoints`
- explicit `base`

The calculation is:

```text
baseAmountIdr * basisPoints / 10000
```

The result is rounded **half-up to the nearest whole IDR**.

The calculation context may carry multiple possible named base amounts, but the engine reads only the base explicitly selected by the winning rule. If that base amount is missing, calculation fails closed.

The engine never substitutes another base and never guesses from booking totals.

## Safe integer boundary

Monetary inputs and outputs are whole IDR safe integers. Negative compensation is not accepted by these normal rule models; negative values remain reserved for a later explicit manual-adjustment model.

Intermediate multiplication uses BigInt and the final amount must fit inside JavaScript's safe integer range.

## Pure calculation result

`resolveAndCalculateCompensation()` returns:

- the winning canonical rule
- `expectedAmountIdr`
- a serialization-ready calculation snapshot containing:
  - source rule ID
  - compensation model
  - normalized configuration
  - operator/type context
  - session/studio context
  - duration
  - effective instant as ISO text
  - selected percentage base and amount when applicable
  - expected amount

This snapshot is a pure value only. Phase 6C does not write it to a booking or commission entry.

## No-match behavior

If no rule qualifies, resolution returns `null`. A later booking-integration layer must decide whether a missing compensation rule is allowed, warned, or blocks a workflow for a particular operator assignment.

## Explicit non-goals

- no Firestore reads/writes
- no booking mutation
- no commission-entry generation
- no `pending | earned | paid | void` lifecycle
- no cancellation/repricing reconciliation
- no already-paid protection logic yet
- no manual positive/negative adjustment
- no payout settlement
- no daily/shift allowance approximation
- no customer pricing changes
- no UI changes

## Phase 6C acceptance

- active/effective/scope matching is deterministic
- package duration participates in matching and specificity
- specificity wins before priority
- equal winners are rejected as ambiguous
- all five configured models calculate predictably
- percentage base is explicit and missing bases fail closed
- per-hour and percentage rounding are half-up whole-IDR operations
- calculation snapshot preserves source rule/configuration/inputs/expected amount
- calculation remains pure and independent of Firestore/query ordering
