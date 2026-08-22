# PRD-18 — Development Roadmap & Implementation Workplan

## 1. Objective

Act as the implementation tracker and phase-by-phase execution source for Studio37. This file must be updated whenever a phase or task is completed so development progress remains visible and future work can resume without guessing.

## 2. Workplan Rules

- `[ ]` = not completed.
- `[x]` = completed and required quality gates passed.
- Do not check a phase complete merely because code was written.
- If a completed phase is materially changed later, reopen affected checklist items until QA passes again.
- Each phase should produce focused commits/PR changes rather than mixing unrelated work.
- PRD requirements remain the source of truth; this document tracks execution order and status.

---

# Phase 0 — Repository & Quality Foundation

## 0.1 Application Bootstrap

- [x] Initialize Vite React JavaScript project.
- [x] Confirm `.jsx`, `.js`, `.css` workflow.
- [x] Install/configure Tailwind CSS.
- [x] Establish feature-oriented `src/` structure from PRD-01.
- [x] Add routing foundation.
- [x] Add application shell/layout foundation.

## 0.2 Development Quality

- [x] Configure ESLint.
- [x] Configure formatting conventions.
- [x] Configure unit/component testing.
- [x] Configure production build command.
- [x] Add baseline CI quality workflow if GitHub Actions is used.
- [x] Ensure lint/test/build pass on clean repository.

## 0.3 Environment

- [x] Add `.env.example`.
- [x] Add local environment ignore rules.
- [x] Define development/prod Firebase configuration boundary.

### Phase 0 gate

- [x] App launches locally.
- [x] Lint passes.
- [x] Tests pass.
- [x] Production build passes.

Phase 0 completed on 2026-08-21. GitHub Actions Quality run `32480902311` passed formatting, lint, component tests, production build, and a Vite development-server smoke check.

---

# Phase 1 — Design System & App Shell

- [x] Implement semantic design tokens.
- [x] Implement typography/spacing/layout primitives.
- [x] Implement Buttons.
- [x] Implement Inputs/Textareas.
- [x] Implement Select/Combobox foundation.
- [x] Implement Modal/Dialog foundation.
- [x] Implement Badge/Status components.
- [x] Implement Toast/feedback states.
- [x] Implement desktop sidebar/topbar shell.
- [x] Implement responsive/mobile navigation shell.
- [x] Implement reusable page/subpage context pattern.
- [x] Verify keyboard/focus baseline.

### Phase 1 gate

- [x] Shared components render consistently.
- [x] Desktop/mobile shell responsive QA passes.
- [x] Lint/test/build pass.

Phase 1 progress on 2026-08-21:

- Phase 1A semantic tokens, shell, responsive navigation, page context, and focus baseline passed GitHub Actions and were manually checked in-browser by the project owner.
- Phase 1B Button, Input/Textarea, and Badge/Status primitives passed GitHub Actions Quality run `32487452247`, including formatting, lint, component tests, production build, and Vite development-server smoke.
- Phase 1C Select/Combobox, Dialog, and Toast/feedback primitives passed GitHub Actions Quality run `32489239004`, including formatting, lint, component tests, production build, and Vite development-server smoke.
- Phase 1 final shared-component visual consistency and desktop/mobile manual browser QA were accepted by the project owner on 2026-08-21.

---

# Phase 2 — Firebase & Data Foundation

- [x] Create/connect Firebase development project.
- [x] Configure Firebase client initialization.
- [x] Configure Firebase Authentication.
- [x] Configure Cloud Firestore.
- [x] Configure Firebase Emulator Suite where practical.
- [x] Implement repository/service layer conventions.
- [x] Define Firestore converters/normalizers if used.
- [x] Implement timestamp/timezone utilities.
- [x] Implement integer-IDR money utilities.
- [x] Implement phone normalization utility.
- [x] Document required Firestore indexes as queries emerge.

### Phase 2 gate

- [x] Firebase dev connection works.
- [x] Emulator/dev strategy documented.
- [x] Core data utilities have tests.
- [x] Lint/test/build pass.

