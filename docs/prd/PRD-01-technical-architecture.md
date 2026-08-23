# PRD-01 — Technical Architecture & Project Structure

## 1. Objective

Define a maintainable React/Vite architecture for Studio37 that stays simple enough for development velocity while keeping business logic isolated from UI components.

## 2. Required Stack

- React
- Vite
- JavaScript
- JSX
- CSS
- Tailwind CSS
- Firebase Authentication
- Cloud Firestore
- Firebase Hosting later in the project
- Firebase Spark Plan as the initial infrastructure constraint

Next.js is intentionally excluded.

## 3. Architectural Principles

1. Feature-oriented organization instead of one giant components folder.
2. Business calculations live outside JSX rendering code.
3. Firebase access is wrapped in dedicated service/repository modules.
4. UI components do not directly encode pricing, commission, or permission rules.
5. Shared UI primitives are reusable and consistent.
6. Route authorization and feature authorization are separate concerns.
7. Money calculations use integer IDR amounts.
8. Date/time conversion is centralized.
9. Configuration is explicit and validated.
10. Avoid dependencies unless they clearly reduce complexity.

## 4. Recommended Project Structure

```text
src/
  app/
    App.jsx
    router.jsx
    providers/
    layouts/
  assets/
  components/
    ui/
    feedback/
    forms/
    navigation/
  features/
    auth/
    dashboard/
    booking/
    calendar/
    customers/
    pricing/
    payments/
    commissions/
    bookkeeping/
    settings/
    operators/
    audit/
  hooks/
  lib/
    firebase/
    money/
    datetime/
    validation/
  services/
  styles/
  utils/
  constants/
  main.jsx
```

A feature may contain:

```text
features/booking/
  components/
  hooks/
  services/
  utils/
  booking.constants.js
  booking.validation.js
  booking.calculations.js
```

The exact folders may evolve, but dependency direction should remain clean.

## 5. Layer Responsibilities

### Presentation Layer

React pages/components. Responsible for rendering, collecting input, showing loading/error states, and invoking domain/application functions.

### Domain/Application Logic

Pure or mostly pure JavaScript functions for pricing calculations, booking conflict evaluation, payment balance calculation, commission calculation, permissions, and validation.

### Data Access Layer

Dedicated Firestore modules for reads/writes. Components should not scatter `getDoc`, `setDoc`, and query construction throughout the UI.

### Infrastructure Layer

Firebase initialization, environment values, logging adapters, and external integrations.

## 6. Routing

Recommended route groups:

- `/login`
- `/dashboard`
- `/calendar`
- `/bookings/:bookingId`
- `/fees-commissions`
- `/bookkeeping`
- `/settings/account`
- `/settings/studio`
- `/settings/pricing`
- `/settings/operators`
- `/settings/danger-zone`

Optional customer routes can be exposed when the customer module becomes a first-class page.

## 7. State Management

Prefer the lightest appropriate mechanism:

- Local component state for isolated UI state.
- Context for app-wide session/theme/config data with limited update frequency.
- Custom hooks for reusable asynchronous feature state.
- Avoid introducing a heavy global state library until concrete complexity justifies it.

Firestore remains the source of persisted business state.

## 8. Firebase Boundary

Recommended modules:

```text
src/lib/firebase/firebase.js
src/lib/firebase/auth.js
src/lib/firebase/firestore.js
src/services/bookingRepository.js
src/services/pricingRepository.js
src/services/paymentRepository.js
src/services/operatorRepository.js
```

Firebase SDK calls should be concentrated in repositories/services to improve testability and future migration options.

## 9. Environment Configuration

Use Vite environment variables for Firebase public client configuration and environment-specific settings. Never commit secrets, service-account keys, or admin credentials.

Expected patterns:

- `.env.example` committed
- `.env.local` ignored
- Vite variables prefixed with `VITE_`
- Separate emulator/dev/prod configuration where useful

## 10. Error Handling

The app must distinguish:

- Validation error
- Permission error
- Booking conflict
- Firebase/network failure
- Missing configuration
- Calculation/configuration error
- Unexpected application error

User-facing messages should be actionable; low-level Firebase details should not leak into normal UI.

## 11. Validation

Validation is required at multiple layers:

- UI form validation for usability
- Domain validation before calculations/writes
- Firebase Security Rules for authorization and trusted field constraints

Client-side validation alone is not a security boundary.

## 12. Styling Architecture

Tailwind CSS may be used for layout and utility styling, supported by project CSS for complex calendar behavior, reusable tokens, and components where utility-only markup becomes difficult to maintain.

Define consistent design tokens for:

- spacing
- typography
- radii
- elevation
- status semantics
- responsive breakpoints
- light/dark surfaces if theme support is included

## 13. Dependency Rules

- Feature A should not import internal implementation files from Feature B unnecessarily.
- Shared domain utilities should be moved to a neutral shared module when genuinely shared.
- UI primitives must not import feature business logic.
- Firebase repositories must not import React components.

## 14. Testing Architecture

Recommended layers:

- Unit tests for calculations and validation
- React component tests for interactive workflows
- Firebase Rules/emulator tests for authorization
- Integration tests for repositories where practical
- End-to-end smoke tests for critical workflows

Tool selection is finalized during project setup but should remain Vite/React friendly.

## 15. Quality Commands

The project should eventually expose predictable scripts such as:

```text
npm run dev
npm run lint
npm run test
npm run build
npm run test:rules
npm run test:e2e
```

Exact commands may vary, but lint/test/build gates must become part of the implementation workplan.

## 16. Acceptance Criteria

- Vite React app can run without Next.js or server framework dependency.
- Feature/domain boundaries are visible in the folder structure.
- Pricing and commission logic can be tested without rendering React.
- Firebase calls are centralized in repository/service modules.
- Authentication and authorization concerns have explicit modules.
- Environment configuration is safe for source control.
- Project structure supports future pages without growing a monolithic `App.jsx`.
