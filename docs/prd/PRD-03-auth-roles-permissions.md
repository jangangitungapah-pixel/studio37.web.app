# PRD-03 — Authentication, Roles & Permissions

## 1. Objective

Provide secure Firebase Authentication and a configurable authorization model for Owner and Studio Operator users.

## 2. Roles

### Owner

Full application administration. Owner-only capabilities include pricing configuration, operator management, permission management, sensitive financial views/actions, and Danger Zone operations.

### Studio Operator

Operational login whose accessible routes and actions are determined by explicit permissions configured by the Owner.

## 3. Authentication Requirements

- Firebase Authentication is the identity provider.
- Initial login may use email/password; additional Firebase-supported providers can be added later without changing the authorization model.
- Session persistence should survive ordinary refresh/reopen behavior.
- Disabled application users must be prevented from using protected application functionality even if a Firebase session still exists.
- Logout must clear application session state.

## 4. Permission Model

Permissions should be capability-based rather than page-name-only. Example capabilities:

- `dashboard.view`
- `booking.view`
- `booking.create`
- `booking.edit`
- `booking.cancel`
- `booking.override_price`
- `payment.view`
- `payment.create`
- `payment.adjust`
- `customer.view`
- `customer.edit`
- `commission.view_own`
- `commission.view_all`
- `bookkeeping.view`
- `bookkeeping.create`
- `settings.studio.view`
- `settings.studio.edit`

Owner implicitly has all capabilities. Owner-only capabilities should remain non-delegable where required for safety, including permission administration and factory reset.

The initial runtime registry treats `permissions.manage` and `danger_zone.execute` as explicitly
non-delegable. Studio Operator capabilities resolve from the exact `permissionSets/{id}` referenced
by the user profile; a null reference grants no capabilities, while a referenced set that is
missing, disabled, malformed, or unreadable fails closed.

## 5. Route Authorization

Protected routes require an authenticated active user. Route visibility should reflect permissions, but hiding navigation is not sufficient security.

If a user navigates directly to an unauthorized route, the application should show a clear access-denied state or redirect to an allowed area.

## 6. Feature-Level Authorization

Buttons, mutations, financial details, and sensitive fields must check permissions independently of route access. Example: a Studio Operator may be allowed to view bookings but not change prices.

## 7. Firebase Security Rules

Firestore Security Rules must enforce server-side authorization based on trusted user/profile data. Client-supplied role or permission fields cannot be trusted to authorize the same write.

Critical protections:

- Operators cannot promote themselves to Owner.
- Operators cannot edit their own protected permission fields.
- Owner-only settings cannot be modified by ordinary operators.
- Financial/commission writes are restricted by capability and field constraints.
- Audit log creation cannot be used to bypass source-record security.

## 8. User Lifecycle

Owner can:

- create/invite an operator account
- link login identity to operator profile
- edit operator profile
- change allowed permissions
- disable/reactivate account

Disabling an account should preserve its historical bookings, payments, commissions, and audit references.

The Phase 4C5A invitation foundation lets a Firebase user with a matching verified email create or
link its own application profile through an exact three-document Firestore batch. This removes the
need to manually create every `users/{uid}` document while preserving strict authority: a new
profile is forced to active `studio_operator`, receives no permission set, and cannot become Owner
through invitation or an Owner client mutation. First-Owner bootstrap remains a separate reviewed
console-only procedure. Provider/sign-up and invitation-delivery UI remain later checkpoints.

## 9. Recording Operator Without Login

An operator/engineer may exist only as an `operators` record for assignment and commission tracking. Creating an operator record does not require creating an authenticated application account.

## 10. UI Requirements

- Login page with clear validation/error state.
- User menu with identity and logout.
- Unauthorized actions should be absent or disabled with appropriate explanation.
- Permission settings should group capabilities by domain and explain sensitive permissions.
- Owner-only labels should be visually clear.

## 11. Acceptance Criteria

- Owner can authenticate and reach all intended application areas.
- Studio Operator can authenticate with only assigned capabilities.
- Direct URL access cannot bypass route authorization.
- Hidden UI cannot be bypassed with direct Firestore writes under operator credentials.
- An operator cannot modify role/permission fields to gain access.
- Disabled accounts lose operational access without deleting historical references.
- Non-login recording operators can still receive assignments/commission records.
