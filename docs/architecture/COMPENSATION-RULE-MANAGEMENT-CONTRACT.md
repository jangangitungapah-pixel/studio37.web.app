# Compensation Rule Management Contract

## Status

Phase 6B management foundation for the Owner compensation-rule control plane. This slice builds on the Phase 6A2 Owner-only `compensationRules` persistence boundary and does not implement compensation calculation, winner resolution, booking integration, commission entries, payout settlement, manual adjustments, or a complete management page.

## Purpose

The management layer answers: **how can an Owner safely review and administer the bounded compensation-rule table?**

It does not answer: **which rule wins for a booking or how much compensation is earned?** Those remain calculation-engine responsibilities.

## Access boundary

Raw compensation rules remain sensitive Owner-only operational/financial configuration.

Phase 6B does not broaden Firestore authorization. Studio Operators remain unable to read or mutate `compensationRules`, including operators with delegated commission-oriented capabilities.

A future UI must keep route/action access Owner-only and must not treat client-side filtering as an authorization mechanism.

## Read model

The management service consumes only the existing Phase 6A2 repository operation:

- `listCompensationRulesWithDiagnostics()`

That repository performs one bounded `priority desc + limit(200)` Firestore query. Phase 6B adds no second query, listener, collection scan, or composite-index requirement.

After the bounded list is loaded, the management projection may filter in memory by:

- status
- operator type
- compensation model
- exact operator reference
- exact session-type reference
- exact studio reference
- case-insensitive rule name/document-ID search

Visible rows retain the canonical compensation-rule ordering.

## Management summary

The pure management projection exposes counts for the currently visible result set:

- total rules
- active vs disabled
- count by compensation model
- count by operator type
- exact-operator-scoped count
- session-type-scoped count
- studio-scoped count

These are administrative configuration counts only. They are not monetary earnings, booking totals, commission totals, or payout totals.

## Corrupt/legacy rows

The Phase 6A2 repository can skip malformed rows while exposing diagnostics. Phase 6B preserves those diagnostics separately from visible valid rules so an Owner-facing UI can surface a data-integrity warning without rendering malformed configuration as if it were valid.

## Write orchestration

The management service is intentionally thin. It delegates only to the focused Phase 6A2 repository operations:

- create rule
- update rule details
- soft activate/deactivate rule

Actor UID context is forwarded to the repository; Firestore remains authoritative for Owner authorization, exact schema/reference validation, server-time metadata, creation-history preservation, and hard-delete denial.

The management service exposes no hard delete and no generic Firestore write primitive.

## UI boundary

`FeesCommissionsPage` remains a foundation placeholder in this slice.

Do not replace it with a seemingly complete Fee & Commission page until the user workflow is actually complete. A later UI slice may consume this management service for rule administration, but PRD-08 commission-entry review/settlement must not be faked from rule configuration data.

## Explicit non-goals

- no compensation arithmetic
- no partial-hour rounding semantics
- no deterministic rule winner/resolver
- no ambiguity resolution
- no booking compensation snapshot
- no `pending | earned | paid | void` commission entries
- no payout settlement
- no manual adjustment records
- no bookkeeping expense integration
- no daily/shift allowance approximation
- no customer-pricing mutation
- no new Firestore collection or index

## Acceptance for this slice

- management filters normalize and reject unsupported enum values
- filtered results preserve canonical rule ordering
- summary counts are based on the visible result set
- malformed-row diagnostics survive management projection
- management service performs one bounded repository load
- create/update/status writes delegate only through the existing focused repository
- no UI or authorization broadening is introduced
