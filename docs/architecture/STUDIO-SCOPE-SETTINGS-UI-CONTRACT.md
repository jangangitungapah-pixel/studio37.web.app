# Studio Scope Settings UI Contract

## Purpose

Phase 5B5 completes the Price Settings studio-scope selector checkpoint on top of the existing pricing-rule and studio-room contracts.

The UI lets an authorized pricing editor choose whether a pricing rule applies to:

- every studio through general scope; or
- one exact configured studio room.

This checkpoint does not change pricing resolution, Firestore schema, Security Rules, indexes, or pricing calculations. It exposes the already-supported canonical `pricingRules.studioId` field through a human-readable administration workflow.

## Source of truth

Phase 5B5 consumes the existing contracts in:

- `docs/prd/PRD-06-pricing-session-engine.md`;
- `docs/prd/PRD-11-settings.md`;
- `docs/architecture/PRICING-RULE-DOMAIN-CONTRACT.md`;
- `src/features/pricing/pricingRuleResolution.js`;
- `src/features/settings/pricingRuleCollision.js`;
- `src/services/studioRoomRepository.js`.

PRD-06 requires studio-specific prices and defines exact-studio matching before general-studio fallback. PRD-11 requires Owner-facing studio-specific price configuration without raw schema editing.

## Canonical representation

The persisted pricing-rule field remains:

```text
studioId: null | <studios document id>
```

The form uses an empty string only as transient UI state for general scope:

```text
form ""         -> persisted null
form "studio-a" -> persisted "studio-a"
```

No wildcard string, room name, room code, array, or alternate studio-scope field is persisted.

The existing pricing-rule normalizer and Firestore Security Rules remain authoritative for validating the reference shape and the existence of an exact referenced studio document.

## Resolution meaning

The selector mirrors the existing Phase 5A7 resolution semantics:

1. filter eligible rules by active status, session, and effective time;
2. prefer exact-studio candidates when at least one exact candidate matches the requested studio;
3. otherwise fall back to general-scope candidates;
4. apply numeric priority inside the preferred scope;
5. reject unresolved equal-highest ambiguity.

Therefore a general rule and an exact Studio A rule may legitimately share the same session and numeric priority. They are not an equal-scope collision because exact Studio A is considered before general fallback.

Two active rules inside the same exact scope, session, and priority remain subject to the existing conservative collision guard. Duration-package siblings with distinct durations retain their existing package-aware exception.

Phase 5B5 does not modify any resolver or ambiguity algorithm.

## Studio choice source

Exact studio choices come from the existing bounded Studio Room repository:

```text
studios orderBy(displayOrder asc) limit(50)
```

The Price Settings workflow reuses `studioRoomRepository.listStudioRooms()`.

Phase 5B5 adds no:

- new Firestore collection;
- new query shape;
- unbounded read;
- listener;
- composite index;
- Cloud Function;
- Admin SDK path;
- Security Rule expansion.

Pricing-rule loading and studio-room loading are independent. A room-list failure must not make the pricing-rule list unavailable.

## Permission boundary

Studio rooms remain protected by the existing `settings.studio.view` capability. Pricing administration remains protected by `settings.pricing.view` / `settings.pricing.edit`.

Phase 5B5 deliberately does not grant studio-read access merely because an account can edit pricing.

Behavior is:

- Owner has implicit access to both capability domains and can choose exact studios;
- an authorized pricing editor with `settings.studio.view` can choose from the bounded room list;
- an authorized pricing editor without `settings.studio.view` can still manage general-scope pricing;
- exact-studio selection is locked when room visibility is unavailable;
- an existing exact-studio ID is preserved rather than silently converted to general scope.

This maintains least privilege and avoids broadening Firestore Security Rules for UI convenience.

## Active, disabled, and missing studios

### Active studio

An active room is selectable for a new exact-studio rule.

The UI shows its human-readable identity:

```text
Studio A · A
```

where the first value is the room name and the second is the room code.

### Disabled studio

A disabled room is not available as a fresh exact-scope choice.

If an existing pricing rule already references that room, the current scope remains visible with inactive context and is preserved unless an authorized editor changes to another available scope.

This matches the historical strategy of soft deactivation rather than hard deletion.

### Missing or unresolved current reference

If an existing exact `studioId` is not present in the loaded room set, the UI shows a fail-safe reference such as:

```text
Studio studio-legacy · tidak tersedia
```

The unresolved exact scope is not silently rewritten.

Firestore/domain validation remains authoritative on any later write.

