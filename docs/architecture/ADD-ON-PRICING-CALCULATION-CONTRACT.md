# Add-on Pricing Calculation Contract

## Purpose

Define the Phase 5A8 pure add-on calculation boundary for Studio37 pricing. This slice calculates
selected optional add-ons after a base pricing rule has been calculated. It supports the three
forms required by PRD-06: fixed, quantity-based, and time-based add-ons.

This contract does not introduce Firestore add-on CRUD, Price Settings UI, booking persistence,
pricing snapshots, discounts, manual overrides, rule priority, or ambiguity resolution.

## Calculation boundary

The public function is:

```text
calculateAddOnPrices({ addOns })
```

`addOns` is an ordered array of selected add-ons. An empty array is valid and returns a zero add-on
subtotal. The calculator preserves caller order and never silently sorts or deduplicates prices.

Each selected add-on has an opaque `addOnId`, one pricing type, and an exact configuration shape.
The identifier is required so the future booking snapshot and Price Settings model can preserve a
stable reference without requiring this calculation slice to define persistence.

Duplicate `addOnId` values in one calculation are rejected. Quantity-based repetition must use the
explicit quantity field rather than duplicating the same add-on entry.

## Supported pricing types

### Fixed

Input shape:

```text
{
  addOnId,
  pricingType: "fixed",
  configuration: {
    amountIdr
  }
}
```

The configured amount is charged exactly once. The amount may be zero but must be a non-negative
JavaScript-safe integer IDR value.

### Quantity

Input shape:

```text
{
  addOnId,
  pricingType: "quantity",
  configuration: {
    amountPerUnitIdr
  },
  quantity
}
```

`quantity` must be a positive JavaScript-safe integer. The calculator multiplies the unit amount by
the explicit quantity using checked integer-IDR arithmetic.

### Time

Input shape:

```text
{
  addOnId,
  pricingType: "time",
  configuration: {
    amountPerIncrementIdr,
    incrementMinutes,
    roundingMode
  },
  durationMinutes
}
```

`durationMinutes` is an explicit positive safe-integer input. The configured pricing increment uses
the same 15-minute configuration granularity as the base pricing-rule foundation and may range from
15 through 1,440 minutes.

Supported rounding modes are:

- `exact`: the requested duration must align to the configured increment;
- `round_up`: a partial increment is billed as the next full increment.

Already aligned duration is never over-billed by `round_up`.

## Calculation output

The function returns a frozen normalized object:

```text
{
  items,
  totalAddOnAmountIdr
}
```

Each item contains:

```text
{
  addOnId,
  pricingType,
  unitAmountIdr,
  quantity,
  inputDurationMinutes,
  incrementMinutes,
  roundingMode,
  billedIncrementCount,
  billedDurationMinutes,
  totalAmountIdr
}
```

Fields that do not apply to a pricing type are explicitly `null`. Fixed add-ons report
`quantity: 1`. The total add-on subtotal is the checked integer-IDR sum of every item total.

The result, item array, and item objects are frozen. Input objects are not mutated.

## Validation and fail-closed behavior

The calculator rejects:

- non-object top-level input;
- unsupported top-level fields;
- non-array add-on input;
- malformed or empty add-on identifiers;
- duplicate add-on identifiers;
- unsupported pricing types;
- missing or extra item/configuration fields;
- fractional, negative, or unsafe IDR values;
- zero, negative, fractional, or unsafe quantities;
- zero, negative, fractional, or unsafe requested durations;
- invalid configured time increments;
- unsupported rounding modes;
- partial increments in exact mode;
- unsafe integer multiplication, billed-duration arithmetic, or subtotal addition.

A zero-priced add-on remains valid because zero can represent an intentional complimentary service.

## Separation from base price and discount

This slice returns only the add-on subtotal and normalized add-on breakdown. It does not receive or
mutate the base pricing result, and it does not calculate a booking grand total. A later composition
boundary can combine:

```text
base price + add-on subtotal - discount
```

using explicit checked arithmetic and snapshot metadata.

Keeping these stages separate prevents the add-on calculator from silently changing pricing-rule
selection or discount policy.

## Persistence boundary

Phase 5A8 intentionally does not choose a Firestore collection or repository for add-on
configuration. PRD-02 and PRD-11 leave add-ons as a separate Phase 5 contract, and the Phase 5.2
Price Settings workplan still contains the configuration UI task.

A future persistence slice may supply the same normalized calculation fields from Owner-managed
configuration. That future model must preserve soft-disable/history requirements and Security Rules
without changing the pure arithmetic semantics documented here.

## Deferred scope

Still deferred after Phase 5A8:

- discount calculation;
- deterministic pricing-rule priority;
- equal-match ambiguity rejection;
- pricing snapshot construction;
- authorized manual price override;
- add-on Firestore configuration/repository;
- add-on and other Price Settings UI;
- booking-form selection and persistence;
- human-readable pricing preview;
- responsive Price Settings browser acceptance.
