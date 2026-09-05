# Booking Compensation Persistence Contract

## Status

Phase 6D2 persistence activation, stacked on the Phase 6D pure booking compensation projection.

This slice persists historical booking compensation evidence and the matching initial commission entries without broadening raw compensation-rule visibility.

## Authority model

The current Studio37 repository contains Firebase client SDK + Firestore only. It does not currently contain Cloud Functions or another trusted backend execution path.

Because `compensationRules` are Owner-only, a delegated Studio Operator cannot safely calculate trusted compensation client-side without either:

- exposing sensitive raw compensation configuration, or
- trusting a client-submitted amount that the client could forge.

Phase 6D2 therefore activates persistence for **active Owner only**.

This is intentionally narrower than the future booking-creation authorization model. A later trusted/server-authoritative slice is required before delegated booking creation can calculate and persist compensation safely.

## Source

Phase 6D2 accepts only the output of `buildBookingCompensationProjection()` from Phase 6D.

The persistence boundary requires:

- an exact existing booking ID
- a historical booking compensation snapshot
- zero or more matching commission-entry drafts
- no unresolved diagnostics
- an explicit actor UID

A projection containing `no_matching_rule` or any future diagnostic is rejected. Persistence never converts an unresolved assignment into Rp0 or a partial commission history.

## Existing booking requirement

Phase 6D2 does not create the general booking document.

`bookings/{bookingId}` must already exist. This keeps the slice focused on compensation persistence rather than inventing the full booking create/edit schema before the booking repository lands.

The transaction may initialize only:

- `compensationSnapshot`
- `compensationSummary`
- `updatedAt`
- `updatedByUid`

No schedule, customer, studio, session, pricing, payment, notes, status, or other booking field may be changed by this boundary.

## One-time historical initialization

A booking compensation snapshot is historical evidence.

Client-side initialization is allowed only when the existing booking has no compensation snapshot.

If the booking already has compensation evidence:

- an exact-equivalent retry is accepted by the repository without rewriting the booking
- different evidence is rejected

Repricing, reassignment, cancellation, and paid-history corrections require explicit later recalculation/adjustment flows. They do not reuse the initialization write.

## Deterministic commission entry IDs

Each Phase 6D source key is SHA-256 hashed and stored as:

`booking-comp-<64 lowercase hex characters>`

The source key already identifies:

`booking + operator + operatorType + rule + source event`

The hash is used only as a deterministic Firestore document ID. The unhashed `sourceKey` remains inside the document as historical idempotency evidence.

A hash collision is treated as a hard persistence error if two distinct source keys resolve to the same document ID within one projection.

## Atomic transaction

`initializeBookingCompensation()` performs one Firestore transaction.

Order:

1. read the exact existing booking
2. read every deterministic `commissionEntries/{id}` document required by the projection
3. validate existing historical evidence
4. stage booking snapshot initialization when missing
5. create every missing commission entry
6. commit atomically

All reads occur before writes.

A failed transaction leaves neither a partially initialized booking nor a partial commission-entry set.

## Retry semantics

A retry is idempotent when:

- the booking snapshot and summary are equivalent to the requested projection
- every existing deterministic commission entry carries the same immutable source evidence

Immutable source evidence includes:

- amount
- booking ID / display booking number
- operator ID/type
- rule ID
- compensation model
- calculation snapshot
- source event
- source key

Mutable lifecycle fields are deliberately excluded from retry equivalence.

For example, if a matching entry has already advanced from `pending` to `paid`, initialization retry accepts the entry and leaves its state/payout untouched.

## Initial commission entry document

A newly persisted entry contains the Phase 6D draft plus server/actor metadata:

- `bookingId`
- optional `bookingNumber`
- `operatorId`
- `operatorType`
- `ruleId`
- `compensationModel`
- detached `calculationSnapshot`
- integer `amountIdr`
- `sourceEvent = booking_confirmation`
- opaque `sourceKey`
- `state = pending`
- `payoutId = null`
- `createdAt`
- `createdByUid`
- `updatedAt`
- `updatedByUid`

Creation and update timestamps use the same server timestamp sentinel for the initial write.

## Firestore authorization

### `bookings/{bookingId}`

Phase 6D2 permits:

- active Owner exact `get`
- active Owner focused compensation initialization update

It denies:

- list
- create
- delete
- delegated Studio Operator compensation initialization
- replacing an existing compensation snapshot
- changing non-compensation booking fields through this write path

### `commissionEntries/{entryId}`

Phase 6D2 permits active Owner:

- exact `get`
- bounded list with `limit <= 200`
- validated initial `pending` create linked to an existing booking after the atomic write

It denies:

- Studio Operator access, including users holding commission-oriented delegated capabilities
- unbounded list
- initial `earned` / `paid` / `void` create
- payout-linked initial create
- update
- delete

Update remains denied because lifecycle persistence is not part of Phase 6D2.

## Why delegated commission capabilities do not apply yet

Permission-set capabilities such as `commission.view_all`, `commission.view_own`, `commission.adjust`, or `commission.payout` are not activated for this new collection in Phase 6D2.

PRD-08 defines Owner-only access as the default and describes operator self-view as a future permission. Enabling those capabilities now would create an authorization surface before the corresponding filtered query, lifecycle, and privacy contracts exist.

## Security limitation and required follow-up

Owner-only client persistence is acceptable for the current trusted Owner workflow, but it is not the final architecture for delegated booking creation.

Before a Studio Operator with `booking.create` can safely persist compensation, Studio37 needs a trusted execution boundary that can:

1. authenticate/authorize the booking actor
2. read protected compensation rules without exposing them to the operator client
3. run Phase 6C resolution/calculation authoritatively
4. create the Phase 6D projection
5. atomically persist booking compensation and commission entries

That boundary may be a Firebase server function or another project-approved backend service. It must not be approximated by granting operators raw `compensationRules` access.

## Current non-goals

- no general booking create/edit repository
- no delegated Studio Operator compensation initialization
- no server-function implementation
- no automatic `pending -> earned`
- no commission-entry update
- no cancellation/repricing reconciliation
- no payout settlement
- no adjustment/reversal records
- no Fee & Commission UI
- no daily/shift allowance approximation
- no customer pricing changes

## Phase 6D2 acceptance

- exact existing booking is required
- unresolved projections fail closed
- booking snapshot initialization and missing entries are atomic
- deterministic entry IDs make retry/concurrent generation idempotent
- exact retry does not rewrite booking history
- advanced matching entry state is never downgraded by initialization retry
- conflicting booking or entry evidence fails closed
- active Owner is the only authorized persistence actor
- Studio Operator cannot gain compensation persistence through delegated commission capabilities
- initial entries are pending and payout-free
- commission updates/deletes remain denied
