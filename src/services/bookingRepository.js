import { collection, doc, getDoc, getDocs, limit, orderBy, query, where } from 'firebase/firestore';

import {
  BOOKING_CONFLICT_QUERY_LIMIT,
  BOOKINGS_COLLECTION_NAME,
  decodeBookingDocument,
  isConflictRelevantBooking,
  normalizeBookingId,
} from '../features/booking/bookings.js';
import { normalizeStudioRoomId } from '../features/settings/studioRooms.js';
import { toJavaScriptDate } from '../lib/datetime/timestamps.js';
import { firestoreDb } from '../lib/firebase/client.js';

const defaultFirestoreAdapter = Object.freeze({
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
});

function requireFirestore(value) {
  if (!value) {
    throw new Error('Firestore is unavailable for repository "bookings".');
  }
  return value;
}

function decodeSnapshot(snapshot) {
  if (!snapshot.exists()) return null;
  return decodeBookingDocument({ ...snapshot.data(), id: snapshot.id });
}

function decodeQuerySnapshot(snapshot) {
  return snapshot.docs.map((bookingSnapshot) =>
    decodeBookingDocument({ ...bookingSnapshot.data(), id: bookingSnapshot.id }),
  );
}

function normalizeConflictWindow({ endAt, startAt, studioId }) {
  const start = toJavaScriptDate(startAt, { label: 'booking conflict startAt' });
  const end = toJavaScriptDate(endAt, { label: 'booking conflict endAt' });
  if (end <= start) {
    throw new RangeError('booking conflict endAt must be later than startAt.');
  }

  return Object.freeze({
    endAt: end,
    startAt: start,
    studioId: studioId === null ? null : normalizeStudioRoomId(studioId),
  });
}

export class BookingConflictQuerySaturationError extends Error {
  constructor(limitValue = BOOKING_CONFLICT_QUERY_LIMIT) {
    super(
      `Booking conflict query reached its ${limitValue}-document safety bound; availability is indeterminate.`,
    );
    this.name = 'BookingConflictQuerySaturationError';
    this.limit = limitValue;
  }
}

export function createBookingRepository({ adapter = defaultFirestoreAdapter, db = firestoreDb } = {}) {
  const resolvedDb = requireFirestore(db);
  const collectionReference = adapter.collection(resolvedDb, BOOKINGS_COLLECTION_NAME);
  const getDocumentReference = (bookingId) =>
    adapter.doc(collectionReference, normalizeBookingId(bookingId));

  return Object.freeze({
    collectionName: BOOKINGS_COLLECTION_NAME,
    conflictQueryLimit: BOOKING_CONFLICT_QUERY_LIMIT,

    async getBooking(bookingId) {
      return decodeSnapshot(await adapter.getDoc(getDocumentReference(bookingId)));
    },

    async findBookingConflicts({ endAt, excludeBookingId = null, startAt, studioId }) {
      const window = normalizeConflictWindow({ endAt, startAt, studioId });
      if (window.studioId === null) return Object.freeze([]);

      const excludedId =
        excludeBookingId === null ? null : normalizeBookingId(excludeBookingId);
      const conflictQuery = adapter.query(
        collectionReference,
        adapter.where('studioId', '==', window.studioId),
        adapter.where('startAt', '<', window.endAt),
        adapter.orderBy('startAt', 'asc'),
        adapter.limit(BOOKING_CONFLICT_QUERY_LIMIT),
      );
      const snapshot = await adapter.getDocs(conflictQuery);

      if (snapshot.docs.length >= BOOKING_CONFLICT_QUERY_LIMIT) {
        throw new BookingConflictQuerySaturationError();
      }

      const conflicts = decodeQuerySnapshot(snapshot)
        .filter((booking) => booking.id !== excludedId)
        .filter((booking) => booking.studioId === window.studioId)
        .filter(isConflictRelevantBooking)
        .filter((booking) => booking.endAt > window.startAt)
        .sort((left, right) => left.startAt - right.startAt || left.id.localeCompare(right.id));

      return Object.freeze(conflicts);
    },
  });
}

export const bookingRepository = createBookingRepository();
