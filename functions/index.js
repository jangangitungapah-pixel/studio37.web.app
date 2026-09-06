import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import {
  classifyTrustedBookingCompensationError,
  createFirebaseBookingCompensationRuntime,
  normalizeCallableBookingCompensationRequest,
} from './bookingCompensationRuntime.js';

if (getApps().length === 0) {
  initializeApp();
}

const runtime = createFirebaseBookingCompensationRuntime({
  db: getFirestore(),
  timestampFactory: () => FieldValue.serverTimestamp(),
});

function toHttpsError(error) {
  const classified = classifyTrustedBookingCompensationError(error);
  return new HttpsError(classified.code, classified.message);
}

export const initializeBookingCompensation = onCall(
  {
    region: 'asia-southeast2',
    timeoutSeconds: 30,
    memory: '256MiB',
    maxInstances: 10,
  },
  async (request) => {
    const actorUid = request.auth?.uid;
    if (!actorUid) {
      throw new HttpsError('unauthenticated', 'Authentication is required.');
    }

    let callableData;
    try {
      callableData = normalizeCallableBookingCompensationRequest(request.data);
    } catch {
      throw new HttpsError('invalid-argument', 'Request must contain only a valid bookingId.');
    }

    try {
      return await runtime.execute({
        actorUid,
        bookingId: callableData.bookingId,
      });
    } catch (error) {
      throw toHttpsError(error);
    }
  },
);
