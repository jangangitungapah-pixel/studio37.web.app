# PRD-02 — Data Model & Firestore Architecture

## 1. Objective

Define Firestore collections, record ownership, historical snapshots, and query patterns that support Studio37 while remaining practical on Firebase Spark Plan.

## 2. Data Principles

- Prefer explicit documents over deeply nested mutable structures.
- Store money as integer IDR.
- Use Firebase timestamps for persisted timestamps.
- Preserve historical booking price/commission snapshots.
- Use status/active flags instead of deleting referenced configuration.
- Avoid unnecessary listeners and repeated reads.
- Every sensitive write records actor/timestamp metadata where appropriate.

## 3. Proposed Top-Level Collections

### `users`
Application login profiles.

Document ID: exact Firebase Authentication `uid`.

Key fields:
- `uid`
- `displayName`
- `email`
- `phone`
- `role`: `owner | studio_operator`
- `status`: `active | disabled`
- `permissionSetId` or normalized permissions
- `operatorId`
- `activationInviteId` (nullable invitation source)
- `createdAt`, `updatedAt`

The initial implementation uses nullable `permissionSetId`; Owner capabilities are implicit and
the capability-resolution layer is introduced separately. A missing, malformed, unreadable, or
disabled profile must not enter protected application routes.

### `operators`
Operational/personnel entity used for assignments and compensation, including people who may not have a login.

Phase 4C1 implements immutable auto-ID `operators/{operatorId}` documents with normalized display
name/contact data, one or both `studio_operator | recording_engineer` domain types,
`active | disabled` status, nullable protected `linkedUserUid`, and immutable
creation/server-controlled update metadata. Domain types never grant application capabilities.

The feature repository owns one one-shot `displayName`-ordered query capped at 100 documents and
exposes no generic collection read or hard delete. New records start with `linkedUserUid: null`,
allowing operational profiles without a Firebase login. Phase 4C3 adds a separate Owner-only
transaction repository that changes `operators.linkedUserUid` and `users.operatorId` together from
exact known document IDs; one-sided links and direct reassignment are denied. The finalized
contracts are documented in `docs/architecture/OPERATOR-DOMAIN-CONTRACT.md` and
`docs/architecture/OPERATOR-ACCOUNT-LINK-CONTRACT.md`. Phase 4C4 consumes the same exact-document
boundary in an Owner-only review/link/unlink browser workflow without adding a user collection
query or Authentication provisioning path. Phase 4C5A adds exact nested
`operators/{operatorId}/accountInvites/{invitationId}` documents for verified-email
self-registration. Redemption creates or links the exact `users/{auth.uid}` profile and updates the
operator/invitation in one atomic batch. New profiles are always active `studio_operator` users
with a null permission set; the invitation path cannot create/promote an Owner. No invitation list
or composite index is introduced. The finalized contract is
`docs/architecture/OPERATOR-ACCOUNT-INVITATION-CONTRACT.md`.

Compensation defaults, permission administration, assignment behavior, and their owning UI are
implemented in later slices.

### `studios`
Studio rooms/resources that can be booked.

Fields:
- name/code
- description
- active state
- display order
- optional capacity/equipment metadata
- optional room-specific operating overrides

Phase 4B implements `studios/{roomId}` with an immutable auto-generated document ID, uppercase
display code, name, description, integer display order, `active | disabled` status, and immutable
creation/server-controlled update metadata. Studio Settings reads the collection with one one-shot
`displayOrder`-ordered query capped at 50 documents. The finalized schema, query, soft-disable,
authorization, and deferred-field contract is documented in
`docs/architecture/STUDIO-ROOMS-CONTRACT.md`.

### `sessionTypes`
Owner-configurable services such as Rehearsal, Recording, Mixing, Mastering.

Fields:
- name/code
- description
- active state
- booking behavior
- default duration/minimum duration
- whether studio/time-slot reservation is required
- display metadata

### `pricingRules`
Pricing configurations associated with session types and optionally specific studios.

Fields:
- `sessionTypeId`
- applicable studio IDs or scope
- pricing model
- price values
- duration/package constraints
- priority
- active/effective dates
- add-on/override metadata
- commission rule references or embedded configuration

### `bookings`
Primary operational reservation records.

Important fields:
- booking number
- customer reference + customer snapshot
- studio reference + studio snapshot
- session type reference + snapshot
- start/end timestamps
- duration
- booking status
- pricing snapshot
- subtotal/discount/add-ons/total
- payment summary
- assigned operator IDs
- compensation snapshot/summary
- notes
- created/updated actor metadata

### `customers`
Reusable customer profiles.

Fields:
- name
- normalized phone
- optional email
- notes
- aggregate convenience fields where justified
- created/updated timestamps

### `payments`
Append-style payment transactions.

Fields:
- booking ID
- amount
- method
- transaction type (`payment`, `refund`, `adjustment`)
- status
- paid/recorded timestamp
- actor
- notes/reference

