# Permission Administration Contract

## Purpose

Define the Phase 4D1 data, query, mutation, and authorization foundation for Owner-managed Studio
Operator permission sets. Phase 4D2 consumes this boundary through the separate responsive UI
contract in `docs/architecture/PERMISSION-ADMINISTRATION-UI-CONTRACT.md`; neither phase exposes
permission administration to Operators or adds another role.

Owner authority remains implicit and is never stored in a permission set. The non-delegable
`permissions.manage` and `danger_zone.execute` capabilities cannot be inserted through this flow.

## Permission-set document

Permission templates remain at:

```text
permissionSets/{permissionSetId}
```

The canonical fields are:

| Field          | Contract                                                  |
| -------------- | --------------------------------------------------------- |
| `name`         | Trimmed non-empty string, at most 120 characters          |
| `status`       | One of `active` or `disabled`                             |
| `capabilities` | Unique sorted list from the delegable capability registry |
| `createdAt`    | Firestore timestamp, immutable after creation             |
| `updatedAt`    | Firestore timestamp, nondecreasing and server-written     |

New documents use auto-generated immutable IDs and start active. Changes replace only `name`,
`capabilities`, and `updatedAt`; status changes are separate soft activation/deactivation writes.
Hard delete is not exposed by the repository or allowed by Security Rules.

Disabling a permission set intentionally revokes its effective capabilities immediately through
the existing live exact-document Auth observer. Historical user references may remain so the Owner
can review or reactivate the template without destructive cleanup.

## Bounded administration query

The Owner administration list is one one-shot query:

```text
permissionSets orderBy(name asc) limit(50)
```

Callers cannot remove or raise the bound. Security Rules allow the bounded list only to a canonical
active Owner and deny unbounded, over-limit, unauthenticated, disabled-user, and Operator queries.
Equal normalized names are sorted by immutable document ID after decoding.

The query uses Firestore's automatic single-field index. No composite-index manifest entry is
required.

## Assignment boundary

The assignment repository accepts one known Firebase user UID and either one known permission-set
ID or `null`. It never scans `users`, `operators`, Authentication identities, or permission sets.

Assigning a non-null permission set runs one transaction that reads exactly:

1. `users/{userUid}`;
2. the reciprocal `operators/{operatorId}` referenced by that user;
3. `permissionSets/{permissionSetId}`.

The transaction writes only `users.permissionSetId` and the server `updatedAt` timestamp. It
requires all of the following:

- the target profile is an active `studio_operator`;
- `users.operatorId` identifies an active operational profile;
- the operator includes the `studio_operator` domain type;
- `operators.linkedUserUid` points back to the same user;
- the permission set exists, has the canonical shape, and is active.

Clearing an assignment writes `permissionSetId: null` and remains possible for a disabled or
unlinked Studio Operator so revocation never depends on repairing another relationship first.
Owner profiles can never receive a delegated permission set. Assignment writes cannot be combined
with role, status, account-link, identity, or invitation-source changes.

## Security and authority

Only a canonical active Owner can list, create, edit, disable/reactivate, assign, or clear
permission sets. `settings.operators.manage` remains insufficient because permission administration
is deliberately non-delegable.

Client checks and the future UI are convenience boundaries only. Firestore Security Rules validate
the exact document shape, capability allowlist, bounded query, active assignment target, reciprocal
account link, active permission set, focused changed fields, and immutable history.

## Spark and deferred scope

This foundation adds one bounded single-field query and exact-document transactions only. It adds
no generic `listAll()`, user collection list, Auth-user enumeration, background health read,
composite index, Cloud Function, Admin SDK, paid service, Hosting, or deployment.

Consumed by Phase 4D2 without expanding the repository boundary:

- grouped capability editor and sensitive-permission explanations;
- create/edit/soft-status dialogs;
- assignment UI on login-linked Studio Operators;
- responsive desktop/mobile browser acceptance, which remains a manual gate until confirmed.

Audit events remain Phase 14. Production Rules/index deployment and Hosting remain Phase 17.
