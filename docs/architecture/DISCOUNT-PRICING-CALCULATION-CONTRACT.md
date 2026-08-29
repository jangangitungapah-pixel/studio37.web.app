# Discount Pricing Calculation Contract

## Purpose

Phase 5A9 introduces the pure discount calculation boundary for Studio37 pricing. It supports the fixed-amount and percentage discount forms required by PRD-06 and the PRD-17 pricing matrix without coupling discount arithmetic to Firestore, React, Booking persistence, rule priority, snapshots, or manual-override authorization.

The contract lives in `src/features/pricing/discountPricing.js`.

## Public API

```js
calculateDiscount({
  discountableAmountIdr,
  discount,
});
```

`discountableAmountIdr` is the exact non-negative safe-integer IDR amount that the caller has decided is eligible for discount.

The calculator intentionally does not decide whether that amount represents only base pricing, base plus add-ons, or another future subtotal. That composition decision belongs to the higher-level pricing/booking flow.

`discount` is either `null` or one strict discount definition.

## Discount Types

### No discount

```js
{
  discountableAmountIdr: 250000,
  discount: null,
}
```

The final amount remains unchanged and the normalized discount amount is zero.

### Fixed discount

```js
{
  discountableAmountIdr: 250000,
  discount: {
    discountType: 'fixed',
    configuration: {
      amountIdr: 50000,
    },
  },
}
```

The configured IDR amount is subtracted exactly once.

A fixed discount larger than `discountableAmountIdr` is rejected. The calculator does not silently clamp an invalid discount to zero because doing so would hide a configuration or caller error.

### Percentage discount

```js
{
  discountableAmountIdr: 250000,
  discount: {
    discountType: 'percentage',
    configuration: {
      percentageBasisPoints: 1000,
    },
  },
}
```

Percentage configuration uses integer basis points:

- `0` = 0%
- `1` = 0.01%
- `1000` = 10%
- `10000` = 100%

Floating-point percentages are intentionally not accepted.

## Percentage Rounding

Percentage discount arithmetic may mathematically produce a fraction of one rupiah. The Phase 5A9 rule is:

> Round the discount amount down to the nearest whole IDR.

Example:

- discountable amount: Rp199.999
- percentage: 12.50% (`1250` basis points)
- mathematical discount: Rp24.999,875
- applied discount: Rp24.999
- final amount: Rp175.000

This rounding direction is deterministic and never grants more discount than the exact percentage calculation.

The implementation avoids unsafe floating-point money arithmetic and also avoids an unsafe large intermediate multiplication by decomposing the percentage calculation into whole 10,000-IDR blocks plus a remainder.

## Percentage Range

`percentageBasisPoints` must be a safe integer from `0` through `10000`, inclusive.

Values above 100% or below 0% are rejected. A 100% discount is valid and produces a zero final amount.

## Money Rules

All IDR values are non-negative JavaScript safe integers.

The calculator rejects:

- negative money
- fractional money
- `NaN`
- `Infinity`
- unsafe integers
- percentage values outside the supported range
- unsupported discount types
- unsupported extra input/configuration fields

The final price can never be negative.

## Normalized Output

The calculator returns a frozen object with this stable shape:

```js
{
  configuredAmountIdr,
  discountAmountIdr,
  discountType,
  discountableAmountIdr,
  finalAmountIdr,
  percentageBasisPoints,
}
```

Field meaning:

- `configuredAmountIdr`: fixed configured amount or `null`
- `discountAmountIdr`: actual whole-IDR discount applied
- `discountType`: `fixed`, `percentage`, or `null`
- `discountableAmountIdr`: original caller-supplied eligible amount
- `finalAmountIdr`: amount after discount
- `percentageBasisPoints`: configured basis points or `null`

The result is deterministic for identical inputs and does not mutate caller-owned data.

## Strict Shape Policy

The top-level input accepts only:

- `discount`
- `discountableAmountIdr`

A discount object accepts only:

- `configuration`
- `discountType`

Fixed configuration accepts only `amountIdr`.

Percentage configuration accepts only `percentageBasisPoints`.

Reason, actor, permission, coupon metadata, validity dates, UI labels, snapshot metadata, and other administration fields are intentionally outside this pure calculator.

## Scope Boundary

Phase 5A9 does not implement:

- Firestore discount documents or repositories
- discount CRUD/settings UI
- permission checks for manual discounts
- discount reason collection
- rule priority
- equal-match ambiguity rejection
- pricing snapshot construction
- manual price override
- Booking integration
- audit logging
- human-readable pricing preview
- responsive Price Settings QA

Those concerns remain in their owning later checkpoints.

## Quality Expectations

Automated coverage includes:

- no discount
- fixed discount
- fixed discount equal to subtotal
- fixed discount greater than subtotal rejection
- percentage discount
- fractional percentage whole-IDR rounding
- zero-percent and 100-percent discounts
- maximum-safe-integer percentage calculation
- invalid IDR input
- invalid basis points
- unsupported types and extra fields
- zero subtotal behavior
- deterministic frozen output

The PRD-18 checklist is updated only after the complete repository Quality workflow passes.
