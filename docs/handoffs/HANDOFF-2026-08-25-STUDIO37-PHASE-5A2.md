# Studio37 Development Handover — Phase 5A2

- **Handover date:** 2026-08-25 (Asia/Jakarta)
- **Repository:** `jangangitungapah-pixel/studio37.web.app`
- **Current implementation branch:** `phase/5a2-pricing-rule-foundation`
- **Current stacked PR:** PR #26 — `Phase 5A2: add pricing rule model foundation`
- **PR base:** `phase/5a1-session-type-foundation`
- **Phase 5A2 implementation/tracker checkpoint:** `15b3b36f7eec1efbac873dae8e5a677b2ec34243`
- **Final checkpoint Quality run:** `32867534719` — success

This document is the resume point for a new ChatGPT/Codex session. The handoff-document commit
itself advances the branch beyond the implementation checkpoint above, so always fetch the latest
GitHub head before creating the next branch.

---

## 1. Mandatory Resume Procedure

Before changing code in a new session:

1. Read this entire document.
2. Read `docs/prd/PRD-18-development-workplan.md` in full.
3. Read `docs/architecture/FIREBASE-DEVELOPMENT-STRATEGY.md` in full.
4. Read the pricing sources of truth listed in section 12.
5. Fetch current GitHub state; do not assume the PR states or SHAs below are still current.
6. In particular, recheck PR #26 and `phase/5a2-pricing-rule-foundation` before choosing the next
   branch base.
7. Recheck the older stacked chain, including PR #25, PR #24, and historical PR #7, because none
   may be treated as merged without evidence.

Never merge a PR without explicit user authorization.

---

## 2. Non-Negotiable Project Constraints

Frontend:

- React
- Vite
- JavaScript only
- `.jsx`, `.js`, `.css`
- Tailwind CSS
- no Next.js
- no TypeScript

Firebase and infrastructure:

- Firebase Spark/free-tier-first
- Firebase Authentication
- Cloud Firestore Standard Edition
- development Firebase project: `studio37webapp`
- source-controlled Security Rules tested with the Emulator Suite
- no service-account credential, Admin SDK private key, or server secret in the repository
- Firebase Hosting and deployment remain deferred until Phase 17

Architecture rules:

- Business calculations stay outside React rendering code.
- React components do not scatter raw Firestore SDK operations.
- Feature repositories own exact query shapes, limits, and index documentation.
- Never add a generic Firestore `listAll()` or an unbounded collection read.
- Money uses safe integer IDR.
- Date/time conversion remains centralized.
- Security Rules are the authorization boundary; UI guards are not sufficient.
- Referenced configuration is soft-disabled instead of ordinarily hard-deleted.
- Confirmed bookings must eventually preserve historical price and commission snapshots.
- Do not introduce Blaze-only services without an explicit architecture decision.

---

## 3. User Workflow and Pacing

The user wants development gradual and checkpointed.

- Implement one phase or clearly scoped sub-phase at a time.
- Use focused feature branches and draft PRs.
- Stacked PRs are expected while earlier work remains unmerged.
- Do not merge silently or infer merge permission from “continue”.
- Update PRD-18 only after implementation and the required quality gate pass.
- Do not accept a manual/browser gate unless the user explicitly confirms it.
- If later changes invalidate accepted QA, reopen the affected tracker item.
- Every implementation handoff to the user must include the PowerShell pull command.

Preferred command shape:

```powershell
git fetch origin; git switch <branch>; git pull --ff-only origin <branch>; npm install; npm run dev
```

---

## 4. GitHub State Verified During This Handover

The following state was fetched on 2026-08-25 and is not a substitute for fetching again later.

### Historical Phase 2B PR #7

- URL: `https://github.com/jangangitungapah-pixel/studio37.web.app/pull/7`
- Head: `phase/2b-firebase-connectivity-foundation`
- Head SHA: `d1690b06e6a52da3ba34132c0dab6ee10f3d9604`
- Base: `phase/2a-firebase-client-foundation`
- State: open, draft, mergeable, unmerged

### Integration PR #24

- URL: `https://github.com/jangangitungapah-pixel/studio37.web.app/pull/24`
- Head: `integration/studio37-through-phase-4d2`
- Head SHA: `2dde4fd8bd9d81ab96762628d7ba2cbde92142f5`
- Base: `main`
- State: open, draft, mergeable, unmerged

### Phase 5A1 PR #25

