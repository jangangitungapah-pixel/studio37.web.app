# Firebase Development Strategy

## Purpose

Define how Studio37 uses the real Firebase development project and the Firebase Emulator Suite without mixing development, emulator, and future production behavior.

## Development project

The current development project is:

- Project ID: `studio37webapp`
- Firestore edition: Standard
- Firebase Authentication: client initialized
- Cloud Firestore: client initialized

Firebase Web App configuration is public client configuration. Service-account credentials, Admin SDK private keys, or other server secrets must never be added to the repository.

## Default mode

Normal local development uses the real `studio37webapp` development project with:

```env
VITE_USE_FIREBASE_EMULATORS=false
```

The application does not perform a connectivity probe automatically. The development-only `/dev/firebase` page contains a manual probe so Firestore reads are not spent on every page load.

## Emulator mode

The repository defines local emulator ports in `firebase.json`:

- Authentication: `127.0.0.1:9099`
- Firestore: `127.0.0.1:8080`
- Emulator UI: `127.0.0.1:4000`

Enable client routing in `.env.local`:

```env
VITE_USE_FIREBASE_EMULATORS=true
VITE_FIREBASE_EMULATOR_HOST=127.0.0.1
VITE_FIREBASE_AUTH_EMULATOR_PORT=9099
VITE_FIRESTORE_EMULATOR_PORT=8080
```

Then start the emulators and app in separate terminals:

```powershell
npm run firebase:emulators
npm run dev
```

Firebase CLI is pinned as a development dependency, so the emulator command does not float to an
unreviewed CLI release. The current Firestore Emulator toolchain requires Java 21 or newer.

## Safety rules

1. Emulator routing is ignored when `VITE_APP_ENV=production`.
2. Switching emulator mode requires restarting the Vite dev server.
3. The emulator is disposable local state unless an explicit import/export workflow is added later.
4. Production Hosting configuration remains deferred to Phase 17.
5. Initial Firestore Security Rules are source-controlled and emulator-tested in Phase 3. Client
   configuration and UI guards are never treated as authorization.

## Security Rules verification

The initial rules and their detailed scope are:

```text
firestore.rules
docs/architecture/FIRESTORE-SECURITY-RULES.md
```

Run the isolated emulator authorization suite with:

```powershell
npm run test:rules
```

The command uses only the Firestore Emulator and the synthetic project ID
`studio37-rules-test`. It does not contact or mutate the real development Firestore database.
Product collections that have not yet reached their implementation phase remain default-deny.
Rules deployment is still deferred to the production review in Phase 17.

## Data-access convention

React components must not scatter Firebase SDK reads and writes.

The shared document repository foundation provides focused operations:

- `getById`
- `setById`
- `updateById`

It intentionally does **not** provide a generic `listAll()` method. Feature repositories own their query shapes, filters, limits, ordering, and index requirements. This keeps Firestore reads predictable for the Spark Plan and prevents accidental full-collection reads.

Feature/domain repositories may wrap the shared document repository, for example:

```text
src/services/studioRepository.js
src/services/customerRepository.js
src/services/bookingRepository.js
```

Business calculations and authorization decisions do not belong inside the shared Firestore repository.

Field-level encoding, decoding, partial-update, timestamp, and timezone conventions are defined in:

```text
docs/architecture/FIRESTORE-DATA-CONVENTIONS.md
```

## Query and index registry

Every implemented collection query must be bounded and registered with its exact filters, ordering, limit or window, listener strategy, and composite-index requirement. The registry and source-controlled manifest are:

```text
docs/architecture/FIRESTORE-QUERY-INDEX-REGISTRY.md
firestore.indexes.json
```

Phase 2 has no collection query yet, so the manifest intentionally contains no speculative composite indexes or field overrides. Index deployment to a production Firebase project remains deferred to Phase 17.

## Authenticated user-profile access

Phase 3 resolves application access through one explicit real-time document listener at:

```text
users/{firebaseAuthUid}
```

The listener is created only after Firebase Authentication supplies a user and is removed when the
identity changes or signs out. Missing, malformed, unreadable, and disabled profiles fail closed.
This is a document-addressed listener, not a collection query, and it requires no composite index.

The initial manual Owner procedure and its Security Rules dependency are documented in:

```text
docs/architecture/OWNER-BOOTSTRAP-STRATEGY.md
```