Phase 2 progress on 2026-08-21:

- Phase 2A connected the application configuration to Firebase project `studio37webapp`, selected Firestore Standard Edition, added Firebase Web SDK `12.18.0`, and initialized singleton Firebase App, Authentication, and Cloud Firestore clients.
- Phase 2A added Vite environment overrides, lazy production-only Analytics eligibility, Firebase client tests, and development-only `/dev/firebase` status UI that performs no Firestore reads or writes.
- GitHub Actions Quality run `32492423270` passed formatting, lint, Firebase/component tests, production build, and Vite development-server smoke after Phase 2A implementation.
- Phase 2B configured Auth/Firestore emulator routing with a production guard, documented the real-project vs emulator strategy, added a manual Firestore connectivity probe, and established a shared focused document repository without a generic full-collection list operation.
- Phase 2B connectivity/repository unit tests and the synchronized Firebase package lock passed GitHub Actions Quality run `32494354595` with formatting, lint, tests, production build, and Vite development-server smoke.
- On 2026-08-22, the project owner reran the fixed manual `/dev/firebase` probe against Firebase project `studio37webapp` and confirmed `Connected`; the Firebase development connectivity gate is accepted.
- Phase 2C slice 1 defined explicit Firestore encode/decode conventions, added centralized Firestore Timestamp/JavaScript Date and IANA timezone utilities, and passed GitHub Actions Quality run `32546928867` with formatting, lint, tests, production build, and Vite development-server smoke.
- Phase 2C slice 2 added strict safe-integer IDR validation, checked IDR addition/formatting, canonical Indonesian E.164 phone normalization, and focused unit tests. GitHub Actions Quality run `32547371906` passed formatting, lint, tests, production build, and Vite development-server smoke.
- Phase 2C final slice added the bounded-query/index registry, linked an intentionally empty source-controlled composite-index manifest from `firebase.json`, and added contract coverage preventing speculative Phase 2 indexes. GitHub Actions Quality run `32547796710` passed formatting, lint, tests, production build, and Vite development-server smoke.
- Phase 2 Firebase & Data Foundation completed on 2026-08-22 after all implementation items and required gates passed.

---

# Phase 3 — Authentication, Owner Bootstrap & Permissions

- [x] Implement Login page.
- [x] Implement Firebase session persistence.
- [x] Implement protected routes.
- [x] Implement `users` profile model.
- [x] Implement Owner bootstrap strategy.
- [x] Implement active/disabled user handling.
- [ ] Implement capability-based permission helpers.
- [ ] Implement route-level permission guards.
- [ ] Implement feature/action-level permission guards.
- [ ] Implement logout/user menu.
- [ ] Add initial Firestore Security Rules.
- [ ] Add auth/permission emulator tests.

### Phase 3 gate

- [ ] Owner can log in.
- [ ] Operator restrictions are enforceable.
- [ ] Operator cannot self-promote.
- [ ] Direct URL cannot bypass permission checks.
- [ ] Security Rule tests pass.
- [ ] Lint/test/build pass.

Phase 3 progress on 2026-08-22:

- Phase 3A implemented Firebase email/password login, explicit browser-local session persistence,
  centralized auth observation, and fail-closed protected-route redirects that preserve the
  requested internal destination.
- Phase 3A added focused gateway, provider, Login, navigation, route-guard, and application
  integration coverage. GitHub Actions Quality run `32548647650` passed formatting, lint, 65 tests,
  production build, and Vite development-server smoke.
- At the Phase 3A checkpoint, Firestore user profiles, Owner bootstrap, active/disabled enforcement,
  permissions, logout UI, Security Rules, and every final Phase 3 gate remained pending.
- Phase 3B added the canonical `users/{uid}` profile model and one explicit document listener per
  Firebase session. Missing, malformed, unreadable, and disabled profiles fail closed; live
  disable/reactivate changes are applied without a page refresh.
- Phase 3B documented a manual Firebase-console Owner bootstrap with no public sign-up,
  self-promotion path, Admin SDK credential, or service-account key. GitHub Actions Quality run
  `32549566508` passed formatting, lint, 84 tests, production build, and Vite development-server
  smoke.
