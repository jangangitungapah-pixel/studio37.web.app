# PRD-09 — Payments & Booking Financials

## 1. Objective

Track customer payments for every booking with accurate balance, transaction history, refund/adjustment handling, and bookkeeping linkage.

## 2. Core Concepts

Booking total and payment history are separate.

Booking keeps denormalized summary values for fast display, while the authoritative money movement is represented by payment transaction records.

## 3. Payment Status

User-facing status:

- `Pending` — valid paid amount is 0
- `DP` — paid amount > 0 and < booking total
- `Lunas` — paid amount >= booking total, subject to overpayment policy

Status should be derived from valid transactions rather than freely typed.

## 4. Payment Transaction

Each transaction stores:

- booking ID
- transaction type
- amount
- method
- date/time
- reference/note
- actor
- created timestamp

Supported transaction types should include:

- payment
- refund
- adjustment where explicitly authorized

## 5. Multiple Payments

A booking may be paid in multiple steps, for example:

Total Rp600.000 -> DP Rp200.000 -> remaining payment Rp400.000.

The application must show each transaction and calculate current paid amount/balance.

## 6. Payment Methods

Methods are configurable or at minimum centralized constants rather than scattered strings. Initial examples:

- Cash
- Bank Transfer
- QRIS
- Other

Optional reference/transaction ID may be stored.

## 7. Overpayment

The application should prevent accidental payments above the remaining balance by default. If an authorized overpayment workflow is later supported, it must be explicit and separately handled.

## 8. Refunds

Refunds are negative financial effects represented as transactions, not deletion of original payment records.

Refund flow should require:

- source booking
- refund amount
- reason
- payment/refund method if relevant
- authorization
- audit record

Refund cannot exceed refundable paid amount unless an explicit adjustment model allows it.

## 9. Booking Price Change

If authorized repricing changes the booking total after payments exist:

- show old total, new total, paid amount, and resulting balance
- do not alter payment history
- recompute payment status
- require resolution if new total falls below already-paid amount

## 10. Cancellation

Cancelling a booking does not automatically erase payments. The cancellation workflow must display existing paid amount and require the appropriate refund/retention decision according to studio policy.

## 11. Bookkeeping Integration

Valid customer payments may generate/link income ledger entries. Refunds may generate/link reversal/expense-like financial entries based on the final ledger design.

Source IDs must prevent duplicate ledger posting for the same transaction.

## 12. Permissions

Capabilities should distinguish at least:

- view payment information
- record payment
- refund/adjust payment
- override booking price

Sensitive actions are Owner-only by default unless explicitly delegated.

## 13. Acceptance Criteria

- Booking can receive multiple payment transactions.
- Pending/DP/Lunas is calculated consistently.
- Payment history remains visible after updates.
- Refunds do not delete original payment evidence.
- Repricing preserves payment transactions and clearly recalculates balance.
- Duplicate bookkeeping posting is prevented.
- Unauthorized operator cannot perform financial adjustments.
