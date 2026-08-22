# Studio37 Authorization Strategy

## Purpose

Define the Phase 3C client authorization contract for active Firebase users while preserving
Firestore Security Rules as the actual data-access boundary.

Client guards improve navigation and workflow behavior. They do not authorize Firestore reads or
writes and must never replace Security Rules.

## Runtime resolution

Every Firebase session first resolves exactly one `users/{uid}` document.

- An active Owner receives every supported capability implicitly. No permission-set read is made.
- An active Studio Operator with `permissionSetId: null` receives an empty capability list.
- An active Studio Operator with a permission-set reference listens to exactly one
  `permissionSets/{permissionSetId}` document.
- A missing, disabled, malformed, or unreadable referenced permission set fails closed and blocks
  the application session.
- Profile and permission-set listeners are replaced when their referenced IDs change and are
  unsubscribed on identity change, sign-out, or provider unmount.

This is at most two exact document listeners for an operator session. It is not a collection query,
does not scan permission sets, and does not expose a generic `listAll()` operation.

## Permission-set document contract

Path:

```text
permissionSets/{permissionSetId}
```

Fields:

| Field          | Contract                                         |
| -------------- | ------------------------------------------------ |
| `name`         | Non-empty display name                           |
| `status`       | `active \| disabled`                             |
| `capabilities` | Array of supported, delegable capability strings |
| `createdAt`    | Firestore Timestamp                              |
| `updatedAt`    | Firestore Timestamp not earlier than `createdAt` |

Duplicate capabilities are normalized away. Unknown capabilities invalidate the document instead
of being silently accepted.

`permissions.manage` and `danger_zone.execute` are Owner-only and rejected in Studio Operator
permission sets. Owner access to these capabilities remains implicit rather than stored in a
permission set.

## Initial capability registry

The source-controlled registry covers the domains already planned in PRD-03:

- dashboard
- bookings
- payments
- customers
- commissions
- bookkeeping
- studio, pricing, and operator settings
- permission administration
- Danger Zone execution

New capability strings must be introduced through a reviewed registry change, tests, and matching
Security Rules work where the capability affects data access.

## Route policy registry

| Route area                 | Required client policy                                      |
| -------------------------- | ----------------------------------------------------------- |
| Dashboard                  | `dashboard.view`                                            |
| Calendar / booking detail  | `booking.view`                                              |
| Fee & Commission           | `commission.view_own` or `commission.view_all`              |
| Bookkeeping                | `bookkeeping.view`                                          |
| Account                    | Active authenticated profile                                |
| Studio settings            | `settings.studio.view`                                      |
| Pricing settings           | `settings.pricing.view`                                     |
| Operator settings          | `settings.operators.view`                                   |
| Danger Zone                | Owner only                                                  |
| Development preview routes | Owner only and still compiled only in Vite development mode |

Navigation uses the same policies for visibility. Direct URLs are independently checked and show
a clear access-denied state, so hiding a link is never treated as authorization.

## Action-level policy

Buttons, mutations, sensitive values, and feature actions must use an independent capability
guard even when their parent route is allowed. For example, `booking.view` must not imply
`booking.edit` or `booking.override_price`.

The reusable action guard accepts all-of, any-of, and Owner-only policies. Future feature phases
must apply it at the relevant action boundary and still enforce matching Firestore Security Rules.

## Deferred security boundary

Phase 3C does not add or deploy Security Rules. Until the Phase 3 rules sub-phase and emulator tests
are complete, operator restrictions are a tested client boundary only and must not be described as
protection against direct Firestore SDK calls.

Production rule/index deployment and Firebase Hosting remain Phase 17 work.