- Capability permissions, route/action authorization, the app-shell user menu, Firestore Security
  Rules, emulator rule tests, manual Owner login acceptance, and every final Phase 3 gate remain
  pending.

---

# Phase 4 — Studio & Operator Configuration

## 4.1 Studio Settings

- [ ] Implement Studio Settings page.
- [ ] Add/edit studio rooms.
- [ ] Activate/deactivate studio rooms.
- [ ] Configure operating hours.
- [ ] Configure booking interval/granularity.
- [ ] Configure timezone/basic studio profile.

## 4.2 Operator Settings

- [ ] Implement operator data model/repository.
- [ ] Add/edit operator.
- [ ] Support Studio Operator type.
- [ ] Support Recording Operator/Engineer type.
- [ ] Support operator without login.
- [ ] Link operator to user account where applicable.
- [ ] Configure operator permissions.
- [ ] Activate/deactivate operator.

### Phase 4 gate

- [ ] Studio configuration drives available rooms/hours.
- [ ] Operator profiles can exist with or without login.
- [ ] Protected operator/account fields pass security tests.
- [ ] Responsive QA passes.
- [ ] Lint/test/build pass.

---

# Phase 5 — Session & Flexible Pricing Engine

## 5.1 Domain Engine

- [ ] Implement session type model.
- [ ] Implement pricing rule model.
- [ ] Implement hourly calculation.
- [ ] Implement fixed-session calculation.
- [ ] Implement duration package calculation.
- [ ] Implement base + additional-time calculation.
- [ ] Implement studio-specific rule resolution.
- [ ] Implement add-on calculations.
- [ ] Implement discount calculations.
- [ ] Implement deterministic rule priority.
- [ ] Reject ambiguous rule matches.
- [ ] Implement pricing snapshot builder.
- [ ] Implement authorized manual override model.

## 5.2 Price Settings UI

- [ ] Session type CRUD/deactivation UI.
- [ ] Pricing rule editor.
- [ ] Package editor.
- [ ] Duration/minimum/increment configuration.
- [ ] Studio scope selector.
- [ ] Add-on configuration.
- [ ] Human-readable pricing preview.
- [ ] Configuration validation/errors.

### Phase 5 gate

- [ ] PRD-17 pricing matrix passes.
- [ ] Existing snapshots remain stable after settings edits.
- [ ] Invalid/ambiguous rules are blocked.
- [ ] Responsive Price Settings QA passes.
- [ ] Lint/test/build pass.

---

# Phase 6 — Operator Fee & Commission Engine

- [ ] Implement compensation rule model.
- [ ] Implement per-hour compensation.
- [ ] Implement per-session compensation.
- [ ] Implement fixed compensation.
- [ ] Implement package-based compensation.
- [ ] Implement percentage compensation with explicit base.
- [ ] Support multiple operator compensation entries per booking.
- [ ] Implement compensation snapshots.
- [ ] Implement Pending/Earned/Paid/Void lifecycle.
- [ ] Implement adjustment model.
- [ ] Define cancellation/repricing recalculation rules.
- [ ] Protect already-paid entries from silent rewrite.
- [ ] Add commission calculation test matrix.

### Phase 6 gate

- [ ] Commission calculations match configured rules.
- [ ] Multiple operator roles work on one booking.
- [ ] Paid records are historically safe.
- [ ] Lint/test/build pass.

---

# Phase 7 — Customer Management Domain

- [ ] Implement customer model/repository.
- [ ] Implement Indonesian phone normalization/matching.
- [ ] Implement customer create/edit.
- [ ] Implement existing-customer suggestions during booking input.
- [ ] Implement duplicate warning strategy.
- [ ] Implement customer snapshot builder.
- [ ] Implement customer history query.
- [ ] Apply customer permissions/Security Rules.

### Phase 7 gate

- [ ] Repeat customer can be reused.
- [ ] Historical booking snapshot survives profile edits.
- [ ] Unauthorized customer access is denied.
- [ ] Lint/test/build pass.

