# Firebase Functions Trusted Compensation Runtime Contract

## Status

Phase 6E2 runtime activation, stacked on Phase 6E trusted booking-compensation execution core.

This phase binds the trusted compensation core to Firebase Functions v2 and Firebase Admin SDK without deploying it to production. The callable runtime is now implementable and emulator-ready, while the stacked PR chain remains Draft and unmerged.

## Runtime topology

The Functions codebase lives in `functions/` and uses Node.js 22.

The callable entrypoint is:

- `initializeBookingCompensation`
- Firebase Functions v2 `onCall`
- region `asia-southeast2`
- 30 second timeout
- 256 MiB memory
- maximum 10 instances

The public callable request contains only:

- `bookingId`

The authenticated actor UID always comes from the callable `request.auth.uid`. A caller cannot submit or override `actorUid`.

Requests with additional properties are rejected. This specifically prevents a caller from supplying compensation-shaped data such as amount, rule ID, percentage base, assignment, source key, or calculation snapshot.

## Source-of-truth strategy

Phase 6C, 6D, and 6E domain logic remains authoritative in `src/`.

Functions does not maintain a manually edited fork of that calculation stack.

Before Functions testing, emulation, or deployment, `scripts/prepare-functions.mjs` copies the minimum required source graph into `functions/runtime-src/` while preserving its relative module structure.

Copied sources:

- `src/services/trustedBookingCompensationExecution.js`
- `src/features/commissions/bookingCompensation.js`
- `src/features/commissions/compensationEngine.js`
- `src/features/commissions/compensationRules.js`
- `src/features/settings/operators.js`
- `src/lib/datetime/timestamps.js`
- `src/lib/money/idr.js`
- `src/lib/validation/indonesianPhone.js`

`functions/runtime-src/` is generated and ignored by Git, but it is intentionally not excluded from the Firebase Functions deployment bundle.

This keeps one human-maintained source of truth while still making the deployed Functions package self-contained.

## Functions package

`functions/package.json` is an isolated runtime package.

Pinned runtime dependencies:

- Firebase client SDK `12.18.0`, required by the copied timestamp helper
- Firebase Admin SDK `14.3.0`
- Firebase Functions SDK `7.3.2`

The package declares Node.js 22 through `engines.node`.

The Functions package intentionally does not modify the root application dependency lock. Function dependencies are installed independently with `npm --prefix functions install`.

## Authentication boundary

`initializeBookingCompensation` requires Firebase Authentication.

Unauthenticated calls fail before trusted execution begins.

The callable never trusts an actor identifier supplied in request data.

## Authorization boundary

The runtime authorizes from Admin-readable Firestore data before reading protected booking compensation context or compensation rules.

### Owner

An Owner is authorized only when:

- `users/{uid}` exists
- profile `status == active`
- profile `role == owner`

### Studio Operator

A Studio Operator is authorized only when all of the following are true:

- `users/{uid}` exists
- profile `status == active`
- profile `role == studio_operator`
- profile has a valid `permissionSetId`
- profile has a valid `operatorId`
- referenced permission set exists
- permission set `status == active`
- permission set capabilities contains `booking.create`
- referenced operator exists
- operator `status == active`
- operator `linkedUserUid` exactly equals the authenticated UID
- operator `operatorTypes` contains `studio_operator`

This reciprocal operator check prevents a permission-set-only account from becoming compensation-authoritative when its operational identity is missing, stale, or linked to another user.

Authorization failure occurs before any read of:

- `bookings/{bookingId}`
- `compensationRules/*`

## Authoritative booking compensation context

The callable does not derive trusted compensation inputs from arbitrary client fields.

The booking document must contain a server-authoritative `compensationContext` map.

Required context consumed by the runtime:

- `assignments`
- `durationMinutes`
- `effectiveAt`
- `percentageBaseAmounts`
- nullable `sessionTypeId`
- nullable `studioId`

Booking-level fields consumed alongside it:

- `bookingNumber`
- `status`

The Phase 6E core still requires booking status `confirmed` for the `booking_confirmation` compensation source event.

A missing `compensationContext` fails closed.

### Ownership of `compensationContext`

Phase 6E2 does not activate general client-side booking creation or editing.

The existing client Firestore boundary does not give Studio Operators direct write authority over booking compensation evidence. A later trusted booking-create phase must create or update `compensationContext` inside the backend transaction that owns booking confirmation.

Until that phase exists, this callable can operate only on bookings whose authoritative context has already been created by a trusted process.

## Protected compensation-rule loading

The Admin runtime reads only active `compensationRules`.

The server query requests at most 201 rows:

- trusted execution limit: 200 active rules
- 201st row is used only to detect overflow

If more than 200 active rules exist, execution fails closed rather than silently truncating the candidate set and potentially choosing the wrong compensation rule.

