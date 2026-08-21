# Phase 2 Handoff — Firebase Setup Input

> Status: **Saved for Phase 2. Not implemented yet.**
>
> This document records the Firebase Web App configuration supplied by the project owner so Phase 2 can wire Firebase deliberately without relying on chat history.

## Firebase Project

- Project ID: `studio37webapp`
- Auth domain: `studio37webapp.firebaseapp.com`
- Storage bucket: `studio37webapp.firebasestorage.app`
- Messaging sender ID: `1057595609578`
- App ID: `1:1057595609578:web:13d717ba53055d6427a293`
- Analytics measurement ID: `G-5R148SLG0R`

## Firebase Web Configuration Supplied by Owner

```js
// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: 'AIzaSyAxxMF62vEXXY_Vv0dsYpHXq0_w5252y_w',
  authDomain: 'studio37webapp.firebaseapp.com',
  projectId: 'studio37webapp',
  storageBucket: 'studio37webapp.firebasestorage.app',
  messagingSenderId: '1057595609578',
  appId: '1:1057595609578:web:13d717ba53055d6427a293',
  measurementId: 'G-5R148SLG0R',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
```

## Intended Phase 2 Integration

During **PRD-18 Phase 2 — Firebase & Data Foundation**, use the supplied project configuration to implement:

- Firebase client SDK installation.
- `initializeApp` boundary under `src/lib/firebase/`.
- Firebase Authentication initialization.
- Cloud Firestore initialization.
- Analytics only when appropriate for the browser/runtime.
- Development/prod environment mapping through Vite `VITE_*` variables rather than duplicating configuration throughout feature code.
- Emulator/dev strategy where practical.

The existing Phase 0 Firebase config boundary should be adapted rather than bypassed.

## Security Note

Firebase Web App configuration values are client-side identifiers, not service-account credentials. Application authorization and data protection must still be enforced through Firebase Authentication, Firestore Security Rules, and the permission model defined in the PRDs.

Do **not** place Firebase Admin SDK private keys, service-account JSON, private API credentials, or other server secrets in this repository.

## Firebase Hosting Input — Save for Deployment Phase

The owner also supplied this Firebase Hosting site identifier:

```json
{
  "hosting": {
    "site": "studio37os",
    "public": "public"
  }
}
```

Record the hosting site as:

- Firebase Hosting site: `studio37os`

Do not apply the supplied `public: "public"` value blindly. This project is a Vite application and the production build output is expected to be `dist/`; the final `firebase.json` must be validated during the production Firebase/hosting phase.

Likely final SPA hosting configuration will need a rewrite to `/index.html`, but that decision belongs to the deployment phase after the production build and Firebase project are verified.

## Implementation Guardrail

This handoff is informational only until Phase 2 starts. Do not mark any Phase 2 checklist item complete solely because this configuration has been recorded.
