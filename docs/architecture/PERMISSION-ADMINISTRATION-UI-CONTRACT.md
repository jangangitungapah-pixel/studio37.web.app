# Permission Administration UI Contract

## Purpose

Define the Phase 4D2 Owner workflow for creating capability templates and assigning one template
to a login-linked Studio Operator. The UI consumes the Phase 4D1 repository and Firestore Security
Rules contracts; it does not create a parallel authorization model.

The route is:

```text
/settings/permissions
```

It appears as **Hak Akses** in Settings only for an authenticated active Owner. The route policy is
Owner-only even when a Studio Operator has every delegable Settings capability. Client routing and
navigation visibility remain convenience boundaries; Firestore Security Rules are authoritative.

## Read and query budget

Opening the page performs two one-shot bounded collection queries:

1. `permissionSets orderBy(name asc) limit(50)`;
2. `operators orderBy(displayName asc) limit(100)`.

The operator result is filtered in memory to records that both include the `studio_operator` type
and have a non-null `linkedUserUid`. The page does not automatically read each linked user.

Only after the Owner presses **Kelola akses** does the dialog read one exact
`users/{linkedUserUid}` document. Saving then calls the existing exact
user/operator/permission-set transaction. There is no `users` query, Authentication-user list,
email lookup, background listener, or generic collection read.

Template mutations refresh only the bounded permission-set list. They do not rerun the operator
query. Assignment does not rerun either collection query.

## Template editor

The editor groups every delegable runtime capability exactly once under:

- Dashboard;
- Booking;
- Customer;
- Payment;
- Commission;
- Bookkeeping;
- Settings.

Each capability has a human-readable label and explanation. Sensitive booking, payment,
commission, bookkeeping, and Settings actions have a visible warning label.

`permissions.manage` and `danger_zone.execute` never appear as selectable values. Owner authority
remains implicit. An empty capability list is valid and represents a login-enabled Studio Operator
with no delegated operational access.

Create and edit submit only canonical `name` and `capabilities` values. Status is changed through a
separate explicit confirmation. Disabling a template immediately removes its effective runtime
capabilities while preserving its document ID and existing user references. Hard delete is not
available.

## Assignment dialog

The assignment dialog shows the exact linked user identity, application role/status, and current
permission reference before a change is confirmed.

Assigning an active template is enabled only when:

- the operator is active and includes the Studio Operator type;
- the user is an active `studio_operator`;
- `users.operatorId` and `operators.linkedUserUid` are reciprocal;
- the selected template is active.

A disabled or broken relationship cannot receive a non-null template. An existing assignment may
still be cleared to `null` when the user remains a Studio Operator, matching the Phase 4D1 safe
revocation contract. The UI writes no role, status, account-link, identity, or invitation fields.

## Responsive and interaction behavior

Desktop uses compact template and operator rows plus a two-column capability editor. Mobile stacks
the editor groups and row actions, keeps buttons full width where useful, and avoids a duplicate
oversized subpage hero. Dialogs use the shared focus trap, Escape/backdrop behavior, loading states,
inline recoverable errors, and explicit status confirmation.

Required browser acceptance covers:

- Owner-only navigation and direct-route denial for Studio Operators;
- create/edit/disable/reactivate template flows;
- assign/change/clear permission on a real login-linked Studio Operator;
- immediate operator-session capability refresh after assignment or template disablement;
- desktop and narrow-mobile layout with no page overflow.

## Deferred scope

Audit events remain Phase 14. Automatic invitation delivery/status administration and remaining
Phase 4 integration gates are separate checkpoints. Cloud Functions, Admin SDK, paid delivery,
production Rules/index deployment, Firebase Hosting, and application deployment remain deferred.