## Loading and error behavior

Studio scope has its own state independent from pricing-rule loading:

- `loading` locks exact choice while the bounded room query is pending;
- `ready` enables exact choices from the loaded room set;
- `error` keeps pricing rules usable, locks exact choice, and exposes a room-specific retry;
- `unavailable` indicates the current account lacks `settings.studio.view` and keeps exact choice locked.

A room-list error does not erase the pricing form or replace the pricing-rule list with a global error state.

## Generic Pricing Rule Editor

The generic Pricing Rule editor now exposes `Studio scope` directly.

New rules default to general scope but may be changed to one active exact studio when room visibility is ready.

Existing rules round-trip their exact or general scope into form state. An authorized editor may change:

```text
general -> exact
exact A -> exact B
exact -> general
```

The existing effective window is still preserved rather than edited in Phase 5B5.

Changing scope does not modify:

- session type;
- pricing model unless separately edited;
- effective dates;
- status;
- historical booking snapshots.

The existing pre-write collision guard evaluates the newly selected canonical `studioId` before repository write.

## Duration Package workspace

A new top-level duration package starts a new package-set envelope. Phase 5B5 lets that new set choose general or exact studio scope.

Once a package set exists, its siblings share:

- session type;
- studio scope;
- priority;
- effective window.

Therefore:

- `Tambah package` may choose scope for a new set;
- `Tambah ke set ini` inherits and locks the existing set scope;
- editing one package keeps the set scope locked.

This prevents a single 3-hour or 6-hour sibling edit from silently splitting one package set into different resolution envelopes.

A future workflow that intentionally changes the whole package-set envelope must update the set coherently rather than changing one sibling accidentally.

## Human-readable list context

Pricing-rule rows and duration-package group headers resolve known studio IDs to room name and code instead of showing raw document IDs whenever room context is available.

General scope is displayed as:

```text
Semua studio
```

Unknown exact references fall back to the raw ID with a `Studio` prefix so historical configuration remains inspectable.

## Historical safety

Studio-scope configuration affects new pricing decisions and explicit future repricing only.

Phase 5B5 never mutates:

- confirmed booking pricing snapshots;
- historical selected rule identity;
- historical package snapshots;
- manual price overrides;
- historical totals.

Soft-disabled rooms and rules remain representable for history.

## Validation boundary

The form adapter validates optional studio references as a single Firestore document ID before producing a canonical pricing-rule payload.

Malformed scope such as `bad/id` fails before repository write.

The repository/domain layer and Firestore Security Rules still independently validate:

- exact reference shape;
- exact referenced studio existence;
- actor metadata;
- full pricing-rule schema.

The UI does not claim to complete the full model/package/effective-window ambiguity validator. That remains the separate `Configuration validation/errors` checkpoint.

## Accessibility and responsive behavior

Studio scope uses the existing accessible Combobox primitive rather than a raw ID text field.

The control:

- has a visible `Studio scope` label;
- supports keyboard navigation through the shared Combobox behavior;
- exposes only enabled choices as selectable options;
- communicates loading/error/permission lock state through field description and nearby status notices;
- remains within the existing responsive Settings dialog layout.

Final manual responsive Price Settings browser acceptance remains a later Phase 5 gate.

## Deferred scope

Phase 5B5 intentionally does not complete:

- effective-period editing;
- add-on configuration;
- human-readable monetary pricing preview;
- full model/package/effective-window configuration validation;
- discount administration UI;
- compensation configuration;
- Booking integration;
- Calendar-generated pricing choices;
- persisted Booking pricing integration;
- manual override UI;
- final responsive Price Settings browser acceptance;
- Firebase Hosting or production deployment.

## Automated coverage

Focused coverage verifies:

- general-scope form mapping to `studioId: null`;
- exact-scope form mapping to canonical studio IDs;
- malformed exact references fail before write;
- studio scope round-trip for existing rules;
- effective windows remain unchanged while studio scope is edited;
- active room choices and human-readable labels;
- disabled or missing current studio fail-safe behavior;
- exact and general same-priority rules can coexist;
- same-scope collisions remain blocked;
- pricing editors without `settings.studio.view` do not issue the room query and cannot choose exact scope;
- new package sets can choose exact scope;
- sibling/edit package operations preserve and lock the package-set scope;
- existing Price Settings workflows remain covered by the complete repository test suite.

PRD-18 must be updated only after the complete repository Quality workflow passes on the Phase 5B5 implementation head.
