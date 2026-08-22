# Firebase Development Strategy

## Purpose

Define how Studio37 uses the real Firebase development project and the Firebase Emulator Suite without mixing development, emulator, and future production behavior.

## Development project

The current development project is:

- Project ID: `studio37webapp`
- Firestore edition: Standard
- Firebase Authentication: client initialized
- Cloud Firestore: client initialized

Firebase Web App configuration is public client configuration. Service-account credentials, Admin SDK private keys, or other server secrets must never be added to the repository.

## Default mode

Normal local development uses the real `studio37webapp` development project with:

```env
VITE_USE_FIREBASE_EMULATORS=false
```

The application does not perform a connectivity probe automatically. The development-only `/dev/firebase` page contains a manual probe so Firestore reads are not spent on every page load.

## Emulator mode

The repository defines local emulator ports in `firebase.json`:

- Authentication: `127.0.0.1:9099`
- Firestore: `127.0.0.1:8080`
- Emulator UI: `127.0.0.1:4000`

Enable client routing in `.env.local`:

```env
VITE_USE_FIREBASE_EMULATORS=true
VITE_FIREBASE_EMULATOR_HOST=127.0.0.1
VITE_FIREBASE_AUTH_EMULATOR_PORT=9099
VITE_FIRESTORE_EMULATOR_PORT=8080
```

Then start the emulators and app in separate terminals:

```powershell
npm run firebase:emulators
npm run dev
```

The Firebase CLI may download tooling through `npx`; Firestore Emulator also requires the Firebase CLI's supported local Java runtime prerequisites.

## Safety rules

1. Emulator routing is ignored when `VITE_APP_ENV=production`.
2. Switching emulator mode requires restarting the Vite dev server.
3. The emulator is disposable local state unless an explicit import/export workflow is added later.
4. Production Hosting configuration remains deferred to Phase 17.
5. Firestore Security Rules are implemented and tested in Phase 3; Phase 2 does not treat client configuration as authorization.

## Data-access convention

React components must not scatter Firebase SDK reads and writes.

The shared document repository foundation provides focused operations:

- `getById`
- `setById`
- `updateById`

It intentionally does **not** provide a generic `listAll()` method. Feature repositories own their query shapes, filters, limits, ordering, and index requirements. This keeps Firestore reads predictable for the Spark Plan and prevents accidental full-collection reads.

Feature/domain repositories may wrap the shared document repository, for example:

```text
src/services/studioRepository.js
src/services/customerRepository.js
src/services/bookingRepository.js
```

Business calculations and authorization decisions do not belong inside the shared Firestore repository.

## Connectivity probe semantics

The manual development probe performs one server document read attempt against the legal non-reserved path:

```text
studio37System/connectivity-probe
```

No document needs to exist and the probe never writes data.

A previous implementation used `__studio37_system__/connectivity-probe`, which Firestore rejected with `invalid-argument` because identifiers matching `__.*__` are reserved. That implementation was replaced and a regression test now protects the legal probe path.

A successful empty read proves Firestore is reachable. A `permission-denied` or `unauthenticated` response also proves the configured backend is reachable, while correctly showing that authorization has not yet been granted. Other errors remain failures until investigated.
