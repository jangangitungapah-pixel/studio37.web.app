# Initial Firestore Security Rules

## Purpose

Define the Phase 3 authorization boundary for the Firebase resources Studio37 currently uses. The
source-controlled rules live in `firestore.rules` and are linked from `firebase.json` for local
emulator validation.

These initial rules are intentionally narrower than the future product data model. A collection is
not opened merely because its name appears in a PRD; its schema, query shape, field invariants, and
authorization tests must be implemented together in the relevant feature phase.

## Trusted authorization chain

Firebase Authentication proves identity. Privileged Firestore access additionally requires an
exact, valid `users/{request.auth.uid}` document whose `uid` matches the document ID and whose
status is `active`.

- An active `owner` profile authorizes the initial Owner operations.
- An active `studio_operator` profile may read only the exact
  `permissionSets/{permissionSetId}` referenced by that profile.
- Disabled, missing, or malformed profiles cannot authorize protected operations.
- Role and permission data supplied only in a client request or auth token is not trusted.

Dependent rule reads address exact documents. They do not scan a collection or introduce a
generic unbounded read path.

## Initial access matrix

| Resource                            | Read                                                                     | List/query                               | Create/update                                                            | Delete                          |
| ----------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------ | ------------------------------- |
| `users/{uid}`                       | Signed-in user: own exact profile. Active Owner: another exact profile.  | Denied.                                  | Active Owner only; account-link changes require reciprocal atomic write. | Denied; use status changes.     |
| `permissionSets/{id}`               | Active Owner, or active Operator whose exact profile references this ID. | Denied.                                  | Active Owner only, with supported delegable capabilities.                | Denied; use `status: disabled`. |
| `appSettings/studio`                | Any exact valid active Studio37 user profile.                            | Denied.                                  | Owner or active Operator with `settings.studio.edit`; validated.         | Denied.                         |
| `studios/{roomId}`                  | Owner or active Operator with `settings.studio.view`.                    | Same access, explicit limit at most 50.  | Owner or `settings.studio.edit`; validated.                              | Denied; use `status: disabled`. |
| `operators/{operatorId}`            | Owner or active Operator with `settings.operators.view`.                 | Same access, explicit limit at most 100. | Ordinary management by capability; account link is atomic Owner-only.    | Denied; use `status: disabled`. |
| `studio37System/connectivity-probe` | Active Owner exact-document read only.                                   | Denied.                                  | Denied.                                                                  | Denied.                         |
| Every other path                    | Denied.                                                                  | Denied.                                  | Denied.                                                                  | Denied.                         |

The self-profile read exception is deliberate. A signed-in identity must be able to observe that
its own profile is missing, malformed, or disabled so the application can fail closed and present
the correct blocked state. That exception grants no permission-set or product-data access.

## Protected profile and permission invariants

User profile writes enforce:

- exact canonical field set;
- `uid` equal to the Firestore document ID;
- supported `owner | studio_operator` role and `active | disabled` status;
- nullable, single-segment references;
- canonical nullable Indonesian `+62` phone storage;
- Owner profiles with no permission-set reference;
- Firestore timestamps with nondecreasing `updatedAt`;
- immutable `createdAt` after creation;
- active Owner authorization for every write.

An Owner cannot disable or demote its own profile through the client rules. This reduces accidental
lockout risk; creating the first Owner still uses the reviewed manual Firebase-console bootstrap.
The Firebase console is an administrative environment and is not a public application bootstrap
endpoint.

Permission-set writes allow only the supported delegable capability registry. In particular,
`permissions.manage`, `danger_zone.execute`, and unknown capability strings are rejected. A unit
contract keeps the rule allowlist synchronized with the JavaScript capability registry.

## Studio settings invariants

Phase 4A opens only the exact `appSettings/studio` document. Reads require a canonical active user
profile. Writes require implicit Owner access or an exact active permission set containing
`settings.studio.edit`.

