# Firestore Query & Index Registry

## Purpose

Keep Studio37 Firestore reads bounded, reviewable, and Spark-plan conscious while recording only
the composite indexes required by implemented feature queries.

This registry is the human-readable companion to:

```text
firestore.indexes.json
```

The manifest is source controlled but is not deployed to a production Firebase project during
Phase 2. Production index review and deployment remain part of Phase 17.

## Current implemented-query state

The application performs document-addressed operations plus feature-owned bounded collection
queries:

| Operation                   | Shape                                                     | Composite index |
| --------------------------- | --------------------------------------------------------- | --------------- |
| Connectivity probe          | One explicit document read                                | Not required    |
| `getById`                   | One explicit document read                                | Not required    |
| `setById`                   | One explicit document write                               | Not required    |
| `updateById`                | One explicit document update                              | Not required    |
| User profile observer       | One explicit `users/{uid}` document listener              | Not required    |
| Permission observer         | One explicit `permissionSets/{id}` listener               | Not required    |
| Permission administration   | Ordered `permissionSets` query capped at 50 docs          | Not required    |
| Permission assignment       | Exact user/operator/set transaction                       | Not required    |
| Studio settings load        | One explicit `appSettings/studio` read                    | Not required    |
| Studio rooms admin          | Ordered `studios` query capped at 50 docs                 | Not required    |
| Operator admin              | Ordered `operators` query capped at 100 docs              | Not required    |
| Operator account link       | Exact user lookup + exact two-doc transaction             | Not required    |
| Operator account invitation | Exact invitation/user reads + exact three-doc write batch | Not required    |

The Studio Rooms and Operator queries use automatically indexed single fields. Phase 4C3 account
linking addresses only known operator/user document paths, and Phase 4C4 exposes only that same
exact-UID workflow. Phase 4C5A invitation creation and redemption likewise use only known
operator, invitation, and own-user document paths; invitation collection reads are not exposed.
Phase 4D1 adds one Owner-only permission-set list using automatic single-field name ordering plus
exact assignment transaction reads. There are still no required composite indexes.
`firestore.indexes.json` intentionally retains empty `indexes` and `fieldOverrides` arrays.

Phase 4A loads the Studio Settings form with one one-shot exact-document read. Missing
configuration resolves to an unsaved UI draft and does not trigger a collection fallback or an
automatic write.

### Active document-listener registry

| Query ID                    | Repository                   | Path                  | Bound                             | Listener                          | Phase |
| --------------------------- | ---------------------------- | --------------------- | --------------------------------- | --------------------------------- | ----- |
| `auth.profile-by-uid`       | `userProfileRepository.js`   | `users/{uid}`         | One authenticated UID document    | One per Firebase session          | 3B    |
| `auth.permission-set-by-id` | `permissionSetRepository.js` | `permissionSets/{id}` | One referenced permission-set doc | One per assigned operator session | 3C    |

The listeners exist so profile removal/disablement and permission-set replacement/disablement take
effect without a page refresh. The permission-set listener is not created for Owners or operators
with a null permission-set reference. Listeners are unsubscribed when their identity/reference
changes, the user signs out, or the Auth provider unmounts.

## Active query registry

| Query ID                        | Repository                              | Collection       | Purpose                          | Filters | Ordering           | Bound     | Listener | Index                               | Phase |
| ------------------------------- | --------------------------------------- | ---------------- | -------------------------------- | ------- | ------------------ | --------- | -------- | ----------------------------------- | ----- |
| `settings.studio-rooms-list`    | `studioRoomRepository.js`               | `studios`        | Studio Settings room admin       | None    | `displayOrder` asc | Limit 50  | One-shot | Automatic single-field; no manifest | 4B    |
| `settings.operators-list`       | `operatorRepository.js`                 | `operators`      | Operator domain/admin foundation | None    | `displayName` asc  | Limit 100 | One-shot | Automatic single-field; no manifest | 4C1   |
| `settings.permission-sets-list` | `permissionAdministrationRepository.js` | `permissionSets` | Owner permission administration  | None    | `name` asc         | Limit 50  | One-shot | Automatic single-field; no manifest | 4D1   |

