import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import {
  executeTrustedBookingCompensation,
  TrustedBookingCompensationError,
} from './trustedBookingCompensationCore.js';
import { createTrustedBookingCompensationFirestoreGateway } from './trustedBookingCompensationFirestoreGateway.js';

if (getApps().length === 0) {
  initializeApp({ credential: applicationDefault() });
}

const db = getFirestore();
const gateway = createTrustedBookingCompensationFirestoreGateway({
  db,
  serverTimestamp: () => FieldValue.serverTimestamp(),
});

function toHttpsError(error) {
  if (error instanceof TrustedBookingCompensationError) {
    return new HttpsError(error.code, error.message);
  }

  console.error('Trusted booking compensation execution failed.', error);
  return new HttpsError('internal', 'Trusted booking compensation execution failed.');
}

export const initializeBookingCompensation = onCall(
  {
    region: 'asia-southeast2',
    enforceAppCheck: false,
  },
  async (request) => {
    try {
      return await executeTrustedBookingCompensation(
        {
          auth: request.auth,
          data: request.data,
        },
        { gateway },
      );
    } catch (error) {
      throw toHttpsError(error);
    }
  },
);
