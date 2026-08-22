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

The application currently performs only document-addressed Firestore operations:

| Operation             | Shape                                        | Composite index |
| --------------------- | -------------------------------------------- | --------------- |
| Connectivity probe    | One explicit document read                   | Not required    |
| `getById`             | One explicit document read                   | Not required    |
| `setById`             | One explicit document write                  | Not required    |
| `updateById`          | One explicit document update                 | Not required    |
| User profile observer | One explicit `users/{uid}` document listener | Not required    |

There are no implemented collection queries and therefore no required composite indexes yet.
`firestore.indexes.json` intentionally begins with empty `indexes` and `fieldOverrides` arrays.

### Active document-listener registry

| Query ID              | Repository                 | Path          | Bound                          | Listener                 | Phase |
| --------------------- | -------------------------- | ------------- | ------------------------------ | ------------------------ | ----- |
| `auth.profile-by-uid` | `userProfileRepository.js` | `users/{uid}` | One authenticated UID document | One per Firebase session | 3B    |

The listener exists so profile removal, disablement, and reactivation take effect without a page
refresh. It is unsubscribed when the Firebase identity changes, signs out, or the Auth provider
unmounts.

## Active query registry

No bounded collection query has been implemented yet. Add an active row only in the same focused
change that introduces or materially changes the corresponding feature-repository query.

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
