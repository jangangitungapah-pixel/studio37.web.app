# Customer Domain Contract

## Phase

Phase 7A — Customer domain foundation.

## Purpose

Phase 7A establishes reusable customer records before Phase 8 activates authoritative booking
creation. The boundary is intentionally small: canonical customer data, exact phone matching,
historical snapshot construction, focused persistence, and capability-scoped Firestore access.

The phase does not implement a customer-management page or booking-form suggestion UI.

## Canonical collection

Customer records use auto-generated immutable document IDs:

```text
customers/{customerId}
```

Persisted fields are:

```text
name
normalizedPhone
displayPhone
email
notes
createdAt
createdByUid
updatedAt
updatedByUid
```

The document ID is supplied by the Firestore document path and is exposed as `id` only after domain
decoding.

## Contact normalization

### Name

- required string
- trimmed
- maximum 120 characters

### Phone evidence

Customer input may use practical Indonesian formats such as:

```text
0812-3456-7890
+62 812 3456 7890
6281234567890
```

All accepted forms converge through the existing centralized `normalizeIndonesianPhone()` utility
to:

```text
+6281234567890
```

Both persisted phone fields are deliberately canonical in Phase 7A:

```text
displayPhone == normalizedPhone == canonical +62 value
```

This duplication follows the PRD field model while keeping the Firestore integrity rule enforceable.
Firestore Rules cannot reliably strip arbitrary presentation punctuation, so preserving formatted
input in the document would make the cross-field invariant impossible to prove at the security
boundary. Human-friendly phone formatting is therefore a presentation concern for later UI work.

`normalizedPhone` is never accepted as independent mutable repository input. It is always derived
from the entered `displayPhone` value. Stored documents fail closed unless both phone evidence fields
are canonical and equal.

### Email

- optional / nullable
- lowercased after trimming
- maximum 254 characters
- validated with the same pragmatic email shape used by existing operational domains

### Notes

- stored as a string
- outer whitespace is trimmed
- empty string is valid
- maximum 2,000 characters

Notes are operational profile context and are deliberately excluded from booking-time customer
snapshots.

## Historical customer snapshot

Phase 7A defines the detached snapshot that Phase 8 bookings can persist:

```js
const customerSnapshot = {
  customerId,
  name,
  normalizedPhone,
  displayPhone,
  email,
};
```

The snapshot is validated and frozen independently of the live customer document. It contains the
minimum booking-time identity/contact evidence required by PRD-12 and excludes mutable notes and
actor metadata.

Editing `customers/{customerId}` later therefore cannot silently rewrite historical booking contact
facts once Phase 8 persists this snapshot.

## Repository boundary

`customerRepository` exposes only focused operations:

```text
getCustomer(customerId)
findCustomersByPhone(phone)
createCustomer(details, actor)
updateCustomer(customerId, details, actor)
```

It intentionally exposes no:

- `listAll()`
- collection listener
- hard delete
- arbitrary full-text search
- booking-history query
- merge operation

### Exact phone matching

`findCustomersByPhone(phone)` normalizes the supplied phone before Firestore is queried and uses:

```text
where normalizedPhone == canonical +62 value
limit 5
```

The small bounded result allows the future booking UI to reuse a repeat customer and warn about
likely duplicates without assuming that a phone number is globally unique. Phase 7A does not add a
unique-index surrogate or silently merge records.

The query requires no composite Firestore index.

## Write metadata

New customer records use one server timestamp for both `createdAt` and `updatedAt` and the current
actor UID for both actor fields.

Updates may change only:

```text
name
normalizedPhone
displayPhone
email
notes
updatedAt
updatedByUid
```

`createdAt` and `createdByUid` are immutable during ordinary customer management.

## Authorization

The existing capability registry already defines:

```text
customer.view
customer.edit
```

Firestore is the enforcement boundary.

- active Owner receives both implicitly
- active Studio Operator requires an active delegated permission set containing the relevant
  capability
- `customer.view` permits exact reads and bounded customer queries
- `customer.edit` permits validated creates and focused updates
- hard delete is denied
- unauthenticated, inactive, malformed-profile, and non-capable users fail closed

A user with `customer.edit` is not automatically treated as a customer viewer unless their assigned
permission set also grants `customer.view`. This keeps read and write delegation explicit.

## Deferred work

Phase 7A does not implement:

- Customers page or dialogs
- name search or arbitrary full-text search
- booking-form suggestion presentation
- customer booking-history query
- denormalized booking count / last-booking fields
- duplicate merge/archive workflow
- Danger Zone deletion
- authoritative booking creation
- production deployment

## Verification

The targeted Phase 7A gates cover:

1. Indonesian phone normalization and matching convergence
2. canonical customer schema validation
3. canonical/equal phone evidence
4. detached minimal snapshot construction
5. exact customer reads
6. bounded exact-phone repository queries
7. create/update metadata ownership
8. absence of generic list/delete repository operations
9. `customer.view` read authorization
10. `customer.edit` validated create/update authorization
11. immutable creation metadata
12. hard-delete denial
13. malformed/forged customer rejection

## Next slice

Phase 7B can consume this boundary for customer-management UI, practical name/phone lookup, and the
booking-input suggestion/duplicate-warning experience. Booking-history queries should wait until
Phase 8 defines the authoritative booking query contract.
