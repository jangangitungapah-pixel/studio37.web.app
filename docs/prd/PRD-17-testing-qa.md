# PRD-17 — Testing, QA & Acceptance Criteria

## 1. Objective

Define the quality gates required before Studio37 features are considered implementation-complete.

## 2. Test Layers

### Unit Tests

Prioritize pure business logic:

- pricing calculations
- duration/package resolution
- commission calculations
- payment balance/status
- booking-overlap logic
- phone normalization
- permission helpers
- validation rules

### Component Tests

Cover important React interactions such as:

- booking form calculation updates
- validation/error behavior
- permission-based actions
- payment form
- pricing settings form
- confirmation dialogs

### Integration Tests

Where practical, test repository/service behavior against Firebase Emulator or controlled mocks, especially multi-record financial workflows.

### Firebase Security Rules Tests

Mandatory for sensitive collections and role boundaries.

### End-to-End Tests

Critical smoke journeys:

- login
- create booking
- reject conflicting booking
- record DP then final payment
- complete booking and generate commission
- Owner settle commission
- create manual expense
- operator access denial for Owner-only areas

## 3. Pricing Test Matrix

At minimum test:

- hourly exact duration
- hourly fractional/increment duration
- minimum duration
- package 3-hour
- package 6-hour
- base + additional time
- studio-specific override
- add-on
- fixed discount
- percentage discount
- manual price override
- ambiguous pricing rule rejection
- inactive rule exclusion
- historical snapshot unaffected by rule edit

## 4. Booking Test Matrix

Test:

- adjacent bookings allowed when one ends exactly as another starts
- overlap at beginning/end rejected
- contained overlap rejected
- same time in different studios allowed
- cancelled booking does not block according to status policy
- reschedule conflict
- operating-hours validation
- configurable time granularity

## 5. Payment Test Matrix

Test:

- zero paid -> Pending
- partial -> DP
- exact total -> Lunas
- multiple partial payments
- accidental overpayment blocked
- refund recalculates status/balance
- repricing with existing payments
- cancellation with existing payment retains transaction history
- duplicate ledger posting prevented

## 6. Commission Test Matrix

Test:

- per-hour
- per-session
- fixed
- percentage with explicit base
- duration package
- multiple operators on one booking
- completion changes Pending -> Earned
- cancellation handling
- paid entry protected from silent recalculation
- payout cannot include already-paid entry twice

## 7. Permission/Security Matrix

Test at least:

- Owner allowed all required actions
- unauthenticated denied
- operator view-only booking
- operator booking create/edit when allowed
- operator cannot access Owner-only Fee & Commission by default
- operator cannot change pricing/settings
- operator cannot promote self
- operator cannot factory reset
- disabled user denied according to architecture

## 8. UI/Responsive QA

Required viewport coverage should include representative:

- desktop
- tablet
- narrow mobile

Manual/automated QA focus:

- calendar scroll
- sticky date/time headers
- no unintended horizontal page overflow
- booking modal/form controls aligned
- touch targets
- dropdown/date/time interactions
- financial tables/cards
- settings forms
- focus states and keyboard behavior

## 9. Browser QA

At minimum target current Chromium-based browsers used by the studio. Broader browser support can be expanded later, but implementation should avoid browser-specific hacks without reason.

## 10. Quality Gate Commands

Target project commands:

```text
npm run lint
npm run test
npm run build
npm run test:rules
npm run test:e2e
```

Final exact scripts are established during project setup.

A phase should not be checked complete in PRD-18 while its required quality gates are known to be failing.

## 11. Definition of Done for a Feature

A feature is done when:

- acceptance criteria are implemented
- loading/empty/error/permission states are handled
- required unit/component/integration tests pass
- relevant Security Rules tests pass
- lint passes
- production build passes
- responsive QA passes for core viewport targets
- documentation/workplan checkbox is updated
- no known critical data-integrity defect remains

## 12. Bug Severity

Suggested classification:

- Critical: security/data-loss/incorrect financial posting/booking corruption
- High: core workflow unavailable or major calculation wrong
- Medium: workflow degraded with workaround
- Low: cosmetic/minor usability issue

Critical and High defects block release of the affected phase.

## 13. Acceptance Criteria

- Business-critical calculations have automated tests.
- Firestore authorization rules have emulator tests.
- Booking conflict edge cases are covered.
- Payment and commission state transitions are covered.
- Responsive calendar/form QA is mandatory.
- A failing required quality gate prevents marking the phase complete.
