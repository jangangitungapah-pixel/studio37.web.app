import { doc, getDocFromServer } from 'firebase/firestore';

import { firestoreDb } from './client.js';

const defaultConnectivityAdapter = Object.freeze({
  doc,
  getDocFromServer,
});

export const FIRESTORE_CONNECTIVITY_PROBE_PATH = Object.freeze({
  collection: 'studio37System',
  document: 'connectivity-probe',
});

const reachableAuthorizationCodes = new Set(['permission-denied', 'unauthenticated']);

function normalizeErrorCode(error) {
  if (typeof error?.code !== 'string') {
    return 'unknown';
  }

  return error.code.replace(/^firestore\//, '');
}

export async function probeFirestoreConnectivity({
  adapter = defaultConnectivityAdapter,
  db = firestoreDb,
} = {}) {
  if (!db) {
    return Object.freeze({
      authorized: null,
      code: 'missing-firestore-client',
      documentExists: null,
      reachable: false,
      state: 'misconfigured',
    });
  }

  try {
    const probeRef = adapter.doc(
      db,
      FIRESTORE_CONNECTIVITY_PROBE_PATH.collection,
      FIRESTORE_CONNECTIVITY_PROBE_PATH.document,
    );
    const snapshot = await adapter.getDocFromServer(probeRef);

    return Object.freeze({
      authorized: true,
      code: null,
      documentExists: snapshot.exists(),
      reachable: true,
      state: 'connected',
    });
  } catch (error) {
    const code = normalizeErrorCode(error);

    if (reachableAuthorizationCodes.has(code)) {
      return Object.freeze({
        authorized: false,
        code,
        documentExists: null,
        reachable: true,
        state: 'reachable-but-denied',
      });
    }

    return Object.freeze({
      authorized: null,
      code,
      documentExists: null,
      reachable: false,
      state: 'unavailable',
    });
  }
}
