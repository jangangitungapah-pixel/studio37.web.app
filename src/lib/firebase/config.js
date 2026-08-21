const readEnvironmentValue = (key, fallback = '') => import.meta.env[key] ?? fallback;

export const appEnvironment = readEnvironmentValue('VITE_APP_ENV', 'development');

export const firebaseClientConfig = Object.freeze({
  apiKey: readEnvironmentValue('VITE_FIREBASE_API_KEY'),
  authDomain: readEnvironmentValue('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: readEnvironmentValue('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: readEnvironmentValue('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: readEnvironmentValue('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: readEnvironmentValue('VITE_FIREBASE_APP_ID'),
});

export const useFirebaseEmulators =
  readEnvironmentValue('VITE_USE_FIREBASE_EMULATORS', 'false').toLowerCase() === 'true';

export const isProductionEnvironment = appEnvironment === 'production';

export function hasFirebaseClientConfiguration() {
  return Object.values(firebaseClientConfig).every(Boolean);
}
