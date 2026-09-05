# Studio37 Simple Pricing Catalog Contract

Status: Product clarification for pricing/session configuration

## 1. Purpose

The Owner-facing pricing workflow must feel like a simple editable catalog of sellable services, sessions, and packages. The implementation may keep the existing pricing engine, rule resolution, snapshots, and validation internally, but ordinary pricing management must not require the Owner to understand engine jargon such as rule priority, collision resolution, or pricing-rule internals.

This contract refines the product intent of PRD-06. It does not replace the pricing snapshot, authorization, validation, or historical safety requirements already defined by the pricing architecture.

## 2. Primary Owner mental model

The main pricing surface should answer these questions for each sellable item:

1. What is the service/session/package called?
2. Does it reserve the main studio?
3. Is it sold per hour, per fixed package duration, or per unit such as one song?
4. What is the current customer price?
5. Is there a simple recurring duration discount or other supported pricing rule?
6. Is the item active for new bookings?

The normal catalog should therefore expose a compact representation equivalent to:

- Name
- Pricing basis / duration or unit
- Customer price
- Main studio required: yes/no
- Simple pricing note or discount rule when applicable
- Status
- Edit action

Advanced engine metadata may remain available behind an advanced surface for diagnostics or exceptional configuration, but it must not dominate the normal Owner workflow.

## 3. Data-driven catalog

Session types, package names, prices, durations, and availability are data. They must not be hardcoded into application logic.

The Owner must be able to add, edit, activate, deactivate, and safely remove catalog items according to the existing historical-reference protections. Prices may change over time. New service types may be introduced and old ones may be retired without requiring source-code changes.

Existing booking price snapshots remain authoritative for historical bookings. Editing the current catalog must not silently rewrite historical booking totals.

## 4. Current Studio37 baseline catalog

The following items describe the current intended active catalog. They are examples/default operating data, not immutable product constants.

| Service / package | Basis | Duration / unit | Customer price | Main studio |
| --- | --- | ---: | ---: | --- |
| Latihan / Rehearsal | Hourly | 1 hour | Rp120,000 | Yes |
| Recording Standard | Duration package | 3 hours | Rp500,000 | Yes |
| Recording Pro | Duration package | 6 hours | Rp950,000 | Yes |
| Recording Live | Duration package | 3 hours | Rp600,000 | Yes |
| Recording Drum Only | Duration package | 3 hours | Rp500,000 | Yes |
| Recording Vocal Only | Duration package | 3 hours | Rp300,000 | Yes |
| Recording 1 Instrument excluding Drum | Duration package | 3 hours | Rp400,000 | Yes |
| Mixing | Fixed per unit | 1 song | Rp500,000 | No |
| Mastering | Fixed per unit | 1 song | Rp500,000 | No |
| Mixing + Mastering | Fixed per unit | 1 song | Rp900,000 | No |

Mixing, Mastering, and Mixing + Mastering are work performed by a Recording Operator and do not reserve the main studio. Their operator compensation is not part of the customer pricing calculation.

## 5. Rehearsal recurring duration discount

The Rehearsal price is Rp120,000 per hour with a Rp40,000 discount for every complete block of 3 booked hours.

This is a recurring block discount, not a one-time coupon.

For an integer number of booked hours:

```text
baseAmount = bookedHours * 120000
completeDiscountBlocks = floor(bookedHours / 3)
discountAmount = completeDiscountBlocks * 40000
totalAmount = baseAmount - discountAmount
```

Expected examples:

| Duration | Base | Discount | Total |
| ---: | ---: | ---: | ---: |
| 1 hour | Rp120,000 | Rp0 | Rp120,000 |
| 2 hours | Rp240,000 | Rp0 | Rp240,000 |
| 3 hours | Rp360,000 | Rp40,000 | Rp320,000 |
| 4 hours | Rp480,000 | Rp40,000 | Rp440,000 |
| 5 hours | Rp600,000 | Rp40,000 | Rp560,000 |
| 6 hours | Rp720,000 | Rp80,000 | Rp640,000 |
| 9 hours | Rp1,080,000 | Rp120,000 | Rp960,000 |

