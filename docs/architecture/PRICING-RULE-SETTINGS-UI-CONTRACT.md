# Pricing Rule Settings UI Contract

## Purpose

Phase 5B2 extends `/settings/pricing` with the first usable Pricing Rule administration workflow on top of the Phase 5A2 domain and repository contracts.

The checkpoint lets an authorized Owner or delegated pricing editor:

- read the bounded canonical pricing-rule set
- create a rule
- edit a rule
- soft-deactivate/reactivate a rule
- configure one of the four canonical pricing models through human-readable fields

The UI never exposes raw Firestore JSON as an editing surface.

## Source of Truth

Phase 5B2 consumes the existing contracts without changing their persistence schema:

- `src/features/pricing/pricingRules.js`
- `src/services/pricingRuleRepository.js`
- `docs/architecture/PRICING-RULE-DOMAIN-CONTRACT.md`

The repository remains responsible for:

- one `priority desc + limit(200)` one-shot query
- create
- edit
- soft status mutation
- canonical encoding/validation
- server-owned actor/timestamp metadata

Phase 5B2 adds no Firestore query, listener, collection, composite index, hard delete, or Security Rule change.

## Authorization

Route access remains governed by `settings.pricing.view`.

Mutation controls require `settings.pricing.edit` through the same capability model already used by Session Type settings.

Owner access remains implicit. A Studio Operator with view-only pricing access can inspect rules but receives no create/edit/status controls.

Actor UID is taken from the authenticated application session and passed only through the existing repository method contract.

## Bounded List

The section consumes only the existing bounded repository list.

Each rule exposes operational context without running a booking calculation:

- priority
- administration name
- active/nonactive state
- pricing model
- referenced Session Type
- general or exact-studio scope
- effective-window summary
- human-readable configuration summary

If the 200-document limit is reached, the UI treats the candidate set as potentially incomplete. Create, edit, and reactivate are disabled. Deactivation remains available because it only reduces the active match set.

## Create and Edit

The editor collects:

- rule administration name
- Session Type
- numeric priority
- pricing model
- configuration fields required by that model

Creating a new rule in Phase 5B2 always uses:

```text
studioId: null
effectiveFrom: null
effectiveUntil: null
```

This is deliberate. The dedicated studio-scope and effective-period editing checkpoints have not been implemented yet.

Editing an existing rule preserves its current `studioId`, `effectiveFrom`, and `effectiveUntil` values exactly. Hidden advanced metadata is never reset to Phase 5B2 defaults.

## Supported Model Fields

### Hourly

The generic editor exposes:

- amount per increment
- increment minutes
- minimum duration
- exact versus round-up behavior

### Fixed Session

The generic editor exposes:

- fixed session amount

### Duration Package

The generic editor can edit one canonical duration-package rule because one Phase 5A2 pricing-rule document represents one package.

Fields:

- package duration
- package amount
- extra-time policy
- additional amount/increment/rounding when the policy is `additional`

This does not complete the dedicated Package Editor checklist. Multi-package management, package-oriented grouping, and package-specific workflow ergonomics remain a later checkpoint.

### Base + Additional Time

The generic editor exposes:

- base duration
- base amount
- additional increment
- additional amount per increment
- exact versus round-up behavior

## Canonical Validation

Form values are normalized into integer IDR and integer minute values before repository writes.

Duration fields use the existing 15-minute grid and 15–1440-minute bounds. Priority uses the existing 1–999 integer range. Pricing amounts remain non-negative safe integer IDR.

The existing `normalizePricingRuleDetails()` function is the final canonical shape validator before a write is attempted.

Recoverable validation errors preserve entered form values.

## Conservative Collision Guard

`createPricingRule()` creates rules active by default. Phase 5B2 therefore performs one conservative safety check before creating, editing, or reactivating an active rule:

```text
same sessionTypeId
+ same studioId
+ same priority
+ another active rule
```

When that obvious collision exists, the write is blocked.

This guard intentionally does not claim to be the full ambiguity validator. Model/package/condition-aware ambiguity preflight remains the dedicated `Configuration validation/errors` checkpoint. The Phase 5A11 runtime ambiguity gate remains the pricing engine source of truth when a candidate set reaches final resolution.

## Status Changes

Hard delete is never exposed.

Deactivation keeps references and historical snapshots intact.

Reactivation uses the same collision guard before invoking the focused repository status mutation.

## Session Type Dependency

New rules require an active Session Type from the already bounded Session Type list.

Existing rules remain visible even if their referenced Session Type becomes inactive. Editing can preserve that existing reference, while new selection does not offer inactive Session Types.

## Historical Safety

Price Settings continues to state explicitly that configuration edits affect new bookings or explicit repricing only.

Phase 5B2 does not mutate:

- pricing snapshots
- bookings
- manual price overrides
- historical totals

## Responsive Behavior

Desktop uses compact pricing-rule rows with priority, configuration context, and actions.

At medium widths, actions flow below rule details. On narrow mobile, each rule becomes a single-column card and action buttons expand into practical touch targets.

The editor reuses the existing large Dialog behavior, which becomes a bottom-sheet-style full-width dialog on narrow mobile through the shared design-system primitive.

## Feedback and Failure States

The workflow exposes:

- loading state
- empty state
- bounded-limit warning
- recoverable Firestore load retry
- mutation errors that preserve editor input
- success Toasts
- view-only permission state inherited from Price Settings

## Deferred Scope

Phase 5B2 intentionally does not complete:

- dedicated Package Editor workspace
- dedicated duration/minimum/increment configuration workflow outside the generic canonical model fields
- studio-scope selector
- effective-period editor
- add-on configuration
- human-readable example calculation preview
- full model/package-aware ambiguity validation UI
- discount administration UI
- compensation configuration
- persisted Booking integration
- manual price override UI
- final responsive Price Settings browser acceptance
- Firebase Hosting or production deployment

Those remain later Phase 5 checkpoints.

## Automated Coverage

Focused tests cover:

- canonical fixed-session form construction
- hourly configuration
- duration-package configuration and additional-time policy
- base-plus-additional configuration
- invalid money/duration/priority/model values
- preservation of hidden studio/effective metadata
- human-readable rule summaries
- bounded rule rendering
- create workflow
- edit workflow
- equal-priority/scope collision rejection
- soft deactivation
- read-only behavior
- recoverable bounded-query retry

PRD-18 must be updated only after the complete repository Quality workflow passes for the implementation head.
