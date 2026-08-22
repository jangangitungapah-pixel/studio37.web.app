# Owner Bootstrap Strategy

## Purpose

Create the first Studio37 Owner identity without adding public sign-up, client-side role claims,
Admin SDK credentials, or a Blaze-only backend. This procedure is for the Firebase development
project and remains subject to the Phase 3 Firestore Security Rules gate.

## Security decision

Studio37 does not expose an application action that creates the first Owner. A user must never be
able to become Owner by submitting `role: "owner"` from the browser.

The first Owner is bootstrapped manually by a trusted project administrator using the Firebase
console:

1. create the Firebase Authentication identity,
2. copy its immutable Firebase UID,
3. create exactly one matching `users/{uid}` Firestore document,
4. verify the active profile through the normal Studio37 login flow.

No password, service-account key, Admin SDK credential, or private token is stored in this
repository.

## Canonical initial Owner document

Create the document in the top-level `users` collection. The Firestore document ID must exactly
match the Firebase Authentication UID.

| Field             | Initial value or type                             |
| ----------------- | ------------------------------------------------- |
| `uid`             | Exact Firebase Authentication UID                 |
| `displayName`     | Non-empty Owner display name                      |
| `email`           | Lowercase Firebase Authentication email           |
| `phone`           | Canonical Indonesian `+62` value or `null`        |
| `role`            | `owner`                                           |
| `status`          | `active`                                          |
| `permissionSetId` | `null`; Owner capabilities are implicit           |
| `operatorId`      | `null` unless a later domain decision links it    |
| `createdAt`       | Firestore Timestamp                               |
| `updatedAt`       | Firestore Timestamp, not earlier than `createdAt` |

Example shape with placeholders only:

```text
users/<FIREBASE_AUTH_UID>
  uid: <FIREBASE_AUTH_UID>
  displayName: "Studio37 Owner"
  email: "owner@example.com"
  phone: null
  role: "owner"
  status: "active"
  permissionSetId: null
  operatorId: null
  createdAt: <Firestore Timestamp>
  updatedAt: <Firestore Timestamp>
```

Do not copy example credentials or invent a UID. Use the UID shown on the Authentication user
record.

## Development-project procedure

1. Open Firebase console for project `studio37webapp`.
2. Confirm Email/Password is enabled under Authentication sign-in methods.
3. Under Authentication users, add the Owner email/password identity and copy its UID.
4. Under Firestore, create `users/<copied UID>` using the canonical fields above.
5. Start the current development branch with the normal non-emulator configuration.
6. Log in with the Owner identity.
7. Confirm Studio37 resolves the exact profile and allows protected routes only while `status` is
   `active`.
8. Change `status` to `disabled` temporarily only if intentionally testing revocation; the open
   application should leave protected routes through its live document listener.

The Owner login acceptance gate is not complete until the project owner performs the manual login
check after the relevant Phase 3 implementation and Security Rules are ready.

## Runtime access behavior

- Firebase Authentication identifies the session.
- Studio37 always listens to exactly one profile document: `users/{authenticatedUid}`.
- Owner capabilities are implicit, so Owner sessions do not create a `permissionSets` listener.
- An assigned Studio Operator additionally listens only to its exact
  `permissionSets/{permissionSetId}` document.
- A missing, malformed, unreadable, or disabled profile fails closed and cannot enter protected
  routes.
- Reactivation through `status: "active"` is observed without requiring a page refresh.
- The listener is unsubscribed when the Firebase user changes, signs out, or the provider unmounts.
- No collection scan or generic `listAll()` operation is used.

## Security Rules dependency

Client-side profile enforcement improves application behavior but is not the authorization
boundary. Initial Firestore Security Rules and emulator tests remain a later Phase 3 sub-phase and
must ensure that:

- ordinary users cannot create an Owner profile,
- operators cannot change protected role, status, or permission fields,
- disabled users cannot read protected studio data,
- Owner-managed profile changes are explicitly authorized.

Do not use this development bootstrap procedure as a production launch approval. Production
Firebase review and deployment remain Phase 17 work.

## Recovery safeguards

- Do not delete the Authentication identity merely to disable access; use `status: "disabled"` so
  historical references remain intact.
- Do not change the document ID when an email or display name changes.
- Avoid disabling the only Owner until a reviewed recovery path or second trusted Owner exists.
- Correct malformed bootstrap data in the Firebase console; do not weaken the decoder to accept an
  ambiguous role or UID mismatch.
