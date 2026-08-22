# Studio Settings Contract

## Purpose

Define the Phase 4A persisted boundary for the Studio37 business profile and booking defaults.
Room configuration is owned separately by the Phase 4B contract; Operator Settings remains a later
Phase 4 sub-phase.

## Firestore path

Studio profile settings use one exact document:

```text
appSettings/studio
```

The page performs one document-addressed read. Collection scans and generic `listAll()` operations
are not exposed. This access shape requires no composite index.

## Canonical document

| Field                    | Type      | Contract                                              |
| ------------------------ | --------- | ----------------------------------------------------- |
| `businessName`           | string    | Trimmed, 1–120 characters                             |
| `timeZone`               | string    | `Asia/Jakarta`, `Asia/Makassar`, or `Asia/Jayapura`   |
| `operatingHours`         | map       | Exact `opensAtMinutes` and `closesAtMinutes` integers |
| `bookingIntervalMinutes` | integer   | `15`, `30`, or `60`                                   |
| `createdAt`              | timestamp | Server timestamp, immutable after creation            |
| `createdByUid`           | string    | Creating Firebase UID, immutable after creation       |
| `updatedAt`              | timestamp | Monotonic server timestamp                            |
| `updatedByUid`           | string    | Firebase UID performing the latest update             |

`operatingHours` stores minutes after local midnight instead of localized display strings. Both
boundaries must fall on the selected booking interval, opening must be earlier than closing, and
the window must contain at least one interval. Phase 4A supports same-day operating windows only;
overnight and day-specific schedules require an explicit later contract.

## Draft defaults

When the document is missing, the UI presents an unsaved draft:

```text
businessName: Studio37
timeZone: Asia/Jakarta
operatingHours: 10:00–22:00
bookingIntervalMinutes: 30
```

Displaying the draft performs no write. The document is created only after an authorized user
explicitly submits the form.

## Authorization

- Any authenticated user with an exact valid and active `users/{uid}` profile may read the exact
  settings document for future calendar/booking operation.
- Owner has implicit edit access.
- A Studio Operator may write only when its exact active permission set includes
  `settings.studio.edit`.
- Missing, disabled, malformed, or unassigned profiles/permission sets fail closed.
- List/query and delete operations are denied.
- Rules validate the complete field set, actor identity, server timestamps, schedule boundaries,
  timezone, and interval values.

The route and edit controls remain capability-aware, but UI visibility is not treated as the
authorization boundary.

## UI states

The Studio Settings page handles:

- loading,
- missing configuration,
- editable and read-only access,
- inline validation,
- unsaved changes and reset,
- background save,
- recoverable Firestore/permission errors,
- success notification.

## Deferred Phase 4 scope

The following remain incomplete after Phase 4A:

- room-specific operating overrides,
- Operator model/repository,
- operators with and without login,
- Operator Settings and permission-management UI.

Studio room add/edit/deactivate and display ordering are specified separately in
`docs/architecture/STUDIO-ROOMS-CONTRACT.md`.

No Firebase rules, indexes, or Hosting resources are deployed by this implementation. Production
review and deployment remain Phase 17.
