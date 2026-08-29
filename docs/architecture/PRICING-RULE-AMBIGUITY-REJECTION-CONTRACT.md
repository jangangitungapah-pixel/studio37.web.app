# Pricing Rule Ambiguity Rejection Contract

## Purpose

Phase 5A11 closes the pricing-rule selection pipeline with an explicit ambiguity gate.

The implementation extends `src/features/pricing/pricingRuleResolution.js` with `resolveUniquePricingRuleMatch()` and `PricingRuleAmbiguityError`.

This phase does not invent another tie-break. If more than one equally valid highest-priority rule remains after eligibility, studio scope, and numeric priority resolution, the configuration fails clearly.

## Pipeline Position

Pricing-rule selection is composed in this order:

1. active/session/effective eligibility filtering
2. matching package/condition selection where applicable
3. exact-studio versus general-studio scope resolution
4. numeric priority resolution
5. unique-match / ambiguity gate

Phase 5A11 implements step 5 only.

The input to this gate is the normalized result from `resolvePricingRulePriority()`:

```js
{
  highestPriority,
  rules,
}
```

## Public API

```js
resolveUniquePricingRuleMatch({
  highestPriority,
  rules,
});
```

The function validates the complete candidate set again rather than trusting caller sequencing blindly.

## No Match

When priority resolution produced no candidates, the valid input is:

```js
{
  highestPriority: null,
  rules: [],
}
```

The result is:

```js
{
  highestPriority: null,
  matchStatus: 'none',
  rule: null,
}
```

No-match is not classified as ambiguity.

## Unique Match

When exactly one canonical candidate remains at `highestPriority`, the result is:

```js
{
  highestPriority: 500,
  matchStatus: 'unique',
  rule: pricingRule,
}
```

The returned result and decoded pricing rule are frozen.

## Ambiguous Match

When two or more distinct rules remain at the same highest priority, the resolver throws `PricingRuleAmbiguityError`.

The error exposes stable machine-readable metadata:

```js
{
  name: 'PricingRuleAmbiguityError',
  code: 'PRICING_RULE_AMBIGUITY',
  highestPriority: 500,
  ruleIds: ['rule-a', 'rule-z'],
}
```

`ruleIds` is sorted deterministically and frozen.

The error message identifies the conflicting priority and rule IDs so later UI or diagnostics can explain which configuration must be corrected.

## No Silent Tie-Break

The ambiguity gate must never select a winner using:

- rule ID
- rule name
- repository order
- caller array order
- creation timestamp
- update timestamp
- administrative list sorting

Those values are not pricing precedence rules.

A duplicate equal-priority configuration that matches the same scenario must be corrected by configuration rather than hidden by an arbitrary fallback.

## Priority Consistency

The gate requires every non-empty candidate to have a priority exactly equal to the supplied `highestPriority`.

This rejects callers that bypass `resolvePricingRulePriority()` or accidentally mix lower-priority candidates back into the final set.

`highestPriority` must be an integer from 1 through 999 for a non-empty candidate set and must be `null` for an empty set.

## Candidate Preconditions

The gate fails closed unless candidates:

- are canonical pricing-rule documents
- are active
- belong to one session type
- belong to one studio scope
- have distinct rule IDs
- all equal the supplied highest priority
- respect the existing bounded pricing-rule candidate limit

Duplicate occurrences of the same rule ID are treated as malformed pipeline input, not as a pricing configuration ambiguity between two distinct rules.

## Studio Precedence

Exact-studio versus general-studio selection happens before numeric priority and ambiguity rejection.

Therefore:

- a general rule cannot rescue an ambiguous exact-studio candidate set
- a high-priority general rule cannot outrank an exact-studio rule after exact scope has been selected
- ambiguity is evaluated only inside the already-selected studio scope

## Scope Boundary

Phase 5A11 does not implement:

- pricing snapshot construction
- manual price overrides
- Firestore discount/add-on persistence
- Price Settings UI
- configuration editor conflict prevention before save
- Booking integration
- human-readable pricing preview
- responsive Price Settings QA
- Firebase Hosting or production deployment

Those concerns remain with later checkpoints.

## Quality Expectations

Automated coverage verifies:

- unique highest-priority match
- explicit no-match result
- lower-priority alternatives excluded before ambiguity evaluation
- exact-studio precedence through the composed resolver pipeline
- typed equal-highest ambiguity error
- deterministic ambiguity metadata regardless of input order
- ambiguity inside exact-studio scope without general fallback
- mixed-priority bypass rejection
- mismatched highest-priority rejection
- empty/highest-priority consistency
- duplicate rule-ID rejection
- disabled rule rejection
- mixed-session rejection
- mixed-studio-scope rejection
- malformed rule and unsupported input-shape rejection
- highest-priority range validation
- frozen successful output and ambiguity rule-ID metadata

PRD-18 is updated only after the complete repository Quality workflow passes.
