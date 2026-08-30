# Duration Package Settings UI Contract

## Purpose

Phase 5B3 adds a dedicated duration-package administration workspace to `/settings/pricing` on top
of the existing Phase 5A2 pricing-rule model and Phase 5B2 Pricing Rule Settings UI.

The workspace makes multiple selectable packages understandable as one business configuration set
without introducing a separate Firestore package collection.

One canonical `duration_package` pricing-rule document remains one package.

## Source of truth

Phase 5B3 consumes the existing contracts:

- `src/features/pricing/pricingRules.js`
- `src/services/pricingRuleRepository.js`
- `docs/architecture/PRICING-RULE-DOMAIN-CONTRACT.md`
- `docs/architecture/PRICING-RULE-SETTINGS-UI-CONTRACT.md`

PRD-06 explicitly models packages as duration + amount plus an extra-time policy. The Phase 5A2
contract explicitly states that multiple selectable packages use separate pricing-rule documents.

Phase 5B3 changes no persisted schema, Firestore query, Security Rule, index, collection, or booking
record.

## Package-set concept

A package set is a presentation grouping of duration-package rules that share the same resolution
envelope:

```text
sessionTypeId
+ studioId
+ priority
+ effectiveFrom
+ effectiveUntil
```

The package duration is intentionally not part of that grouping key because sibling durations are
the selectable conditions inside one set.

Examples:

```text
Recording / Studio A / priority 200 / current window
- 180 minutes = Rp450.000
- 360 minutes = Rp800.000
```

and

```text
Recording / general studio / priority 100 / future window
- 180 minutes = Rp500.000
- 360 minutes = Rp900.000
```

are two separate package sets.

## Shared bounded query

Phase 5B3 does not issue a second pricing-rule query.

`PricingRulesSection` continues to own the existing:

```text
pricingRules orderBy(priority desc) limit(200)
```

one-shot administration query.

The Package Workspace receives that already decoded bounded candidate set and filters/group rules
in memory. Package mutations trigger the parent bounded query to refresh.

This keeps the Spark-development read strategy unchanged.

## Package ordering

Within a package set, rules are displayed by:

1. `durationMinutes` ascending;
2. Indonesian case-insensitive package name;
3. immutable rule ID.

The ordering is presentation-only. Rule ID or name never decides a pricing winner.

## Global package creation

A package created from the workspace-level `Tambah package` action uses the Phase 5B3 default
envelope:

```text
studioId: null
priority: 100
effectiveFrom: null
effectiveUntil: null
```

The Owner selects an active Session Type and configures only package-specific fields.

Studio-scope, priority/effective-period workflow refinement remains outside this checkpoint.

## Sibling package creation

`Tambah ke set ini` creates another duration package using an existing package as an envelope
template.

The new sibling inherits exactly:

- `sessionTypeId`
- `studioId`
- `priority`
- `effectiveFrom`
- `effectiveUntil`

The package-specific fields remain independently editable:

- administration name
- package duration
- package amount
- extra-time policy
- additional-time amount/increment/rounding where applicable

The inherited envelope is locked in the package dialog so a sibling package cannot silently drift
into another resolution set.

## Package editing

Editing an existing package preserves its exact resolution envelope:

- session
- studio scope
- priority
- effective start
- effective end

The Package Editor only changes package identity/configuration fields.

The generic Pricing Rule editor remains available for broader rule administration, while future
dedicated scope/effective controls will own those metadata fields.

## Extra-time policies

The Package Editor exposes all canonical Phase 5A2 policies:

### `blocked`

Requests beyond the package duration are not priced by that package.

### `another_package`

Extra duration requires another package selection rather than guessed overtime arithmetic.

### `additional`

The Owner configures:

- additional amount per increment
- additional increment minutes
- `exact` or `round_up` behavior

All money remains whole safe-integer IDR. All duration/increment values remain aligned to the
existing 15-minute grid and 15–1440-minute bounds.

## Package-aware collision guard