---

# Phase 8 — Booking Engine & New Booking Form

## 8.1 Booking Domain

- [ ] Implement booking model/repository.
- [ ] Implement booking number strategy.
- [ ] Implement start/end time calculations.
- [ ] Implement overlap detection.
- [ ] Implement booking-status lifecycle.
- [ ] Keep payment status separate from booking status.
- [ ] Integrate pricing snapshot.
- [ ] Integrate commission snapshot generation.
- [ ] Implement reschedule/repricing behavior.
- [ ] Implement cancellation behavior.

## 8.2 Booking Form

- [ ] Customer section.
- [ ] Session type selector.
- [ ] Studio selector.
- [ ] Date/time selector.
- [ ] Duration/package selector.
- [ ] Add-ons.
- [ ] Operator assignment.
- [ ] Live pricing breakdown.
- [ ] Initial payment/DP section.
- [ ] Notes.
- [ ] Final booking summary.
- [ ] Conflict error preserving entered values.
- [ ] Success feedback.

### Phase 8 gate

- [ ] All booking overlap edge cases pass tests.
- [ ] Booking price comes only from pricing engine/authorized override.
- [ ] Same-time bookings in different rooms work.
- [ ] Booking creation works desktop/mobile.
- [ ] Security rules pass.
- [ ] Lint/test/build pass.

---

# Phase 9 — Booking Calendar

- [ ] Implement time-grid calendar.
- [ ] Read operating hours from settings.
- [ ] Implement date headers.
- [ ] Implement sticky time column.
- [ ] Implement booking blocks by start/end duration.
- [ ] Integrate multiple active studio rooms.
- [ ] Implement previous/next/today navigation.
- [ ] Implement visible payment-status indicators.
- [ ] Open booking details from block.
- [ ] Open New Booking from calendar action/context.
- [ ] Implement efficient date-range Firestore query.
- [ ] Avoid per-cell listeners.
- [ ] Implement smooth mobile horizontal scrolling.
- [ ] Ensure sticky headers have opaque surfaces.
- [ ] Validate touch interaction/no accidental page lock.

### Phase 9 gate

- [ ] Calendar accurately reflects booking time ranges.
- [ ] Mobile scrolling/touch QA passes.
- [ ] No unintended horizontal page overflow.
- [ ] Query/read strategy is reasonable for Spark development.
- [ ] Lint/test/build pass.

---

# Phase 10 — Booking Detail, Payments & Financials

## 10.1 Booking Detail

- [ ] Implement booking detail page/panel.
- [ ] Show customer/session/studio/schedule.
- [ ] Show price snapshot/breakdown.
- [ ] Show assigned operators.
- [ ] Show permitted commission information.
- [ ] Show notes/audit context.
- [ ] Implement edit/reschedule.
- [ ] Implement cancellation UI.

## 10.2 Payments

- [ ] Implement payment repository/model.
- [ ] Add Payment flow.
- [ ] Multiple partial payments.
- [ ] Pending/DP/Lunas derivation.
- [ ] Payment methods.
- [ ] Overpayment protection.
- [ ] Refund flow.
- [ ] Adjustment authorization.
- [ ] Repricing with existing payment handling.
- [ ] Payment history UI.

### Phase 10 gate

- [ ] Payment matrix from PRD-17 passes.
- [ ] Transaction history remains intact.
- [ ] Refund/repricing balances are correct.
- [ ] Unauthorized adjustments are blocked.
- [ ] Lint/test/build pass.

---

# Phase 11 — Fee & Commission Management

- [ ] Implement Owner Fee & Commission page.
- [ ] Period/operator/status filters.
- [ ] Operator summary totals.
- [ ] Source booking drill-down.
- [ ] Calculation explanation UI.
- [ ] Implement commission adjustment UI.
- [ ] Implement payout settlement model.
- [ ] Select multiple earned entries for payout.
- [ ] Prevent duplicate payout.
- [ ] Link payout to commission entries.
- [ ] Responsive operator detail view.

### Phase 11 gate