The rule must be implemented generically as a recurring duration-block discount that can be configured for any eligible session type. Application code must not special-case `REHEARSAL`, a specific document id, or the current Rp120,000 / Rp40,000 values.

## 6. Existing engine gap

The current persisted pricing-rule models support hourly, fixed session, duration package, and base-plus-additional pricing. Current hourly calculation is amount-per-increment multiplied by billed increments. The existing discount calculation supports a single fixed or percentage discount but does not represent a recurring fixed discount for every N duration blocks.

Therefore the Rehearsal rule above must not be approximated with multiple competing duration-package rules. Pricing-rule resolution currently selects by session type, effective time, studio scope, and priority rather than booking duration, so overlapping package rules for the same session could become ambiguous or select the wrong rule.

A dedicated generic recurring duration-block discount capability must be introduced before the Rehearsal rule is considered fully implemented.

## 7. UI direction

The default Owner experience should be catalog-first rather than rule-first.

Recommended normal row examples:

```text
Latihan / Rehearsal
Rp120.000 / jam · Pakai studio utama
Diskon Rp40.000 setiap 3 jam
Aktif                                    Edit
```

```text
Recording Pro
6 jam · Rp950.000 · Pakai studio utama
Aktif                                    Edit
```

```text
Mixing
1 lagu · Rp500.000 · Tanpa studio utama
Aktif                                    Edit
```

Creating or editing an item should reveal only the fields needed by the chosen pricing basis. Technical priority, collision diagnostics, effective-window internals, and similar controls should remain advanced concerns unless they are genuinely required for the configuration being edited.

Add-ons and pricing preview may remain supported capabilities, but they should not make the primary catalog workflow feel like an enterprise pricing console.

## 8. Operator compensation is a separate domain

Customer pricing and operator compensation must remain separate calculations, consistent with PRD-07 and PRD-08.

The following are current business examples for the future fee/commission phase and must not be stored as customer price fields:

| Compensation example | Recipient | Rule example |
| --- | --- | --- |
| Rehearsal studio fee | Studio Operator | Rp10,000 per rehearsal hour |
| Meal allowance | Studio Operator | Rp40,000 per eligible work day |
| Recording track shift fee | Studio Operator | Rp50,000 per qualifying 6-hour recording shift |
| Recording overtime | Studio Operator | Rp10,000 per overtime hour |
| Recording Pro track commission | Recording Operator | Rp450,000 for the current Rp950,000 / 6-hour package |
| Recording Live commission | Recording Operator | Rp285,000 for the current Rp600,000 / 3-hour package |

These values are examples of configurable compensation policy. They must not be hardcoded, and future compensation changes must not rewrite historical commission snapshots.

## 9. Non-goals of the current UI-overhaul PR

The Phase 5D UI/UX overhaul must not silently introduce a new persisted pricing model or change historical pricing semantics. In particular, the following belong to a pricing-engine follow-up phase:

- persisted recurring duration-block discount configuration
- Firestore validation changes required for that configuration
- pricing preview/calculation changes for recurring block discounts
- pricing snapshot representation for the new discount calculation
- dedicated automated tests and Firestore emulator coverage
- operator fee/commission calculation and management

Phase 5D may simplify the visible Owner workflow without changing those business semantics.

## 10. Acceptance principles for the follow-up phase

The pricing follow-up is acceptable when:

- the ten baseline catalog examples can be represented entirely as editable data
- the Owner can change names, prices, durations, studio usage, status, and supported simple rules without a code deployment
- Rehearsal totals correctly apply Rp40,000 for every complete 3-hour block, including 6 and 9 hours
- the recurring block rule is generic and reusable by future session types
- Mixing/Mastering services can exist without reserving the main studio
- operator compensation remains completely separate from customer-facing price calculation
- historical booking price snapshots remain unchanged after catalog edits
- pricing tests and Firestore rules tests cover the new behavior
