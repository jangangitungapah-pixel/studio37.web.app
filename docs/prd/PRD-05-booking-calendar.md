# PRD-05 — Booking & Calendar System

## 1. Objective

Provide the primary operational workspace for viewing studio availability and creating/managing bookings accurately.

## 2. Calendar Layout

Primary calendar is a time-grid table.

- Horizontal header: date columns.
- Left sticky column: operating time.
- Default visible operating range: 10:00–22:00.
- Actual opening/closing hours must come from Studio Settings.
- Booking blocks occupy time ranges according to start time and duration.
- Active studio rooms must be distinguishable without making the grid confusing.

The detailed visual grouping for multiple rooms is finalized in the UI/UX PRD, but the data model must support multiple active studios from the start.

## 3. Calendar Navigation

Required capabilities:

- previous/next period
- jump to today
- selected date/period context
- visible current-time indicator when useful
- responsive horizontal scrolling on small screens

Calendar navigation must not use disruptive snap behavior that prevents smooth mobile scrolling.

## 4. Booking Block Information

At minimum show enough information to recognize the reservation quickly:

- customer name
- session type
- start/end or duration
- studio/room
- payment-status indicator

Additional information may appear in hover/popover/detail panel rather than overcrowding the block.

## 5. New Booking Entry

A prominent `New Booking` action opens the booking form.

### Required booking fields

- Customer name
- Phone number
- Session type
- Studio/room
- Booking date
- Start time
- Duration or selected package
- Assigned Studio Operator when applicable
- Assigned Recording Operator/Engineer when applicable
- Additional services/add-ons where enabled
- Discount where permitted
- Notes
- Payment information/status

### Calculated fields

- base price
- add-ons
- discount
- total amount
- amount paid
- remaining balance
- payment status
- applicable operator compensation preview where the user has permission to see it

## 6. Customer Handling

When entering phone/name, the application should help match an existing customer while still allowing creation of a new customer. Duplicate customer creation should be minimized through normalized phone matching.

## 7. Pricing Integration

The booking form must call the Pricing Engine. It must not contain session-specific hardcoded prices.

Before final save, the booking stores a pricing snapshot containing the selected rule/package and calculation inputs/results.

Authorized Owner price override must be explicit and audited; it should not silently replace the configured rule.

## 8. Conflict Detection

A booking cannot overlap another conflict-relevant booking for the same room.

Overlap rule:

`existing.startAt < new.endAt && existing.endAt > new.startAt`

Conflict validation must run before committing creation/reschedule and return a clear conflicting booking reference.

Cancelled/voided bookings do not block time. Other statuses are defined consistently during implementation.

## 9. Booking Status

Recommended operational lifecycle:

- `confirmed`
- `in_progress` (optional automation/manual state)
- `completed`
- `cancelled`

Payment status is separate from booking status and must not be mixed into the same field.

## 10. Payment Status

Derived/displayed statuses:

- Pending — nothing paid
- DP — partially paid
- Lunas — fully paid

Status should be derived from total and valid payment transactions where possible rather than independently editable into inconsistent values.

## 11. Booking Detail & Editing

Booking detail must show:

- customer and contact
- studio/session
- schedule
- current price breakdown and snapshot reference
- payment history and balance
- assigned operators
- fee/commission information if permitted
- notes
- creation/update metadata
- activity history link/summary

Editing schedule triggers conflict revalidation. Editing price-sensitive fields triggers explicit repricing preview before confirmation.

## 12. Reschedule

Rescheduling must:

1. validate new studio/time availability
2. determine whether price is affected
3. show any price change before save
4. preserve audit history
5. update relevant dependent compensation only through defined recalculation rules

## 13. Cancellation

Cancellation requires a reason/note when appropriate and must define handling of:

- room availability release
- existing payments/refunds
- earned/pending commissions
- ledger effects

Cancellation should not hard-delete the booking.

## 14. Time Granularity

The UI may display hourly rows while supporting smaller increments such as 30 minutes if configured. Booking interval/granularity must therefore not be permanently hardcoded to one-hour increments.

## 15. Responsive Behavior

Desktop should optimize dense schedule monitoring.

Mobile should support smooth horizontal/vertical navigation, sticky time/date context, large enough touch targets, and a booking form that does not require precision tapping inside a desktop-sized grid.

## 16. Acceptance Criteria

- User can see bookings across configured operating hours.
- Authorized user can create a booking from the calendar.
- Price is calculated from active configuration and stored as a snapshot.
- Same-room overlapping bookings are blocked.
- Different rooms may have overlapping times.
- Payment status and booking status remain separate concepts.
- Reschedule validates conflicts and price effects.
- Historical booking is preserved on cancellation.
- Calendar remains usable on desktop and mobile.