Phase 4C3 account linking does not enumerate Authentication users or scan the `users` collection.
An active Owner explicitly resolves one existing `users/{uid}` profile and the focused repository
links or unlinks that profile with one exact operator document in a reciprocal Firestore
transaction. Firebase Authentication identity provisioning, passwords, Admin SDK credentials, and
service-account keys remain outside the browser repository. The relationship contract is:

```text
docs/architecture/OPERATOR-ACCOUNT-LINK-CONTRACT.md
```

Phase 4C4 exposes that same boundary only after an explicit Owner action in Operator Settings. The
Owner enters an immutable UID, reviews the one exact profile read, and confirms the transaction.
The UI never accepts email as an identity lookup, lists Authentication users, or changes permission
sets. Its workflow contract is `docs/architecture/OPERATOR-ACCOUNT-LINK-UI-CONTRACT.md`.

Phase 4C5A adds a separate invitation/self-registration foundation without weakening the manual
exact-UID fallback. An active Owner creates one opaque exact-path invitation beneath an eligible
unlinked Studio Operator. A Firebase user with the matching verified email may redeem it through
one atomic user/operator/invitation batch. A new application profile always starts as
`studio_operator` with `permissionSetId: null`; the path cannot create or promote an Owner. It does
not create an Authentication identity, enumerate Auth/users, send email, or require Functions,
Admin SDK, or service-account credentials. The contract is:

```text
docs/architecture/OPERATOR-ACCOUNT-INVITATION-CONTRACT.md
```

Phase 4C5B exposes that exact-path boundary through an Owner copy/share dialog and the public
`/invite/:operatorId/:invitationId` onboarding shell. Firebase email/password sign-up creates only
the Authentication identity. Firebase's verification email returns to the same invitation route;
the client then reloads the user and forces a fresh ID token before the matching-email Firestore
read. The UI adds no invitation list/query, Auth-user administration, automatic background read,
or paid delivery service. Its workflow contract is:

```text
docs/architecture/OPERATOR-ACCOUNT-INVITATION-UI-CONTRACT.md
```

Phase 4D1 adds a separate Owner-only permission administration repository. It lists at most 50
`permissionSets` ordered by name, mutates only canonical templates, and assigns one active template
through exact user/operator/permission-set transaction reads. No users/Auth enumeration or generic
collection read is introduced. Its contract is:

```text
docs/architecture/PERMISSION-ADMINISTRATION-CONTRACT.md
```

Phase 4D2 exposes that repository through the Owner-only `/settings/permissions` route. The page
reuses the bounded permission-set and operator administration queries, filters linked Studio
Operators in memory, and reads one exact `users/{uid}` profile only after the Owner opens an
assignment dialog. It introduces no automatic per-operator user reads or new query/index shape.
Its workflow contract is:

```text
docs/architecture/PERMISSION-ADMINISTRATION-UI-CONTRACT.md
```

Phase 5A1 adds the first pricing-domain collection boundary at `sessionTypes/{sessionTypeId}`. Its
repository owns one `displayOrder asc + limit(100)` administration query plus focused create/edit
and soft-status mutations. It exposes no generic list, listener, hard delete, pricing rule, or
calculation operation. Booking-capability reads remain default-deny until their owning booking
phase reviews that access. The contract is:

```text
docs/architecture/SESSION-TYPE-DOMAIN-CONTRACT.md
```

Phase 5A2 adds `pricingRules/{pricingRuleId}` with strict discriminated configuration for hourly,
fixed-session, duration-package, and base-plus-additional models. Its administration repository
owns one `priority desc + limit(200)` one-shot query plus focused create/edit/soft-status writes.
Writes validate one exact session-type reference and one optional exact studio reference; there is
no calculation, resolver, listener, generic list, hard delete, Cloud Function, Admin SDK, or paid
service. The contract is:

```text
docs/architecture/PRICING-RULE-DOMAIN-CONTRACT.md
```

## Connectivity probe semantics

The manual development probe performs one server document read attempt against the legal non-reserved path:

```text
studio37System/connectivity-probe
```

No document needs to exist and the probe never writes data.

A previous implementation used `__studio37_system__/connectivity-probe`, which Firestore rejected with `invalid-argument` because identifiers matching `__.*__` are reserved. That implementation was replaced and a regression test now protects the legal probe path.

A successful empty read proves Firestore is reachable. A `permission-denied` or `unauthenticated` response also proves the configured backend is reachable, while correctly showing that authorization has not yet been granted. Other errors remain failures until investigated.
