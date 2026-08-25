# Session Type Domain Contract

## Purpose

Define the Phase 5A1 foundation for Owner-configurable Studio37 service/session types without
hardcoding Rehearsal, Recording, Mixing, or another service name in application logic. This slice
implements the strict document model, bounded repository, Security Rules, and automated coverage.
Pricing rules are implemented separately by the Phase 5A2 contract in
`PRICING-RULE-DOMAIN-CONTRACT.md`; calculations, add-ons, discounts, snapshots, and Price Settings
UI remain later Phase 5 slices.

## Document path and identity

Session types are stored at:

```text
sessionTypes/{sessionTypeId}
```

`sessionTypeId` is an immutable Firestore auto ID. Display codes and names are editable data and
must never be used as document identity or booking-history truth. Referenced session types are
soft-disabled instead of hard-deleted.

## Canonical document shape

Every document contains exactly:

| Field                       | Contract                                                           |
| --------------------------- | ------------------------------------------------------------------ |
| `code`                      | Uppercase `A-Z`, digits, or hyphens; 1–24 characters               |
| `name`                      | Trimmed service name; 1–80 characters                              |
| `description`               | Trimmed optional description; at most 240 characters               |
| `displayOrder`              | Integer from 1 through 999                                         |
| `requiresStudioReservation` | Boolean indicating whether a physical studio/time slot is required |
| `defaultDurationMinutes`    | Null or 15-minute increment from 15 through 1,440                  |
| `minimumDurationMinutes`    | Null or 15-minute increment from 15 through 1,440                  |
| `status`                    | `active` or `disabled`                                             |
| `createdAt`                 | Immutable server timestamp                                         |
| `createdByUid`              | Immutable creating actor UID                                       |
| `updatedAt`                 | Monotonic server timestamp                                         |
| `updatedByUid`              | Current mutation actor UID                                         |

Default and minimum duration are configured together or are both null. A session that reserves a
studio must configure both durations, and its minimum cannot exceed its default. A non-reserving
service such as an off-calendar fixed Mixing project may leave both null. More specific duration,
package, and rounding behavior belongs to pricing rules rather than this base identity document.

## Repository boundary

`sessionTypeRepository.js` owns four focused operations:

- `listSessionTypes()` — one `displayOrder asc` query capped at 100 documents;
- `createSessionType(details, actor)` — creates one active auto-ID document;
- `updateSessionType(id, details, actor)` — updates only canonical editable fields;
- `setSessionTypeStatus(id, status, actor)` — explicitly activates or soft-disables one document.

The repository exposes no `listAll`, listener, hard-delete, pricing-rule, or calculation operation.
Equal display orders are sorted deterministically by Indonesian case-insensitive name and then
immutable document ID after decoding.

## Authorization boundary

An active user with `settings.pricing.view` may read one session type or issue the bounded list
query. An active user with `settings.pricing.edit` may create or update a canonical document.
Firestore Security Rules independently validate the full shape, status, duration relationship,
server actor/time metadata, and immutable creation history. Hard delete, unbounded/over-limit
queries, malformed fields, and unauthorized writes are denied.

Booking-phase reads are intentionally not widened in Phase 5A1. Phase 8 must explicitly review and
test the least-privilege active-session query needed by users with booking capabilities.

## Query, index, and Spark behavior

The administration query is:

```text
sessionTypes orderBy(displayOrder asc) limit(100)
```

It uses Firestore automatic single-field indexing and requires no composite-index manifest entry.
The one-shot bound prevents an accidental unbounded collection read and remains appropriate for
Firebase Spark development.

## Deferred Phase 5 scope

- Session Type CRUD/deactivation UI and responsive browser acceptance;
- hourly, fixed, package, base-plus-additional, and studio-specific calculation models;
- add-ons, discounts, rule priority, ambiguity rejection, and effective periods;
- pricing snapshot and authorized manual override models;
- booking-form consumption and historical snapshot integration.

No Hosting, deployment, Cloud Function, Admin SDK, service-account credential, or paid Firebase
service is introduced by this foundation.