Raw rule documents never leave the trusted runtime.

## Calculation and projection

After authorization and trusted reads, the runtime invokes the existing Phase 6E executor.

That executor reuses:

- Phase 6C deterministic rule resolution and integer-IDR calculation
- Phase 6D booking compensation projection and historical snapshot evidence
- Phase 6E authorization-before-protected-read orchestration

No caller-supplied compensation amount, rule candidate, source key, or calculation snapshot participates in resolution.

## Admin persistence boundary

Firebase Admin SDK bypasses Firestore Security Rules, so the Functions adapter is itself a security boundary.

The adapter preserves the important Phase 6D2 persistence invariants.

### Deterministic commission IDs

Each commission entry document ID is:

`booking-comp-<sha256(sourceKey)>`

The SHA-256 digest is calculated server-side using Node.js crypto.

### Transaction ordering

Inside the Admin transaction:

1. read the exact booking
2. read every target deterministic commission entry
3. validate existing historical booking snapshot evidence
4. validate existing immutable commission-entry evidence
5. only then perform booking and commission-entry writes

No writes occur before required transaction reads complete.

### Historical booking snapshot

If the booking already has `compensationSnapshot`, a retry is accepted only when:

- stored snapshot equals the newly generated trusted snapshot
- stored `compensationSummary` equals the snapshot summary

Different historical evidence fails with a conflict.

### Immutable commission evidence

An existing deterministic entry must match:

- amount
- booking ID
- optional booking number
- calculation snapshot
- compensation model
- operator ID
- operator type
- rule ID
- source event
- source key

Lifecycle fields are deliberately excluded from retry equivalence:

- `state`
- `payoutId`

Therefore a retry cannot downgrade an entry that has already advanced from `pending` to `earned`, `paid`, or another later valid lifecycle state.

### Audit actor

Admin writes use the authenticated caller UID for:

- `createdByUid`
- `updatedByUid`

This preserves who invoked the trusted operation even though the physical write is executed by Admin SDK.

## Public result

The callable returns the Phase 6E redacted receipt only:

- `bookingId`
- `createdEntryCount`
- `existingEntryCount`
- `initializedBookingSnapshot`

It does not expose:

- compensation amount
- rule ID
- raw rule configuration
- deterministic entry ID
- source key
- percentage-base evidence
- calculation snapshot

## Public errors

Internal errors are mapped to stable callable error categories without exposing protected compensation evidence.

Examples:

- unauthenticated -> `unauthenticated`
- malformed request -> `invalid-argument`
- authorization failure -> `permission-denied`
- missing booking -> `not-found`
- missing context / incomplete projection / rule overflow -> `failed-precondition`
- historical snapshot or immutable-entry conflict -> `aborted`
- unknown runtime failure -> `internal`

Internal source keys, rule IDs, calculation details, and raw exception messages are not returned to the caller.

## Local commands

Install the isolated Functions dependencies:

`npm run functions:install`

Prepare the trusted runtime source mirror:

`npm run functions:prepare`

Run Phase 6E2 runtime unit tests:

`npm run functions:test`

Import-smoke the deployable Functions entrypoint:

`npm run functions:smoke`

Start Auth + Firestore + Functions emulators:

`npm run firebase:emulators:functions`

## Firebase configuration

`firebase.json` now defines:

- Functions source: `functions`
- codebase: `default`
- predeploy runtime-source preparation
- Functions emulator port 5001

The custom Functions ignore list retains Firebase CLI defaults and additionally excludes the runtime unit-test file from deployment.

## CI acceptance

Permanent Phase 6E2 quality gates must verify:

- root formatting
- root lint
- previous compensation phases remain green
- isolated Functions dependency installation succeeds
- runtime source preparation succeeds
- Phase 6E2 runtime tests pass
- deployable Functions entrypoint imports successfully
- existing dedicated Phase 6D2 Firestore boundary remains green

The inherited combined Firestore suite is tracked separately and must not be misclassified as a Phase 6E2 regression unless the failing surface is causally changed by this PR.

## Non-goals

Phase 6E2 intentionally does not include:

- production Functions deployment
- general booking creation endpoint
- client authorization to read raw compensation rules
- client submission of compensation amounts or rule snapshots
- automatic `pending -> earned` lifecycle transition
- cancellation or repricing reconciliation
- payout settlement
- manual adjustment/reversal persistence
- Fee & Commission UI
- daily/shift allowance approximation

## Required next phase

The next logical slice is a trusted booking-create/confirmation transaction that owns creation of the booking's authoritative `compensationContext` and invokes this runtime in the same server-authoritative workflow.

That phase must also define room conflict validation, pricing snapshot authority, and booking persistence before Studio Operators can create a booking end-to-end through the backend.
