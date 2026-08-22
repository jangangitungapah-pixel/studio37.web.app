# Studio Rooms Contract

## Purpose

Define the Phase 4B persisted, query, authorization, and UI boundary for bookable Studio37 rooms.
Studio profile defaults remain in `appSettings/studio`; Operator Settings and booking/calendar
integration remain separate later phases.

## Firestore path

Each room is an independent document:

```text
studios/{roomId}
```

`roomId` is an auto-generated immutable Firestore document ID. It is deliberately independent of
the editable room code and name so configuration changes do not invalidate future references or
historical booking snapshots.

## Canonical document

| Field          | Type      | Contract                                           |
| -------------- | --------- | -------------------------------------------------- |
| `code`         | string    | Uppercase letters/numbers/hyphens, 1–24 characters |
| `name`         | string    | Trimmed, 1–80 characters                           |
| `description`  | string    | Trimmed, optional content, maximum 240 characters  |
| `displayOrder` | integer   | `1`–`999`; lower values display first              |
| `status`       | string    | `active` or `disabled`                             |
| `createdAt`    | timestamp | Server timestamp, immutable after creation         |
| `createdByUid` | string    | Creating Firebase UID, immutable after creation    |
| `updatedAt`    | timestamp | Monotonic server timestamp                         |
| `updatedByUid` | string    | Firebase UID performing the latest mutation        |

The application normalizes codes to uppercase and blocks duplicate codes within the loaded room
set. Firestore Security Rules validate code shape, but do not claim cross-document uniqueness.
Document IDs—not editable codes—remain the authoritative reference identity.

## Bounded list query

The Settings UI performs one one-shot collection query:

```text
collection: studios
orderBy: displayOrder ascending
limit: 50
```

Equal display-order values are sorted deterministically by normalized room name and then document
ID in application memory. The query uses Firestore automatic single-field indexing and requires no
composite-index manifest entry.

The repository exposes `listStudioRooms()` only as this fixed query. It does not expose generic
`listAll()`, caller-controlled limits, collection listeners, or a delete operation. The UI prevents
ordinary creation after the 50-room operational bound is reached.

## Mutations

- Create generates an immutable room ID and begins with `status: active`.
- Edit replaces only code, name, description, and display order plus server update metadata.
- Activate/deactivate changes only status plus server update metadata.
- Hard delete is not part of the repository, UI, or Security Rules.

Deactivation prevents the room from future booking selection once booking integration is
implemented. Existing historical references and snapshots are not rewritten.

## Authorization

- Owner has implicit view/edit access.
- An active Studio Operator requires `settings.studio.view` to get or run the bounded room query.
- Create, edit, activation, and deactivation require `settings.studio.edit`.
- Missing, disabled, malformed, or unassigned profiles/permission sets fail closed.
- List queries without a limit or above 50 documents are denied.
- Delete is always denied.
- Rules validate exact fields, supported status/order/code values, immutable creation metadata,
  server timestamps, and the current authenticated update actor.

UI visibility and disabled buttons remain convenience controls; Firestore Security Rules are the
authorization boundary.

## UI states

The Studio Rooms section handles:

- bounded-list loading and retryable errors,
- empty configuration,
- active and inactive room status,
- permission-aware read-only mode,
- add/edit dialog validation,
- duplicate-code feedback,
- explicit activate/deactivate confirmation,
- mutation progress, errors, refresh, and success feedback,
- compact desktop rows and stacked mobile actions.

## Deferred scope

The following are intentionally not implemented in Phase 4B:

- room-specific or day-specific operating-hour overrides,
- equipment/capacity inventory,
- drag-and-drop ordering,
- Operator Settings UI, account linking, and permission-management workflows,
- booking form or calendar consumption of active rooms,
- Firebase Rules/index/Hosting deployment.

Production review and deployment remain Phase 17.

The separate Phase 4C1 operator model/repository contract is documented in
`docs/architecture/OPERATOR-DOMAIN-CONTRACT.md`.
