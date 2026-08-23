import { describe, expect, it } from 'vitest';

import firebaseConfig from '../../../firebase.json';
import firestoreIndexes from '../../../firestore.indexes.json';

describe('Firestore index registry foundation', () => {
  it('links Firebase configuration to the source-controlled index manifest', () => {
    expect(firebaseConfig.firestore.indexes).toBe('firestore.indexes.json');
  });

  it('retains no speculative composite indexes or field overrides', () => {
    expect(firestoreIndexes).toEqual({
      fieldOverrides: [],
      indexes: [],
    });
  });
});
