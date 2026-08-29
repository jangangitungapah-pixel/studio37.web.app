# Pricing Rule Resolution Contract

## Purpose

Define the Phase 5A7 pure-domain boundary for pricing-rule eligibility and studio specificity.
This slice makes active/effective filtering and exact-studio versus general-studio precedence
explicit without selecting a final pricing-rule winner.

The resolver performs no Firestore access, React rendering, price calculation, add-on/discount
processing, snapshot mutation, or booking integration.

## Resolution sequence

The intended pricing-rule pipeline is:

1. load a bounded canonical pricing-rule candidate set;
2. filter by active status, exact session type, and effective pricing instant;
3. apply any model/package/duration conditions required by the pricing scenario;
4. resolve studio specificity, preferring exact-studio candidates over general-scope candidates;
5. apply deterministic rule priority in a later phase;
6. reject equal-match ambiguity in a later phase;
7. calculate price and eventually build an immutable booking snapshot.

Keeping studio specificity separate from priority prevents this phase from silently deciding a
winner when multiple otherwise-valid rules remain.

## Eligibility filter

`filterEligiblePricingRules({ rules, sessionTypeId, pricingTime })` accepts at most the existing
pricing-rule repository limit of 200 canonical persisted pricing-rule documents.

Each input rule is revalidated through the existing strict pricing-rule decoder before it can be
used. The filter then retains only rules that are:

- `status: active`;
- for the exact requested `sessionTypeId`;
- effective at the explicit `pricingTime`.

Effective windows follow the Phase 5A2 contract:

- `effectiveFrom` is start-inclusive;
- `effectiveUntil` is end-exclusive;
- null `effectiveFrom` means no lower bound;
- null `effectiveUntil` means no upper bound.

The function returns a frozen normalized object containing the cloned pricing instant, normalized
session ID, and frozen eligible rule array. Empty eligibility is valid and returns an empty array.

## Studio scope resolver

`resolveStudioPricingScope({ rules, studioId })` consumes an already-eligible, otherwise-matching
candidate set. Callers should normally pass output from the eligibility filter after any additional
model/package/duration-condition matching required by the scenario.

The studio resolution rules are:

- requested exact studio with one or more exact-studio candidates -> return all exact-studio
  candidates;
- requested exact studio with no exact-studio candidates -> fall back to all general-scope rules
  where `studioId === null`;
- requested `studioId: null` -> only general-scope rules are eligible;
- no exact/general candidates -> return an explicit `none` scope with an empty rule array.

Exact-studio specificity takes precedence over general scope regardless of numeric priority. The
resolver intentionally preserves the relative input order of candidates and returns every candidate
in the preferred scope.

## Match-scope output

The normalized match-scope values are:

- `exact_studio`;
- `general_studio`;
- `none`.

The returned object and rule array are frozen.

## Fail-closed candidate contract

Studio resolution rejects candidate sets that still contain disabled rules or mix multiple session
types. This catches common misuse where the caller bypasses eligibility filtering.

Effective-time correctness cannot be inferred without a pricing instant, so callers must use the
eligibility filter before studio resolution whenever effective bounds are possible.

All rule documents are decoded through the existing strict persisted-document contract. Malformed
metadata, unknown fields, invalid configuration, or malformed references therefore fail before
resolution.

## Priority and ambiguity boundary

Phase 5A7 does not sort or select by `priority`.

A lower-priority exact-studio candidate still outranks a higher-priority general-scope candidate at
the studio-specificity stage. If multiple exact candidates or multiple fallback general candidates
remain, all remain in the result.

The later deterministic-priority phase must select the highest-priority tier from that result. The
later ambiguity phase must reject multiple equally valid rules rather than using array order, name,
or document ID as a business-price tie breaker.

The administration-only `comparePricingRules()` helper may remain deterministic for list display,
but its name/ID tie breakers are not pricing winner semantics.

## Scope deliberately deferred

Phase 5A7 does not complete:

- model/package/duration condition matching beyond the active/session/effective eligibility filter;
- deterministic winning-rule priority;
- equal-match ambiguity rejection;
- add-on calculation;
- discount calculation;
- pricing snapshot construction;
- authorized manual price override;
- Price Settings UI;
- Booking integration;
- Firebase Hosting or production deployment.

Those remain separate PRD-18 checkpoints.
