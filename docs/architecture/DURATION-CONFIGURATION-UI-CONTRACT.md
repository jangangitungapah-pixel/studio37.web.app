# Duration Configuration UI Contract

## Purpose

Phase 5B4 completes the dedicated Price Settings checkpoint for duration, minimum, and increment configuration without changing the established pricing-domain schema or calculator semantics.

The goal is to make duration configuration readable and fast for an Owner while preserving the exact canonical minute values expected by Session Type and Pricing Rule contracts.

This checkpoint adds a shared duration control across:

- Session Type default duration;
- Session Type minimum duration;
- hourly pricing increment;
- hourly minimum duration;
- duration-package duration;
- duration-package additional-time increment;
- base-plus-additional base duration;
- base-plus-additional additional-time increment.

## Source of truth

Phase 5B4 consumes the existing contracts:

- `src/features/pricing/sessionTypes.js`;
- `src/features/pricing/pricingRules.js`;
- `src/features/pricing/hourlyPricing.js`;
- `src/features/pricing/durationPackagePricing.js`;
- `src/features/pricing/baseAdditionalPricing.js`;
- `docs/architecture/SESSION-TYPE-DOMAIN-CONTRACT.md`;
- `docs/architecture/PRICING-RULE-DOMAIN-CONTRACT.md`;
- `docs/architecture/DURATION-PACKAGE-SETTINGS-UI-CONTRACT.md`.

PRD-06 requires explicit duration, minimum, increment, and rounding behavior and states that Booking duration options must eventually come from configuration rather than hardcoded service assumptions.

PRD-11 requires Price Settings to expose these controls in a human-readable administration workflow.

Phase 5B4 changes no Firestore schema, collection, index, query, Security Rule, repository operation, pricing calculator, booking record, or pricing snapshot.

## Canonical duration representation

Persisted duration values remain integer minutes.

The existing domain boundaries continue to require:

```text
minimum value: 15 minutes
maximum value: 1440 minutes
step: 15 minutes
```

The shared duration control does not introduce an hour-based storage field, decimal hour value, or alternate duration representation.

Examples:

```text
30 minutes -> 30
1 hour -> 60
1 hour 30 minutes -> 90
3 hours -> 180
6 hours -> 360
```

## Shared preset control

The reusable duration field provides quick presets for common studio values:

```text
15m
30m
45m
1h
1h30m
2h
3h
4h
6h
```

Preset selection writes the exact canonical minute string into the existing form state.

Manual numeric input remains available for any other valid 15-minute-grid value through 1440 minutes.

Presets are therefore an input accelerator, not an allowlist. A valid 150-minute duration remains supported even though it is not a quick preset.

## Human-readable duration labels

Every duration field exposes a readable interpretation beside the numeric input.

Examples:

```text
90 -> 1 jam 30 menit
120 -> 2 jam
360 -> 6 jam
```

Malformed or off-grid values do not receive a misleading formatted label. Existing form/domain validation remains authoritative for whether a write can occur.

## Session Type behavior

When Session Type duration configuration is enabled, the editor uses the shared control for:

- default duration;
- minimum duration.

The existing Session Type invariant remains unchanged:

```text
minimumDurationMinutes <= defaultDurationMinutes
```

The UI adds a readable summary, for example:

```text
Default 2 jam · minimum 30 menit.
```

The requirement that studio-reserving services have duration configuration remains unchanged.

## Hourly pricing behavior

Hourly pricing continues to configure:

- amount per increment;
- increment minutes;
- minimum duration minutes;
- rounding mode.

Phase 5B4 adds a behavior explanation derived from the same values.

### Exact rounding

When rounding is `exact`, requested duration must align to the configured pricing increment.

A minimum duration does not need to be a multiple of the pricing increment because the existing calculator does not require that relationship.

Example:

```text
minimum = 90 minutes
increment = 60 minutes
rounding = exact
```

The configuration is still valid. The first requested duration at or above the minimum that can pass exact increment validation is 120 minutes.

