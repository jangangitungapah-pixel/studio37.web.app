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
- [x] Implement capability-based permission helpers.
- [x] Implement route-level permission guards.
- [x] Implement feature/action-level permission guards.
- [x] Implement logout/user menu.
- [x] Add initial Firestore Security Rules.
- [x] Add auth/permission emulator tests.

### Phase 3 gate

- [x] Owner can log in.
- [x] Operator restrictions are enforceable.
- [x] Operator cannot self-promote.
- [x] Direct URL cannot bypass permission checks.
- [x] Security Rule tests pass.
- [x] Lint/test/build pass.

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
- At the Phase 3B checkpoint, capability permissions, route/action authorization, the app-shell
  user menu, Firestore Security Rules, emulator rule tests, manual Owner login acceptance, and every
  final Phase 3 gate remained pending.
- Phase 3C added the source-controlled capability registry, implicit Owner access, and live exact
  `permissionSets/{id}` resolution for assigned Studio Operators. Null assignments grant no
  capabilities; missing, disabled, malformed, and unreadable referenced sets fail closed.
- Phase 3C applies shared policies to route access and navigation visibility, shows a clear denied
  state for unauthorized direct URLs, and provides an independent all-of/any-of/Owner-only action
  guard. GitHub Actions Quality run `32551197015` passed formatting, lint, 107 tests, production
  build, and Vite development-server smoke.
- At the Phase 3C checkpoint, the app-shell user menu/logout UI, Firestore Security Rules, emulator
  rule tests, manual Owner login acceptance, and every final Phase 3 gate remained pending.
- Phase 3D replaced the temporary topbar status with a responsive authenticated-user disclosure
  showing identity and role context. The menu supports Escape/outside dismissal plus logout loading
  and recoverable error states.
- Successful Phase 3D logout immediately stops profile/permission listeners, clears application
  session state, and returns protected routes to Login. GitHub Actions Quality run `32552628384`
  passed formatting, lint, 115 tests, production build, and Vite development-server smoke.
- Phase 3E added source-controlled initial Firestore Security Rules for canonical user profiles,
  exact assigned permission-set reads, validated Owner mutations, and the read-only connectivity
  probe. User and permission-set collection scans are denied, and every not-yet-implemented product
  collection remains default-deny until its feature phase adds schema-specific rules and tests.
- The Phase 3E Firestore Emulator suite covers 14 authorization scenarios, including unauthenticated
  denial, manual-only first-Owner bootstrap, active/disabled access, Operator self-promotion and
  permission-edit rejection, Owner recovery safeguards, capability allowlisting, immutable
  creation history, and deferred-domain denial. A separate unit contract keeps the rules capability
  allowlist synchronized with the JavaScript registry.
- GitHub Actions Quality run `32553953356` passed formatting, lint, 116 unit/component tests, 14
  Firestore Emulator authorization tests, production build, and Vite development-server smoke.
- The automated Operator restriction, self-promotion, direct-URL, Security Rules, and quality gates
  are accepted.
- On 2026-08-22, the project owner confirmed a successful browser login using the manually
  bootstrapped Owner account. Phase 3 Authentication, Owner Bootstrap & Permissions is complete
  after all implementation items and required gates passed.

---

# Phase 4 — Studio & Operator Configuration

## 4.1 Studio Settings

- [x] Implement Studio Settings page.
- [x] Add/edit studio rooms.
- [x] Activate/deactivate studio rooms.
- [x] Configure operating hours.
- [x] Configure booking interval/granularity.
- [x] Configure timezone/basic studio profile.

## 4.2 Operator Settings

- [x] Implement operator data model/repository.
- [x] Add/edit operator.
- [x] Support Studio Operator type.
- [x] Support Recording Operator/Engineer type.
- [x] Support operator without login.
- [x] Link operator to user account where applicable.
- [x] Add scoped operator account invitation/self-registration foundation.
- [x] Add email/password invitation onboarding and manual copy/share delivery UI.
- [ ] Configure operator permissions.
- [x] Activate/deactivate operator.

### Phase 4 gate

- [ ] Studio configuration drives available rooms/hours.
- [x] Operator profiles can exist with or without login.
- [x] Protected operator/account fields pass security tests.
- [ ] Responsive QA passes.
- [x] Lint/test/build pass.

Phase 4 progress on 2026-08-22:

- Phase 4A implemented the exact `appSettings/studio` profile and booking-defaults contract,
  responsive permission-aware Studio Settings page, one exact-document repository read,
  server timestamp/actor metadata, and Settings subnavigation.
- Firestore Security Rules allow exact active-user reads, Owner or explicit
  `settings.studio.edit` writes, reject list/delete/invalid shapes/spoofed metadata, and retain
  all deferred collections as default-deny.
- GitHub Actions Quality run `32558100901` passed formatting, lint, 131 unit/component tests, 18
  Firestore Emulator authorization tests, production build, and Vite development-server smoke.
- At the Phase 4A checkpoint, studio room CRUD, Operator Settings, and Phase 4
  integration/responsive gates remained pending.
- Phase 4B implemented immutable-ID `studios/{roomId}` documents, room add/edit dialogs,
  explicit soft activation/deactivation, deterministic display ordering, and responsive
  permission-aware room management inside Studio Settings.
- The Studio Rooms repository owns one `displayOrder`-ordered one-shot query capped at 50
  documents. It exposes no generic `listAll()` or delete operation and requires no composite index.
- Firestore Security Rules require `settings.studio.view` for bounded room reads and
  `settings.studio.edit` for validated writes, reject unbounded/over-limit queries and hard delete,
  and preserve server actor/timestamp metadata. GitHub Actions Quality run `32559335130` passed
  formatting, lint, 149 unit/component tests, 22 Firestore Emulator authorization tests,
  production build, and Vite development-server smoke.
- Phase 4C1 implemented strict immutable-ID `operators/{operatorId}` documents, Studio Operator and
  Recording Engineer domain types, canonical nullable contact data, and unlinked operational
  profiles that require no Firebase Authentication account.
- The Operator repository owns one `displayName`-ordered one-shot query capped at 100 documents,
  exposes no generic collection read/listener/delete/account-link operation, and supports validated
  create, detail update, and soft-status mutations behind server actor/timestamp metadata.
- Firestore Security Rules require `settings.operators.view` for bounded reads and
  `settings.operators.manage` for validated mutations, while rejecting unbounded/over-limit reads,
  hard delete, spoofed metadata, and every Phase 4C1 account-link mutation. GitHub Actions Quality
  run `32563791689` passed formatting, lint, 162 unit/component tests, 26 Firestore Emulator
  authorization tests, production build, and Vite development-server smoke.
- Phase 4C2 replaced the Operator Settings placeholder with a responsive bounded list, validated
  add/edit dialogs, explicit soft activation/deactivation confirmation, capability-aware
  view/manage states, and clear no-login versus login-linked context.
- The UI consumes only the Phase 4C1 `displayName asc + limit(100)` repository contract and exposes
  no hard delete, unbounded read, listener, account-link, role, or permission mutation. GitHub
  Actions Quality run `32564907232` passed formatting, lint, 172 unit/component tests, 26 Firestore
  Emulator authorization tests, production build, and Vite development-server smoke.
- Phase 4C3 implemented the exact-document operator/account-link repository and reciprocal
  `operators.linkedUserUid` / `users.operatorId` invariant through one active-Owner-only atomic
  transaction. It exposes no user collection scan, Authentication-user enumeration, hard delete,
  direct reassignment, or account-provisioning path and requires no composite index.
- Firestore Security Rules reject one-sided writes, pre-linked user creation, delegated linking,
  spoofed actor/time metadata, and non-null direct reassignment while requiring reciprocal
  post-commit state for link and unlink. GitHub Actions Quality run `32566431990` passed formatting,
  lint, 178 unit/component tests, 28 Firestore Emulator authorization tests, production build, and
  Vite development-server smoke.
- Phase 4C4 added the Owner-only exact-UID review, link, and unlink workflow inside Operator
  Settings. Missing profiles, existing links, broken backlinks, and delegated operator managers
  fail closed; successful mutations reuse the reciprocal Phase 4C3 transaction and refresh the
  existing bounded list without adding a user query, Auth provisioning, or permission mutation.
- GitHub Actions Quality run `32575053286` passed formatting, lint, 183 unit/component tests, 28
  Firestore Emulator authorization tests, production build, and Vite development-server smoke.
- Phase 4C5A added opaque exact-path account invitations beneath eligible active, unlinked Studio
  Operators. The repository exposes no list/query/Auth-user administration path and lets a Firebase
  user with a matching verified email redeem one pending invitation into an exact reciprocal
  user/operator relationship without manual `users/{uid}` console provisioning.