### `commissionEntries`
Compensation generated from bookings or manual adjustments.

Fields:
- booking ID
- operator ID
- compensation type
- calculation snapshot
- amount
- state (`pending`, `earned`, `paid`, `void`)
- payout/batch reference
- timestamps

### `commissionPayouts`
Optional payout settlement documents grouping commission entries paid together.

### `ledgerEntries`
Operational bookkeeping records.

Fields:
- type (`income`, `expense`, `adjustment`)
- category
- amount
- occurredAt
- source type/source ID
- booking/operator references when relevant
- payment method
- notes
- actor metadata

### `appSettings`
Small global configuration documents, for example:
- studio profile
- operating hours
- booking defaults
- numbering preferences

Phase 4A implements the exact `appSettings/studio` document with business name, Indonesian IANA
timezone, same-day operating-hour minutes, booking interval, immutable creation metadata, and
server-controlled update metadata. The finalized field and authorization contract is documented in
`docs/architecture/STUDIO-SETTINGS-CONTRACT.md`. Other settings documents remain deferred and
default-deny.

### `permissionSets`
Configurable Studio Operator permission templates if permissions are not stored directly on user documents.

The initial permission-set document contract contains:

- `name`
- `status`: `active | disabled`
- `capabilities`: supported delegable capability strings
- `createdAt`, `updatedAt`

Unknown capabilities and Owner-only `permissions.manage` / `danger_zone.execute` capabilities are
invalid in an operator permission set. Runtime resolution reads only the exact referenced
`permissionSets/{permissionSetId}` document.

Phase 4D1 adds Owner-only template administration with one `name asc + limit(50)` query and a
focused exact-document assignment transaction. Non-null assignments require an active reciprocal
Studio Operator user/operator link and an active canonical permission set; clearing to null remains
available for revocation. No user collection scan, Auth enumeration, hard delete, or composite
index is introduced. The contract is
`docs/architecture/PERMISSION-ADMINISTRATION-CONTRACT.md`.

### `auditLogs`
Append-only-ish operational audit events for sensitive changes.

## 4. Snapshot Strategy

Bookings must retain snapshots sufficient to explain historical data even if referenced configuration changes.

Recommended booking snapshot objects:

- `customerSnapshot`
- `studioSnapshot`
- `sessionSnapshot`
- `pricingSnapshot`
- `commissionSnapshot`

References remain for navigation/reporting, while snapshots preserve historical truth.

## 5. Booking Time Model

Persist canonical `startAt` and `endAt` timestamps. Duration may also be stored as a convenience/validation field but should be derivable.

Conflict rule:

`existing.startAt < candidate.endAt AND existing.endAt > candidate.startAt`

for the same active studio and conflict-relevant booking statuses.

## 6. Payment Summary

The authoritative payment history is the `payments` collection. A booking may contain denormalized summary fields such as:

- `totalAmount`
- `paidAmount`
- `balanceAmount`
- `paymentStatus`

These summaries must be updated consistently with payment writes and repairable from transactions.

## 7. Deletion Policy

Configuration and referenced operational data should generally use soft-disable/archival semantics.

Hard deletion is reserved for controlled Danger Zone/reset workflows and must not leave inconsistent references during ordinary use.

## 8. Query & Index Requirements

Likely queries include:

- bookings by date range + studio
- bookings by customer
- bookings by payment status
- commission entries by operator + period + status
- ledger entries by date range + type/category
- active studios/session types/pricing rules
- audit logs by entity or date

Composite indexes should be added only for actual query requirements rather than pre-creating large numbers of indexes.

## 9. Spark Plan Efficiency

- Avoid one real-time listener per calendar cell.
- Query booking ranges in batches appropriate to the visible calendar window.
- Cache/reference stable configuration in app state where safe.
- Do not maintain expensive aggregate documents unless they materially reduce reads and can be kept correct.
- Prefer paginated history views.

## 10. Numbering

Human-readable booking numbers may be generated separately from Firestore document IDs. Document IDs should not depend on mutable display numbers.

## 11. Data Integrity Rules

- Referenced IDs must point to valid domain entities at creation time.
- Negative prices/payments/fees are rejected except explicit adjustment/refund models.
- Disabled session/studio configuration cannot be selected for new bookings but remains readable for history.
- Ordinary operators cannot modify protected pricing or compensation snapshots after booking confirmation unless permission explicitly allows a controlled repricing flow.

## 12. Acceptance Criteria

- Schema supports multiple studios and arbitrary session types.
- Historical bookings remain understandable after settings change.
- Payment and commission history are represented as transaction/entry records, not only mutable totals.
- Calendar queries can load a date range without per-cell Firestore reads.
- Owner/operator authorization can be expressed in Firebase Security Rules.
- Data model remains compatible with Spark Plan development constraints.