The UI explains that fact instead of silently adding a stricter validation rule that the pricing engine does not define.

### Round-up behavior

When rounding is `round_up`, the UI explains that duration at or above the minimum may be accepted even when it is not aligned to the increment, while billing duration is rounded to the next configured increment by the existing pricing calculator.

Phase 5B4 does not calculate or display a price amount.

## Duration Package behavior

Both the generic Pricing Rule editor and the dedicated Package Editor use the shared control for package duration.

When a package uses the `additional` extra-time policy, the additional increment uses the same control.

The UI summarizes the duration relationship, for example:

```text
Durasi package 3 jam. Extra time dihitung per 30 menit.
```

The existing package policies remain unchanged:

- `blocked`;
- `another_package`;
- `additional`.

Package set grouping, collision behavior, envelope inheritance, and soft status management remain owned by Phase 5B3.

## Base + Additional behavior

The generic Pricing Rule editor uses the shared control for:

- base duration;
- additional-time increment.

The UI summarizes the relationship, for example:

```text
Window dasar 2 jam. Setelah itu waktu tambahan dihitung per 1 jam.
```

The calculation itself remains owned by the Phase 5A6 pure calculator.

## Error behavior

The shared control does not bypass existing validation.

Invalid values continue to fail through existing form/domain boundaries, including:

- values below 15 minutes;
- values above 1440 minutes;
- values outside the 15-minute grid;
- malformed numeric input;
- Session Type minimum duration greater than default duration.

The behavior-summary helpers fail closed and render no misleading summary when their inputs are malformed.

## Accessibility

Preset choices are exposed as a named button group tied to the field label.

The active preset uses `aria-pressed` so keyboard and assistive-technology users receive the current quick selection state.

Manual numeric entry remains available and continues to use the shared form-field label/error semantics.

Preset buttons retain visible focus treatment and are disabled while the parent mutation is saving.

## Responsive behavior

Desktop and tablet render compact wrapping preset chips below each duration input.

On narrow mobile:

- helper metadata stacks vertically;
- preset buttons grow into practical touch targets;
- the underlying Settings dialogs retain their existing responsive/bottom-sheet behavior;
- no horizontal scrolling is required for duration controls.

Final manual Price Settings responsive browser acceptance remains a later Phase 5 gate.

## Query and persistence impact

Phase 5B4 adds no Firestore read or write path.

All saves continue through the existing Session Type and Pricing Rule repositories.

There is no new collection, document shape, listener, query, composite index, Cloud Function, Admin SDK path, or paid Firebase dependency.

## Historical safety

Changing duration configuration affects future pricing or explicit repricing only.

Phase 5B4 never mutates:

- confirmed Booking pricing snapshots;
- historical package snapshots;
- manual price overrides;
- historical totals.

The existing snapshot-stability architecture remains authoritative.

## Deferred scope

Phase 5B4 intentionally does not complete:

- studio-scope selector;
- effective-period editor;
- add-on configuration;
- human-readable monetary pricing preview;
- full model/package/effective-window ambiguity validation UI;
- discount administration UI;
- compensation configuration;
- Booking duration/package selection;
- Calendar-generated duration options;
- persisted Booking pricing integration;
- manual override UI;
- final responsive Price Settings browser acceptance;
- Firebase Hosting or production deployment.

## Automated coverage

Focused automated coverage includes:

- minute-to-human duration formatting;
- canonical preset values;
- exact hourly first-valid-duration explanation;
- round-up hourly explanation;
- Session Type default/minimum summary;
- duration-package summary;
- base-plus-additional summary;
- malformed display input fail-closed behavior;
- reusable preset selection and `aria-pressed` state;
- manual duration entry path;
- disabled/saving state;
- Pricing Rule dialog preset-to-canonical payload integration;
- Session Type dialog preset-to-canonical payload integration;
- existing Pricing Rule and Package Editor workflow regression coverage through the full repository test suite.

PRD-18 must be updated only after the complete repository Quality workflow passes on the Phase 5B4 implementation head.
