# PRD-07 — Operator Fee & Commission Engine

## 1. Objective

Calculate Studio Operator and Recording Operator compensation consistently from configurable rules while keeping compensation separate from customer pricing.

## 2. Supported Compensation Models

### Per Hour
Example: operator receives Rp20.000 for every compensated hour.

### Per Session
Example: operator receives Rp50.000 for one completed rehearsal booking.

### Percentage
Example: operator receives 10% of the commission base amount.

### Package-Based
Example:
- Recording 3 hours -> Rp100.000
- Recording 6 hours -> Rp175.000

### Fixed Fee
Example: Mixing engineer receives Rp150.000 per project/session.

### Manual Adjustment
Authorized Owner can add a positive or negative adjustment with reason and audit record.

## 3. Compensation Scope

Rules may be scoped by:

- operator or operator type
- session type
- studio/room
- package/duration
- effective period

The engine must resolve rules deterministically and reject ambiguous configuration.

## 4. Operator Types

The data model should support at least:

- Studio Operator
- Recording Operator / Engineer

One person may potentially be capable of multiple operational types; compensation assignment is booking-specific.

## 5. Commission Base

Percentage rules must define the base explicitly, for example:

- final booking subtotal before discount
- final booking total after discount
- selected service amount only

The application must never guess the percentage base.

## 6. Earning Lifecycle

Recommended entry states:

- `pending` — generated but not yet earned
- `earned` — entitlement confirmed based on business rule
- `paid` — included in a settled payout
- `void` — cancelled/reversed

The condition that changes Pending to Earned must be explicit. Default recommendation: booking completion, with owner-controlled exceptions where needed.

## 7. Commission Snapshot

Booking confirmation stores the compensation rule snapshot relevant to assigned operators. Changing a compensation setting later must not silently alter old bookings.

The snapshot should preserve:

- rule/model
- rate or fixed amount
- calculation base
- duration/package inputs
- expected amount
- configuration/rule ID

## 8. Recalculation

Changes to session, duration, price, assigned operator, or booking cancellation may require compensation recalculation.

Recalculation must:

1. show the existing and proposed value when material
2. preserve audit history
3. not rewrite already-paid entries silently
4. create adjustment/reversal handling when a settled amount is affected

## 9. Cancellation

Cancellation behavior depends on configured policy and lifecycle state. Examples:

- pending entry becomes void
- earned-but-unpaid entry may become void or require Owner review
- already-paid entry requires adjustment/reversal instead of deletion

## 10. Multiple Operators

A booking may generate multiple compensation entries, such as one Studio Operator fee and one Recording Engineer fee. Each entry is independently traceable.

## 11. Manual Override

Owner can override or adjust an expected compensation amount only with:

- authorization
- reason
- original amount retained
- actor/timestamp audit record

## 12. Validation

Reject:

- negative base configuration except explicit adjustment records
- invalid percentage
- missing operator/session references
- ambiguous matching rules
- accidental duplicate commission generation for the same booking/operator/rule event

## 13. Acceptance Criteria

- Per-hour, per-session, percentage, package, and fixed compensation can be configured.
- Recording and Studio Operator compensation can coexist on one booking.
- Historical commission expectations do not change when settings change.
- Paid entries cannot be silently rewritten or deleted.
- Cancellation/repricing has defined commission effects.
- Every amount can be traced to booking + rule snapshot + adjustments.
