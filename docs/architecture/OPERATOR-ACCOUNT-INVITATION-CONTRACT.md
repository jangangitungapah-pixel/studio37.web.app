# Operator Account-Invitation Contract

## Purpose

Define the Phase 4C5A Firestore foundation for a low-friction Studio Operator onboarding flow.
An Owner can create a scoped invitation from an existing operational operator record, and the
invited person can redeem it after Firebase Authentication proves a matching verified email. The
redeem operation creates or links the application profile without manual `users/{uid}` console
work while keeping Owner authority and permission assignment out of the invitation path.

This slice implements the data model, exact-document repository, Security Rules, and automated
tests. Authentication-provider UI, invitation delivery, and browser acceptance remain separate
later checkpoints.

## Eligibility boundary

An invitation may be created only by a canonical active Owner and only when the target
`operators/{operatorId}` document is:

- valid and `active`;
- currently unlinked (`linkedUserUid: null`);
- typed as `studio_operator` (it may also be a `recording_engineer`); and
- configured with a normalized lowercase email address.

A recording-only operator still needs no login. Adding an invitation does not change operator
status, types, permissions, or the account relationship.

## Exact path and identifier

Each invitation is stored at:

```text
operators/{operatorId}/accountInvites/{invitationId}
```

`invitationId` is an opaque cryptographically random single-segment identifier with 20–128
URL-safe characters. The repository creates it with `crypto.randomUUID()`. It is never derived from
an email, UID, display name, or sequential counter.

The nested path keeps ownership explicit and lets every operation address one known invitation.
The repository exposes no invitation collection list, collection-group query, or generic
`listAll()` operation.

## Document contract

An invitation stores exactly:

| Field           | Contract                                                     |
| --------------- | ------------------------------------------------------------ |
| `operatorId`    | Parent operator document ID                                  |
| `displayName`   | Operator display-name snapshot                               |
| `email`         | Normalized lowercase operator email snapshot                 |
| `phone`         | Canonical nullable Indonesian `+62` phone snapshot           |
| `status`        | `pending                                                     | accepted | revoked` |
| `expiresAt`     | Absolute Firestore timestamp, at most 30 days after creation |
| `createdAt`     | Server creation timestamp                                    |
| `createdByUid`  | Creating Owner UID                                           |
| `updatedAt`     | Server update timestamp                                      |
| `updatedByUid`  | Last transition actor UID                                    |
| `acceptedAt`    | Acceptance server timestamp, otherwise `null`                |
| `acceptedByUid` | Redeeming Firebase UID, otherwise `null`                     |

Pending and revoked documents must keep both acceptance fields null. An accepted document must
set `acceptedAt == updatedAt` and `acceptedByUid == updatedByUid`.

The corresponding `users/{uid}` profile may contain nullable `activationInviteId`. It records the
one invitation that established the account relationship. Owner profiles must always keep this
field null or absent.

## State transitions

Only these transitions are valid:

| From      | To         | Actor                           | Preconditions                     |
| --------- | ---------- | ------------------------------- | --------------------------------- |
| none      | `pending`  | Active Owner                    | Eligible exact operator           |
| `pending` | `revoked`  | Active Owner                    | Invitation is still pending       |
| `pending` | `accepted` | Verified matching Firebase user | Before `expiresAt`; atomic redeem |

Expiry is derived when a pending invitation reaches `expiresAt`; it is not persisted as another
mutable status. Expired, revoked, and accepted invitations cannot be redeemed or reopened. Hard
delete is denied so the source and acceptance metadata remain reviewable.

## Verified-email redemption

The invitee must already have a Firebase Authentication session whose token contains:

- a non-empty email;
- `email_verified == true`; and
- an email that case-normalizes to the invitation email.

Knowledge of the invitation path alone is insufficient. A signed-in user with an unverified or
different email cannot read or redeem it. The Web SDK does not enumerate Authentication users,
inspect another identity, store a password, or use Admin SDK credentials.

The repository supports two fail-closed redemption cases:

1. **No application profile yet.** Create `users/{auth.uid}` as an active `studio_operator`, copy
   the invitation contact snapshot, set the reciprocal operator reference, record
   `activationInviteId`, and start with `permissionSetId: null`.
2. **Eligible application profile exists.** It must already be an active, unlinked
   `studio_operator` with the same normalized email. Only `operatorId`, `activationInviteId`, and
   `updatedAt` change; its current permission set is preserved.

A missing application profile is therefore normal during self-registration. A malformed,
disabled, Owner-role, different-email, or already-linked profile is ineligible.

## Atomic relationship and authority invariants

Redemption commits one batch across exactly three documents:

```text
users/{auth.uid}.operatorId == operatorId
users/{auth.uid}.activationInviteId == invitationId
operators/{operatorId}.linkedUserUid == auth.uid
accountInvites/{invitationId}.acceptedByUid == auth.uid
```

Security Rules validate the post-commit state of all three documents. A one-sided user create,
user link, operator link, or invitation acceptance fails. The operator must still be active,
unlinked, and typed as `studio_operator` when the batch commits.

Invitation redemption can never create or promote an Owner, assign a permission set, disable or
reactivate an existing user, or change unrelated profile/operator fields. Application rules also
prevent an Owner client from creating another Owner or promoting a Studio Operator. First-Owner
bootstrap remains the separate reviewed console-only procedure.

## Repository boundary

`operatorAccountInvitationRepository.js` owns four focused operations:

- `createInvitation(operatorId, options)` — transactionally validates one operator and writes one
  collision-free pending invitation;
- `getInvitation(operatorId, invitationId)` — reads one exact invitation;
- `revokeInvitation(operatorId, invitationId, options)` — transitions one exact pending
  invitation;
- `redeemInvitation(operatorId, invitationId, authIdentity)` — reads the exact invitation and own
  user profile, then commits the exact three-document batch.

Authorization is enforced by Security Rules, not by the caller-supplied actor fields. The
repository's local validation exists for deterministic errors and document-shape safety.

## Query, index, and Spark behavior

There is no invitation list/query/listener, Authentication-user enumeration, Cloud Function, or
Admin SDK. Creation reads the operator plus one collision path. Redemption reads one invitation
and one own-profile path before its three-document write batch. These operations need no composite
index and remain compatible with the Spark/client-first development architecture.

## Deferred scope

- sign-up/provider and invitation-acceptance browser UI;
- email or other invitation delivery;
- invitation resend/rotation and Owner invitation-status UI;
- permission-set administration and assignment;
- Firebase Authentication administrative provisioning or deletion;
- audit-log events and notification history;
- final real-Firebase responsive acceptance;
- Rules, index, Hosting, and production deployment.

Production review and deployment remain Phase 17.
