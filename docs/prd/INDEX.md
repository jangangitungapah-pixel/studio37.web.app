# Studio37 PRD Index

This directory is the source of truth for Studio37 Management Web App product and engineering requirements.

## Document order

- [PRD-00 — Master Product Requirements](./PRD-00-master-product-requirements.md)
- [PRD-01 — Technical Architecture & Project Structure](./PRD-01-technical-architecture.md)
- [PRD-02 — Data Model & Firestore Architecture](./PRD-02-firestore-data-model.md)
- [PRD-03 — Authentication, Roles & Permissions](./PRD-03-auth-roles-permissions.md)
- [PRD-04 — Dashboard](./PRD-04-dashboard.md)
- [PRD-05 — Booking & Calendar System](./PRD-05-booking-calendar.md)
- [PRD-06 — Flexible Pricing & Session Engine](./PRD-06-pricing-session-engine.md)
- [PRD-07 — Operator Fee & Commission Engine](./PRD-07-fee-commission-engine.md)
- [PRD-08 — Fee & Commission Management](./PRD-08-fee-commission-management.md)
- [PRD-09 — Payments & Booking Financials](./PRD-09-payments-booking-financials.md)
- [PRD-10 — Bookkeeping / Studio Ledger](./PRD-10-bookkeeping-ledger.md)
- [PRD-11 — Settings & Studio Configuration](./PRD-11-settings.md)
- [PRD-12 — Customer Management](./PRD-12-customer-management.md)
- [PRD-13 — Activity Log & Audit Trail](./PRD-13-audit-trail.md)
- [PRD-14 — UI/UX Design System & Responsive Experience](./PRD-14-ui-ux-design-system.md)
- [PRD-15 — User Flow, Wireframe & Interaction Specification](./PRD-15-user-flow-wireframe.md)
- [PRD-16 — Firebase Security & Data Integrity](./PRD-16-firebase-security.md)
- [PRD-17 — Testing, QA & Acceptance Criteria](./PRD-17-testing-qa.md)
- [PRD-18 — Development Roadmap & Implementation Workplan](./PRD-18-development-workplan.md)

## Core dependency order

`Studio Configuration -> Session/Pricing Engine -> Booking -> Payments -> Fee/Commission -> Ledger -> Dashboard`

Authentication, permissions, security rules, audit trail, UI/UX, and QA apply across all domains.

## Product principle

Avoid hardcoded business assumptions where the studio may change policy later. Pricing, session duration, operator commission, active studio rooms, permissions, and operational settings should be configuration-driven wherever practical.
