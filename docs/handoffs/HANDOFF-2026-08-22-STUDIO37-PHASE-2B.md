# Studio37 Development Handover — Phase 2B

**Handover date:** 2026-08-22 (Asia/Jakarta)  
**Repository:** `jangangitungapah-pixel/studio37.web.app`  
**Current implementation branch:** `phase/2b-firebase-connectivity-foundation`  
**Current stacked PR:** PR #7 — `feat(phase-2b): add Firebase connectivity and repository foundation`  
**PR base:** `phase/2a-firebase-client-foundation`  
**PR state at handover:** open, draft, mergeable

This document is the resume point for a new ChatGPT/Codex session. Read it together with `docs/prd/PRD-18-development-workplan.md` before making changes.

---

## 1. Product Summary

Studio37 is a full-stack studio-management web application for managing:

- studio bookings and calendar schedules,
- studio and recording operators,
- flexible service/session pricing,
- operator fees and commissions,
- payments,
- bookkeeping/ledger,
- dashboard monitoring,
- studio/application settings,
- customers and historical snapshots,
- permissions and audit history.

Main user roles:

1. **Owner**
2. **Studio Operator**

The architecture intentionally preserves historical price and commission snapshots on bookings so future settings changes do not silently rewrite old financial records.

---

## 2. Non-Negotiable Technical Constraints

Frontend stack:

- React
- Vite
- JavaScript only
- `.jsx`, `.js`, `.css`
- Tailwind CSS
- **No Next.js**

Backend/infrastructure direction:

- Firebase Spark Plan / free-tier-first architecture
- Firebase Authentication
- Cloud Firestore **Standard Edition**
- Firebase Hosting later in the roadmap
- Firebase development project: `studio37webapp`
- Firebase Hosting site reserved for later deployment: `studio37os`

Firebase SDK currently pinned to:

```text
firebase 12.18.0
```

Production hosting/deployment is intentionally deferred to **Phase 17**. Do not prematurely deploy the application or introduce Blaze-only architecture without an explicit user decision.

The saved Firebase Web App setup input is documented in:

```text
docs/handoffs/PHASE-2-firebase-setup-input.md
```

Do not add service-account credentials, Admin SDK private keys, or server secrets to the repository.

---

## 3. Architecture Direction

Core business dependency chain:

```text
Studio Configuration
  -> Pricing / Session Engine
  -> Booking
  -> Payments
  -> Fee / Commission
  -> Ledger
  -> Dashboard
```

Cross-cutting concerns:

- authentication,
- capability-based permissions,
- Firestore Security Rules,
- audit history,
- UI/UX consistency,
- responsive behavior,
- testing and QA.

Important architecture rules:

- Business calculations stay outside React rendering code.
- React components should not scatter raw Firestore SDK operations.
- Firebase access belongs behind repositories/services.
- Money calculations use integer IDR amounts.
- Date/time conversion must be centralized.
- Feature repositories own query shapes and limits.
- Do not introduce a generic `listAll()` Firestore operation that can accidentally read entire collections.
- Security Rules, not client-side validation, are the real authorization boundary.

Primary architecture reference:

```text
docs/prd/PRD-01-technical-architecture.md
```

---

## 4. User Development Workflow Preferences

The user wants implementation to be gradual and checkpointed.

### Pacing

Do **not** try to implement every remaining phase in one response.

Work one phase or clearly scoped sub-phase at a time, e.g.:

```text
Phase 2A
Phase 2B
Phase 2C
```

Finish the selected slice, run quality gates, update the roadmap, report, then stop.

### Tracker discipline

`docs/prd/PRD-18-development-workplan.md` is the implementation tracker.

Rules:

- `[ ]` means incomplete.
- `[x]` only after implementation and the required quality gate pass.
- Do not mark manual/browser gates complete unless the user actually confirms them.
- Reopen affected items if later material changes invalidate prior QA.

### GitHub workflow

