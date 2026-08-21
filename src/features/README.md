# Feature Modules

Studio37 uses feature-oriented modules. Each business domain owns its React UI, hooks, domain helpers, and feature-specific services as the implementation grows.

Planned domains from PRD-01 include auth, dashboard, booking, calendar, customers, pricing, payments, commissions, bookkeeping, settings, operators, and audit.

Cross-feature primitives belong in `src/components`, shared infrastructure belongs in `src/lib`, and persistence access belongs behind repository/service modules rather than directly inside JSX components.
