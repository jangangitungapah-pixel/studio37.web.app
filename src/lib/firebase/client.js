import { getAnalytics, isSupported as isAnalyticsSupported } from 'firebase/analytics';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

import {
  firebaseClientConfig,
  getFirebaseProjectSummary,
  hasFirebaseClientConfiguration,
  isProductionEnvironment,
} from './config.js';

function getOrCreateFirebaseApp() {
  if (!hasFirebaseClientConfiguration()) {
    return null;
  }

  return getApps().length ? getApp() : initializeApp(firebaseClientConfig);
}

export const firebaseApp = getOrCreateFirebaseApp();
export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
export const firestoreDb = firebaseApp ? getFirestore(firebaseApp) : null;

let analyticsPromise = null;

export function getFirebaseClientStatus() {
  const project = getFirebaseProjectSummary();

  return Object.freeze({
    ...project,
    appInitialized: Boolean(firebaseApp),
    authInitialized: Boolean(firebaseAuth),
    firestoreInitialized: Boolean(firestoreDb),
    analyticsEligible: Boolean(
      firebaseApp && firebaseClientConfig.measurementId && isProductionEnvironment,
    ),
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