- Work on focused feature/phase branches.
- Use draft PRs by default.
- Current work is intentionally stacked because earlier phase PRs were not automatically merged.
- **Never silently merge a PR.** Fetch current PR state first and wait for explicit user authorization before consequential merges.
- Keep commits focused.

### Local environment

The user develops on Windows/PowerShell.

Preferred pull/run command shape:

```powershell
git fetch origin; git switch <branch>; git pull origin <branch>; npm install; npm run dev
```

For previous manual file-edit workflows the user likes `.cjs` generators, but GitHub connector implementation has been used successfully for this project.

---

## 5. Completed Development Status

### Phase 0 — Repository & Quality Foundation — COMPLETE

Completed:

- Vite React JavaScript project
- Tailwind
- feature-oriented source structure
- routing foundation
- app shell foundation
- ESLint
- Prettier conventions
- Vitest/component test foundation
- build command
- GitHub Actions quality workflow
- `.env.example`
- Firebase config boundary

Phase 0 is quality-gated and recorded in PRD-18.

### Phase 1 — Design System & App Shell — COMPLETE

#### Phase 1A

Completed:

- semantic design tokens
- typography/spacing/layout foundation
- desktop sidebar/topbar shell
- mobile navigation drawer
- reusable `PageContext`
- keyboard/focus baseline

#### Phase 1B

Completed:

- Button
- Input
- Textarea
- Badge/Status

#### Phase 1C

Completed:

- Select
- searchable Combobox
- Dialog/Modal
- Toast/feedback system

The development preview route is:

```text
/dev/design-system
```

The user manually accepted final Phase 1 visual consistency and desktop/mobile browser QA.

### Phase 2 — Firebase & Data Foundation — IN PROGRESS

#### Phase 2A — COMPLETE

Implemented:

- Firebase Web SDK
- Firebase client config with Vite environment overrides
- singleton Firebase App
- Firebase Authentication client
- Cloud Firestore client
- lazy production-only Analytics eligibility
- development-only Firebase status page

Status page:

```text
/dev/firebase
```

The configured development project is:

```text
studio37webapp
```

Firestore edition:

```text
Standard
```

#### Phase 2B — IMPLEMENTED + AUTOMATED QA PASSED

Implemented:

- Auth + Firestore Emulator Suite routing
- production guard preventing emulator routing when `VITE_APP_ENV=production`
- `.firebaserc`
- `firebase.json`
- emulator ports:
  - Auth `9099`
  - Firestore `8080`
  - Emulator UI `4000`
- `npm run firebase:emulators`
- Firebase development/emulator strategy documentation
- manual Firestore connectivity probe
- shared Firestore document repository foundation
- repository operations:
  - `getById`
  - `setById`
  - `updateById`
- intentionally **no generic `listAll()`**
- connectivity tests
- repository contract tests
- synchronized `package-lock.json`

Firebase development strategy document:

```text
docs/architecture/FIREBASE-DEVELOPMENT-STRATEGY.md
```

Shared repository implementation:

```text
src/services/firestore/createDocumentRepository.js
```

Connectivity implementation:

```text
src/lib/firebase/connectivity.js
```

---

## 6. Very Important: Latest Firestore Probe Bug and Fix

The user initially ran the manual Firestore probe from `/dev/firebase` and received:

```text
Unavailable (invalid-argument)
```

This was diagnosed as an **application probe bug, not a Firestore project problem**.

### Root cause

The first implementation used this collection ID:

```text
__studio37_system__
```

Firestore reserves identifiers matching the `__.*__` pattern. The SDK therefore threw `invalid-argument` locally before a backend connectivity request could be evaluated.

### Fix

The probe path was changed to the legal non-reserved path:

```text
studio37System/connectivity-probe
```

A regression test was added to verify that the probe path is legal and does not match the reserved naming pattern.

The corresponding development strategy documentation was also corrected.

### Automated QA after the fix

Latest successful post-fix GitHub Actions Quality run:

```text
32545820031
```

It passed:

- formatting
- lint
- tests
- production build
- Vite dev-server smoke

### Manual gate is STILL OPEN

At the moment of this handover, the conversation has **not yet confirmed the post-fix result of clicking the Firestore probe again**.

Therefore do **not** mark this PRD-18 item complete yet:

```text
[ ] Firebase dev connection works.
```

The next session should first ask the user to pull the latest Phase 2B branch and rerun the manual probe, unless the user immediately provides the new result.

Expected valid results after the fix:

```text
Connected
```

or

```text
Reachable / Rules denied
```

Both prove backend reachability for the Phase 2 connectivity gate. `Reachable / Rules denied` is acceptable at this stage because authenticated access and Security Rules are Phase 3 work.

If another error appears, diagnose that exact new error before advancing the connectivity checklist.

---

## 7. Current Branch and PR Resume Point

Current branch:

```text
phase/2b-firebase-connectivity-foundation
```

Current PR:

```text
PR #7
feat(phase-2b): add Firebase connectivity and repository foundation
```

Base:

```text
phase/2a-firebase-client-foundation
```

At handover, PR #7 is:

- open
- draft
- mergeable

Do not assume this remains true later; fetch PR #7 again at the start of a future session.

Do not merge it unless the user explicitly instructs you to merge.

The historical implementation uses stacked PRs. Fetch current repository/PR state before choosing the base for the next branch.

---

## 8. Phase 2 Tracker State

Current intended Phase 2 state in PRD-18:

```text
[x] Create/connect Firebase development project.
[x] Configure Firebase client initialization.
[x] Configure Firebase Authentication.
[x] Configure Cloud Firestore.
[x] Configure Firebase Emulator Suite where practical.
[x] Implement repository/service layer conventions.
[ ] Define Firestore converters/normalizers if used.
[ ] Implement timestamp/timezone utilities.
[ ] Implement integer-IDR money utilities.
[ ] Implement phone normalization utility.
[ ] Document required Firestore indexes as queries emerge.
```

Phase 2 gate:

```text
[ ] Firebase dev connection works.
[x] Emulator/dev strategy documented.
[ ] Core data utilities have tests.
[x] Lint/test/build pass.
```

The connection item remains open only because post-fix manual browser confirmation is still pending.

---

## 9. Exact Next Steps

### Step 1 — Finish the Phase 2B manual connectivity gate

Have the user pull the latest branch:

```powershell
git fetch origin; git switch phase/2b-firebase-connectivity-foundation; git pull origin phase/2b-firebase-connectivity-foundation; npm install; npm run dev
```

Open:

```text
http://localhost:5173/dev/firebase
```

Click:

```text
Run Firestore probe
```

If result is `Connected` or `Reachable / Rules denied`:

1. mark `Firebase dev connection works` as `[x]` in PRD-18,
2. note the manual verification in Phase 2 progress,
3. run CI again after the documentation update,
4. then begin Phase 2C.

Do not perform a write merely to prove connectivity. The probe is intentionally read-only.

### Step 2 — Phase 2C

Recommended scope for the next implementation slice:

- decide/define Firestore converter/normalizer conventions only where they improve consistency,
- centralized timestamp/timezone utilities,
- integer-IDR money utilities,
- Indonesian phone normalization utility,
- Firestore index/query registry/documentation foundation,
- unit tests for the data utilities,
- complete remaining Phase 2 gate items.

Do not start Phase 3 in the same response unless Phase 2 is genuinely completed and the user explicitly wants to continue.

If PR #7 is still unmerged, the safest Phase 2C branch is a stacked branch from the latest Phase 2B head, for example:

```text
phase/2c-core-data-utilities
```

with its draft PR targeting:

```text
phase/2b-firebase-connectivity-foundation
```

If the prior PR chain has been merged by the time work resumes, fetch current GitHub state and branch from the correct merged target instead.

### Step 3 — Phase 3 after Phase 2 is closed

Phase 3 is:

```text
Authentication, Owner Bootstrap & Permissions
```

It includes:

- real login UI
- Firebase session persistence
- protected routes
- users profile model
- Owner bootstrap strategy
- disabled user handling
- capability-based permissions
- route/action guards
- logout/user menu
- initial Firestore Security Rules
- auth/permission emulator tests

Do not treat Firebase client initialization from Phase 2 as completed authentication/authorization.

---

## 10. UI/UX Direction Already Approved

Global UI direction from Phase 1:

- dense, modern desktop UI
- compact mobile UI
- consistent alignment
- avoid excessive empty space
- avoid giant duplicate page heroes
- accessible keyboard/focus behavior
- light default visual direction

The approved future Booking Calendar direction is especially important:

- wide continuous time grid
- date columns at top
- time column at left
- booking cards span actual duration
- sticky opaque time/date headers
- smooth free horizontal mobile scrolling
- no forced column snap
- mobile keeps useful column width rather than squeezing every date into the screen

Calendar implementation itself is later in **Phase 9**.

---

## 11. Firestore Cost/Query Discipline

This project is intentionally Spark/free-tier conscious.

Rules to preserve:

- no automatic health-check reads on every render/page load,
- manual connectivity probe only,
- avoid per-cell Firestore listeners in the future calendar,
- query by meaningful bounded ranges,
- feature repositories must own query constraints,
- avoid accidental unbounded collection reads,
- indexes should be documented as actual queries emerge.

This is why the shared repository does not expose `listAll()`.

---

## 12. Current Quality Workflow

GitHub Actions quality pipeline currently checks:

```text
npm install
npm run format:check
npm run lint
npm test
npm run build
Vite dev-server smoke
```

Known non-blocking runner warnings observed previously:

- installed ESLint 9.x version has emitted an upstream support/deprecation warning,
- `actions/checkout@v4` and `actions/setup-node@v4` have emitted GitHub runner Node-runtime deprecation warnings.

These warnings have not failed the quality gate. Do not introduce unrelated version churn during a focused feature phase unless it becomes necessary.

---

## 13. Source-of-Truth Documents to Read First

At the start of the next session, read these before changing code:

```text
docs/prd/PRD-18-development-workplan.md
docs/prd/PRD-01-technical-architecture.md
docs/prd/PRD-02-firestore-data-model.md
docs/prd/PRD-03-authentication-roles-permissions.md
docs/architecture/FIREBASE-DEVELOPMENT-STRATEGY.md
docs/handoffs/PHASE-2-firebase-setup-input.md
```

For the next immediate Phase 2C slice, PRD-18 and the Firebase architecture document are the first checkpoints.

---

## 14. Safety Against False Progress

The next session must not:

- mark Firebase connectivity complete solely because SDK initialization works,
- mark it complete based on the old `invalid-argument` probe,
- silently merge stacked PRs,
- move directly into Phase 3 before Phase 2 gates are closed,
- change historical booking financial snapshot principles,
- introduce unrestricted generic Firestore reads,
- prematurely deploy Firebase Hosting,
- switch the project to Firestore Enterprise Edition,
- introduce Next.js or TypeScript without a new explicit project decision.

---

## 15. Resume Summary

Shortest possible resume state:

```text
Phase 0: COMPLETE
Phase 1: COMPLETE + manual responsive QA accepted
Phase 2A: COMPLETE
Phase 2B: IMPLEMENTED + CI PASS
Phase 2B manual Firestore connectivity: PENDING POST-FIX RECHECK
Next after successful probe: Phase 2C core data utilities + index/converter foundation
Then: Phase 3 Authentication / Owner Bootstrap / Permissions
```

Current work branch:

```text
phase/2b-firebase-connectivity-foundation
```

Current active PR:

```text
#7
```

Latest post-probe-fix CI known at handover:

```text
32545820031 — success
```

The first operational question for the next session should be whether the user has rerun the fixed `/dev/firebase` Firestore probe and what result it returned.