- URL: `https://github.com/jangangitungapah-pixel/studio37.web.app/pull/25`
- Head: `phase/5a1-session-type-foundation`
- Head SHA: `fcf1e2aeb6cf3af046625927ec4beda8982b65b7`
- Base: `integration/studio37-through-phase-4d2`
- State: open, draft, mergeable, unmerged

### Phase 5A2 PR #26

- URL: `https://github.com/jangangitungapah-pixel/studio37.web.app/pull/26`
- Head: `phase/5a2-pricing-rule-foundation`
- Implementation/tracker checkpoint SHA: `15b3b36f7eec1efbac873dae8e5a677b2ec34243`
- Base: `phase/5a1-session-type-foundation`
- State at handoff preparation: open, draft, mergeable, unmerged

The safe local pull command for the completed Phase 5A2 branch is:

```powershell
git fetch origin; git switch phase/5a2-pricing-rule-foundation; git pull --ff-only origin phase/5a2-pricing-rule-foundation; npm install; npm run dev
```

Phase 5A2 is a domain/repository foundation and adds no new browser screen.

---

## 5. Current Project Status

### Completed and quality-gated

- Phase 0 — Repository & Quality Foundation
- Phase 1 — Design System & App Shell, including accepted desktop/mobile manual QA
- Phase 2 — Firebase & Data Foundation
- Phase 3 — Authentication, Owner Bootstrap & Permissions, including accepted Owner login QA

### Phase 4 — still in progress

Implemented and automated quality-gated:

- Phase 4A — studio settings
- Phase 4B — studio rooms
- Phase 4C1/C2 — operator domain and settings UI
- Phase 4C3/C4 — exact-UID reciprocal operator/account link foundation and UI
- Phase 4C5A/C5B — verified-email invitation/self-registration foundation and onboarding UI
- real-Firebase operator invitation/account-link browser acceptance
- Phase 4D1 — permission-set administration and exact assignment repository
- Phase 4D2 — Owner-only permission editor and linked-user assignment UI implementation

Still pending:

- final Phase 4D2 real-Firebase permission mutation and responsive browser acceptance
- automated invitation delivery/status administration
- final Phase 4 integration/responsive gates

Do not mark those manual or integration items complete without their real evidence.

### Phase 5 — in progress

- Phase 5A1 Session Type Foundation: complete and quality-gated
- Phase 5A2 Pricing Rule Model Foundation: complete and quality-gated
- pricing calculations, selection/resolution, ambiguity rejection, snapshots, overrides, UI, and
  all final Phase 5 gates: pending

PRD-18 currently checks only these Phase 5 domain items:

```text
[x] Implement session type model.
[x] Implement pricing rule model.
```

Every other Phase 5 implementation item and gate remains unchecked.

---

## 6. Phase 5A1 — Completed Session Type Foundation

Path:

```text
sessionTypes/{sessionTypeId}
```

Implemented:

- strict configurable code/name/description model
- explicit studio-reservation behavior
- paired default/minimum duration contract
- 15-minute duration alignment up to 1,440 minutes
- deterministic display ordering
- `active | disabled` soft status
- immutable creation and server-controlled update metadata
- one `displayOrder asc + limit(100)` one-shot administration query
- focused create/edit/soft-status repository operations
- capability-scoped Firestore Security Rules
- domain, repository, and Emulator authorization tests

Intentionally absent:

- pricing configuration inside the session-type document
- generic list or listener
- hard delete
- calculation or booking behavior
- Session Type UI

Contract:

```text
docs/architecture/SESSION-TYPE-DOMAIN-CONTRACT.md
```

---

## 7. Phase 5A2 — Completed Pricing Rule Model Foundation

Path:

```text
pricingRules/{pricingRuleId}
```

### Canonical rule envelope

Every rule contains:

- administration `name`
- exact `sessionTypeId`
- nullable exact `studioId` (`null` means general studio scope)
- `pricingModel`
- strict discriminated `configuration`
- integer `priority` from 1 through 999
- nullable `effectiveFrom` and `effectiveUntil`
- `active | disabled` status
- immutable creation metadata
- server-controlled update actor/timestamp metadata

Effective windows are validated structurally. Their future resolution semantics are start-inclusive
and end-exclusive, but Phase 5A2 does not filter or select rules.

### Supported configuration shapes

#### `hourly`

- `amountPerIncrementIdr`
- `incrementMinutes`
- `minimumDurationMinutes`
- `roundingMode`: `exact | round_up`

#### `fixed_session`

- `amountIdr`

#### `duration_package`

