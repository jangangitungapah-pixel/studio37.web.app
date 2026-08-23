# Operator Account-Link UI Contract

## Purpose

Define the Phase 4C4 browser workflow for linking one existing Studio37 user profile to one
operator profile and for removing that relationship safely. This UI consumes the exact-document,
atomic Phase 4C3 repository and Security Rules boundary; it does not provision Firebase
Authentication identities or administer permission sets. Phase 4C5A keeps this manual exact-UID
workflow available as an Owner fallback while introducing a separate invitation repository.

## Route and authorization

The workflow is embedded in:

```text
/settings/operators
```

- Existing list access still requires `settings.operators.view` or implicit Owner access.
- Ordinary profile/status controls still require `settings.operators.manage` or implicit Owner
  access.
- Account-link and unlink controls are rendered only for a canonical active Owner.
- A delegated operator manager cannot see or execute the account-link controls even when it has
  `settings.operators.manage`.
- Firestore Security Rules remain the authorization boundary; the Owner-only React condition is
  workflow guidance, not a security substitute.

## Link workflow

1. Owner selects **Hubungkan akun** on an unlinked operator.
2. Owner enters one immutable Firebase Authentication UID.
3. The UI performs one exact `users/{uid}` document read through
   `operatorAccountLinkRepository.getUserByUid()`.
4. The resolved profile is shown for review with display name, email, role, application status,
   permission-set reference, current operator backlink, and exact UID.
5. Confirmation remains disabled when the profile is missing or already references an operator.
6. Owner confirms **Hubungkan akun**.
7. The repository commits `operators.linkedUserUid` and `users.operatorId` in one reciprocal
   transaction, then the bounded operator list is refreshed.

The typed UID is preserved after recoverable lookup or mutation errors. Email is display context
only and is never accepted as the identity lookup key. Direct reassignment is not offered: unlink
the existing relationship first, then create a new reviewed relationship.

## Unlink workflow

1. Owner selects **Kelola akun** on a linked operator.
2. The UI reads the exact linked `users/{uid}` profile and verifies that its `operatorId` points
   back to the selected operator.
3. Missing or non-reciprocal state stops the workflow and presents a recoverable error/retry state.
4. Owner explicitly confirms **Putuskan akun**.
5. The repository clears both relationship fields in one transaction and refreshes the operator
   list.

Unlinking does not delete either document, disable the user/operator, revoke the Firebase
Authentication identity, change a role, or change a permission set. Historical references remain
intact.

## Profile-state behavior

- An active or disabled canonical user profile may be reviewed.
- A disabled user is shown with a warning; linking does not reactivate it.
- A null permission-set reference is shown as **Belum ditetapkan** and grants no delegated
  capability.
- A user already linked to another operator is visible for diagnosis but cannot be confirmed.
- A broken reciprocal backlink blocks unlinking and fails closed.

## Loading, error, and feedback states

- Linked-profile resolution shows an explicit one-document loading state.
- Missing, permission-denied, unavailable, malformed, and invariant errors use actionable,
  non-secret messages.
- Linked-profile lookup offers retry without closing the dialog.
- Mutation controls remain disabled until the exact profile state is eligible.
- Dialog dismissal is blocked only while the atomic mutation is being submitted.
- Successful link/unlink shows a toast and refreshes the existing bounded operator list.

## Responsive and accessibility behavior

- Desktop keeps compact adjacent row actions and a review dialog.
- Mobile stacks row actions and profile metadata without horizontal page overflow.
- UID input uses the shared labeled field/error pattern.
- The shared dialog preserves focus trapping, Escape dismissal, focus restoration, and loading
  button semantics.
- Link and unlink use explicit action labels; unlink requires a danger-styled confirmation action.

Final real-Firebase account-link and responsive browser acceptance remains a Phase 4 manual gate
and is not implied by component tests.

## Query, index, and Spark behavior

The UI adds no user query, collection scan, listener, or composite index. Every account action is
explicitly initiated by the Owner and addresses at most the known operator and user document paths.
The existing operator list remains a one-shot `displayName asc + limit(100)` query.

## Deferred scope

- Firebase Authentication administrative identity creation/deletion,
- invitation creation/acceptance and delivery UI,
- permission-set list, create/edit/disable, and assignment UI,
- user account activation/deactivation workflow,
- compensation defaults and booking assignment consumption,
- final Phase 4 real-Firebase/responsive acceptance,
- audit events,
- Rules/index/Hosting deployment.

Production review and deployment remain Phase 17.