Equal display-order values are sorted by room name and document ID after decoding. Callers cannot
remove or raise the repository bound, and Firestore Security Rules reject unbounded or over-limit
queries.

Equal operator display names are sorted by immutable operator document ID after decoding. The
operator query likewise has a fixed repository bound and matching Rules limit. Phase 4C3 keeps
account linking in a separate exact-document transaction repository, and Phase 4C4 calls it only
after an explicit Owner interaction; neither repository exposes a collection listener or generic
collection read. Phase 4C5A keeps invitation operations in another exact-document repository with
no list/query method; expiry is checked on the addressed document rather than discovered through
a collection scan. Phase 4D1 keeps user assignment document-addressed and exposes only the fixed
Owner permission-set administration query; callers cannot remove or raise its 50-document bound.

Add another active row only in the same focused change that introduces or materially changes the
corresponding feature-repository query.

Required columns for future entries:

| Field      | Required content                                                        |
| ---------- | ----------------------------------------------------------------------- |
| Query ID   | Stable feature-owned identifier                                         |
| Repository | Module that constructs the query                                        |
| Collection | Exact collection or collection group                                    |
| Purpose    | User workflow served by the query                                       |
| Filters    | Equality, membership, and range filters                                 |
| Ordering   | Ordered fields and directions                                           |
| Bound      | Limit, page size, or date window                                        |
| Listener   | One-shot or intentionally shared real-time listener                     |
| Index      | Not required, required manifest entry, or pending emulator verification |
| Phase      | Workplan phase that owns implementation                                 |

## Anticipated query families

These are planning candidates, not active query contracts and not permission to pre-create
indexes:

| Candidate                  | Owning phase | Mandatory discipline                                   |
| -------------------------- | ------------ | ------------------------------------------------------ |
| Customer exact-phone match | Phase 7      | Canonical phone equality and explicit limit            |
| Customer booking history   | Phase 7/10   | Customer filter, stable ordering, pagination           |
| Booking calendar window    | Phase 8/9    | Visible date range, studio scope, no per-cell listener |
| Booking payment attention  | Phase 10/13  | Explicit status/date scope and result limit            |
| Operator commission period | Phase 11     | Operator, state, bounded period, pagination            |
| Ledger period view         | Phase 12     | Bounded period plus explicit type/category filters     |
| Audit history              | Phase 14     | Entity or bounded date scope with pagination           |

The owning feature phase must finalize field names, filter combinations, ordering, and index
requirements from its real repository implementation.

## Registration workflow

1. Define the query inside its feature repository, never directly in a React component.
2. Give the query a stable query ID and document its exact filters, ordering, and bound here.
3. Confirm the query does not perform an unbounded collection read.
4. Prefer one bounded query or a deliberately shared listener over per-card/per-cell listeners.
5. Run the query against the Emulator Suite or configured development project where practical.
6. If Firestore requires a composite index, add only the minimal reviewed entry to
   `firestore.indexes.json`.
7. Add or update repository tests and record the relevant workplan phase.
8. Re-run formatting, lint, tests, build, and development-server smoke before checking the item
   complete.

## Index review rules

- Do not paste a generated index link without reviewing its collection, fields, directions, and
  query scope.
- Do not create speculative indexes for anticipated UI filters.
- Do not add a generic `listAll()` helper to make a query easier to implement.
- Do not remove a manifest entry until every owning query has been removed or migrated.
- Single-field automatic indexing is not duplicated in the composite-index manifest.
- Field overrides require an explicit documented reason and data-access impact review.
- Security Rules remain the authorization boundary; indexes do not grant access.

## Completion criteria for a future registry entry

An entry is complete only when the feature query, bounds, tests, manifest requirement, and quality
gate agree. A Firebase console suggestion by itself is not completion evidence.
