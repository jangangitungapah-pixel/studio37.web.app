# PRD-06 — Flexible Pricing & Session Engine

## 1. Objective

Provide a configuration-driven pricing engine that supports varied studio services without hardcoding each service into booking UI logic.

## 2. Session Type Model

Owner can create, edit, activate, and deactivate session types such as:

- Rehearsal
- Recording
- Mixing
- Mastering
- Podcast
- Live Recording
- Instrument/Room Rental
- Custom Session

Session type names are data, not application constants.

A session type may define booking behavior such as whether a physical studio/time slot is required, allowed durations/packages, default studio scope, and enabled add-ons.

Phase 5A1 establishes the strict base session-type identity, reservation behavior, paired
default/minimum duration, soft-status, bounded repository, and Security Rules contract in
`docs/architecture/SESSION-TYPE-DOMAIN-CONTRACT.md`. It intentionally does not place pricing
models, packages, add-ons, or rule-selection logic inside the session-type document.

## 3. Supported Pricing Models

### Hourly

Example: Rp120.000/hour.

Inputs may include duration, billing increment, minimum duration, and optional overtime rule.

### Fixed Session

Example: Mixing Rp500.000/project/session regardless of calendar duration when appropriate.

### Duration Package

Examples:

- Recording 3 hours = Rp350.000
- Recording 6 hours = Rp600.000

Packages have explicit duration and price. Owner may configure whether extra time is blocked, priced separately, or requires another package.

### Tiered / Base + Additional Time

Example:

- first 2 hours Rp200.000
- every additional hour Rp80.000

The configuration must explicitly define increment and rounding behavior.

### Studio-Specific Price

The same session type can have different pricing by studio/room.

### Optional Add-ons

Add-ons may be fixed, quantity-based, or time-based where supported. Examples: instrument rental, extra microphone, engineer service, extra recording hour.

Phase 5A2 establishes the strict `pricingRules/{pricingRuleId}` envelope and discriminated
configuration for the four base pricing models above. Each rule has one session reference,
nullable exact-studio scope, integer priority, optional effective window, soft status, and
server-owned metadata. The bounded repository and Security Rules contract are documented in
`docs/architecture/PRICING-RULE-DOMAIN-CONTRACT.md`. This foundation validates configuration but
does not yet calculate a price, resolve a studio-specific winner, or reject equal-match ambiguity.

## 4. Pricing Rule Selection

Rules require deterministic priority. Suggested resolution order:

1. exact session + exact studio + matching package/condition
2. exact session + general studio scope + matching package/condition
3. session default rule

If multiple active rules remain equally valid, creation should fail with a configuration error rather than silently selecting an arbitrary price.

## 5. Effective Configuration

Pricing rules may optionally support effective start/end dates for future price changes. Only active rules valid at the booking pricing time are selectable.

## 6. Calculation Output

The pricing engine returns a normalized result such as:

- session/rule/package identifiers
- calculation model
- quantity/duration inputs
- base amount
- add-on breakdown
- discount breakdown
- manual override if authorized
- final total
- human-readable calculation explanation
- calculation version/snapshot metadata

## 7. Price Snapshot

When booking is confirmed, store enough pricing detail to reconstruct the agreed amount. Later changes to Price Settings must not mutate the historical booking amount automatically.

A reschedule/change to price-sensitive fields can offer explicit repricing. The user must see the old and new total before confirming.

## 8. Discounts

Discount support should be configuration-safe and permission-aware.

Possible forms:

- fixed amount
- percentage

Minimum rules:

- final price cannot become negative
- discount is stored explicitly in booking snapshot
- manual discounts require appropriate permission
- discount reason may be required for manual discount/override

## 9. Manual Price Override

Owner or explicitly authorized user may override a calculated price.

Override must store:

- calculated original amount
- overridden final amount
- actor
- timestamp
- reason

The configured pricing rule remains referenced; override does not edit the rule itself.

## 10. Duration & Rounding

Each pricing model defines its own duration rules where relevant:

- minimum duration
- maximum duration if any
- booking increment (for example 30/60 minutes)
- pricing increment
- round up/exact/package-only behavior

Calendar UI duration options must be generated from valid configuration rather than embedding Recording=3/6 hours in code.

## 11. Inactive/Deleted Configuration

Session types and pricing rules referenced by historical bookings should normally be deactivated, not hard-deleted. They become unavailable for new bookings but remain resolvable for history.

## 12. Validation

Reject invalid configuration such as:

- negative price
- zero/negative duration where duration is required
- overlapping ambiguous package definitions
- missing required studio/session reference
- percentage outside permitted range
- duplicate equal-priority rules that match the same scenario

## 13. Separation from Commission

Customer pricing and operator compensation are independent calculations. A pricing rule may reference or coordinate with a compensation configuration, but customer amount must not be derived from operator fee and operator fee must not simply infer itself from display price unless an explicit percentage rule says so.

## 14. Examples

### Rehearsal

Studio A, hourly, Rp120.000/hour, 2 hours -> Rp240.000.

### Recording Package

Studio B, package 3 hours, Rp450.000 -> total Rp450.000.

### Recording Package + Extra Time

3-hour package Rp450.000 + 1 extra hour Rp100.000 -> total Rp550.000 when configured.

### Mixing

Fixed project/session Rp500.000 -> total Rp500.000 independent of booking duration if the session configuration does not reserve a duration-based resource.

## 15. Acceptance Criteria

- Owner can add a new session type without code changes.
- Hourly, fixed-session, duration-package, and base/additional-time pricing are supported by configuration.
- Studio-specific pricing is supported.
- Booking receives deterministic calculated totals.
- Ambiguous pricing configuration fails clearly.
- Historical booking amounts do not change when settings change.
- Authorized override is explicit and auditable.
- Money calculations use integer IDR and defined rounding rules.
