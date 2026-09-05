# Trusted Booking Compensation Execution Contract

## Status

Phase 6E execution-core foundation, stacked on Phase 6D2 booking compensation persistence.

This phase defines the reusable trusted orchestration contract that a Firebase Function or other approved backend adapter can invoke. It does not expose protected compensation configuration to the browser and it does not trust client-submitted compensation inputs.

## Why this boundary exists

Phase 6D2 intentionally keeps `compensationRules` and direct compensation persistence Owner-only in Firestore Security Rules.

That is safe for Owner workflows but it cannot support a delegated Studio Operator with `booking.create` if the browser must calculate compensation. Letting the operator client read raw rules would expose protected fee configuration. Letting the client submit expected commission amounts, rule IDs, percentage bases, or snapshots would allow forgery.

Phase 6E therefore moves compensation orchestration behind a trusted contract.

## Public request surface

The execution request contains only:

- authenticated `actorUid`
- target `bookingId`

The trusted executor ignores any additional caller-supplied compensation-shaped properties.

The caller must not be authoritative for:

- assigned operators
- operator types
- duration
- studio
- session type
- effective timestamp
- percentage base amounts
- compensation rules
- expected amounts
- rule IDs
- calculation snapshots
- commission source keys

## Execution sequence

`createTrustedBookingCompensationExecutor()` executes this order:

1. validate actor and booking IDs
2. authorize the actor for `booking.create`
3. load authoritative booking compensation context from trusted storage
4. verify the loaded context belongs to the requested booking
5. require the booking to be `confirmed`
6. load canonical compensation rules through a protected server adapter
7. build the Phase 6D projection internally
8. fail closed if the projection contains diagnostics
9. persist through the trusted Phase 6D2 persistence adapter
10. return a redacted operational receipt

Authorization happens before any protected booking context or compensation rules are loaded.

## Authoritative booking context

The trusted booking-context adapter provides:

- `bookingId`
- optional `bookingNumber`
- `status`
- assignments
- duration in minutes
- explicit compensation `effectiveAt`
- percentage-base amounts
- nullable session type ID
- nullable studio ID

The executor requires the context booking ID to match the request and currently accepts only `confirmed` bookings because the Phase 6D source event is `booking_confirmation`.

Future completed/cancelled/repriced flows require separate lifecycle contracts rather than reusing confirmation initialization.

## Authorization adapter

The trusted authorization adapter receives:

- `actorUid`
- `bookingId`
- required capability `booking.create`

It must resolve authorization from trusted account/profile/permission-set data. A future Firebase Functions adapter should authorize active Owners directly and active Studio Operators only when their active permission set includes `booking.create` and any additional booking-scope constraints are satisfied.

The core accepts authorization only when the adapter returns literal `true`; all other values fail closed.

## Protected rules adapter

`loadCanonicalCompensationRules()` runs only after authorization.

It must read canonical compensation rules with server authority and return them to the executor only. Raw rules are never included in the public result.

The adapter may apply safe server-side filtering by effective time or scope, but it must not allow the client to supply trusted rule candidates.

## Projection

The executor calls the existing Phase 6D `buildBookingCompensationProjection()` with only server-loaded context and server-loaded rules.

This preserves:

- Phase 6C deterministic resolution
- exact compensation arithmetic
- Phase 6D historical calculation evidence
- independent entries for Studio Operator and Recording Engineer
- no-match diagnostics instead of implicit Rp0

Any unresolved diagnostic stops execution before persistence.

## Persistence adapter

`persistBookingCompensation()` receives:

- authenticated actor UID
- exact booking ID
- internally generated projection

The production server adapter must preserve Phase 6D2 atomic/idempotent persistence semantics.

A future Admin SDK implementation may bypass Firestore client security rules, so the adapter itself becomes a security boundary and must not weaken the Phase 6D2 validation contract.

## Safe result receipt

The public execution result contains only:

- `bookingId`
- `createdEntryCount`
- `existingEntryCount`
- `initializedBookingSnapshot`

It deliberately excludes:

- raw compensation rules
- rule IDs
- commission-entry document IDs
- source keys
- commission amounts
- percentage-base values
- calculation snapshots

Financial visibility remains governed by separate Fee & Commission permission/UI contracts.

## Retry behavior

The execution core delegates idempotency to Phase 6D2 persistence.

A retry may return:

- zero created entries
- one or more existing entries
- `initializedBookingSnapshot = false`

The core converts those internal persistence details into counts only and never returns deterministic entry IDs.

## Error behavior

Fail closed on:

- invalid actor/booking IDs
- failed authorization
- mismatched authoritative booking context
- non-confirmed booking state
- missing authoritative effective timestamp
- malformed canonical-rules result
- projection diagnostics
- malformed/mismatched persistence result

Domain ambiguity/calculation failures from Phase 6C/6D propagate as execution failure and must not be converted to a zero-value result.

## Phase 6E non-goals

- no deployed Cloud Function yet
- no Firebase Admin SDK adapter yet
- no callable endpoint yet
- no general booking-create repository
- no browser access to compensation rules
- no client-submitted commission amount/rule snapshot
- no commission lifecycle transition persistence
- no cancellation/repricing reconciliation
- no payout settlement
- no adjustment/reversal records
- no Fee & Commission UI
- no daily/shift allowance approximation

## Required next activation slice

Phase 6E2 should bind this core to a real trusted runtime, preferably Firebase Functions v2 for the current Firebase stack.

That adapter must:

1. authenticate the callable/request context
2. resolve Owner or delegated `booking.create` authorization from trusted Firestore data
3. load the authoritative booking context
4. read protected compensation rules with Admin/server authority
5. invoke this Phase 6E core
6. persist with Admin SDK transaction semantics equivalent to Phase 6D2
7. map internal errors to stable public error codes without leaking protected compensation data
8. add emulator/integration coverage for Owner, authorized operator, unauthorized operator, retry, and forged payload attempts

## Phase 6E acceptance

- authorization precedes protected reads
- only `bookingId` and authenticated actor identity are request-authoritative
- client compensation-shaped fields cannot influence the projection
- canonical rules are loaded behind the trusted adapter
- booking context is server-authoritative and must match the requested booking
- only confirmed bookings use booking-confirmation compensation initialization
- unresolved diagnostics fail before persistence
- persistence receives only internally generated projection data
- returned receipt exposes no protected rule, entry ID, source key, or amount
- retry semantics remain compatible with Phase 6D2 idempotency