- one rule document represents one package
- `amountIdr`
- `durationMinutes`
- `extraTimePolicy`: `blocked | additional | another_package`
- additional amount/increment/rounding fields are all required only for `additional`
- those additional fields must all be null for the other policies

#### `base_plus_additional`

- `baseAmountIdr`
- `baseDurationMinutes`
- `additionalAmountPerIncrementIdr`
- `additionalIncrementMinutes`
- `roundingMode`: `exact | round_up`

All money is non-negative safe integer IDR. All configured durations are 15-minute increments from
15 through 1,440 minutes. Unknown fields and mismatched model/configuration shapes fail closed.

### Repository boundary

`src/services/pricingRuleRepository.js` exposes only:

- `listPricingRules()`
- `createPricingRule()`
- `updatePricingRule()`
- `setPricingRuleStatus()`

The list query is exactly:

```text
pricingRules orderBy(priority desc) limit(200)
```

It is one-shot and uses automatic single-field indexing. No composite index was added.

The repository exposes no:

- `listAll()`
- listener
- hard delete
- pricing calculator
- rule resolver
- snapshot builder
- manual override operation

### Security boundary

- `settings.pricing.view` controls exact reads and bounded list access.
- `settings.pricing.edit` controls create/update/soft-status mutations.
- Rules validate the full pricing envelope and model-specific configuration.
- Rules require the exact session-type reference and optional exact studio reference to exist.
- The referenced collections retain their own canonical write validation.
- Missing references, malformed fields, spoofed metadata, over-limit/unbounded queries, and hard
  delete are denied.
- Booking-phase pricing reads remain default-deny.

Contract:

```text
docs/architecture/PRICING-RULE-DOMAIN-CONTRACT.md
```

---

## 8. Important Firestore Evaluator Regression and Fix

The first Phase 5A2 Rules CI run failed even though ordinary unit tests passed.

### Initial failed run

```text
32867003005
```

Failure:

```text
Unable to evaluate the expression as the maximum of 1000 expressions to evaluate has been reached.
```

Root cause:

- a pricing-rule write first validated the full pricing-rule shape;
- it then recursively revalidated the complete referenced session-type schema;
- an exact-studio rule also recursively revalidated the complete room schema;
- combined with capability checks, this exceeded the Firestore Rules 1,000-expression ceiling.

Fix:

- keep strict full validation for the pricing-rule document;
- require exact referenced session/studio documents to exist;
- rely on the source collections' own Rules to protect their canonical application writes;
- avoid recursively duplicating both complete schemas during every pricing-rule mutation.

This is not a permission relaxation to an unbounded path. Reference reads remain exact-document and
the pricing rule remains fully validated.

Do not reintroduce recursive full-schema reference validation without measuring the evaluator
budget in the Emulator Suite.

---

## 9. Quality Evidence

### Phase 5A1

Final Quality run:

```text
32695519606 — success
```

It passed 45 unit/component test files, 249 tests, 40 Firestore Emulator authorization tests,
formatting, zero-warning lint, production build, and Vite smoke.

### Phase 5A2

First fully successful implementation run after the evaluator fix:

```text
32867285524 — success
```

Final run after PRD-18 was updated:

```text
32867534719 — success
```

Final Phase 5A2 counts:

- 47 unit/component test files
- 261 unit/component tests
- 44 Firestore Emulator authorization tests
- formatting passed
- zero-warning lint passed
- production build passed
- Vite development-server smoke passed

The tracker was updated only after `32867285524` passed, and the documentation update itself was
then validated by `32867534719`.

---

## 10. Explicitly Deferred Phase 5 Scope

Phase 5A2 does not implement:

- hourly price calculation
- fixed-session price calculation
- duration-package calculation
- base-plus-additional-time calculation
- exact-studio versus general-scope rule resolution
- effective-time rule filtering
- deterministic winning-rule evaluation
- equal-match ambiguity rejection
- add-ons
- discounts
- pricing snapshots
- authorized manual overrides
- Session Type CRUD UI
- Pricing Rule editor/package editor
- human-readable price preview
- Booking integration
- responsive Pricing Settings QA
- Hosting or deployment

Storing a field such as `priority`, `roundingMode`, or `effectiveFrom` is not evidence that its
runtime engine behavior is implemented.

---

## 11. Recommended Exact Next Slice — Phase 5A3

The next recommended slice is:

```text
Phase 5A3 — Hourly Calculation Engine
```

Keep this slice pure and narrow.

Recommended scope:

