# Pricing Rule Domain Contract

## Purpose

Define the Phase 5A2 foundation for configurable Studio37 pricing rules. This slice implements a
strict rule envelope, four discriminated pricing-configuration shapes, optional exact-studio and
effective-time scope, a bounded administration repository, Security Rules, and automated
coverage. It does not calculate a price or select a winning rule.

## Document path and identity

Pricing rules are stored at:

```text
pricingRules/{pricingRuleId}
```

`pricingRuleId` is an immutable Firestore auto ID. A rule may be edited because future booking
snapshots preserve the agreed historical price; ordinary configuration removal uses
`status: disabled` rather than hard delete.

## Canonical rule envelope

Every document contains exactly:

| Field            | Contract                                                                   |
| ---------------- | -------------------------------------------------------------------------- |
| `name`           | Trimmed administration label; 1–100 characters                             |
| `sessionTypeId`  | Existing canonical `sessionTypes/{id}` document ID                         |
| `studioId`       | Null for general studio scope, or one existing canonical `studios/{id}` ID |
| `pricingModel`   | `hourly`, `fixed_session`, `duration_package`, or `base_plus_additional`   |
| `configuration`  | Exact model-specific map described below                                   |
| `priority`       | Integer 1–999; larger values are listed first                              |
| `effectiveFrom`  | Null or Firestore timestamp; null has no lower time bound                  |
| `effectiveUntil` | Null or Firestore timestamp; when present it is later than `effectiveFrom` |
| `status`         | `active` or `disabled`                                                     |
| `createdAt`      | Immutable server timestamp                                                 |
| `createdByUid`   | Immutable creating actor UID                                               |
| `updatedAt`      | Monotonic server timestamp                                                 |
| `updatedByUid`   | Current mutation actor UID                                                 |

An effective interval is interpreted as start-inclusive and end-exclusive by the future resolver.
Phase 5A2 validates its shape only; active-time filtering remains unimplemented.

## Model-specific configuration

All IDR fields are non-negative JavaScript-safe integers representing whole rupiah. All durations
are 15-minute increments from 15 through 1,440 minutes. Supported rounding values are `exact` and
`round_up`.

### `hourly`

| Field                    | Contract                                         |
| ------------------------ | ------------------------------------------------ |
| `amountPerIncrementIdr`  | Integer IDR charged per configured increment     |
| `incrementMinutes`       | Pricing/billing increment                        |
| `minimumDurationMinutes` | Minimum duration input for the future calculator |
| `roundingMode`           | `exact` or `round_up`                            |

### `fixed_session`

| Field       | Contract                                  |
| ----------- | ----------------------------------------- |
| `amountIdr` | One integer-IDR amount for the whole rule |

### `duration_package`

One document represents one duration package. Multiple selectable packages use separate rule
documents so each keeps its own ID, studio scope, priority, status, and effective window.

| Field                             | Contract                                       |
| --------------------------------- | ---------------------------------------------- |
| `amountIdr`                       | Package amount                                 |
| `durationMinutes`                 | Exact package duration                         |
| `extraTimePolicy`                 | `blocked`, `additional`, or `another_package`  |
| `additionalAmountPerIncrementIdr` | Required only for `additional`; otherwise null |
| `additionalIncrementMinutes`      | Required only for `additional`; otherwise null |
| `roundingMode`                    | Required only for `additional`; otherwise null |

### `base_plus_additional`

| Field                             | Contract                             |
| --------------------------------- | ------------------------------------ |
| `baseAmountIdr`                   | Amount covering the base duration    |
| `baseDurationMinutes`             | Duration covered by the base amount  |
| `additionalAmountPerIncrementIdr` | Amount for each additional increment |
| `additionalIncrementMinutes`      | Additional-time increment            |
| `roundingMode`                    | `exact` or `round_up`                |

The normalizer and Firestore Rules reject unknown envelope/configuration fields, fractional or
negative money, misaligned durations, mismatched configuration/model combinations, partially
configured package extra-time behavior, invalid effective windows, and malformed references.

## Repository boundary

`pricingRuleRepository.js` owns four focused operations:

- `listPricingRules()` — one `priority desc` query capped at 200 documents;
- `createPricingRule(details, actor)` — creates one active auto-ID document;
- `updatePricingRule(id, details, actor)` — updates only canonical editable fields;
- `setPricingRuleStatus(id, status, actor)` — explicitly activates or soft-disables one document.

The repository exposes no generic `listAll`, listener, hard delete, rule resolver, calculator,
snapshot builder, or manual-override operation. Equal priorities are sorted deterministically by
Indonesian case-insensitive name and immutable document ID after decoding.

## Authorization and reference boundary

An active user with `settings.pricing.view` may read one pricing rule or issue the bounded list
query. An active user with `settings.pricing.edit` may create or update a canonical rule.
Firestore Security Rules independently validate the complete discriminated shape, integer-IDR and
duration bounds, server actor/time metadata, immutable creation history, and existence of the exact
referenced session/studio documents. The referenced collections enforce their own canonical schema
on application writes. Hard delete, unbounded/over-limit queries, missing references, malformed
fields, and unauthorized writes are denied.

Booking-phase reads remain default-deny. Phase 8 must explicitly review and test the least-
privilege active-rule query or exact reads required by the booking engine.

## Query, index, and Spark behavior

The administration query is:

```text
pricingRules orderBy(priority desc) limit(200)
```

It uses Firestore automatic single-field indexing and requires no composite-index manifest entry.
Reference validation performs at most one session-type read and one optional studio read per
configuration mutation. There is no background listener, per-card read, generic collection scan,
Cloud Function, Admin SDK, or paid Firebase dependency.

## Deferred Phase 5 scope

- hourly, fixed-session, duration-package, and base-plus-additional calculation functions;
- studio-specific/general rule resolution and effective-time filtering;
- deterministic precedence evaluation and equal-match ambiguity rejection;
- add-ons, discounts, pricing snapshots, and authorized manual overrides;
- Pricing Settings UI, package editor, human-readable preview, and responsive browser acceptance;
- booking-form consumption and historical snapshot integration.

Storing a `priority` or model configuration in this foundation does not complete any calculation,
resolution, ambiguity, snapshot, or UI checklist item. Hosting and deployment remain Phase 17.
