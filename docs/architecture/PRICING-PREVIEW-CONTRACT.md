# Pricing Preview Contract

## Purpose

Phase 5B7 adds a human-readable, non-persisted simulator to Price Settings so an administrator can inspect the arithmetic of one stored pricing rule or duration-package configuration before relying on it operationally.

The preview is an administration aid. It is not a Booking quote, does not create a pricing snapshot, and does not change whether a rule or add-on is active.

## Explicit rule selection

The simulator selects one persisted `pricingRules/{pricingRuleId}` document explicitly.

It intentionally does not run the complete automatic pricing-rule resolution pipeline. Phase 5A7 through 5A11 already provide active/effective eligibility, studio-scope preference, numeric priority, and ambiguity rejection, but the repository does not yet expose a package-condition selector that can distinguish sibling duration packages such as 3-hour and 6-hour choices before the ambiguity gate.

Silently running the existing resolver over all sibling package rules would therefore misrepresent valid package sets as ambiguous. Phase 5B7 fails safe by making the administrator choose the rule/package being simulated instead of inventing missing condition logic.

## Canonical calculation reuse

`buildPricingPreview()` performs no independent financial formula. It delegates base pricing to the existing production calculators:

- `calculateHourlyPrice()`
- `calculateFixedSessionPrice()`
- `calculateDurationPackagePrice()`
- `calculateBaseAdditionalPrice()`

Selected add-ons are delegated to `calculateAddOnPrices()`, and the final preview total is reconciled with the shared checked integer-IDR sum utility.

React renders the returned calculation fields; it does not reimplement billing increments, minimums, package overtime, rounding, quantity multiplication, or currency arithmetic.

## Duration input

Hourly, duration-package, and base-plus-additional preview scenarios accept an explicit positive duration in minutes. The canonical calculator remains responsible for minimum duration, exact-increment alignment, round-up behavior, package duration, and extra-time policy.

Fixed-session preview requires a null duration input so calendar duration cannot silently affect the configured fixed amount.

The UI may initialize the simulator to a convenient valid example duration, but that default does not alter persisted configuration.

## Add-on input

The simulator may compose persisted add-ons whose scope is either:

- general: `sessionTypeId === null`, or
- exactly equal to the selected pricing rule's `sessionTypeId`.

Transaction inputs remain separate from Settings configuration:

- fixed add-on: no quantity or duration input
- quantity add-on: positive integer quantity
- time add-on: positive duration in minutes

The pure preview composer validates those boundaries before invoking `calculateAddOnPrices()`.

## Disabled configuration

A persisted disabled pricing rule or add-on may be simulated explicitly. This supports the PRD-11 requirement to preview configuration before activation.

The simulator displays inactive status clearly. Previewing inactive configuration does not make it eligible for Booking and does not bypass Phase 5A7 active/effective selection rules.

## Effective windows and studio scope

The simulator displays the stored priority, effective window, session context, and studio scope for explanation only.

Because the administrator selected one exact persisted rule, Phase 5B7 does not claim that the rule would win automatic resolution at the current time. Booking-time automatic selection remains a separate resolver concern.

Exact studio labels reuse the bounded Studio Room repository when the authenticated account has `settings.studio.view`. When room context is unavailable, the persisted studio ID is preserved and displayed rather than rewritten or guessed.

## Human-readable output

The UI renders a breakdown derived from the canonical calculation result, including as applicable:

- requested versus billed duration
- billed increment count
- fixed session amount
- package amount
- additional-time amount
- base amount
- selected add-on amounts and transaction inputs
- final preview total

Calculator validation failures are translated into concise administration-facing explanations without replacing the original business rules.

## Firestore and permission boundary

Phase 5B7 adds no collection, write, listener, Security Rule, or composite index.

The preview uses existing bounded one-shot repositories for pricing rules, add-ons, and optional Studio Room context. The simulator performs no Firestore mutation.

A pricing-view-only Studio Operator can use the read-only preview when the surrounding Price Settings route is available. Studio details are not fetched without `settings.studio.view`.

## Deliberately excluded

Phase 5B7 does not implement or claim completion of:

- automatic package-condition selection
- full Booking-time pricing-rule resolution
- discount administration or discount simulation UI
- manual price-override simulation or persistence
- configuration save/activation blocking beyond existing guards
- effective-period editing
- Booking add-on selection persistence
- pricing snapshot persistence
- Booking creation or repricing
- final PRD-17 pricing matrix acceptance
- final responsive browser acceptance

Those concerns remain in their dedicated later checkpoints.