- Invitation redemption atomically creates or updates the exact user profile, links the operator,
  and accepts the invitation. New users are forced to active `studio_operator` with
  `permissionSetId: null`; eligible existing Studio Operators preserve their permission set.
  Security Rules reject expired/revoked/reused invitations, unverified or mismatched emails,
  one-sided writes, injected permissions, and every invitation/Owner role escalation path.
- GitHub Actions Quality run `32579690151` passed formatting, lint, 196 unit/component tests, 34
  Firestore Emulator authorization tests, production build, and Vite development-server smoke.
- Phase 4C5B added the Owner-only invitation creation/copy workflow and public exact-path onboarding
  route. Invitees can create or reuse a Firebase email/password identity, receive Firebase email
  verification with the invitation return URL, refresh the verified ID token, review one exact
  invitation, and atomically establish the Phase 4C5A relationship.
- The browser flow preserves the exact-UID fallback, gives every newly invited user zero delegated
  permissions, exposes no invitation/Auth-user collection read, and adds no paid delivery service,
  Cloud Function, Admin SDK, composite index, or deployment. GitHub Actions Quality run
  `32581224908` passed formatting, lint, 213 unit/component tests, 34 Firestore Emulator
  authorization tests, production build, and Vite development-server smoke.
- Phase 4C5B email-delivery QA on 2026-08-23 clarified that a successful provider request does not
  prove inbox delivery, added a 60-second client-side resend guard, and separated verification-email
  throttling recovery from login errors. GitHub Actions Quality run `32648089596` passed formatting,
  lint, 214 unit/component tests, 34 Firestore Emulator authorization tests, production build, and
  Vite development-server smoke.
- On 2026-08-23, the project owner confirmed successful real-Firebase operator account registration
  through the invitation onboarding flow; the manual invitation/account-link browser acceptance
  gate is accepted.
- Phase 4D1 established bounded Owner-only permission-set administration, exact-user permission
  assignment and revocation transactions, evaluator-safe Security Rules, query/index documentation,
  and automated coverage. GitHub Actions Quality run `32649866117` passed formatting, lint, 223
  unit/component tests, 36 Firestore Emulator authorization tests, production build, and Vite
  development-server smoke.
- Phase 4D2 implementation added the Owner-only Hak Akses route, grouped capability editor,
  sensitive-permission explanations, template create/edit/soft-status dialogs, and exact-user
  assignment/change/clear workflow for login-linked Studio Operators. It reuses the bounded
  permission/operator queries and reads no user profile until an explicit assignment action.
  GitHub Actions Quality run `32668577849` passed formatting, lint, 238 unit/component tests, 36
  Firestore Emulator authorization tests, production build, and Vite development-server smoke.
- Final Phase 4D2 real-Firebase template/assignment and desktop/mobile browser acceptance remains
  pending, so `Configure operator permissions` and the responsive Phase 4 gate remain open.
- Booking/calendar consumption of active rooms/hours, automated invitation
  delivery/resend/status administration, and final Phase 4 integration gates remain pending; Phase
  4 remains in progress.

---

# Phase 5 — Session & Flexible Pricing Engine

## 5.1 Domain Engine

- [x] Implement session type model.
- [x] Implement pricing rule model.
- [x] Implement hourly calculation.
- [x] Implement fixed-session calculation.
- [x] Implement duration package calculation.
- [x] Implement base + additional-time calculation.
- [x] Implement studio-specific rule resolution.
- [x] Implement add-on calculations.
- [x] Implement discount calculations.
- [x] Implement deterministic rule priority.
- [x] Reject ambiguous rule matches.
- [x] Implement pricing snapshot builder.
- [x] Implement authorized manual override model.

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

Phase 5 progress on 2026-08-24:

- Phase 5A1 implemented strict configurable `sessionTypes/{sessionTypeId}` documents, explicit
  studio-reservation behavior, paired default/minimum durations, deterministic display ordering,
  and soft activation/deactivation.
- The Session Type repository owns one `displayOrder asc + limit(100)` one-shot query and focused
  create/edit/status operations. It exposes no generic `listAll()`, listener, hard delete, pricing
  rule, calculation, or UI operation and requires no composite index.
