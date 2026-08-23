# PRD-16 — Firebase Security & Data Integrity

## 1. Objective

Protect Studio37 data using Firebase Authentication, Firestore Security Rules, permission-aware application logic, and validated write patterns suitable for a client-side Firebase Spark Plan architecture.

## 2. Security Principles

- Authentication is not authorization.
- Navigation visibility is not a security boundary.
- Client-supplied `role`, `owner`, price, or permission claims are not trusted automatically.
- Least privilege is the default.
- Sensitive financial/configuration writes require stronger permissions.
- Security Rules must be tested automatically.

## 3. Authentication Boundary

Protected application data requires an authenticated Firebase user associated with an active Studio37 user profile.

Disabled Studio37 users must not regain access merely because their Firebase authentication token remains valid.

## 4. Role & Permission Integrity

Owner role and protected permissions cannot be self-assigned by a Studio Operator.

Security design must specifically prevent:

- changing own role to Owner
- changing protected permission fields
- creating arbitrary Owner profiles
- modifying another user's privileges without Owner authorization

## 5. Collection-Level Expectations

### Users / Permissions

Owner manages protected role/permission/account-status data. Ordinary users may update only explicitly allowed profile fields.

### Studios / Session Types / Pricing Rules

Write: Owner by default.
Read: authenticated operational users where needed for booking/UI.

### Bookings

Read/write based on booking permissions. Rules should constrain protected snapshots/financial fields as much as practical and keep sensitive override flows restricted.

### Customers

Authenticated users with customer/booking operational permission only.

### Payments

Create/read according to financial permissions. Refund/adjustment is more restricted than ordinary payment recording.

### Commission Entries / Payouts

Full management Owner-only by default. Optional own-summary access must be explicit and narrowly scoped.

### Ledger Entries

Financial permissions required. Source-generated records should not be freely editable by operators.

### Audit Logs

Read Owner or specifically authorized roles. Ordinary users cannot rewrite/delete existing audit evidence.

### App Settings / Danger Zone

Owner-only writes.

## 6. Field-Level Integrity

Where Firestore Rules can reasonably enforce it, validate:

- allowed enum/status values
- non-negative standard money values
- protected identifiers not unexpectedly changed
- immutable creator/source fields after creation
- Owner-only fields unchanged by operators
- timestamps/required fields present

Rules should not become an unmaintainable duplicate of the entire business engine, but critical trust boundaries must be enforced.

## 7. Money Integrity

Money is stored as integer IDR.

Client UI calculations are not trusted purely because they came from the official UI. Write authorization and protected override capabilities should minimize opportunities for operators to submit arbitrary price/commission amounts.

Because Spark Plan intentionally avoids a mandatory custom backend initially, any remaining trust limitation in client-computed calculations must be documented and mitigated with permissions, snapshots, validation, and audit trails.

## 8. Booking Conflict Integrity

Firestore Security Rules alone are not ideal for complex range conflict checks. The application must perform conflict validation in its booking write flow and use transaction/revalidation patterns where practical.

The known concurrency risk and selected mitigation must be tested. If future booking volume demands stronger authoritative scheduling, a server-side transaction/function architecture can be evaluated later.

## 9. Environment & Secrets

Firebase web configuration is not treated as a secret, but the project must never commit:

- service-account private keys
- Admin SDK credentials
- API secrets for future private integrations
- passwords/tokens

Use `.env.local` or platform secret mechanisms as appropriate and commit only `.env.example` placeholders.

## 10. App Check / Abuse Controls

Firebase App Check can be evaluated for production hardening where available/appropriate. It complements but does not replace Authentication and Security Rules.

## 11. Emulator & Rules Testing

Use Firebase Emulator Suite where practical for rule tests covering at least:

- unauthenticated access denied
- Owner allowed sensitive actions
- operator allowed delegated actions
- operator cannot promote self
- operator cannot change pricing/settings without permission
- operator cannot mutate paid commissions
- disabled user access denied according to chosen rule architecture
- protected historical/source fields cannot be casually rewritten

## 12. Destructive Operations

Danger Zone/factory reset is Owner-only and requires explicit application-level confirmation. Security Rules must reject destructive writes from ordinary operators even if they directly call the Firebase SDK.

Large-scale reset feasibility under Spark/client architecture must be designed carefully before implementation; batching, partial failure, and preserved Owner access must be specified.

## 13. Auditability

Sensitive actions should include actor/source metadata and audit events. Auditability is a secondary control and does not replace authorization.

## 14. Acceptance Criteria

- Unauthenticated users cannot access protected studio data.
- Studio Operator cannot promote self or edit protected permissions.
- Pricing/settings/Danger Zone writes are Owner-only by default.
- Financial actions respect distinct permissions.
- Security Rules have automated emulator tests.
- Secrets/private credentials are not stored in repository source.
- Known client-only limitations are documented instead of being treated as magically secure.
