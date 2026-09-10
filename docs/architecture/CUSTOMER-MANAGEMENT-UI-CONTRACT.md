# Customer Management UI Contract

## Phase

Phase 7B — Customer management UI and reuse workflow.

## Purpose

Phase 7B activates the reusable customer domain established in Phase 7A as an operational workspace.
The goal is to let authorized users find, create, and edit customer profiles without introducing an
unbounded collection scan or prematurely coupling customer management to the Phase 8 booking model.

## Route and authorization

The workspace route is:

```text
/customers
```

Route access requires `customer.view`.

Mutation controls require `customer.edit`.

An active Owner receives both capabilities implicitly. A Studio Operator can see the workspace only
when the assigned active permission set includes `customer.view`, and can mutate records only when
`customer.edit` is also delegated.

A view-only user receives the same directory information but no create/edit controls.

## Directory query

The customer repository exposes a focused `listCustomerDirectory()` operation using:

```text
orderBy name asc
limit 50
```

The UI does not expose a generic collection read, listener, pagination-by-guessing, or `listAll()`
operation.

The first 50 records are intentionally a bounded operational directory, not a claim that the
customer collection contains at most 50 records.

## Search behavior

### Local search

Name, email, and partial phone filtering operate only on the bounded directory already loaded into
the browser.

This is a presentation filter and causes no additional Firestore collection scan.

### Exact phone search

When the complete search input can be normalized as a valid Indonesian phone number, the page uses
the existing Phase 7A exact query:

```text
where normalizedPhone == canonical +62 value
limit 5
```

This allows a customer outside the first 50 name-ordered records to be found by a complete known
phone number without introducing server-side full-text search.

Exact phone results are de-duplicated against the bounded directory by immutable customer document
ID.

## Phone presentation

Firestore persists canonical phone evidence:

```text
displayPhone == normalizedPhone == +62...
```

Phase 7B formats that canonical value for human presentation in cards and edit forms. Presentation
formatting never becomes independent persistence evidence and is normalized again before writes.

## Create workflow

The create dialog accepts:

- customer name
- Indonesian phone
- optional email
- optional notes

Validation reuses the Phase 7A canonical normalizers.

Before a create is persisted, the UI runs the exact normalized-phone lookup. If one or more existing
records use the same phone, the first save attempt stops and shows those records as a likely duplicate
warning.

The UI never silently merges, replaces, or reuses a record. The user must explicitly choose the
`Tetap simpan customer` action to proceed with a duplicate after reviewing the warning.

This duplicate guard is advisory. It is not a uniqueness constraint and does not pretend to prevent
concurrent duplicate creation.

## Edit workflow

Edit uses the same validation and exact-phone duplicate check as create, but excludes the customer
currently being edited from the warning set.

Changing a live customer profile does not mutate historical booking snapshots. Phase 8 will persist
the detached customer snapshot defined by Phase 7A.

## Failure states

The page provides explicit states for:

- directory loading
- directory load failure with retry
- empty directory
- no local/exact search result
- exact phone lookup failure while retaining the loaded directory
- form validation errors
- mutation failures while preserving form input

Firestore authorization remains the security boundary; hiding mutation controls is usability only.

## Mobile and accessibility

The workspace uses a responsive one/two/three-column customer card layout, a full-width mobile
create action, and dialogs built on the existing focus-managed Studio37 dialog component.

Search has an explicit accessible label, mutation buttons identify their target customer, and
loading/error/duplicate states expose appropriate live or alert semantics.

## Explicit non-goals

Phase 7B does not implement:

- customer booking history
- arbitrary server-side name/full-text search
- unbounded customer collection scans
- duplicate merge/archive workflows
- customer hard delete
- booking form integration
- booking creation or confirmation
- payment or commission changes
- production deployment

## Next dependency

Phase 8 can now consume the reusable customer repository and Phase 7A customer snapshot from an
authoritative booking create/confirm boundary. Customer booking-history queries should be added only
after that booking collection contract is active.
