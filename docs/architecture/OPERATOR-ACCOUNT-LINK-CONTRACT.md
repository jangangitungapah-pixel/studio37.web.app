# Operator Account-Link Contract

## Purpose

Define the Phase 4C3 foundation for safely connecting an existing Studio37 user profile to one
operational operator profile. This slice opens only the bidirectional Firestore relationship and
its Owner-only repository/rules boundary. Phase 4C4 subsequently consumes that boundary in the
Operator Settings linking UI; account provisioning and permission administration remain later
checkpoints.

## Relationship invariant

A linked relationship is valid only when both exact documents point to each other:

```text
operators/{operatorId}.linkedUserUid == userUid
users/{userUid}.operatorId == operatorId
```

An unlinked relationship stores `null` on both sides. One-sided relationships are invalid. A user
profile can reference at most one operator, and an operator can reference at most one user. Direct
reassignment from one non-null relationship to another is intentionally rejected; unlink first,
then establish the new relationship as a separate reviewed action.

## Existing-account boundary

Phase 4C3 never creates a Firebase Authentication identity. The target must already have an exact
`users/{firebaseAuthUid}` profile, normally after the Firebase Authentication identity and profile
have been provisioned through the reviewed development administration procedure.

The repository resolves only the immutable UID supplied for an explicit Owner action. It does not
list Firebase Authentication users, scan the `users` collection, accept an email as identity, store
passwords, initialize an Admin SDK, or add service credentials. Automated Auth provisioning or
invitation remains deferred because the current Spark/client-first architecture has no trusted
server administration boundary.

For development, a trusted administrator must first create the Authentication identity in the
Firebase console and copy its immutable UID. The matching canonical `users/{uid}` document must be
created with `operatorId: null`; a Studio Operator may start with `permissionSetId: null` and
therefore no delegated capabilities. The future linking UI will resolve that exact profile by UID.
The repository does not verify an email against Firebase Authentication because the Web SDK cannot
administratively inspect other Auth users.

## Repository boundary

`operatorAccountLinkRepository.js` owns three focused operations:

- `getUserByUid(userUid)` — one exact, one-shot `users/{uid}` read;
- `linkOperatorToUser(operatorId, userUid, { actorUid })` — reads and updates exactly the operator
  and user documents in one Firestore transaction;
- `unlinkOperatorFromUser(operatorId, { actorUid })` — resolves the stored reciprocal user and
  clears both documents in one Firestore transaction.

The repository decodes both canonical records before writing and fails closed for missing records,
existing links, malformed records, or a broken backlink. It exposes no user/operator collection
scan, generic `listAll()`, Auth account creation, delete, or direct reassignment operation.

## Mutation fields

Account-link transactions may change only:

| Document   | Allowed fields during link/unlink            |
| ---------- | -------------------------------------------- |
| `operator` | `linkedUserUid`, `updatedAt`, `updatedByUid` |
| `user`     | `operatorId`, `updatedAt`                    |

Operator identity, types, status, creation history, user role, user status, and permission-set
assignment cannot be bundled into the relationship write. Server timestamps are used on both
documents; operator actor metadata must match the authenticated Owner UID.

## Authorization and atomicity

- Only a canonical active Owner may change the account relationship.
- Delegated `settings.operators.manage` can continue ordinary operator management but cannot link
  or unlink accounts.
- Security Rules use post-commit document state to require the reciprocal pointer on both writes.
- One-sided writes, pre-linked user-profile creation, direct non-null reassignment, spoofed actor
  metadata, and hard delete are rejected.
- Ordinary user/operator updates still require their existing schema, history, and capability
  checks.

The transaction prevents a client/network failure from committing only one side. This is the
authorization and consistency boundary; React guards in the later UI do not replace it.

## Status and permissions remain separate

`operators.status` controls future operational assignment eligibility. `users.status` controls
application access. Linking or unlinking changes neither status. Permission-set assignment also
remains a distinct Owner action and is not silently inferred from operator types.

## Query and cost behavior

Every Phase 4C3 operation addresses at most two known document paths. There is no collection query,
listener, composite index, or Authentication-user enumeration. No index manifest change is needed.

## Browser consumer

Phase 4C4 exposes the repository through an Owner-only, exact-UID review and confirmation workflow
inside Operator Settings. The UI contract, error states, and responsive behavior are documented in:

```text
docs/architecture/OPERATOR-ACCOUNT-LINK-UI-CONTRACT.md
```

The browser workflow does not widen this repository or Security Rules contract.

## Deferred scope

- Firebase Authentication identity creation/invitation,
- final real-Firebase account-link and responsive browser acceptance,
- permission-set bounded administration repository and UI,
- user status/permission assignment workflow,
- compensation defaults and booking assignment consumption,
- audit events,
- Rules/index/Hosting deployment.

Production review and deployment remain Phase 17.
