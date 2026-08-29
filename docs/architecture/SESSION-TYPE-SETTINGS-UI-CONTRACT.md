# Session Type Settings UI Contract

## Purpose

Phase 5B1 replaces the `/settings/pricing` placeholder with the first real Price Settings workflow: Session Type administration.

This checkpoint implements only the first step of the PRD-15 pricing configuration flow:

1. select/create Session Type
2. later define pricing model and rule configuration

Pricing Rule, package, add-on, studio-scope, preview, and ambiguity-editing UI remain separate later checkpoints.

## Source of Truth

The UI consumes the Phase 5A1 domain and repository contracts without changing them:

- `src/features/pricing/sessionTypes.js`
- `src/services/sessionTypeRepository.js`

The existing repository remains responsible for:

- one bounded `displayOrder asc + limit(100)` list query
- create
- edit
- soft status mutation
- canonical normalization before writes

Phase 5B1 adds no Firestore query, listener, delete path, index, or Security Rule change.

## Route and Authorization

The existing route remains:

```text
/settings/pricing
```

Route access continues to require `settings.pricing.view` through `ROUTE_POLICIES.PRICING`.

Mutation controls use the existing `settings.pricing.edit` capability.

Owner access remains implicit through the shared capability resolver. A Studio Operator with only `settings.pricing.view` receives a read-only page with no create/edit/status controls.

## Session Type List

The page renders the bounded repository result in canonical display order and exposes human-readable operational context:

- display order
- name
- code
- active/nonactive status
- studio-reservation behavior
- default/minimum duration summary
- description

The UI exposes explicit loading, empty, error/retry, limit-reached, and read-only states.

Hard delete is not exposed.

## Create and Edit

The editor collects:

- name
- code
- description
- display order
- whether the session reserves a studio slot
- whether duration defaults are configured
- default duration
- minimum duration

Codes are normalized to uppercase before repository writes.

The page detects duplicate codes inside the currently loaded bounded Session Type set before a write is attempted. The persisted domain normalizer remains the authoritative shape validator.

Editing preserves the existing Firestore document identity and calls `updateSessionType(id, details, { actorUid })`.

Creating calls `createSessionType(details, { actorUid })`.

## Reservation and Duration Interaction

A Session Type that reserves a studio slot must configure both default and minimum duration.

The UI therefore forces duration configuration on whenever `requiresStudioReservation` is enabled.

For non-studio services, duration configuration is optional. When disabled, both duration fields are sent as `null` through the canonical domain shape.

Configured duration values must:

- be integers
- use 15-minute increments
- be between 15 and 1440 minutes
- keep minimum duration less than or equal to default duration

The editor preserves attempted values after recoverable validation errors.

## Deactivation

Session Type removal is soft only.

Deactivation requires an explicit confirmation dialog and calls:

```text
setSessionTypeStatus(id, 'disabled', { actorUid })
```

Reactivation uses the same focused repository method with `active`.

The UI explains that deactivation prevents future selection/configuration use while historical references and snapshots remain intact.

## Historical Pricing Safety

The Price Settings page and editor explicitly communicate:

- settings edits affect new bookings or explicit repricing only
- confirmed historical pricing snapshots are not recalculated automatically

Phase 5B1 does not mutate pricing snapshots or bookings.

## Responsive Behavior

Desktop uses a compact three-column Session Type row:

- order
- service information
- actions

At narrower widths actions move below the content and become easier touch targets. On narrow mobile the row becomes a single-column card.

The editor uses stacked form sections naturally through the existing Settings and form primitives. No duplicated mobile hero is introduced.

## Feedback and Failure States

Successful create, edit, deactivate, and reactivate actions produce Toast feedback.

Recoverable Firestore failures keep the editor context available and use user-facing messages for:

- permission denied
- service unavailable
- generic write/load failure

List loading failure exposes an explicit retry action without remounting the route.

## Scope Boundary

Phase 5B1 intentionally does not implement:

- Pricing Rule editor
- pricing-model selection UI
- duration-package editor
- base-plus-additional configuration UI
- studio-specific pricing scope selector
- add-on configuration UI
- effective-period editor
- compensation-rule configuration
- human-readable pricing calculation preview
- ambiguity detection before save/activation
- persisted Booking integration
- manual price override UI
- final responsive Price Settings acceptance
- Firebase Hosting or production deployment

Those remain later Phase 5 checkpoints.

## Automated Coverage

Focused tests cover:

- form normalization
- reserving and non-reserving duration behavior
- duration validation
- display-order calculation
- bounded list rendering
- create workflow
- edit workflow
- duplicate-code rejection
- soft deactivation
- read-only capability behavior
- recoverable list retry

PRD-18 is updated only after the complete repository Quality workflow passes.
