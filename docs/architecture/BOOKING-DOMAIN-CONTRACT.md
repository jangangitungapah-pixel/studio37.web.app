# Booking Domain Contract — Phase 8A1

## Purpose

Phase 8A1 establishes the canonical in-memory and repository boundary for Studio37 bookings before any new booking write is permitted by Firestore Security Rules.

The goal is to make scheduling, pricing evidence, lifecycle state, and conflict behavior deterministic first. Firestore create/update authorization, transaction composition, and emulator rule coverage are intentionally deferred to Phase 8A2 so the persisted mutation boundary is not opened around an unstable schema.

## Canonical collection

- Collection: `bookings`
- Firestore document ID is the immutable booking identity.
- Human-readable booking number is derived as `ST37-${bookingId}`.
- The booking number is display/reference metadata; it is not used as the Firestore document ID and is not mutable independently.
- No hard-delete operation is exposed.

## Booking lifecycle

Supported operational statuses:

- `confirmed`
- `in_progress`
- `completed`
- `cancelled`

Initial drafts are `confirmed`.

Allowed base transitions:

- `confirmed -> in_progress`
- `confirmed -> completed`
- `confirmed -> cancelled`
- `in_progress -> completed`
- `in_progress -> cancelled`

`completed` and `cancelled` are terminal in the Phase 8A1 base lifecycle. Persistence/audit requirements for transitions are added with the Phase 8A2+ mutation boundary.

## Payment state is separate

Booking status never doubles as payment status.

Canonical payment statuses are:

- `pending`: paid amount is zero
- `dp`: paid amount is greater than zero and below total
- `lunas`: paid amount equals total

The base derivation rejects overpayment. Phase 8A1 booking drafts start with zero paid amount because authoritative payment transactions are owned by the later payment phase. The booking stores denormalized payment summary values only as reconciled display evidence.

## Time model

A booking persists canonical `startAt`, `endAt`, and `durationMinutes`.

Phase 8A1 duration is constrained to positive 15-minute increments up to 24 hours. `endAt` must equal `startAt + durationMinutes` exactly.

This 15-minute domain floor remains compatible with Studio Settings booking intervals of 15, 30, or 60 minutes. A later form validator may apply a stricter configured interval without weakening the persisted booking invariant.

## Room conflict rule

A booking conflicts only when all of the following are true:

1. both bookings reserve the same non-null studio room;
2. both statuses are conflict-relevant; and
3. `existing.startAt < candidate.endAt && existing.endAt > candidate.startAt`.

Conflict-relevant statuses are `confirmed`, `in_progress`, and `completed`. `cancelled` releases the room and never blocks time.

Back-to-back bookings are valid. For example, `10:00–13:00` and `13:00–16:00` do not overlap.

Different studio rooms may host bookings at the same time.

A non-room session has `studioId: null` and does not participate in room conflict queries.

## Conflict repository query

Phase 8A1 defines one prospective bounded query owned by `bookingRepository`:

- equality: `studioId == candidate.studioId`
- range: `startAt < candidate.endAt`
- ordering: `startAt asc`
- hard limit: 100 documents
- one-shot read only
- client post-filter: `endAt > candidate.startAt`, conflict-relevant status, optional excluded booking ID

If the result reaches the 100-document safety bound, the repository throws `BookingConflictQuerySaturationError` rather than reporting a potentially false empty slot.

The query is not yet an active production/development Firestore access path because current Security Rules intentionally deny booking list/create operations. Phase 8A2 must review the required composite index, register it in the query/index registry, add only the minimal manifest entry if required, and add matching Security Rules/emulator tests before booking persistence is wired into UI.

## Snapshot boundaries

A new booking draft contains detached historical evidence for:

- customer
- studio when a room is reserved
- session type
- pricing

### Customer snapshot

Phase 8A1 reuses the Phase 7 customer snapshot builder and preserves:

- `customerId`
- name
- canonical phone
- email

Later customer profile edits cannot change the booking snapshot.

### Studio snapshot

A new room-reserving booking accepts only an active studio and stores:

- `studioId`
- code
- name

A disabled room remains readable in historical bookings but cannot be selected for a new draft.

### Session snapshot

A new booking accepts only an active session type and stores:

- `sessionTypeId`
- code
- name
- `requiresStudioReservation`

If the session requires a room, the booking must contain a studio snapshot.

### Pricing snapshot

The booking consumes the canonical Phase 5 pricing snapshot shape. Phase 8A1 validates the snapshot envelope, safe-integer IDR amount reconciliation, rule/session identity, and studio scope before accepting it into a draft.

Top-level booking amounts are denormalized from the snapshot and must reconcile exactly:

- subtotal
- add-ons
- discount
- total/final amount

The form must not invent or hardcode prices. The caller is expected to obtain the snapshot from the canonical pricing engine pipeline.

## Compensation compatibility

The existing Phase 6D2 Firestore rule boundary can initialize `compensationSnapshot` and `compensationSummary` on a booking. Phase 8A1 therefore reserves those fields as `null` in the initial draft.

Actual compensation projection, commission-entry creation, atomic persistence, and related authorization are not duplicated inside the booking domain in 8A1. They are integrated in a later Phase 8 slice using the existing commission modules.

## Repository boundary

`bookingRepository` exposes only:

- `getBooking(bookingId)` — one exact-document read
- `findBookingConflicts(window)` — one bounded prospective conflict query

It intentionally exposes no:

- `listAll`
- collection listener
- `createBooking`
- `updateBooking`
- `deleteBooking`

The absence of mutation methods is deliberate while Firestore booking writes remain denied by Security Rules.

## Deferred to Phase 8A2+

- Firestore booking create/update Security Rules
- emulator authorization tests
- required composite index confirmation/manifest registration
- persistence transaction/write orchestration
- compensation snapshot + commission-entry composition
- reschedule/repricing persistence
- cancellation reason/audit persistence
- initial payment transaction persistence
- Booking Form UI
- Calendar range query/UI

## Acceptance for this slice

Phase 8A1 is acceptable when:

- canonical draft construction rejects invalid resources, schedule, and pricing evidence;
- same-room overlap edge cases are covered;
- different-room and back-to-back bookings do not conflict;
- cancelled bookings do not block time;
- booking and payment states remain separate;
- conflict repository reads are bounded and fail closed on saturation;
- repository mutation methods remain absent;
- focused tests, full unit suite, lint, build, and dev-server smoke pass.
