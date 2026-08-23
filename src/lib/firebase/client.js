import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

import {
  firebaseClientConfig,
  firebaseEmulatorConfig,
  getFirebaseProjectSummary,
  hasFirebaseClientConfiguration,
  isProductionEnvironment,
  shouldUseFirebaseEmulators,
} from './config.js';

const emulatorStateKey = Symbol.for('studio37.firebase.emulator-state');

function getOrCreateFirebaseApp() {
  if (!hasFirebaseClientConfiguration()) {
    return null;
  }

  return getApps().length ? getApp() : initializeApp(firebaseClientConfig);
}

export const firebaseApp = getOrCreateFirebaseApp();
export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
export const firestoreDb = firebaseApp ? getFirestore(firebaseApp) : null;

function connectFirebaseEmulators() {
  if (!shouldUseFirebaseEmulators || !firebaseAuth || !firestoreDb) {
    return false;
  }

  const emulatorState = globalThis[emulatorStateKey] ?? { connected: false };

  if (!emulatorState.connected) {
    connectAuthEmulator(
      firebaseAuth,
      `http://${firebaseEmulatorConfig.host}:${firebaseEmulatorConfig.authPort}`,
      { disableWarnings: true },
    );
    connectFirestoreEmulator(
      firestoreDb,
      firebaseEmulatorConfig.host,
      firebaseEmulatorConfig.firestorePort,
    );
    emulatorState.connected = true;
    globalThis[emulatorStateKey] = emulatorState;
  }

  return true;
}

export const firebaseEmulatorsConnected = connectFirebaseEmulators();

let analyticsPromise = null;

export function getFirebaseClientStatus() {
  const project = getFirebaseProjectSummary();

  return Object.freeze({
    ...project,
    analyticsEligible: Boolean(
      firebaseApp && firebaseClientConfig.measurementId && isProductionEnvironment,
    ),
    appInitialized: Boolean(firebaseApp),
    authInitialized: Boolean(firebaseAuth),
    emulatorsConnected: firebaseEmulatorsConnected,
    firestoreInitialized: Boolean(firestoreDb),
  });
}

export async function initializeFirebaseAnalytics() {
  if (!firebaseApp || !firebaseClientConfig.measurementId || !isProductionEnvironment) {
    return null;
  }

  if (!analyticsPromise) {
    analyticsPromise = isAnalyticsSupported()
      .then((supported) => (supported ? getAnalytics(firebaseApp) : null))
      .catch(() => null);
  }

  return analyticsPromise;
}