- [ ] Owner can trace every displayed amount.
- [ ] Paid entries cannot be settled twice.
- [ ] Commission security tests pass.
- [ ] Lint/test/build pass.

---

# Phase 12 — Bookkeeping / Ledger

- [ ] Implement ledger model/repository.
- [ ] Implement income/expense categories.
- [ ] Implement manual income entry.
- [ ] Implement manual expense entry.
- [ ] Post/link valid booking payment income.
- [ ] Post/link commission payout expense.
- [ ] Handle refunds/reversals.
- [ ] Add source IDs/idempotency guard.
- [ ] Implement date/type/category filters.
- [ ] Implement total income/expense/net summary.
- [ ] Implement transaction detail/source links.
- [ ] Protect source-generated entries from arbitrary edits.

### Phase 12 gate

- [ ] Ledger totals reconcile with filtered entries.
- [ ] Unpaid booking balances are not counted as cash income.
- [ ] Duplicate source posting is prevented.
- [ ] Lint/test/build pass.

---

# Phase 13 — Dashboard

- [ ] Implement role-aware dashboard.
- [ ] Today booking summary.
- [ ] Now/Next booking widgets.
- [ ] Studio availability/status.
- [ ] Payment attention.
- [ ] Owner financial snapshot.
- [ ] Commission attention.
- [ ] Quick actions based on permission.
- [ ] Handle empty/loading/partial error states.
- [ ] Optimize overlapping dashboard queries.

### Phase 13 gate

- [ ] Operator sees no unauthorized financial data.
- [ ] Owner sees actionable operational summary.
- [ ] Dashboard responsive QA passes.
- [ ] Lint/test/build pass.

---

# Phase 14 — Audit Trail

- [ ] Implement audit event model/repository.
- [ ] Audit booking create/edit/reschedule/cancel.
- [ ] Audit price overrides/settings changes.
- [ ] Audit payment/refund/adjustment.
- [ ] Audit commission changes/payouts.
- [ ] Audit permission/operator changes.
- [ ] Audit destructive actions.
- [ ] Add booking-specific activity history.
- [ ] Add Owner activity filtering/view.
- [ ] Protect logs against ordinary mutation/deletion.

### Phase 14 gate

- [ ] Critical actions identify actor/time/context.
- [ ] Operators cannot erase their audit history.
- [ ] No secrets are written to logs.
- [ ] Lint/test/build pass.

---

# Phase 15 — Account Settings & Danger Zone

## 15.1 Account

- [ ] Account/profile settings UI.
- [ ] Allowed profile updates.
- [ ] Password/security integration supported by Firebase Auth.
- [ ] Protected role fields remain read-only to operators.

## 15.2 Danger Zone

- [ ] Define exact reset scopes.
- [ ] Define preserved Owner/auth behavior.
- [ ] Implement typed confirmation.
- [ ] Implement re-authentication where practical.
- [ ] Implement reset batching/error recovery.
- [ ] Implement audit event.
- [ ] Owner-only Security Rules coverage.

### Phase 15 gate

- [ ] No destructive action is one click.
- [ ] Studio Operator cannot execute reset.
- [ ] Partial reset failure has clear handling.
- [ ] Lint/test/build pass.

---

# Phase 16 — Full Integration & Responsive QA

- [ ] End-to-end booking journey.
- [ ] End-to-end DP -> Lunas journey.
- [ ] Booking completion -> commission earned journey.
- [ ] Commission payout -> ledger expense journey.
- [ ] Refund -> financial/ledger reconciliation journey.
- [ ] Owner permission flows.
- [ ] Studio Operator permission flows.
- [ ] Desktop calendar QA.
- [ ] Tablet QA.
- [ ] Narrow mobile QA.
- [ ] Keyboard/focus accessibility pass.
- [ ] Loading/empty/error states review.
- [ ] No critical console errors.
- [ ] Firestore read/query review for obvious Spark inefficiency.

### Phase 16 gate

- [ ] All critical E2E tests pass.
- [ ] Security Rules tests pass.
- [ ] Responsive QA passes.
- [ ] No Critical/High known bugs.
- [ ] Lint/test/build pass.

