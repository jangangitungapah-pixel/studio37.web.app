# PRD-13 — Activity Log & Audit Trail

## 1. Objective

Create a traceable history of important operational and administrative changes performed by Owners and Studio Operators.

## 2. Events to Audit

At minimum:

- booking created
- booking rescheduled/edited
- booking cancelled
- manual price override
- payment recorded/refunded/adjusted
- commission generated/adjusted/settled/voided
- ledger entry created/corrected
- pricing/session configuration changed
- studio settings changed
- operator/account status changed
- permissions changed
- destructive reset actions

## 3. Audit Record

Recommended fields:

- event/action type
- actor user ID
- actor display snapshot
- timestamp
- entity type
- entity ID
- related booking/operator/customer IDs where useful
- summary
- structured before/after values for selected sensitive fields
- reason/note when required

Avoid copying entire large documents into every audit event when a focused diff is sufficient.

## 4. Immutability

Audit records should be treated as append-only for ordinary application users. Studio Operators must not be able to delete or rewrite evidence of their own actions.

## 5. Before/After Data

Sensitive edits should preserve enough context to answer questions such as:

- who moved this booking from 14:00 to 16:00?
- who changed Rehearsal price from Rp100.000 to Rp120.000?
- why was a booking manually repriced?
- who changed an operator's permissions?

Secrets/authentication credentials must never be logged.

## 6. Activity UI

Owner should be able to inspect recent activity and entity-specific history.

Useful filters:

- date range
- actor
- entity type
- action type
- entity/reference search

Booking detail should expose relevant booking activity without requiring the Owner to search the global log manually.

## 7. Security

Security Rules must prevent ordinary users from mutating audit records beyond permitted event creation patterns. Where atomic trusted audit creation cannot be perfectly enforced with client-only Spark architecture, critical workflows should be structured to minimize spoofing risk and this limitation documented.

## 8. Retention

No automatic retention deletion is required for MVP. Future retention policies must consider operational dispute resolution and Firestore usage.

## 9. Acceptance Criteria

- Critical booking, pricing, payment, commission, permission, and reset events generate audit history.
- Owner can identify actor and timestamp.
- Relevant before/after context is available for sensitive edits.
- Operators cannot delete their audit history.
- Audit logging excludes credentials/secrets.
- Booking detail can expose booking-specific activity.
