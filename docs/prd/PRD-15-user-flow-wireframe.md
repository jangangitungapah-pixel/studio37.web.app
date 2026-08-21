# PRD-15 — User Flow, Wireframe & Interaction Specification

## 1. Objective

Define how Owners and Studio Operators move through Studio37 so implementation follows consistent workflows rather than isolated pages.

This document is interaction-oriented and complements PRD-14.

## 2. Global Navigation Flow

Authenticated user enters the application and is routed to the first allowed operational page, normally Dashboard.

Primary flow:

`Login -> Dashboard -> Calendar / Finance / Settings according to permission`

Navigation must hide unauthorized destinations while direct URL authorization remains enforced independently.

## 3. Booking Creation Flow

Recommended flow:

1. Open Booking Calendar.
2. Click `New Booking` or select an available time range.
3. Find/select customer or create a new customer.
4. Select Session Type.
5. Select Studio/Room if required.
6. Select date/start time.
7. Select duration/package allowed by current pricing configuration.
8. Add optional services/add-ons.
9. Assign Studio Operator and/or Recording Operator when applicable.
10. Pricing Engine calculates the total.
11. Enter initial payment/DP if received.
12. Review booking summary.
13. Validate booking conflict.
14. Confirm booking.
15. Show success and update calendar.

## 4. Booking Conflict Flow

If requested time conflicts:

1. Save is blocked.
2. Show conflicting booking/studio/time clearly.
3. Preserve user's entered form values.
4. Offer return to schedule selection or suitable non-destructive correction path.

The application must never silently move the booking to another time.

## 5. Booking Detail Flow

`Calendar/Dashboard -> Booking Detail`

Detail provides contextual actions based on permission:

- edit booking
- reschedule
- record payment
- view payment history
- complete session
- cancel booking
- inspect audit history

Financial/commission data is shown only when authorized.

## 6. Reschedule Flow

1. Open booking.
2. Choose Edit/Reschedule.
3. Change studio/date/time/duration.
4. Re-check availability.
5. Recalculate price if price-sensitive inputs changed.
6. Display old vs new price if different.
7. Display compensation impact when authorized/relevant.
8. Confirm.
9. Save booking and audit event.

## 7. Payment Flow

`Booking Detail -> Add Payment`

1. Show total, paid, remaining.
2. Enter amount.
3. Choose payment method.
4. Optional reference/note.
5. Validate amount.
6. Confirm.
7. Create payment transaction.
8. Update derived payment summary/status.
9. Create/link bookkeeping entry where configured.
10. Show updated balance.

## 8. Cancellation Flow

1. Open booking.
2. Select Cancel.
3. Show booking/payment/commission consequences.
4. Require reason if configured.
5. If payment exists, show refund/retention decision requirement rather than deleting money history.
6. Confirm cancellation.
7. Release calendar slot.
8. Apply defined commission state change.
9. Create audit record.

## 9. Pricing Configuration Flow

`Settings -> Price Settings`

1. Select or create Session Type.
2. Define service behavior.
3. Select pricing model.
4. Define studio scope.
5. Configure price/duration/package fields.
6. Configure add-ons where needed.
7. Configure compensation rule where applicable.
8. Preview human-readable example calculation.
9. Validate ambiguity/errors.
10. Save/activate configuration.

The UI must not require editing raw JSON.

## 10. Operator Management Flow

`Settings -> Operator Settings`

1. Add/select operator.
2. Edit identity/contact information.
3. Define operational type/capabilities.
4. Optionally enable application login.
5. Assign Studio Operator permission set if login-enabled.
6. Configure compensation rule/default where needed.
7. Save.

Disabling an operator must preserve history.

## 11. Commission Settlement Flow

`Fee & Commission -> Operator/Period`

1. Filter/select operator.
2. Review Pending/Earned/Paid items.
3. Inspect calculation/source booking when needed.
4. Select eligible Earned entries.
5. Review payout total.
6. Enter payout method/date/reference.
7. Confirm settlement.
8. Mark entries Paid and link payout.
9. Create/link bookkeeping expense.
10. Audit action.

## 12. Bookkeeping Flow

### Manual expense

`Bookkeeping -> Record Expense -> Category -> Amount -> Date -> Method -> Description -> Save`

### Source-generated

Payment/commission/refund source workflow creates or links its ledger record without requiring duplicate manual entry.

## 13. Danger Zone Flow

1. Owner opens Danger Zone.
2. Select reset scope.
3. Read exact impact summary.
4. Re-authenticate if required/available.
5. Enter typed confirmation phrase.
6. Final destructive confirmation.
7. Execute reset with clear progress/result.

No one-click reset.

## 14. Wireframe Inventory

Implementation/design should produce wireframes/specs for at least:

- Login
- Dashboard desktop/mobile
- Booking Calendar desktop/mobile
- New Booking form desktop/mobile
- Booking Detail
- Fee & Commission list/detail/settlement
- Bookkeeping list + manual transaction form
- Settings shell
- Account Settings
- Studio Settings
- Price Settings rule editor
- Operator Settings + permissions
- Danger Zone
- reusable dialogs/feedback states

## 15. Interaction Standards

- Preserve form input after recoverable validation/conflict errors.
- Do not use destructive defaults.
- Display calculation changes before applying them.
- Use confirmation only for material/destructive actions; avoid confirmation fatigue for trivial actions.
- After successful creation/edit, show clear result and return user to useful context.

## 16. Acceptance Criteria

- Every core page has a defined entry, primary action, and exit/result state.
- Booking flow covers customer, schedule, pricing, operators, payment, conflict validation, and save.
- Price changes during reschedule are explicit.
- Payment/commission/bookkeeping source relationships are represented in workflows.
- Mobile booking workflow does not depend on precision use of a desktop calendar grid.
- Destructive/reset flow has multiple safeguards.