Phase 5B2 introduced a deliberately conservative pre-write guard for active rules sharing:

```text
session + studio scope + priority
```

That rule is too strict for duration packages because valid 3-hour and 6-hour packages must be able
to coexist in the same envelope.

Phase 5B3 refines the shared UI guard:

- same session + studio + priority non-package collision remains blocked;
- package versus non-package at the same envelope remains blocked conservatively;
- duration package versus duration package with the same duration is blocked;
- duration package versus duration package with a different duration is allowed.

The guard continues to ignore effective-window overlap and other future condition dimensions. It is
therefore still a conservative editing safeguard, not the final configuration validator.

The Phase 5A11 runtime ambiguity gate remains authoritative for final resolved candidate sets.

## Duplicate-duration safety

Two active sibling packages with the same duration inside the same resolution envelope are not
created or reactivated through the Package Editor.

Example blocked state:

```text
Recording / Studio A / priority 200
- 180 min = Rp450.000
- 180 min = Rp475.000
```

Example allowed state:

```text
Recording / Studio A / priority 200
- 180 min = Rp450.000
- 360 min = Rp800.000
```

This focused package rule does not complete the broader `Configuration validation/errors` PRD-18
checkpoint.

## Status handling

Package removal remains soft-status only.

Deactivation:

- removes the package from future active pricing selection;
- keeps the pricing-rule document;
- preserves historical booking snapshots and references.

Reactivation runs the same package-aware collision guard before the focused repository status
mutation.

Hard delete is not exposed.

## Session Type dependency

Global package creation offers only active Session Types.

Existing package sets remain visible if their Session Type becomes inactive. A sibling package
cannot be added to an inactive Session Type set until the Session Type is reactivated.

Existing packages can still be inspected and soft-deactivated for administration/history safety.

## Bounded-list saturation

When the existing 200-rule administration limit is reached, create, edit, and reactivate remain
blocked because the client cannot know whether unseen candidates would change collision safety.

Deactivation remains available because it only reduces the active candidate set.

This is the same fail-closed behavior established in Phase 5B2.

## Authorization

Package Workspace visibility follows `settings.pricing.view` through the Price Settings route.

Mutations require `settings.pricing.edit`.

Owner access remains implicit through the existing capability model. View-only Studio Operators can
inspect package sets but receive no package create/edit/status controls.

Actor UID is derived from the authenticated application session and passed only to the existing
focused repository methods.

## Historical safety

Phase 5B3 never mutates:

- bookings
- pricing snapshots
- previous package snapshots
- manual overrides
- historical totals

Price Settings continues to explain that changes affect new bookings or explicit repricing only.

## Responsive behavior

Desktop package sets use compact grouped cards:

- package-set envelope header
- duration tile
- package name/status
- price
- overtime summary
- actions

At narrower widths, package-set headers stack and package actions move below the package details.
On narrow mobile, package rows become single-column cards with practical full-width action targets.

The package form reuses the shared large Dialog primitive, including its existing mobile bottom-sheet
behavior.

## Deferred scope

Phase 5B3 intentionally does not complete:

- dedicated duration/minimum/increment workflow beyond package fields
- studio-scope selector
- effective-period editor
- priority administration refinement
- add-on configuration
- pricing example preview
- full model/package/effective-window ambiguity preflight
- discount administration UI
- compensation configuration
- Booking package selection
- pricing snapshot persistence in Booking
- manual override UI
- final responsive Price Settings browser acceptance
- Firebase Hosting or production deployment

## Automated coverage

Focused automated coverage includes:

- package form normalization
- inherited package-set envelope
- additional-time configuration
- malformed price/duration/policy/session rejection
- package form round-trip
- package grouping and duration ordering
- overtime summaries
- package-aware collision behavior
- sibling package creation
- duplicate-duration rejection before write
- edit with envelope preservation
- soft deactivation
- view-only mutation hiding

PRD-18 is updated only after the complete repository Quality workflow passes on the Phase 5B3
implementation head.