---

# Phase 17 — Production Firebase Preparation

> Hosting is intentionally deferred until core development is ready.

- [ ] Create/confirm production Firebase project.
- [ ] Configure production Auth providers.
- [ ] Configure production Firestore.
- [ ] Review/deploy production Security Rules.
- [ ] Review required Firestore indexes.
- [ ] Configure Firebase Hosting.
- [ ] Configure Vite production build deployment.
- [ ] Deploy `.web.app` preview/production target.
- [ ] Verify SPA routing rewrites.
- [ ] Run production smoke tests.
- [ ] Validate no dev/emulator config leaks into production.

### Phase 17 gate

- [ ] Production login works.
- [ ] Critical booking/payment workflows work.
- [ ] Security Rules deployed and tested.
- [ ] `.web.app` deployment works.
- [ ] No Critical/High release blocker.

---

# Phase 18 — Post-MVP Improvements

Potential future work, not required before MVP unless promoted explicitly:

- [ ] Customer-facing booking portal.
- [ ] WhatsApp notifications/integration.
- [ ] Calendar export/sync.
- [ ] CSV/Excel financial export.
- [ ] More advanced analytics.
- [ ] Equipment inventory/maintenance.
- [ ] Staff shift scheduling.
- [ ] Configurable cancellation/deposit policy engine.
- [ ] Firebase App Check production hardening.
- [ ] Server-side authoritative booking/financial workflows if scale/security requirements outgrow client-first Spark architecture.
- [ ] Multi-branch/multi-company SaaS architecture if business scope expands.

---

# Current Project Status

Documentation baseline:

- [x] PRD-00 Master Product Requirements drafted.
- [x] PRD-01 Technical Architecture drafted.
- [x] PRD-02 Firestore Data Model drafted.
- [x] PRD-03 Authentication/Roles/Permissions drafted.
- [x] PRD-04 Dashboard drafted.
- [x] PRD-05 Booking & Calendar drafted.
- [x] PRD-06 Flexible Pricing Engine drafted.
- [x] PRD-07 Fee & Commission Engine drafted.
- [x] PRD-08 Fee & Commission Management drafted.
- [x] PRD-09 Payments drafted.
- [x] PRD-10 Bookkeeping drafted.
- [x] PRD-11 Settings drafted.
- [x] PRD-12 Customer Management drafted.
- [x] PRD-13 Audit Trail drafted.
- [x] PRD-14 UI/UX Design System drafted.
- [x] PRD-15 User Flow/Wireframe Specification drafted.
- [x] PRD-16 Firebase Security drafted.
- [x] PRD-17 Testing & QA drafted.
- [x] PRD-18 Development Workplan drafted.

Implementation status:

- [x] Phase 0 — Repository & Quality Foundation completed and quality-gated.
- [x] Phase 1 — Design System & App Shell completed and quality-gated.
  - [x] Phase 1A — semantic design tokens and responsive shell completed and quality-gated.
  - [x] Phase 1B — Button, Input/Textarea, and Badge/Status primitives completed and quality-gated.
  - [x] Phase 1C — Select/Combobox, Dialog, and Toast/feedback primitives completed and quality-gated.
  - [x] Final Phase 1 shared-component visual consistency and desktop/mobile manual browser QA accepted.
- [x] Phase 2 — Firebase & Data Foundation completed and quality-gated.
  - [x] Phase 2A — Firebase App/Auth/Firestore client foundation implemented and quality-gated.
  - [x] Phase 2B — emulator routing, connectivity probe, and repository foundation implemented and quality-gated.
  - [x] Phase 2C — converters, timestamp/timezone, integer-IDR, phone normalization, and query/index registry completed and quality-gated.
- [ ] Phase 3 — Authentication, Owner Bootstrap & Permissions in progress.
  - [x] Phase 3A — Login, Firebase session persistence, and authenticated-route foundation implemented and quality-gated.
  - [x] Phase 3B — user profile model, manual Owner bootstrap strategy, and active/disabled access enforcement implemented and quality-gated.
