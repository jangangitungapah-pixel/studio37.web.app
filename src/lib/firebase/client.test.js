import { describe, expect, it } from 'vitest';

import { firebaseClientConfig } from './config.js';
import {
  firebaseApp,
  firebaseAuth,
  firestoreDb,
  getFirebaseClientStatus,
  initializeFirebaseAnalytics,
} from './client.js';

describe('Firebase client foundation', () => {
  it('uses the Studio37 Firebase development project by default', () => {
    expect(firebaseClientConfig.projectId).toBe('studio37webapp');
    expect(firebaseClientConfig.authDomain).toBe('studio37webapp.firebaseapp.com');
    expect(firebaseClientConfig.appId).toBe('1:1057595609578:web:13d717ba53055d6427a293');
  });

  it('initializes one Firebase app with Auth and Firestore clients', () => {
    expect(firebaseApp).not.toBeNull();
    expect(firebaseApp.options.projectId).toBe('studio37webapp');
    expect(firebaseAuth).not.toBeNull();
    expect(firestoreDb).not.toBeNull();

    expect(getFirebaseClientStatus()).toMatchObject({
      appEnvironment: 'development',
      appInitialized: true,
      authInitialized: true,
      configured: true,
      firestoreInitialized: true,
      projectId: 'studio37webapp',
      useFirebaseEmulators: false,
    });
  });

  it('does not enable Analytics in the development environment', async () => {
    await expect(initializeFirebaseAnalytics()).resolves.toBeNull();
  });
});
