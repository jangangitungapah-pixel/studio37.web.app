# Firestore Data Conventions

## Purpose

Define the conversion and normalization boundary between Studio37 domain values and Cloud
Firestore documents. These rules keep Firebase-specific values out of React rendering and make
timestamp, money, and partial-update behavior testable.

## Converter decision

Studio37 uses the explicit `encode` and `decode` hooks already exposed by
`createDocumentRepository`. The shared repository does not apply one recursive global converter
and does not attach an SDK `withConverter()` implementation to every collection.

Feature repositories should provide named, field-aware functions such as:

```text
encodeBooking
decodeBooking
encodeBookingPatch
```

This keeps each collection's persisted shape visible and lets feature repositories own their
query, normalization, and index requirements.

## Required boundary behavior

### Encoding writes

- Convert domain `Date` values to Firestore `Timestamp` values with
  `toFirestoreTimestamp()`.
- Store money as integer IDR; money helpers are added in the next Phase 2C slice.
- Do not persist the synthetic document `id` inside a payload unless a domain requirement
  explicitly calls for it.
- Do not mutate the caller's object.
- Encode known fields explicitly instead of recursively converting unknown nested values.
- Use a dedicated patch encoder for partial updates so omitted fields remain omitted.
- Keep `null`, delete-field, and server-timestamp behavior explicit per field.

### Decoding reads

- The shared repository adds the Firestore document ID before calling `decode`.
- Convert persisted Firestore `Timestamp` fields to cloned JavaScript `Date` values with
  `toJavaScriptDate()`.
- Preserve historical snapshot objects as persisted; do not silently rebuild them from current
  settings.
- Reject malformed required values close to the data boundary rather than letting invalid data
  reach UI calculations.

## Timestamp and timezone rules

- Persist instants as Firestore `Timestamp` values.
- Do not persist localized date/time display strings as authoritative time values.
- The initial studio timezone is the IANA identifier `Asia/Jakarta`.
- Formatting must always pass an explicit IANA timezone or use
  `DEFAULT_STUDIO_TIME_ZONE`.
- A timezone changes how an instant is displayed, never the stored instant itself.
- Nullable timestamp fields must opt in with `{ allowNull: true }`.
- Ambiguous date-only strings are not accepted by the shared timestamp utilities.

Central utilities live in:

```text
src/lib/datetime/timestamps.js
```

## Feature-repository example

```js
import { toFirestoreTimestamp, toJavaScriptDate } from '../../lib/datetime/timestamps.js';
import { createDocumentRepository } from '../../services/firestore/createDocumentRepository.js';

function encodeBooking({ id: _documentId, endAt, startAt, ...booking }) {
  return {
    ...booking,
    endAt: toFirestoreTimestamp(endAt, { label: 'booking.endAt' }),
    startAt: toFirestoreTimestamp(startAt, { label: 'booking.startAt' }),
  };
}

function decodeBooking({ endAt, startAt, ...booking }) {
  return {
    ...booking,
    endAt: toJavaScriptDate(endAt, { label: 'booking.endAt' }),
    startAt: toJavaScriptDate(startAt, { label: 'booking.startAt' }),
  };
}

export const bookingRepository = createDocumentRepository({
  collectionName: 'bookings',
  decode: decodeBooking,
  encode: encodeBooking,
});
```

The example documents the boundary only. The Booking repository and its bounded query shapes are
implemented in their scheduled feature phases.

## Query and index discipline

- The shared repository remains document-focused and exposes no generic `listAll()`.
- Feature repositories own filters, ordering, limits, pagination, and composite-index needs.
- Indexes are recorded only when actual query shapes emerge.
- React components do not construct raw Firestore queries.
