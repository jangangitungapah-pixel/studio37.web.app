# PRD-04 — Dashboard

## 1. Objective

Provide a fast operational overview for the Owner and Studio Operator without forcing them to open multiple pages.

## 2. Role-Aware Dashboard

Dashboard content is permission-aware.

### Owner dashboard may include
- bookings today
- next bookings
- current studio occupancy
- available studios
- today's revenue
- month-to-date revenue
- pending/DP balances
- unpaid customer balances
- outstanding operator commissions
- recent bookkeeping activity
- booking/session trends

### Studio Operator dashboard may include
- today's bookings
- next booking
- assigned studio/operator work
- payment status needed for operational handling
- quick booking action
- limited commission information if allowed

Sensitive owner-only financial metrics must not be exposed to operators without permission.

## 3. Core Widgets

### Today Summary
Shows total bookings, occupied hours, and basic operational state.

### Now / Next
Shows what is currently running and upcoming sessions, including studio, customer, session type, start/end time, and relevant operator assignment.

### Studio Status
For every active room:
- Available
- Booked now
- Next booking time
- Optional unavailable/maintenance state in future

### Payment Attention
Bookings with Pending/DP/remaining balance requiring attention.

### Financial Snapshot
Owner-focused summary of collected revenue, outstanding balances, expenses, and net operational result for a selected period.

### Commission Attention
Owner-focused pending/earned/unpaid commission amount with navigation to the commission module.

### Quick Actions
Examples:
- New Booking
- Open Calendar
- Record Expense
- Add/Find Customer

Only permitted actions are displayed.

## 4. Time & Period Filters

Default operational summary is Today. Financial widgets may expose compact filters such as Today, This Week, This Month, or custom period if useful.

## 5. Data Loading

Dashboard should avoid creating many independent Firestore reads for overlapping information. Shared period queries/aggregates should be reused where practical.

Real-time listeners should be used selectively for information that benefits from live updates, not every metric by default.

## 6. Empty & Error States

- No bookings today: show a useful empty state with New Booking action if permitted.
- Missing pricing/settings should surface an actionable configuration warning for Owner.
- Partial widget failure should not necessarily break the entire dashboard.

## 7. Responsive Behavior

Desktop: dense multi-column operational layout.

Mobile: prioritize Now/Next, booking status, payment attention, and quick actions. Secondary analytics may stack below.

## 8. Acceptance Criteria

- Dashboard reflects the current user's permissions.
- Owner can quickly identify today's schedule, outstanding payments, and key financial/commission signals.
- Operator can quickly see operationally relevant bookings without owner-only information leakage.
- Dashboard links to the source modules rather than duplicating full management workflows.
- Empty/error/loading states are clearly handled.
- Layout is usable on desktop and mobile.
