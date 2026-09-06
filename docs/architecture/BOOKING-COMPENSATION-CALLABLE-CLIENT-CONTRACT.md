# Booking Compensation Callable Client Contract

## Phase

Phase 6E3 — Booking compensation callable client boundary.

## Purpose

Phase 6E2 activated trusted booking-compensation execution behind Firebase Functions v2 and Firebase Admin SDK. Phase 6E3 establishes the browser-side boundary that can call that trusted runtime without broadening what the browser is allowed to decide.

This phase intentionally does **not** implement Booking Calendar or Booking Detail behavior. Those screens remain dedicated booking-domain work. The goal here is to make the trusted compensation runtime consumable by that future booking flow through one narrow, testable client contract.

## Security principle

The browser is authoritative for only one compensation-initialization input:

```text
bookingId
```

Everything else remains server-authoritative.

The browser must never submit or derive trusted values for:

- operator assignments
- operator type
- duration
- session type
- studio
- effective time
- percentage bases
- compensation rules
- rule IDs
- compensation model
- expected amount
- calculation snapshot
- source key
- commission-entry identity

## Client API

The application-facing service is:

```js
bookingCompensationCallableClient.initialize({ bookingId });
```

The request object must contain exactly one key: `bookingId`.

Any additional key fails locally before Firebase Functions is invoked. This includes apparently harmless duplicated evidence. The trusted runtime must remain the only authority for compensation facts.

## Firebase Functions binding

The client binds to:

```text
Callable: initializeBookingCompensation
Region: asia-southeast2
```

The callable was introduced in Phase 6E2.

Firebase Auth continues to provide the authenticated actor identity. The browser does not send actor UID in the callable payload.

## Safe receipt

The only accepted response shape is:

```js
const receipt = {
  bookingId,
  createdEntryCount,
  existingEntryCount,
  initializedBookingSnapshot,
};
```

The client validates all four fields and rejects additional fields.

### Receipt invariants

- `bookingId` must exactly match the requested booking.
- `createdEntryCount` must be a non-negative safe integer.
- `existingEntryCount` must be a non-negative safe integer.
- `initializedBookingSnapshot` must be a boolean.
- no unknown response keys are accepted.

The strict response shape is deliberate. It detects accidental backend contract expansion before protected compensation evidence can reach ordinary application code.

## Protected response evidence

The client explicitly fails closed if the callable response contains compensation evidence such as:

- amount
- rule ID
- compensation rule/configuration
- assignment data
- duration
- effective time
- percentage bases
- calculation snapshot
- commission entry ID
- source key

Phase 6E2 already redacts these values. Phase 6E3 adds a second defensive boundary in the browser.

## Error contract

Firebase callable errors are mapped to stable client errors with sanitized messages.

Supported public categories include:

- `unauthenticated`
- `permission-denied`
- `invalid-argument`
- `not-found`
- `failed-precondition`
- `aborted`
- `unavailable`
- `internal`

Backend diagnostic messages are not passed through to UI-facing application code.

Unexpected backend failures map to a generic `internal` client error.

## Idempotent retry semantics

A retry can legitimately return:

```js
const receipt = {
  bookingId,
  createdEntryCount: 0,
  existingEntryCount: N,
  initializedBookingSnapshot: false,
};
```

This is treated as success. The client exposes counts only, preserving Phase 6D2/6E/6E2 idempotency semantics without exposing commission-entry identities.

## Firebase client foundation

The existing Firebase web client now initializes:

- Auth
- Firestore
- Functions

When local emulators are explicitly enabled, all three clients connect to the configured Emulator Suite endpoints.

Default Functions emulator port:

```text
5001
```

Environment override:

```text
VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT
```

Production mode continues to suppress emulator use.

## Booking-domain integration rule

Future booking creation/confirmation work should depend on this client boundary instead of importing `httpsCallable` directly throughout UI components.

A booking flow may call compensation initialization only after a server-authoritative booking exists in a state accepted by the trusted runtime.

The future booking orchestration layer should treat compensation initialization as a domain step with explicit success/failure handling, not as UI-calculated commission logic.

## Non-goals

Phase 6E3 does not:

- implement Booking Calendar
- implement Booking Detail
- create a booking repository
- create/confirm bookings
- write `compensationContext` from the browser
- change Firestore Security Rules
- expose raw compensation rules to Studio Operators
- calculate compensation in browser code
- persist payout/lifecycle transitions
- implement cancellation or repricing reconciliation
- implement Fee & Commission UI
- deploy Firebase Functions
- merge the stacked compensation PR chain

## Verification

The Phase 6E3 targeted suite verifies:

1. the callable receives only `bookingId`
2. extra caller compensation fields fail before network invocation
3. safe receipts are normalized and frozen
4. protected response evidence fails closed
5. unknown/missing response fields fail closed
6. booking mismatches and invalid counters fail closed
7. callable failures are sanitized
8. unknown failures are reduced to generic internal errors
9. retry receipts preserve idempotent semantics without leaking entry identities
10. the Firebase client initializes the Functions client alongside Auth and Firestore

## Next phase

The next booking-domain phase can establish the actual authoritative booking create/confirm workflow and then call this boundary as part of that lifecycle. Until such a workflow exists, Phase 6E3 should remain a reusable integration boundary rather than being wired into placeholder screens.