- Capability-scoped Firestore Security Rules validate canonical fields, duration relationships,
  immutable creation metadata, server update metadata, bounded reads, and hard-delete denial.
  GitHub Actions Quality run `32695402968` passed formatting, lint, 249 unit/component tests, 40
  Firestore Emulator authorization tests, production build, and Vite development-server smoke.
- Phase 5A2 implemented strict `pricingRules/{pricingRuleId}` documents with nullable exact-studio
  scope, integer priority, optional effective timestamps, and discriminated hourly, fixed-session,
  duration-package, and base-plus-additional configuration using integer IDR.
- The Pricing Rule repository owns one `priority desc + limit(200)` one-shot query plus focused
  create/edit/soft-status operations. It exposes no generic `listAll()`, listener, hard delete,
  calculation, resolver, snapshot, override, or UI operation and requires no composite index.
- Capability-scoped Firestore Security Rules validate complete model-specific shapes, existing
  exact session/studio references, immutable creation metadata, server update metadata, bounded
  reads, and hard-delete denial. GitHub Actions Quality run `32867285524` passed formatting, lint,
  261 unit/component tests, 44 Firestore Emulator authorization tests, production build, and Vite
  development-server smoke.
- Phase 5A3 implemented a pure hourly pricing calculator that consumes one canonical hourly
  configuration plus an explicit requested duration, enforces the configured minimum duration,
  supports exact increment rejection and deterministic round-up billing, and uses checked safe
  integer-IDR multiplication.
- The calculator returns a frozen normalized machine-readable breakdown only; it performs no
  Firestore access, rule selection, snapshot mutation, React rendering, or booking integration.
  GitHub Actions Quality run `33218197842` passed formatting, zero-warning lint, all unit/component
  tests, Firestore Emulator authorization tests, production build, and Vite development-server smoke.
- Phase 5A4 implemented a pure fixed-session pricing calculator that consumes one canonical
  fixed-session configuration, validates its non-negative safe-integer IDR amount, and returns that
  amount unchanged as the deterministic final total.
- Fixed-session calculation explicitly rejects duration and other extra pricing inputs, so calendar
  duration cannot silently alter a fixed project/session price. GitHub Actions Quality run
  `33219153731` passed formatting, zero-warning lint, all unit/component tests, Firestore Emulator
  authorization tests, production build, and Vite development-server smoke.
- Phase 5A5 implemented a pure duration-package calculator that consumes one canonical package
  configuration plus an explicit requested duration. Exact package duration returns the package
  amount, requests shorter than the selected package fail clearly, blocked overtime is rejected,
  and `another_package` overtime is deferred to later package selection rather than guessed.
- The `additional` overtime policy supports explicit exact-increment rejection or deterministic
  round-up billing, with checked safe-integer IDR multiplication and addition. The result is a frozen
  normalized machine-readable breakdown with no Firestore access, rule/package discovery, snapshot
  mutation, React rendering, or booking integration. GitHub Actions Quality run `33220251251` passed
  formatting, zero-warning lint, all unit/component tests, Firestore Emulator authorization tests,
  production build, and Vite development-server smoke.
- Phase 5A6 implemented a pure base-plus-additional calculator that consumes one canonical
  configuration plus an explicit requested duration. The configured base amount covers requests up
  to the base duration, and only minutes beyond that boundary become additional-time billing.
- Additional time supports explicit exact-increment rejection or deterministic round-up billing,
  with checked safe-integer IDR multiplication and addition. The result is a frozen normalized
  machine-readable breakdown with no Firestore access, rule resolution, snapshot mutation, React
  rendering, or booking integration. GitHub Actions Quality run `33224093253` passed formatting,
  zero-warning lint, all unit/component tests, Firestore Emulator authorization tests, production
  build, and Vite development-server smoke.
- Phase 5A7 implemented pure pricing-rule eligibility filtering for active rules, exact session type,
  and start-inclusive/end-exclusive effective windows, plus a studio-scope resolver that prefers
  exact-studio candidates over general scope and falls back to general scope when no exact candidate
  remains.
- The studio resolver deliberately preserves every candidate inside the preferred scope and does not
  apply numeric priority, name/ID tie breakers, or ambiguity resolution. Invalid persisted rules,
  disabled studio candidates, mixed-session candidate sets, malformed IDs, and oversized candidate
  arrays fail closed. GitHub Actions Quality run `33224744380` passed formatting, zero-warning lint,
  all unit/component tests, Firestore Emulator authorization tests, production build, and Vite
  development-server smoke.
