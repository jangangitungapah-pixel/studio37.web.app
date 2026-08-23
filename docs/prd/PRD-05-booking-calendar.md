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

### 2.1 Approved Calendar Grid Reference

The user-provided calendar example is the baseline interaction and layout reference for the Studio37 booking grid.

Expected structure:

- The top-left corner displays the current month context.
- Each date is a fixed-width vertical column.
- Date headers show a short day label and day number.
- The far-left column displays the time scale.
- Time rows run vertically from the configured opening hour to closing hour.
- Default reference is one visible row per hour from 10:00 through 22:00.
- The grid may support smaller booking increments such as 30 minutes without forcing every increment to become a visually heavy row.
- Empty time/date cells remain visually quiet so booking blocks are the dominant operational information.
- Vertical and horizontal grid lines remain subtle but sufficiently visible for fast scanning.

A booking is rendered as a vertically spanning card inside its date column. Its visual height is proportional to booking duration. For example, a six-hour booking beginning at 10:00 occupies the calendar range from 10:00 until 16:00 rather than appearing as a single-row item.

Booking cards should expose a compact information hierarchy similar to the reference:

1. Customer name
2. Payment-status badge
3. Session type
4. Start time and duration
5. Compact price/payment information when permitted

The card may use a thin status/accent edge and a lightly differentiated surface. Text must remain readable without relying only on color.

### 2.2 Grid Scrolling & Sticky Context

The reference establishes a large scrollable planning surface rather than a compressed week card UI.

Required behavior:

- Horizontal scrolling reveals additional dates.
- Vertical scrolling reveals additional operating hours when needed.
- Horizontal scrolling must remain smooth and free-scrolling; no forced date-column snapping.
- The time column remains sticky while scrolling horizontally.
- Date headers remain sticky while scrolling vertically.
- The top-left month/context cell remains aligned with both sticky axes.
- Sticky surfaces must be opaque and must not allow booking content/grid lines to visually bleed through.
- Scrollbars may be visually subtle but the calendar must remain discoverable and operable with mouse, touchpad, and touch.

### 2.3 Booking Block Geometry

Calendar positioning is time-based rather than row-index-only.

Each booking block uses:

- date
- room/studio
- start time
- end time or duration

The layout engine calculates top position and height from time values so bookings such as 10:30–13:00 can be represented accurately even when the visible labels use hourly rows.

Adjacent bookings must not visually overlap when they do not overlap in time. Back-to-back bookings such as 10:00–13:00 and 13:00–16:00 may touch at the boundary but remain clearly distinguishable.

If overlapping bookings are ever intentionally supported for different resources, the UI must distinguish those resources explicitly rather than stacking ambiguous cards in the same room lane.

## 3. Calendar Navigation

Required capabilities:

- previous/next period
- jump to today
- selected date/period context
- visible current-time indicator when useful
- responsive horizontal scrolling on small screens

Calendar navigation must not use disruptive snap behavior that prevents smooth mobile scrolling.

The default planning range may show more dates than fit on screen; the user is expected to pan horizontally through the continuous grid.

## 4. Booking Block Information

At minimum show enough information to recognize the reservation quickly:

- customer name
- session type
- start/end or duration
- studio/room
- payment-status indicator

When space permits, also show:

- compact amount/price information
- assigned operator indicator
- booking state if operationally important

Additional information may appear in hover/popover/detail panel rather than overcrowding the block.

Clicking/tapping a booking block opens booking detail or an appropriate detail surface; it must not require precision clicking on tiny text inside the card.

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

Recommended model:

- visual major grid: 60 minutes
- configurable booking increment: commonly 15, 30, or 60 minutes
- positioning: continuous/minute-based within the major grid

This preserves the clean reference layout without sacrificing scheduling flexibility.

## 15. Responsive Behavior

Desktop should optimize dense schedule monitoring and preserve the wide continuous calendar concept shown in the approved reference.

Mobile must not attempt to squeeze all dates into the viewport. Instead:

- preserve useful minimum date-column width
- preserve the sticky time column
- allow smooth horizontal panning across dates
- keep the sticky date header readable
- provide large enough booking cards/touch targets
- avoid horizontal scroll gesture conflicts with the surrounding page
- avoid mandatory snap-to-column behavior
- keep booking creation available through a prominent action rather than requiring interaction with a tiny grid cell

## 16. Acceptance Criteria

- User can see bookings across configured operating hours.
- Calendar follows the approved continuous date-column/time-row reference model.
- Booking block height visually represents its actual duration.
- Date headers and the left time column retain context while scrolling.
- Authorized user can create a booking from the calendar.
- Price is calculated from active configuration and stored as a snapshot.
- Same-room overlapping bookings are blocked.
- Different rooms may have overlapping times.
- Payment status and booking status remain separate concepts.
- Reschedule validates conflicts and price effects.
- Historical booking is preserved on cancellation.
- Calendar remains usable on desktop and mobile.
- Horizontal calendar scrolling is smooth and does not force column snapping.
- Smaller booking increments can be represented without abandoning the clean hourly visual grid.
