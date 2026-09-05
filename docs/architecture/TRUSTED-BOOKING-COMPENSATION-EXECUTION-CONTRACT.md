# Trusted Booking Compensation Execution Contract

## Phase

Phase 6E — Trusted Booking Compensation Execution Boundary.

## Objective

Move booking-compensation resolution behind a trusted server authority so a Studio Operator may trigger compensation initialization without receiving raw compensation rules or supplying trusted financial evidence from the browser.

This phase adds a buildable Firebase Cloud Functions source package. It does **not** deploy the function and does not wire booking UI yet.

## Callable surface

`initializeBookingCompensation`

Accepted request data is exactly:

```json
{
  "bookingId": "booking-id"
}
```

The callable rejects additional fields. In particular, the caller cannot supply:

- amount/rate/basis points
- compensation model
- rule ID or rule configuration
- operator assignments
- duration, studio, or session type
- percentage base amounts
- effective timestamp
- calculation snapshot
- commission state or payout reference

## Authorization

The server reads `users/{auth.uid}` itself.

Allowed callers:

1. active `owner`; or
2. active `studio_operator` whose user profile has an exact active `permissionSetId` containing `booking.create`, and whose exact `operators/{operatorId}` document is active, reciprocally linked to the same UID, and contains the `studio_operator` domain type.

Missing, disabled, malformed, non-reciprocal, or insufficiently delegated callers fail closed before the booking is read.

Raw `compensationRules` remain Owner-only through client Firestore Security Rules. Admin SDK access in the trusted executor does not change the client rule boundary.

## Authoritative booking contract

Phase 6E executes only for an existing booking whose `status` is `confirmed` and which stores an explicit `confirmedAt` timestamp. `confirmedAt` is the compensation rule effective instant for this phase; booking start time is not silently substituted.

The trusted executor derives calculation input from stored booking fields:

- `bookingNumber` (optional display reference)
- `assignedOperators`: array of `{ operatorId, operatorType }`
- `durationMinutes`
- `confirmedAt`
- `sessionTypeId`
- `studioId`
- `subtotalAmountIdr` -> `booking_subtotal_before_discount`
- `totalAmountIdr` -> `booking_total_after_discount`
- `serviceAmountIdr` -> `service_amount`

Missing percentage bases remain missing. If the winning percentage rule needs one, the Phase 6C engine fails closed rather than guessing.

## Rule loading

The Admin SDK gateway reads only active `compensationRules`. It requests at most 201 rows and the execution core rejects a result larger than the canonical trusted limit of 200 so truncation cannot silently change rule resolution.

Resolution/calculation reuses the Phase 6C engine through the Phase 6D booking projection. Ambiguity or a no-match diagnostic prevents persistence.

## Persistence

The trusted Admin SDK transaction mirrors the Phase 6D2 initialization invariants:

- booking compensation snapshot is initialized once;
- deterministic commission entry IDs are SHA-256 derived from the Phase 6D source key;
- immutable source evidence must match on retry;
- existing entries may have advanced lifecycle state and are not downgraded;
- new entries must be `pending` with `payoutId: null`;
- booking snapshot and new entries commit atomically;
- retry/concurrency cannot create a second logical commission entry for the same source key.

The callable returns counts and initialization status only. It does not return raw rules, rates, calculation snapshots, source keys, amounts, or payout information.

## Cloud Functions packaging

`functions/src/index.js` is bundled with esbuild into `functions/lib/index.js`. Pure compensation modules from the root application are bundled into the server artifact, while `firebase-admin` and `firebase-functions` remain runtime dependencies of the Functions package.

The configured region is `asia-southeast2`.

## Non-goals

Phase 6E does not implement:

- production deployment;
- booking-form/client callable wiring;
- booking creation persistence itself;
- automatic booking-status triggers;
- pending-to-earned transitions;
- payout settlement;
- cancellation/repricing reconciliation;
- manual commission adjustments;
- operator commission-history UI;
- App Check enforcement policy;
- per-studio user scope that is not present in the current authorization data model.

## Next activation boundary

A later booking workflow slice should write the authoritative confirmed-booking fields above and invoke the callable after booking confirmation. That client integration must continue sending only `bookingId`.
