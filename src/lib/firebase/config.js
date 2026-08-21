const studio37FirebaseProjectDefaults = Object.freeze({
  apiKey: 'AIzaSyAxxMF62vEXXY_Vv0dsYpHXq0_w5252y_w',
  authDomain: 'studio37webapp.firebaseapp.com',
  projectId: 'studio37webapp',
  storageBucket: 'studio37webapp.firebasestorage.app',
  messagingSenderId: '1057595609578',
  appId: '1:1057595609578:web:13d717ba53055d6427a293',
  measurementId: 'G-5R148SLG0R',
});

const readEnvironmentValue = (key, fallback = '') => import.meta.env[key] ?? fallback;

export const appEnvironment = readEnvironmentValue('VITE_APP_ENV', 'development');

export const firebaseClientConfig = Object.freeze({
  apiKey: readEnvironmentValue('VITE_FIREBASE_API_KEY', studio37FirebaseProjectDefaults.apiKey),
  authDomain: readEnvironmentValue(
    'VITE_FIREBASE_AUTH_DOMAIN',
    studio37FirebaseProjectDefaults.authDomain,
  ),
  projectId: readEnvironmentValue('VITE_FIREBASE_PROJECT_ID', studio37FirebaseProjectDefaults.projectId),
  storageBucket: readEnvironmentValue(
    'VITE_FIREBASE_STORAGE_BUCKET',
    studio37FirebaseProjectDefaults.storageBucket,
  ),
  messagingSenderId: readEnvironmentValue(
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    studio37FirebaseProjectDefaults.messagingSenderId,
  ),
  appId: readEnvironmentValue('VITE_FIREBASE_APP_ID', studio37FirebaseProjectDefaults.appId),
  measurementId: readEnvironmentValue(
    'VITE_FIREBASE_MEASUREMENT_ID',
    studio37FirebaseProjectDefaults.measurementId,
  ),
});

export const useFirebaseEmulators =
  readEnvironmentValue('VITE_USE_FIREBASE_EMULATORS', 'false').toLowerCase() === 'true';

export const isProductionEnvironment = appEnvironment === 'production';

export function hasFirebaseClientConfiguration() {
  const requiredKeys = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId',
  ];

  return requiredKeys.every((key) => Boolean(firebaseClientConfig[key]));
}

export function getFirebaseProjectSummary() {
  return Object.freeze({
    appEnvironment,
    authDomain: firebaseClientConfig.authDomain,
    configured: hasFirebaseClientConfiguration(),
    projectId: firebaseClientConfig.projectId,
    useFirebaseEmulators,
  });
}
