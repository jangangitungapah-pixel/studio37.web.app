# Phase 5 Pricing Final Acceptance Contract

## Objective

Phase 5C is the final acceptance checkpoint for the Session & Flexible Pricing Engine after Phase 5A and Phase 5B implementation slices. It verifies the existing canonical pricing stack without introducing new pricing behavior.

## Source of truth

This checkpoint is governed by:

- `docs/prd/PRD-06-pricing-session-engine.md`
- `docs/prd/PRD-11-settings.md`
- `docs/prd/PRD-17-testing-qa.md`
- `docs/prd/PRD-18-development-workplan.md`

## Automated acceptance scope

The PRD-17 pricing matrix must exercise the existing canonical modules for:

- hourly exact duration
- hourly fractional/increment behavior
- minimum duration
- 3-hour duration package
- 6-hour duration package
- base + additional time
- studio-specific override resolution
- add-on composition
- fixed discount
- percentage discount
- authorized manual price override
- ambiguous pricing-rule rejection
- inactive-rule exclusion
- historical snapshot stability after source-rule/settings mutation

The matrix must call production pricing modules directly. Phase 5C must not duplicate calculation logic inside test helpers or React.

## Configuration acceptance scope

Final automated acceptance must also prove that invalid or ambiguous active pricing-rule candidates remain blocked by the Phase 5B8 configuration-validation path, including overlapping equal-priority candidates that resolve to the same scenario.

## Historical snapshot invariant

A pricing snapshot is historical evidence. Once built, later mutation of source pricing-rule/settings objects must not change the snapshot's selected rule context, calculation breakdown, discounts, add-ons, override baseline, or final amount.

Phase 5C may prove this invariant with detached in-memory source mutation. Booking persistence remains Phase 8 scope.

## Responsive acceptance boundary

PRD-11 and PRD-17 require responsive Price Settings acceptance across representative desktop, tablet, and narrow-mobile layouts.

Automated component/CSS checks may support this gate, but they do not replace actual browser acceptance. The PRD-18 responsive Price Settings gate must remain open unless a real browser run is completed and recorded.

## Quality gate

The final Phase 5 automated acceptance evidence must include the repository Quality workflow with:

- formatting
- zero-warning lint
- full unit/component suite
- both Firestore Emulator authorization suites
- production build
- Vite development-server smoke

## Explicit non-goals

Phase 5C does not add:

- new pricing models
- new rule-selection semantics
- new discount administration UI
- effective-period editing UI
- Booking persistence
- server-authoritative booking writes
- new Firestore queries or indexes
- operator compensation calculations
- Firebase Hosting or production deployment

## Tracker policy

PRD-18 Phase 5 gate checkboxes may only be checked when their corresponding evidence is complete. In particular, responsive Price Settings QA must not be marked complete from automated tests alone.