The rules enforce the canonical field set, supported Indonesian IANA timezone, supported booking
interval, same-day aligned operating-hours window, immutable creation actor/time, server update
time, and current authenticated update actor. List/query and delete remain denied. The detailed
schema is documented in:

```text
docs/architecture/STUDIO-SETTINGS-CONTRACT.md
```

## Studio room invariants

Phase 4B opens `studios/{roomId}` only to active Owners or Operators with the relevant Studio
Settings capability. List access additionally requires an explicit query limit of at most 50;
the repository fixes the query to `displayOrder` ascending and a one-shot 50-document bound.

Writes require implicit Owner access or `settings.studio.edit`. Rules enforce the canonical room
field set, code/name/description bounds, integer display order, `active | disabled` status,
immutable creation actor/time, server update time, and current authenticated update actor. Hard
delete remains denied. The detailed contract is documented in:

```text
docs/architecture/STUDIO-ROOMS-CONTRACT.md
```

## Operator domain invariants

Phase 4C1 opens `operators/{operatorId}` only to active Owners or Operators with the relevant
Operator Settings capability. List access requires an explicit query limit of at most 100; the
repository fixes one `displayName`-ordered, one-shot query at that bound.

Ordinary writes require implicit Owner access or `settings.operators.manage`. Rules enforce the
exact field set, supported unique `studio_operator | recording_engineer` domain types, canonical
nullable contact fields, `active | disabled` status, immutable creation metadata, server update
metadata, and current actor. New records must have `linkedUserUid: null`, and ordinary detail/status
updates must preserve the field. Hard delete remains denied. The detailed contract is documented
in:

```text
docs/architecture/OPERATOR-DOMAIN-CONTRACT.md
```

## Operator account-link invariants

Phase 4C3 opens `operators.linkedUserUid` and `users.operatorId` only to a canonical active Owner
performing a reciprocal atomic write. Post-commit Rules checks require:

```text
operators/{operatorId}.linkedUserUid == userUid
users/{userUid}.operatorId == operatorId
```

Linking changes only the relationship and server update metadata. One-sided writes, a user profile
created already linked, direct non-null reassignment, delegated `settings.operators.manage`
linking, spoofed actor/time metadata, and hard delete are denied. Unlinking must atomically clear
both sides. Ordinary operator management and ordinary Owner-managed user updates continue through
their existing boundaries while preserving the relationship field.

The repository performs only one exact target-user lookup and exact two-document transactions; no
user collection list or Authentication-user enumeration is opened. The complete relationship and
provisioning boundary is documented in:

```text
docs/architecture/OPERATOR-ACCOUNT-LINK-CONTRACT.md
```

## Deferred product collections

Bookings, customers, remaining settings documents, session/pricing configuration, payments,
commissions, ledger entries, and audit logs remain default-deny. Account-link UI and permission
administration also remain deferred. Their later phases must add the smallest required access with:

1. a finalized document contract,
2. explicit capability and field-level constraints,
3. bounded repository queries,
4. positive and negative emulator tests,
5. protected historical/source-field coverage where applicable.

This means a future screen cannot be considered implemented until its required rules are added and
tested. It also prevents a broad provisional rule from silently exposing not-yet-reviewed data.

## Emulator verification

Install dependencies, then run:

```powershell
npm run test:rules
```

The command starts only the local Firestore Emulator under the synthetic project ID
`studio37-rules-test`, runs the authorization suite, and shuts the emulator down. It does not read,
write, or deploy rules to the real `studio37webapp` project. Firebase CLI and the Rules Unit Testing
library are pinned in the development dependencies; the current CLI requires Java 21 or newer.

The GitHub Actions quality workflow provisions Java 21 and runs the emulator suite in addition to
formatting, lint, normal tests, build, and the Vite smoke check.

## Deployment boundary

Phase 3 source-controls and tests the rules. It does not deploy them. Review and deployment to the
production Firebase project remain Phase 17 work, together with production Hosting and indexes.
