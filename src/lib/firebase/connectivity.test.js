import { describe, expect, it } from 'vitest';

import { probeFirestoreConnectivity } from './connectivity.js';

function createAdapter({ exists = false, error = null } = {}) {
  return {
    doc: (_db, collectionName, documentId) => ({ collectionName, documentId }),
    getDocFromServer: async () => {
      if (error) {
        throw error;
      }

      return {
        exists: () => exists,
      };
    },
  };
}

describe('probeFirestoreConnectivity', () => {
  it('reports a successful server response without requiring the probe document to exist', async () => {
    const result = await probeFirestoreConnectivity({
      adapter: createAdapter({ exists: false }),
      db: {},
    });

    expect(result).toEqual({
      authorized: true,
      code: null,
      documentExists: false,
      reachable: true,
      state: 'connected',
    });
  });

  it('treats permission denial as proof that the configured Firestore backend is reachable', async () => {
    const result = await probeFirestoreConnectivity({
      adapter: createAdapter({
        error: { code: 'firestore/permission-denied' },
      }),
      db: {},
    });

    expect(result.reachable).toBe(true);
    expect(result.authorized).toBe(false);
    expect(result.state).toBe('reachable-but-denied');
  });

  it('reports a missing Firestore client without attempting a request', async () => {
    const result = await probeFirestoreConnectivity({
      adapter: createAdapter(),
      db: null,
    });

    expect(result.state).toBe('misconfigured');
    expect(result.reachable).toBe(false);
  });
});
