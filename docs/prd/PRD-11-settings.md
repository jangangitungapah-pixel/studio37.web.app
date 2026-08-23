# PRD-11 — Settings & Studio Configuration

## 1. Objective

Make Studio37 highly configurable by the Owner so changes to rooms, operating hours, session types, pricing, commissions, and operator access do not require source-code edits.

## 2. Settings Navigation

Required subpages:

- Account & Profile
- Studio Settings
- Price Settings
- Operator Settings
- Danger Zone

Settings UI should clearly separate ordinary preferences from business-critical configuration and destructive actions.

---

# 3. Account & Profile Settings

Supported fields/actions:

- display name
- email/account identity information
- phone
- avatar if implemented
- password/security management through supported Firebase Auth flows
- user role display
- logout/session controls where appropriate

Studio Operators can edit only their allowed profile fields. Role and permissions are protected.

---

# 4. Studio Settings

Owner can configure:

- studio/business display name
- active studio rooms
- room name/code
- room description
- active/inactive status
- display order
- general operating hours
- optional day-specific hours in future
- booking interval/granularity
- default calendar behavior
- timezone

Initial default operating hours may be 10:00–22:00, but implementation must read configured settings rather than permanently hardcoding those values.

Deactivating a studio prevents it from new booking selection without breaking historical bookings.

---

# 5. Price Settings

Price Settings is the administration UI for PRD-06 and relevant PRD-07 compensation configuration.

Owner can:

- create/edit/deactivate session types
- define whether a session reserves a studio/time slot
- configure hourly pricing
- configure fixed-session pricing
- configure duration packages
- configure base + additional-time pricing
- configure studio-specific prices
- configure add-ons
- define duration/minimum/increment rules
- define price effective periods where supported
- configure associated operator compensation rules
- preview calculations before activating configuration

The UI should show human-readable pricing rules, not force Owner to understand internal JSON/schema structures.

## 5.1 Configuration Validation

Before save/activation, detect:

- ambiguous overlapping rules
- invalid duration/package values
- negative prices
- incomplete studio/session references
- invalid percentages

Existing historical bookings must not be recalculated when settings change.

---

# 6. Operator Settings

Owner can:

- add an operator profile
- edit operator identity/contact data
- mark operator type/capabilities
- activate/deactivate operator
- optionally create/link Firebase login account
- configure permission set for login-enabled Studio Operator
- configure compensation defaults/rules where appropriate
- inspect account status

Recording operators/engineers can exist without login accounts.

Phase 4C1 establishes the underlying bounded `operators/{operatorId}` domain/repository and keeps
new records intentionally unlinked from Firebase Authentication. Phase 4C2 adds the responsive
bounded-list, add/edit, and soft activation/deactivation UI while retaining that account boundary.
Phase 4C3 establishes the reciprocal Owner-only account-link transaction and rules foundation for
an already provisioned exact user profile; it does not create Firebase Authentication identities
or expose permission controls. Phase 4C4 adds the Owner-only exact-UID profile review plus atomic
link/unlink UI while preserving the no-provisioning and separate-permission boundaries.
The detailed contracts are documented in `docs/architecture/OPERATOR-DOMAIN-CONTRACT.md` and
`docs/architecture/OPERATOR-SETTINGS-CONTRACT.md`, with the account relationship in
`docs/architecture/OPERATOR-ACCOUNT-LINK-CONTRACT.md` and its browser workflow in
`docs/architecture/OPERATOR-ACCOUNT-LINK-UI-CONTRACT.md`. Phase 4C5A/4C5B add the exact-path
verified-email invitation plus email/password onboarding UI, while keeping new accounts at zero
delegated permissions. Those flows are documented in
`docs/architecture/OPERATOR-ACCOUNT-INVITATION-CONTRACT.md` and
`docs/architecture/OPERATOR-ACCOUNT-INVITATION-UI-CONTRACT.md`; permission administration remains
a separate implementation checkpoint. Phase 4D1 establishes its bounded permission-template CRUD,
soft-status, exact assignment transaction, and Security Rules contract in
`docs/architecture/PERMISSION-ADMINISTRATION-CONTRACT.md`. Phase 4D2 adds the separate Owner-only Hak
Akses route, grouped responsive editor, sensitive-capability explanations, and explicit assignment
dialog in `docs/architecture/PERMISSION-ADMINISTRATION-UI-CONTRACT.md` without enumerating users or
Authentication identities.

## 6.1 Permissions UI

Permissions should be grouped by functional domain, for example:

- Dashboard
- Booking
- Customer
- Payment
- Commission
- Bookkeeping
- Settings

Sensitive permissions should include clear warnings. Owner-only capabilities such as permission administration/factory reset should not be delegable by default.

---

# 7. Danger Zone

Owner-only destructive administration.

Potential actions:

- reset booking data
- reset financial/ledger data
- reset customer data
- full factory reset

## 7.1 Safety Requirements

Every destructive action must use safeguards proportional to impact:

- clear explanation of what will be deleted/preserved
- confirmation dialog
- typed confirmation phrase for high-impact actions
- re-authentication where practical
- audit record before/around action where technically possible
- progress/error handling
- no single-click irreversible reset

## 7.2 Factory Reset

Factory reset should have an explicit specification before implementation defining whether authentication Owner account and base configuration are preserved. It must never rely on vague `delete everything` behavior.

---

# 8. Change Impact

For configuration changes that could affect future bookings, the UI should explain impact. Example:

`Changing this price affects new/repriced bookings only. Existing confirmed booking snapshots remain unchanged.`

## 9. Responsive Requirements

Desktop: compact form sections/navigation suitable for frequent administration.

Mobile: stacked forms, clear section context, sticky/save actions where helpful, and no oversized duplicated subpage hero that wastes operational screen space.

## 10. Acceptance Criteria

- Owner can add/deactivate rooms without code edits.
- Owner can add/deactivate session types and pricing rules without code edits.
- Owner can configure operator access without modifying source.
- Configuration changes do not mutate historical booking snapshots automatically.
- Invalid/ambiguous price configuration is blocked.
- Studio Operator cannot modify protected role/permission fields.
- Danger Zone actions require strong confirmation and Owner authorization.
