# Add-on Configuration Contract

## Purpose

Define the Phase 5B6 persistence and Price Settings boundary for Owner-managed Studio37 add-ons.
The existing Phase 5A8 calculator remains the arithmetic source of truth; this contract supplies
validated configuration for that calculator without mixing configuration with Booking transaction
inputs.

## Firestore model

Add-on configuration is stored at:

```text
addOns/{addOnId}
```

`addOnId` is an immutable Firestore auto ID. Ordinary administration uses soft disable rather than
hard delete so historical pricing snapshots never depend on a mutable display name or a deleted
configuration document.

Every persisted document contains exactly:

```text
{
  name,
  description,
  displayOrder,
  sessionTypeId,
  pricingType,
  configuration,
  status,
  createdAt,
  createdByUid,
  updatedAt,
  updatedByUid
}
```

`sessionTypeId` is nullable. `null` means the add-on is generally available across session types;
an exact ID scopes the configuration to one existing Session Type. Disabled Session Types remain
valid historical references but are not offered as new UI selections.

## Pricing configuration

The discriminated configuration intentionally matches the Phase 5A8 calculator.

### Fixed

```text
pricingType: "fixed"
configuration: {
  amountIdr
}
```

The configured amount is charged once when the add-on is selected.

### Quantity

```text
pricingType: "quantity"
configuration: {
  amountPerUnitIdr
}
```

Price Settings stores only the per-unit amount. The selected Booking quantity is transaction input
and is never persisted in add-on configuration.

### Time

```text
pricingType: "time"
configuration: {
  amountPerIncrementIdr,
  incrementMinutes,
  roundingMode
}
```

`incrementMinutes` uses the existing 15-minute pricing grid from 15 through 1,440 minutes.
`roundingMode` is `exact` or `round_up`. Actual Booking duration is transaction input and is not
part of this configuration document.

All IDR values are non-negative JavaScript-safe integers. Zero remains valid for intentionally
complimentary add-ons.

## Repository boundary

`addOnRepository.js` owns four focused operations:

- `listAddOns()` uses one `displayOrder asc` one-shot query capped at 100 documents;
- `createAddOn(details, actor)` creates one active auto-ID document;
- `updateAddOn(id, details, actor)` updates only canonical editable fields;
- `setAddOnStatus(id, status, actor)` performs soft activation/deactivation.

The repository exposes no generic list, listener, hard delete, Booking selection, quantity/duration
transaction input, pricing composition, snapshot mutation, or calculator implementation.

The query uses Firestore automatic single-field indexing and introduces no composite index.

## Authorization and Security Rules

An active user with `settings.pricing.view` may read an exact add-on document or the bounded list.
An active user with `settings.pricing.edit` may create or update a canonical add-on document.

Security Rules independently enforce:

- exact canonical fields and discriminated configuration shapes;
- non-negative integer IDR values;
- 15-minute time increments and supported rounding modes;
- an existing Session Type when `sessionTypeId` is non-null;
- bounded list reads with limit at most 100;
- immutable creation metadata;
- server-owned update timestamp and actor UID;
- hard-delete denial.

Dedicated Firestore Emulator coverage lives in `tests/addOnRules.emulator.js` and runs alongside the
existing repository authorization suite.

## Price Settings UI

The Add-ons section in `/settings/pricing` supports:

- bounded loading, empty, error/retry, and saturation states;
- create and edit for fixed, quantity, and time configuration;
- general or exact Session Type availability;
- human-readable pricing summaries;
- soft deactivate/reactivate;
- view-only rendering without mutation controls;
- preservation of disabled current Session Type references during edit.

The editor explicitly labels the boundary between configuration and Booking data. Quantity and
actual duration are selected later during Booking, not stored here.

## Historical safety

Editing or disabling an add-on never rewrites a confirmed Booking pricing snapshot. Future Booking
integration must copy the selected add-on identity, normalized calculation inputs/results, and
amounts into the versioned pricing snapshot before confirmation.

## Deferred scope

Still deferred after Phase 5B6:

- Booking add-on selection and transaction quantity/duration inputs;
- human-readable composed pricing preview;
- discount administration UI;
- effective-period editor for base pricing rules;
- final full configuration validation/error surface;
- Booking persistence and snapshot integration;
- compensation configuration;
- final responsive Price Settings browser acceptance;
- Firebase Hosting or production deployment.
