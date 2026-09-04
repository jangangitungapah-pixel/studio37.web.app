# Pricing Configuration Validation Contract

## Purpose

Phase 5B8 adds a human-readable validation boundary for Price Settings without creating a second pricing engine in React. The validator explains whether persisted pricing configuration is healthy and blocks a proposed save or reactivation only when that candidate would remain invalid, ambiguous, or unverifiable.

This contract implements the Price Settings validation requirements from PRD-06 and PRD-11 while preserving the canonical pricing domain established in Phase 5A.

## Source of truth

Validation reuses existing production contracts instead of duplicating pricing rules in UI code:

- `normalizePricingRuleDetails()` validates the canonical pricing-rule envelope and model-specific configuration.
- `hasPricingRuleWriteCollision()` owns package-aware ambiguity semantics.
- Existing Session Type and Studio Room status constants define active versus inactive references.
- Existing bounded repositories remain the only Firestore read/write boundary.

The validator does not calculate booking prices, select a booking-time winner, build pricing snapshots, or mutate persisted configuration.

## Global configuration health

`validatePricingConfiguration()` inspects the bounded Price Settings data already loaded by the UI and returns a frozen result containing:

- `blocking`
- `complete`
- `errors`
- `warnings`
- `issues`

The read-only Configuration Health panel translates those results into human-readable status and per-rule feedback.

### Blocking issues

The global health surface reports these conditions as blocking configuration defects:

- malformed canonical pricing-rule configuration
- missing Session Type reference on an active rule
- missing exact Studio Room reference when studio references are available
- ambiguous active rules with the same session, studio scope, numeric priority, and overlapping effective window
- saturated pricing-rule candidate set where complete ambiguity validation cannot be guaranteed

### Warnings and incomplete validation

The health surface reports warnings for conditions that need attention but do not by themselves rewrite historical data:

- active rule references an inactive Session Type
- active exact-studio rule references an inactive Studio Room
- exact-studio reference cannot be verified because the current account cannot load Studio Rooms

When exact-studio references cannot be verified, the global result is marked incomplete rather than inventing a missing-reference error.

## Effective-window ambiguity

Collision detection uses start-inclusive and end-exclusive effective windows.

Two otherwise equal resolution envelopes are ambiguous only when their effective windows overlap. Adjacent windows where one rule ends exactly when another begins are allowed.

Unbounded windows participate normally. Malformed effective-window values fail closed.

Duration-package siblings retain the established package rule: distinct package durations may coexist inside the same resolution envelope, while duplicate package durations remain a collision.

## Candidate-scoped write validation

`validatePricingRuleCandidate()` simulates one proposed create, edit, or reactivation against the current bounded configuration before any repository mutation occurs.

Candidate validation intentionally filters global findings to issues relevant to the proposed rule, plus candidate-set saturation. An unrelated legacy ambiguity does not prevent the Owner from editing a different rule to repair configuration elsewhere.

### Save behavior

Create and edit actions validate the candidate before calling the Pricing Rule repository.

A blocking candidate issue prevents the repository write and is surfaced as a human-readable dialog error.

A disabled-rule edit remains disabled during candidate simulation, so editing historical/inactive configuration does not silently reactivate it.

### Reactivation behavior

Reactivation is stricter because the rule would re-enter booking-price resolution.

The action is blocked when candidate validation is blocking or incomplete. In particular, an exact-studio rule cannot be reactivated while its Studio Room reference cannot be verified.

Deactivation remains available because it removes a rule from new-booking resolution and does not damage historical snapshots.

## Candidate-set saturation

The Pricing Rule repository remains bounded to its existing list limit. When the UI reaches that limit, validation cannot prove it has every possible conflicting candidate.

Create, edit, and reactivation therefore fail closed. The validator does not add an unbounded fallback query.

## Firestore and authorization boundary

Phase 5B8 adds no Firestore collection, listener, query, index, Security Rule, or write path.

The validator consumes data that existing bounded repositories already returned to Price Settings. Repository methods continue to own persistence, and existing capabilities continue to control view/edit actions.

A pricing-view-only user can see configuration health but receives no mutation controls.

## Historical safety

Validation is prospective for configuration used by new or explicitly repriced bookings.

It does not:

- update an existing booking
- recalculate a historical booking snapshot
- mutate a pricing snapshot
- change a pricing rule merely because a health issue is detected
- auto-fix or auto-delete invalid configuration

Historical pricing snapshots remain immutable when Price Settings changes.

## UI behavior

Price Settings exposes:

- overall Configuration Health state: Valid, Warning/Incomplete, or Blocking
- human-readable issue messages
- per-rule attention/error badges
- pre-write create/edit validation
- fail-closed reactivation validation

The UI does not expose raw JSON validation output or require the Owner to understand Firestore schema details.

## Explicitly deferred

Phase 5B8 does not implement:

- effective-period editing UI
- discount administration UI
- Booking persistence or Booking form integration
- final PRD-17 pricing matrix acceptance
- final historical-snapshot integration acceptance
- final responsive Price Settings browser acceptance
- Firebase Hosting or production deployment

Those remain separate checkpoints in PRD-18.
