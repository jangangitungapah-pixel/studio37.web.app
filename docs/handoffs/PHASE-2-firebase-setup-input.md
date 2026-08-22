# Phase 2 Handoff — Firebase Setup Input

> Status: **Phase 2 started. Phase 2A uses this input for Firebase client foundation.**
>
> This document records the Firebase Web App configuration supplied by the project owner so implementation does not rely on chat history.

## Firebase Project

- Project ID: `studio37webapp`
- Auth domain: `studio37webapp.firebaseapp.com`
- Storage bucket: `studio37webapp.firebasestorage.app`
- Messaging sender ID: `1057595609578`
- App ID: `1:1057595609578:web:13d717ba53055d6427a293`
- Analytics measurement ID: `G-5R148SLG0R`
- Firestore edition: **Standard Edition**

## Firebase Web Configuration Supplied by Owner

```js
const firebaseConfig = {
  apiKey: 'AIzaSyAxxMF62vEXXY_Vv0dsYpHXq0_w5252y_w',
  authDomain: 'studio37webapp.firebaseapp.com',
  projectId: 'studio37webapp',
  storageBucket: 'studio37webapp.firebasestorage.app',
  messagingSenderId: '1057595609578',
  appId: '1:1057595609578:web:13d717ba53055d6427a293',
  measurementId: 'G-5R148SLG0R',
};
```

## Phase 2 Integration

Phase 2 should implement:

- Firebase client SDK installation.
- `initializeApp` boundary under `src/lib/firebase/`.
- Firebase Authentication initialization.
- Cloud Firestore initialization.
- Analytics only when appropriate for the browser/runtime.
- Development/prod environment mapping through Vite `VITE_*` overrides.
- Emulator/dev strategy where practical.
- Repository/service layer and core data utilities in later Phase 2 slices.

## Security Note

Firebase Web App configuration values are client-side identifiers, not service-account credentials. Application authorization and data protection must still be enforced through Firebase Authentication, Firestore Security Rules, and the permission model defined in the PRDs.

Do **not** place Firebase Admin SDK private keys, service-account JSON, private API credentials, or other server secrets in this repository.

## Firebase Hosting Input — Save for Deployment Phase

Firebase Hosting site:

- `studio37os`

The originally supplied hosting snippet used `public: "public"`. Do not apply that value blindly: this Vite app is expected to build into `dist/`, and final SPA rewrites must be validated during Phase 17.
