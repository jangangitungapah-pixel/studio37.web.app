# PRD-12 — Customer Management

## 1. Objective

Maintain reusable customer records so booking history, contact information, and repeat-client context are not fragmented across independent booking text fields.

## 2. Customer Record

Recommended fields:

- customer ID
- name
- normalized phone number
- display phone number
- optional email
- notes
- createdAt / updatedAt
- createdBy / updatedBy

Optional convenience fields such as last booking date or booking count may be denormalized only if they can be kept consistent.

## 3. Customer Matching

During booking creation, entering a phone number should attempt to match an existing customer using a normalized representation.

The UI should:

- suggest an existing customer when matched
- allow selecting the existing customer
- allow creating a new customer when genuinely different
- warn about likely duplicates

Phone normalization rules should be centralized, particularly for Indonesian number formats.

## 4. Customer Snapshot in Booking

Bookings should store both:

- `customerId` reference
- `customerSnapshot` containing at least the booking-time name/contact values needed for history

Changing a customer profile later should not erase what was recorded at the time of an old booking.

## 5. Customer Detail

When exposed as a page/panel, customer detail may show:

- contact information
- notes
- booking history
- last booking
- total bookings
- payment-related summary only when user has permission

## 6. Search

Search should support practical lookup by:

- name
- phone number
- booking/customer reference where useful

Firestore query limitations must be considered; do not design a search UX that assumes arbitrary full-text search without implementing an appropriate strategy.

## 7. Privacy & Permissions

Customer contact information is operational data and should only be visible to authenticated users with relevant permission.

Studio Operators may be allowed to view/edit customer information for booking operations, but permission should be configurable.

## 8. Deactivation / Deletion

Ordinary customer management should avoid destructive deletion if the record is referenced by bookings. A merge/archive strategy can be added later for duplicates.

Danger Zone may remove customer data only according to explicit reset semantics.

## 9. Acceptance Criteria

- Repeat customers can be reused across bookings.
- Phone matching reduces duplicate customer creation.
- Old bookings keep customer snapshot information when profile changes.
- Customer history can be traced from profile to bookings.
- Unauthorized users cannot access customer contact data.
- Customer records referenced by history are not casually hard-deleted.
