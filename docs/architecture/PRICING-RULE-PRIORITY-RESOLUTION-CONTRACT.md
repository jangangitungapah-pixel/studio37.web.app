# Pricing Rule Priority Resolution Contract

## Purpose

Phase 5A10 adds deterministic numeric-priority resolution to the Studio37 pricing-rule pipeline.

The implementation extends `src/features/pricing/pricingRuleResolution.js` with `resolvePricingRulePriority()`.

This phase does not decide whether equal-priority candidates are valid. It deliberately preserves every candidate that shares the highest priority so the later ambiguity gate can reject an unresolved tie explicitly.

## Pipeline Position

Pricing-rule selection is composed in this order:

1. active/session/effective eligibility filtering
2. matching pricing condition or package selection where applicable
3. exact-studio versus general-studio scope resolution
4. numeric priority resolution
5. equal-match ambiguity rejection

Phase 5A10 implements step 4 only.

Studio specificity remains stronger than numeric priority. A general rule with priority `999` must not outrank an exact-studio rule with priority `1` after exact-studio scope has already been selected.

## Public API

```js
resolvePricingRulePriority({
  rules,
});
```

`rules` is the candidate set produced after earlier eligibility and studio-scope resolution steps.

The function accepts at most the existing pricing-rule repository limit and decodes every candidate through the canonical pricing-rule document model before applying priority.

## Priority Semantics

Pricing-rule priority is already constrained by the canonical rule model to an integer from `1` through `999`.

Higher numbers have higher precedence.

Example:

- rule A priority `10`
- rule B priority `200`
- rule C priority `50`

The Phase 5A10 result contains only rule B and reports `highestPriority: 200`.

The algorithm does not depend on repository order or caller array order.

## Equal Highest Priority

If more than one candidate has the same highest priority, all of those candidates remain in the result.

Example:

- rule A priority `500`
- rule B priority `500`
- rule C priority `100`

The result contains rule A and rule B. Phase 5A10 does not select one of them.

Equal-highest candidates are ordered by rule ID only to make the returned array stable for identical candidate sets supplied in different input orders. ID ordering is not a business tie-break and must never be interpreted as choosing a winner.

The next ambiguity checkpoint owns the rule that multiple equally valid highest-priority candidates must fail clearly rather than silently selecting one.

## Why `comparePricingRules()` Is Not Winner Logic

The existing `comparePricingRules()` helper orders pricing rules by priority and then falls back to name and ID for deterministic administrative list ordering.

Phase 5A10 intentionally does not use those name/ID fallbacks to choose a pricing winner.

Using administrative sort order as business selection logic would hide equal-priority configuration ambiguity and violate PRD-06.

## Candidate Preconditions

Priority resolution fails closed unless every non-empty candidate set:

- contains canonical pricing-rule documents
- contains only active rules
- belongs to one session type
- belongs to one studio scope
- respects the canonical priority range

A mixed general/exact-studio set is rejected because studio-scope resolution must run before priority resolution.

An empty candidate set is valid and produces:

```js
{
  highestPriority: null,
  rules: [],
}
```

## Normalized Output

A non-empty result has this shape:

```js
{
  highestPriority: 500,
  rules: [
    // every canonical candidate whose priority is exactly 500
  ],
}
```

The result object and returned rule array are frozen.

The caller-owned candidate array is never mutated.

## Scope Boundary

Phase 5A10 does not implement:

- equal-priority ambiguity rejection
- package/condition discovery
- Firestore queries or writes
- pricing calculation
- add-on or discount composition
- pricing snapshots
- manual price overrides
- Booking integration
- Price Settings UI
- human-readable pricing explanation
- responsive QA

Those concerns remain with their later checkpoints.

## Quality Expectations

Automated coverage verifies:

- unique highest priority selection
- input-order independence
- preservation of equal-highest candidates
- stable equal-priority output ordering without tie-breaking
- studio specificity before numeric priority
- explicit empty-candidate behavior
- frozen output and caller-array immutability
- unsupported shape rejection
- malformed rule rejection
- disabled rule rejection
- mixed-session rejection
- mixed-studio-scope rejection
- canonical priority-range validation

PRD-18 is updated only after the complete repository Quality workflow passes.