- Phase 5A8 implemented a pure add-on calculator for fixed, quantity-based, and time-based optional
  services. It preserves explicit add-on identity, rejects duplicate selections, uses checked
  safe-integer IDR multiplication/addition, and returns a frozen normalized add-on breakdown and
  subtotal without mutating the base pricing result.
- Time-based add-ons support exact-increment rejection and deterministic round-up billing while
  already-aligned duration remains unchanged. GitHub Actions Quality run `33225271093` passed
  formatting, zero-warning lint, all unit/component tests, Firestore Emulator authorization tests,
  production build, and Vite development-server smoke.
- Phase 5A9 implemented a pure fixed/percentage discount calculator with an explicit caller-owned
  `discountableAmountIdr` boundary. Fixed discounts fail closed when they exceed the eligible amount,
  while percentage configuration uses integer basis points from 0 through 10000 and rounds any
  fractional-rupiah discount down deterministically.
- The percentage algorithm avoids unsafe large intermediate multiplication, supports zero through
  100-percent discounts, and returns a frozen normalized result without Firestore, permission,
  snapshot, override, React, or Booking coupling. GitHub Actions Quality run `33258165384` passed
  formatting, zero-warning lint, all unit/component tests, Firestore Emulator authorization tests,
  production build, and Vite development-server smoke.
- Phase 5A10 implemented deterministic numeric priority resolution after studio-scope selection.
  The resolver keeps only candidates at the highest configured priority while preserving every
  equal-highest candidate for the later ambiguity gate; rule ID is used only to stabilize returned
  array ordering and never as a winner tie-break. GitHub Actions Quality run `33265511421` passed
  formatting, zero-warning lint, all unit/component tests, Firestore Emulator authorization tests,
  production build, and Vite development-server smoke.
- Phase 5A11 implemented the final unique-match gate after numeric priority resolution. Zero
  candidates produce an explicit `none` result, one candidate produces a frozen `unique` result,
  and multiple distinct equal-highest candidates throw typed `PricingRuleAmbiguityError` metadata
  instead of being selected by ID, name, repository order, or caller order.
- The gate revalidates active/session/studio-scope consistency, distinct rule IDs, and
  `highestPriority` sequencing so bypassed or malformed pipeline inputs fail closed. GitHub Actions
  Quality run `33268564767` passed formatting, zero-warning lint, all unit/component tests,
  Firestore Emulator authorization tests, production build, and Vite development-server smoke.
- Phase 5A12 implemented a pure versioned pricing snapshot builder that binds normalized base
  calculation output to the exact selected pricing-rule configuration, replays base/add-on/discount
  calculations to detect tampered derived values, and reconciles base, add-ons, partial/full discount
  scope, and final integer-IDR totals before history is captured.
- Snapshot output freezes detached rule/configuration context, calculation breakdowns, pricing time,
  source-update metadata, and explicit snapshot/calculation versions so later source-object/settings
  mutation cannot rewrite the in-memory historical result. GitHub Actions Quality run `33269361587`
  passed formatting, zero-warning lint, all unit/component tests, Firestore Emulator authorization
  tests, production build, and Vite development-server smoke.
- Phase 5A13 implemented a pure authorized manual-price override boundary on top of the immutable
  automatic pricing snapshot. Owner authority uses the existing implicit capability model, while a
  Studio Operator must explicitly have `booking.override_price`; actor UID is derived from the
  authenticated active profile and cannot be caller supplied.
- The override preserves the automatic calculated amount and selected pricing-rule identity, records
  the overridden final amount, actor role/UID, authorization capability, timestamp, and required
  reason, and rejects unauthenticated/disabled/mismatched actors, no-op or invalid amounts, malformed
  snapshots, and forged audit fields. GitHub Actions Quality run `33270313881` passed formatting,
  zero-warning lint, all unit/component tests, Firestore Emulator authorization tests, production
  build, and Vite development-server smoke.
