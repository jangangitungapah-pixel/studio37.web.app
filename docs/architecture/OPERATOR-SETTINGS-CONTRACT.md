# Operator Settings UI Contract

## Purpose

Define the Phase 4C2 browser workflow for viewing, creating, editing, activating, and deactivating
Studio37 operator profiles. It consumes the finalized Phase 4C1 operator domain/repository without
opening account-link, permission-management, or compensation scope.

## Route and access

The implemented route is:

```text
/settings/operators
```

- Route access requires `settings.operators.view` or implicit Owner access.
- The page loads the fixed repository query only; React does not construct a Firestore query.
- Add, edit, activate, and deactivate controls require `settings.operators.manage` or implicit
  Owner access.
- A view-only user receives the same bounded list with no mutation controls.
- UI guards improve workflow behavior; Firestore Security Rules remain the authorization boundary.

## List workflow

The page renders the one-shot `displayName asc + limit(100)` repository result with:

- active/disabled state,
- Studio Operator and/or Recording Engineer types,
- optional canonical contact data,
- login-linked versus no-login context,
- explicit edit and soft-status actions for authorized managers.

Loading, recoverable error/retry, empty, read-only, and fixed-limit states are explicit. Reaching the
repository limit disables creation instead of replacing the bounded query with an unbounded read.
The page exposes no hard-delete or collection-listener workflow.

## Add and edit workflow

The dialog edits only Phase 4C1 mutable profile fields:

| UI field           | Persisted field   | Behavior                                           |
| ------------------ | ----------------- | -------------------------------------------------- |
| Nama operator      | `displayName`     | Required, trimmed, maximum 100 characters          |
| Email kontak       | `email`           | Optional; normalized lowercase or persisted `null` |
| WhatsApp / telepon | `phone`           | Optional; normalized to canonical Indonesian `+62` |
| Studio Operator    | `operatorTypes[]` | Optional individually; at least one type required  |
| Recording Engineer | `operatorTypes[]` | Optional individually; both types may be selected  |

Validation is applied before repository mutation and attempted input remains visible after errors.
Create always produces an active profile with `linkedUserUid: null`. Edit does not send status,
creation metadata, or account-link fields.

Operator types describe assignment eligibility only. The UI explicitly states that selecting a
type does not grant login access, roles, permission sets, or application capabilities.

## Activation workflow

Status changes use a separate confirmation dialog and the focused `setOperatorStatus()` repository
method. Deactivation prevents future operational selection when booking assignment integration is
implemented, while preserving the immutable operator ID and historical booking/commission
references. No hard delete is offered.

## Account-link boundary

The list may display whether a future account link exists, but Phase 4C2 never creates, changes,
or removes `linkedUserUid`, `users/{uid}.operatorId`, Firebase Authentication identities, roles, or
permission sets. The form explains this boundary instead of presenting a disabled fake account
provisioning flow.

## Responsive and accessibility behavior

- Desktop uses compact operator rows with identity, types, contact, status, and adjacent actions.
- Tablet/mobile rows stack actions into full-width controls without horizontal overflow.
- Type selection uses native labeled checkboxes with visible selected and error states.
- Dialog focus trapping, Escape dismissal, focus restoration, and mutation loading behavior reuse
  the shared Dialog/Button primitives.
- Status changes require explicit confirmation; errors remain recoverable.

Final manual responsive/browser acceptance remains a Phase 4 gate and is not implied by automated
component coverage.

## Deferred scope

- Firebase Authentication account provisioning or invitation,
- bidirectional operator/user linking,
- permission-set listing and administration,
- operator compensation defaults and rules,
- booking assignment consumption,
- final Phase 4 responsive/integration acceptance,
- Firebase Rules/index/Hosting deployment.

Production review and deployment remain Phase 17.
