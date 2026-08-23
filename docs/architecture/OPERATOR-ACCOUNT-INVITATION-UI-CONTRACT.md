# Operator Account-Invitation UI Contract

## Purpose

Define the Phase 4C5B browser/provider workflow that consumes the exact-path Phase 4C5A account
invitation. An Owner can create a link from an eligible Studio Operator, and the invitee can create
or reuse a Firebase email/password identity, verify the matching email, review the invitation, and
redeem it without manual `users/{uid}` console provisioning.

This checkpoint remains client-first and Firebase Spark compatible. It does not add a trusted
server, Admin SDK, service credential, Cloud Function, Authentication-user enumeration, or
invitation collection query.

## Routes and access boundaries

Owner invitation creation is embedded in:

```text
/settings/operators
```

The onboarding route is:

```text
/invite/:operatorId/:invitationId
```

The onboarding shell is intentionally outside the protected application layout because a newly
created Firebase identity has no `users/{uid}` profile until redemption. Public route visibility
does not expose invitation data: Firestore permits the exact invitation read only after Firebase
Authentication supplies the invitation's matching verified email. An invalid path is rejected
locally before any Firestore read.

## Owner creation and delivery flow

The **Undang akun** action is visible only to a canonical active Owner and only for an operator that
the browser already knows to be active, unlinked, typed as `studio_operator`, and configured with
an email. The repository and Security Rules independently revalidate those conditions.

1. Owner reviews the operator, exact email, and seven-day default lifetime.
2. Owner explicitly selects **Buat link undangan**.
3. The existing repository creates one opaque exact-path invitation.
4. The browser builds a same-origin route containing only `operatorId` and the random
   `invitationId`; email, role, and permission data are not placed in query parameters.
5. Owner copies the link and sends it through the studio's chosen communication channel.

The current delivery boundary is deliberate manual copy/share. Studio37 does not store a password
or require a paid email/notification service. Automated invitation email, resend/rotation, and
invitation-status administration remain later checkpoints. The exact-UID linking dialog remains
available as an Owner fallback.

## Invitee authentication and verification flow

The onboarding page offers two explicit email/password paths:

- **Buat akun baru** uses Firebase Authentication client sign-up.
- **Sudah punya akun** uses the existing Firebase email/password sign-in.

For a new identity, the Firebase provider sends its standard email-verification message with the
same invitation route as the continue URL. The page never collects an Owner-selected password,
creates another user's identity, or assigns an application role through the Auth provider.

An unverified user cannot load the invitation. After the user follows Firebase's verification
link, **Saya sudah verifikasi** reloads the current Firebase user and forces a fresh ID token before
the exact Firestore read. This ensures `request.auth.token.email_verified` reflects the latest
provider state rather than a cached token.

## Review and redemption flow

After verification:

1. The page reads only
   `operators/{operatorId}/accountInvites/{invitationId}` through the focused repository.
2. The invitee reviews the operator snapshot, expiry, forced Studio Operator role, and empty
   initial permission assignment.
3. Expired, revoked, accepted, missing, mismatched, or unreadable invitations fail closed.
4. The invitee explicitly selects **Aktifkan akun Studio37**.
5. The existing Phase 4C5A three-document batch creates or updates the exact user profile, links
   the exact operator, and accepts the exact invitation atomically.
6. The live `users/{uid}` observer resolves the new active profile. The account can open Account
   Settings, while operational routes remain unavailable until an Owner separately assigns a
   permission set.

The UI cannot request or inject a role, status, permission set, different operator, or acceptance
actor. Security Rules remain the authorization and atomicity boundary.

## Loading, error, and recovery states

- Auth session restoration has an explicit loading state.
- Sign-up and sign-in preserve the entered email after recoverable errors.
- Provider errors are mapped to non-secret Indonesian messages.
- Verification can be resent explicitly; it is never sent on every render. A successful request
  starts a 60-second client-side resend guard, while Firebase may enforce a longer provider-side
  throttle. The UI reports only that Firebase accepted the request because inbox delivery cannot be
  observed from the browser.
- The user can refresh verification state or sign out and choose another account.
- Exact invitation reads expose a generic recovery message for permission-denied or missing data so
  private invitation details are not leaked.
- Failed redemption keeps the verified session and invitation context available for retry.
- Completion waits for the live application profile before enabling the Account Settings action.

## Responsive and accessibility behavior

- The onboarding panel uses the existing full-height authentication surface and shared fields and
  buttons.
- Desktop keeps compact side-by-side mode/actions and a three-column invitation summary.
- Narrow mobile stacks authentication modes, actions, and invitation metadata without horizontal
  page overflow.
- Forms have explicit labels, inline errors, autocomplete hints, disabled/loading semantics, and
  live status messaging.
- Owner creation uses the shared focus-trapped dialog and keeps the invitation URL available for
  manual selection when the Clipboard API is unavailable.

Final real-Firebase email verification, account redemption, and desktop/mobile browser acceptance
remain a manual Phase 4 gate and are not implied by component tests.

## Query, index, and Spark behavior

This UI adds no collection query, listener, Authentication-user enumeration, or composite index.
The Owner creates one exact invitation after an explicit action. The invitee reads and redeems one
known invitation path. Verification email is sent only after explicit sign-up/resend actions.

The existing bounded operator list remains `displayName asc + limit(100)`. No index manifest change
is required.

## Deferred scope

- automated invitation-link email/WhatsApp delivery and notification history;
- pending invitation list/status, resend/rotation, and revocation UI;
- permission-set administration and assignment;
- user account activation/deactivation administration;
- Authentication administrative provisioning or deletion;
- audit-log events;
- final Phase 4 real-Firebase and responsive acceptance;
- Rules, indexes, Hosting, and production deployment.

Production review and deployment remain Phase 17.
