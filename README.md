# Studio37 Management Web App

Studio37 is a React/Vite management application for music-studio booking, flexible pricing, operator fee/commission tracking, payments, bookkeeping, and configurable studio operations.

## Current implementation status

Development is executed phase-by-phase from `docs/prd/PRD-18-development-workplan.md`.

Current implementation branch: **Phase 0 — Repository & Quality Foundation**.

Phase 0 intentionally provides architecture and quality foundations only. Business features are added in later phases after their requirements and gates are ready.

## Stack foundation

- React
- Vite
- JavaScript / JSX / CSS
- Tailwind CSS
- React Router
- Vitest + Testing Library
- ESLint + Prettier
- Firebase configuration boundary (SDK integration begins in Phase 2)

## Local development

```bash
npm install
npm run dev
```

## Quality gates

```bash
npm run format:check
npm run lint
npm test
npm run build
```

The GitHub Actions quality workflow runs the same baseline checks on implementation pushes and pull requests.

## Environment

Copy `.env.example` to `.env.local` for local environment values. Never commit service-account credentials or private secrets. Firebase public web-client configuration is wired in later phases.

## Product documentation

See `docs/prd/INDEX.md` for the PRD set and `docs/prd/PRD-18-development-workplan.md` for implementation progress.
