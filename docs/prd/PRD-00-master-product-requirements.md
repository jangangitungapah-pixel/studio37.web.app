# PRD-00 — Master Product Requirements

## 1. Product Summary

Studio37 Management Web App is an internal full-stack web application for managing a music studio's daily operations. The product centralizes booking schedules, session pricing, customer payments, operator fees/commissions, bookkeeping, user access, and studio configuration.

The initial product is designed for one music-studio business, but the internal data model and configuration should avoid unnecessary assumptions that would make future expansion difficult.

## 2. Primary Goals

1. Make booking schedules easy to create, monitor, reschedule, and prevent conflicts.
2. Allow the Owner to configure flexible prices for multiple session types without changing application code.
3. Track customer payment status and balances accurately.
4. Calculate and monitor operator/recording-operator fees and commissions with configurable rules.
5. Record operational income and expenses in one bookkeeping ledger.
6. Give Studio Operators only the access explicitly permitted by the Owner.
7. Keep the system usable on desktop and mobile.
8. Run initially within Firebase Spark Plan constraints.

## 3. Non-Goals for Initial Development

- Public marketplace for studio booking.
- Multi-company SaaS billing/subscription management.
- Full double-entry accounting/ERP replacement.
- Native Android/iOS application.
- Advanced payroll, tax, or HR management.
- Production Firebase Hosting setup before the application is development-ready.

## 4. Primary Roles

### Owner

Full administrative role. Can manage bookings, pricing, studio configuration, operators, permissions, commissions, bookkeeping, and destructive settings.

### Studio Operator

Operational role for studio staff. Access is controlled by configurable permissions. Typical permissions may include viewing schedules, creating/editing bookings, updating customer/payment information, and viewing limited operational information.

A recording operator/engineer may be represented as an assignable operator for fee/commission purposes even when that person does not need an application login.

## 5. Main Product Areas

- Dashboard
- Booking Calendar
- Booking Form / Booking Detail
- Fee & Commission
- Bookkeeping
- Settings
  - Account & Profile
  - Studio Configuration
  - Price & Session Settings
  - Operator & Permission Settings
  - Danger Zone
- Customer data domain
- Activity/Audit Log

## 6. Core Business Model

### Booking

A booking represents a reserved studio/service time and contains customer, session, room/studio, schedule, duration, price snapshot, payment status, assigned operator(s), and operational notes.

### Session Type

Examples include Rehearsal, Recording, Mixing, Mastering, Podcast, or any custom type created by the Owner. Session types must not be hardcoded into the UI or database schema.

### Pricing

Pricing is configuration-driven. Supported concepts should include hourly pricing, fixed-session pricing, duration packages, studio-specific pricing, optional add-ons, discounts, and authorized manual overrides.

### Fee / Commission

Customer pricing and operator compensation are separate concepts. Compensation may be per hour, per session, percentage-based, package-based, or manually adjusted.

### Payment

A booking can be Pending, DP/partially paid, or Paid in Full. The system must preserve transaction history rather than relying only on one mutable amount field.

### Bookkeeping

Operational financial events are represented as ledger records linked to their source where possible, such as a booking, payment, operator commission, expense, or manual adjustment.

## 7. Critical Product Principles

### Configuration over hardcoding

Studio rooms, operating hours, session types, duration packages, prices, commissions, and operator permissions should be configurable where practical.

### Snapshot historical values

A later change to price or commission configuration must not silently recalculate historical bookings. Confirmed bookings retain the pricing and compensation configuration applied when they were created or last explicitly repriced.

### Traceable money movement

Amounts shown in bookings, payments, commissions, and bookkeeping must be explainable from source records and adjustments.

### Conflict-safe booking

The system must prevent accidental overlapping bookings for the same studio/room and time range unless the Owner explicitly resolves a supported exception.

### Least-privilege access

Studio Operators cannot gain Owner privileges through client-side manipulation. Authorization must be enforced by application logic and Firebase Security Rules.

## 8. Initial Operating Assumptions

- Default operational calendar view: approximately 10:00–22:00, but operating hours must ultimately be configurable.
- Multiple active studio rooms may exist.
- One booking has one primary session type but may have optional services/add-ons.
- Booking duration can vary by session/pricing rule.
- Session types can be activated/deactivated without deleting historical references.
- Prices are stored as integer IDR values; avoid floating-point money calculations.
- Timestamps are stored consistently and displayed in the studio's configured local timezone.

## 9. High-Level User Journeys

### New Booking

Calendar -> New Booking -> Customer -> Session Type -> Studio -> Date/Time -> Duration/Package -> Price Calculation -> Operator Assignment -> Payment Information -> Validation -> Save -> Calendar Update.

### Payment Update

Booking Detail -> Add Payment -> Amount/Method/Date -> Recalculate Balance -> Update Payment Status -> Create Financial/Audit Record.

### Pricing Configuration

Settings -> Price Settings -> Session Type -> Pricing Model/Package -> Applicable Studio(s) -> Price -> Commission Rule -> Validation -> Save as active configuration.

### Commission Settlement

Fee & Commission -> Select Operator/Period -> Review earned items -> Adjust if authorized -> Mark selected payout as paid -> Record settlement and bookkeeping link.

## 10. Success Criteria

The MVP is successful when:

- Owner can configure studios and session pricing without code changes.
- Owner/authorized operator can create a booking and receive correct calculated pricing.
- Double booking for the same room is blocked.
- Payment balances and statuses are accurate.
- Operator compensation can be traced to its booking/session rule.
- Owner can view operational financial records and summaries.
- Permissions restrict operator access correctly.
- Core workflows work on desktop and mobile.
- Firebase rules protect Owner-only and sensitive financial actions.
- Automated tests cover critical pricing, booking, permission, payment, and commission rules.

## 11. Source-of-Truth Relationship

This Master PRD defines product boundaries and global rules. Detailed behavior is defined by PRD-01 through PRD-18. If a child PRD conflicts with this document, the conflict must be resolved explicitly before implementation rather than silently choosing one interpretation.