- Firestore Booking persistence/integration, server-authoritative override writes/timestamps,
  Price Settings UI, and all final Phase 5 gates remain pending; Phase 5 remains in progress.

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
- [x] Phase 3 — Authentication, Owner Bootstrap & Permissions completed and quality-gated.
  - [x] Phase 3A — Login, Firebase session persistence, and authenticated-route foundation implemented and quality-gated.
  - [x] Phase 3B — user profile model, manual Owner bootstrap strategy, and active/disabled access enforcement implemented and quality-gated.
  - [x] Phase 3C — capability resolution plus route, navigation, and action guards implemented and quality-gated.
  - [x] Phase 3D — responsive authenticated-user menu and fail-safe logout flow implemented and quality-gated.
  - [x] Phase 3E — initial Firestore Security Rules and emulator authorization coverage implemented and quality-gated.
  - [x] Final Phase 3 manual Owner login browser QA accepted.
- [ ] Phase 4 — Studio & Operator Configuration in progress.
  - [x] Phase 4A — studio profile, timezone, operating hours, and booking defaults implemented and quality-gated.
  - [x] Phase 4B — room create/edit, soft activation/deactivation, and display ordering implemented and quality-gated.
  - [x] Phase 4C1 — bounded operator domain/repository, operator types, no-login profiles, and Security Rules implemented and quality-gated.
  - [x] Phase 4C2 — bounded Operator Settings UI, add/edit, and soft activation/deactivation implemented and quality-gated.
  - [x] Phase 4C3 — exact-document atomic operator/account-link repository and Security Rules foundation implemented and quality-gated.
  - [x] Phase 4C4 — Owner-only exact-UID operator/account-link review, link, and unlink UI implemented and quality-gated.
  - [x] Phase 4C5A — exact-path verified-email invitation/self-registration model, repository, atomic Rules, and automated coverage implemented and quality-gated.
  - [x] Phase 4C5B — email/password provider, Firebase verification, Owner copy/share invitation, and browser acceptance UI implemented and automated quality-gated.
  - [x] Final Phase 4C5B real-Firebase invitation/account-link browser acceptance accepted.
  - [x] Phase 4D1 — bounded permission-set repository, exact assignment transaction, Security Rules, and automated coverage implemented and quality-gated.
  - [x] Phase 4D2 implementation — Owner-only grouped permission editor, soft status, exact linked-user assignment UI, and automated coverage implemented and quality-gated.
  - [ ] Final Phase 4D2 real-Firebase permission mutation and responsive browser acceptance pending.
  - [ ] Automated invitation delivery/status administration and final integration/responsive gates pending.
- [ ] Phase 5 — Session & Flexible Pricing Engine in progress.
  - [x] Phase 5A1 — strict session-type domain/repository, bounded query, Security Rules, and automated coverage implemented and quality-gated.
  - [x] Phase 5A2 — strict pricing-rule model/repository, bounded query, Security Rules, and automated coverage implemented and quality-gated.
  - [x] Phase 5A3 — pure hourly pricing calculation, increment/minimum validation, checked integer-IDR arithmetic, and automated coverage implemented and quality-gated.
  - [x] Phase 5A4 — pure fixed-session pricing calculation, duration-independence validation, integer-IDR validation, and automated coverage implemented and quality-gated.
  - [x] Phase 5A5 — pure duration-package pricing calculation, explicit extra-time policies, checked integer-IDR arithmetic, and automated coverage implemented and quality-gated.
  - [x] Phase 5A6 — pure base-plus-additional pricing calculation, base-window coverage, explicit additional-time rounding, checked integer-IDR arithmetic, and automated coverage implemented and quality-gated.
  - [x] Phase 5A7 — active/effective eligibility filtering and exact-studio/general-scope pricing-rule resolution implemented and quality-gated.
  - [x] Phase 5A8 — pure fixed/quantity/time add-on calculation, checked integer-IDR arithmetic, strict validation, and automated coverage implemented and quality-gated.
  - [x] Phase 5A9 — pure fixed/percentage discount calculation, integer-basis-point percentage arithmetic, non-negative final totals, and automated coverage implemented and quality-gated.
  - [x] Phase 5A10 — deterministic highest-priority candidate selection with equal-highest preservation and automated coverage implemented and quality-gated.
  - [x] Phase 5A11 — explicit unique-match resolution and typed equal-highest ambiguity rejection with fail-closed pipeline validation implemented and quality-gated.
  - [x] Phase 5A12 — pure versioned pricing snapshot construction, selected-rule binding, calculator replay integrity, reconciled totals, and historical-detachment coverage implemented and quality-gated.
  - [x] Phase 5A13 — authorized manual price override with existing capability enforcement, immutable automatic baseline preservation, explicit audit metadata, and automated coverage implemented and quality-gated.