- implement a pure hourly calculator outside React;
- consume only a canonical hourly configuration plus explicit duration input;
- enforce the configured minimum duration;
- support `exact` increment behavior with clear rejection of non-aligned duration;
- support `round_up` with deterministic ceiling to the configured increment;
- calculate with safe integer-IDR multiplication and reject overflow;
- return a deterministic normalized explanation/breakdown suitable for later snapshot work without
  claiming that snapshots are implemented;
- add focused unit tests for exact duration, fractional/increment duration, minimum duration,
  rounding, malformed input, wrong pricing model, and safe-integer overflow;
- document any finalized calculation contract.

Do not include in Phase 5A3:

- fixed-session/package/base-plus-additional calculators
- Firestore rule selection or collection queries
- studio-specific resolution
- effective-time filtering
- priority or ambiguity resolution
- add-ons or discounts
- snapshots or manual overrides
- Pricing Settings UI or Booking integration

Suggested branch only after fetching the latest Phase 5A2 head:

```text
phase/5a3-hourly-calculation
```

Suggested draft PR base while PR #26 remains unmerged:

```text
phase/5a2-pricing-rule-foundation
```

After implementation:

1. run formatting, zero-warning lint, all unit/component tests, Rules tests, build, and Vite smoke;
2. wait for GitHub Actions to pass;
3. then check only `Implement hourly calculation` in PRD-18;
4. push the tracker update and wait for final CI;
5. leave all other Phase 5 items and gates open;
6. stop and report with the PR link plus PowerShell pull command.

Do not start multiple calculation models in the same response merely because they share helpers.

---

## 12. Sources of Truth for Phase 5A3

Read these before designing the hourly calculator:

```text
docs/prd/PRD-18-development-workplan.md
docs/prd/PRD-06-pricing-session-engine.md
docs/prd/PRD-17-testing-qa.md
docs/prd/PRD-02-firestore-data-model.md
docs/prd/PRD-16-firebase-security.md
docs/architecture/FIREBASE-DEVELOPMENT-STRATEGY.md
docs/architecture/FIRESTORE-DATA-CONVENTIONS.md
docs/architecture/FIRESTORE-QUERY-INDEX-REGISTRY.md
docs/architecture/FIRESTORE-SECURITY-RULES.md
docs/architecture/SESSION-TYPE-DOMAIN-CONTRACT.md
docs/architecture/PRICING-RULE-DOMAIN-CONTRACT.md
```

Relevant implementation files:

```text
src/features/pricing/sessionTypes.js
src/features/pricing/sessionTypes.test.js
src/features/pricing/pricingRules.js
src/features/pricing/pricingRules.test.js
src/services/sessionTypeRepository.js
src/services/sessionTypeRepository.test.js
src/services/pricingRuleRepository.js
src/services/pricingRuleRepository.test.js
src/lib/money/idr.js
src/lib/money/idr.test.js
firestore.rules
tests/firestoreRules.emulator.js
```

---

## 13. Safety Against False Progress

The next session must not:

- assume PR #26 or any older stacked PR was merged;
- merge a PR without explicit permission;
- mark hourly calculation complete before its implementation and CI pass;
- mark the full Phase 5 quality gate complete after one calculator;
- infer manual Phase 4D2 browser acceptance from automated tests;
- treat configured priority/effective dates as implemented runtime selection;
- put pricing math inside React components;
- add a generic or unbounded Firestore collection read;
- open booking reads prematurely in Phase 5A3;
- deploy Firestore Rules, indexes, Hosting, or the app before Phase 17;
- add Next.js, TypeScript, Cloud Functions, Admin SDK credentials, or Blaze-only infrastructure;
- change historical price-snapshot principles.

If the next task materially changes the pricing-rule schema, reopen the pricing-rule tracker item
until the updated model and all affected quality gates pass again.

---

## 14. Short Resume Summary

```text
Phase 0: COMPLETE
Phase 1: COMPLETE + manual responsive QA accepted
Phase 2: COMPLETE
Phase 3: COMPLETE + manual Owner login accepted
Phase 4: IN PROGRESS
  Phase 4D2 implementation: automated QA PASS
  Phase 4D2 real-Firebase mutation/responsive acceptance: PENDING
Phase 5: IN PROGRESS
  Phase 5A1 Session Type Foundation: COMPLETE + CI PASS
  Phase 5A2 Pricing Rule Model Foundation: COMPLETE + CI PASS
  Next recommended slice: Phase 5A3 Hourly Calculation Engine only

Current branch: phase/5a2-pricing-rule-foundation
Current draft PR: #26
Final implementation/tracker CI: 32867534719 — success
No PR is authorized to merge.
```
