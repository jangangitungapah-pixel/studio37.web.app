# Operator Domain Contract

## Purpose

Define the Phase 4C1 persisted, query, authorization, and repository boundary for Studio37
operators. This slice establishes operational people independently from Firebase Authentication;
Operator Settings UI, account linking, permission-set administration, and compensation defaults
remain separate checkpoints.

## Firestore path

Each operator is an independent document:

```text
operators/{operatorId}
```

`operatorId` is an auto-generated immutable Firestore document ID. It remains stable when an
operator's name, contact data, types, status, or future account relationship changes, so later
booking and commission references do not depend on mutable display values.

## Canonical document

| Field           | Type         | Contract                                                     |
| --------------- | ------------ | ------------------------------------------------------------ |
| `displayName`   | string       | Trimmed, 1–100 characters                                    |
| `email`         | string/null  | Lowercase normalized email or `null`, maximum 254 characters |
| `phone`         | string/null  | Canonical Indonesian `+62` E.164 value or `null`             |
| `operatorTypes` | string array | One or both supported unique operator types                  |
| `linkedUserUid` | string/null  | Future Firebase/user-profile link; protected in Phase 4C1    |
| `status`        | string       | `active` or `disabled`                                       |
| `createdAt`     | timestamp    | Server timestamp, immutable after creation                   |
| `createdByUid`  | string       | Creating Firebase UID, immutable after creation              |
| `updatedAt`     | timestamp    | Monotonic server timestamp                                   |
| `updatedByUid`  | string       | Firebase UID performing the latest allowed mutation          |

Supported `operatorTypes` values are:

```text
studio_operator
recording_engineer
```

One person may carry both types. These domain types describe operational assignment eligibility;
they do not grant application capabilities and must never be treated as an authorization source.

## Operators without login

Creating an operator always persists `linkedUserUid: null`. No Firebase Authentication account,
`users/{uid}` profile, permission set, service credential, or automatic secondary identity is
created. This supports recording engineers and other operational personnel who need assignment and
future compensation references but do not need application access.

The Phase 4C1 repository deliberately exposes no account-link mutation. Security Rules also keep
`linkedUserUid` immutable on updates, including Owner writes. A later account-linking slice must
define and test the bidirectional invariant with `users/{uid}.operatorId`, authorization,
uniqueness limitations, account provisioning workflow, and partial-failure handling before opening
that field.

## Bounded list query

The feature repository owns one one-shot collection query:

```text
collection: operators
orderBy: displayName ascending
limit: 100
```

Equal normalized names are sorted by immutable document ID after decoding. The query uses an
automatically indexed single field and requires no composite-index manifest entry.

`listOperators()` has a fixed limit. The repository exposes no generic `listAll()`, caller-controlled
limit, collection listener, delete operation, or account-link operation.

## Mutations

- Create generates an immutable operator ID, starts `active`, and starts without a login link.
- Detail updates replace only display name, email, phone, and operator types plus server update
  metadata.
- Activate/deactivate changes only status plus server update metadata.
- Hard delete is not part of the repository or Security Rules.
- Disabling preserves the record for future historical booking, assignment, and commission
  references.

## Authorization

- Owner has implicit view/manage access.
- An active Studio Operator requires `settings.operators.view` to get or run the bounded query.
- Create, detail update, activation, and deactivation require `settings.operators.manage`.
- Missing, disabled, malformed, or unassigned profiles/permission sets fail closed.
- List queries without a limit or above 100 documents are denied.
- Create with a login link, update of a login link, spoofed actor/timestamp metadata, malformed
  fields, and hard delete are denied.

The route and future UI remain capability-aware, but Firestore Security Rules are the actual
authorization boundary.

## Deferred scope

The following are intentionally not implemented in Phase 4C1:

- Operator Settings list/form UI,
- add/edit/activate/deactivate browser workflows and responsive QA,
- Firebase Authentication account creation or invitation,
- bidirectional operator/user account linking,
- permission-set list and management UI,
- operator compensation defaults and rules,
- assignment availability and booking integration,
- Firebase Rules/index/Hosting deployment.

Production review and deployment remain Phase 17.
