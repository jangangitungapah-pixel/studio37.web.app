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

| Resource                            | Read                                                                     | List/query | Create/update                                                      | Delete                          |
| ----------------------------------- | ------------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------ | ------------------------------- |
| `users/{uid}`                       | Signed-in user: own exact profile. Active Owner: another exact profile.  | Denied.    | Active Owner only, with canonical schema and monotonic timestamps. | Denied; use status changes.     |
| `permissionSets/{id}`               | Active Owner, or active Operator whose exact profile references this ID. | Denied.    | Active Owner only, with supported delegable capabilities.          | Denied; use `status: disabled`. |
| `studio37System/connectivity-probe` | Active Owner exact-document read only.                                   | Denied.    | Denied.                                                            | Denied.                         |
| Every other path                    | Denied.                                                                  | Denied.    | Denied.                                                            | Denied.                         |

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

## Deferred product collections

Bookings, customers, studios, settings, pricing, payments, commissions, ledger entries, and audit
logs remain default-deny in this initial rule set. Their later phases must add the smallest required
access with:

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
