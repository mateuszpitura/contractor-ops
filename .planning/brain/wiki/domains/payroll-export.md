---
title: Payroll export adapters (per-market payroll integration)
type: domain
tags: [payroll, export, csv, xml, datev, rti, symfonia, gusto, quickbooks, feature-flags, pii, audit, i18n]
source_commit: 13abc6a56
verify_with:
  - packages/payroll/src/types/profile.ts
  - packages/payroll/src/types/feed.ts
  - packages/payroll/src/registry.ts
  - packages/payroll/src/engine/engine.ts
  - packages/api/src/services/payroll-feed.ts
  - packages/api/src/services/register-payroll-profiles.ts
  - packages/api/src/routers/workforce/payroll-export-router.ts
  - packages/integrations/src/adapters/gusto-adapter.ts
  - packages/integrations/src/adapters/quickbooks-adapter.ts
  - apps/web-vite/src/components/payroll/hooks/use-payroll-export.ts
updated: 2026-07-05
---

# Payroll export adapters (per-market payroll integration)

## Purpose

HR exports employee master data to the incumbent payroll system in each market —
**adapters only, never an own payroll engine**. The export is a join of three
already-shipped models (`Worker` + `EmployeeProfile` + `PersonnelFile`), masked to
last-4 national IDs, transformed into each vendor's file/format. The incumbent system
computes gross→net and files; these exports carry master data (hire/termination dates,
tax class/code, gross rate, statutory IDs). The whole surface is dark behind
`module.workforce-employees` plus a per-adapter `payroll.*` flag.

`packages/payroll` is a structural clone of `packages/einvoice`'s profile-registry engine
(`PayrollExportProfile` interface + `PayrollFeed` DTO + registry + engine) — **not** the
payment-run bank-file factory (`_generateExportFileForFormat` / `PaymentExportFormat`),
which is a separate lifecycle.

## Flow

1. HR opens the payroll export surface (`/{locale}/dashboard/payroll-export`, dark until
   `module.workforce-employees`). `payrollExport.listTargets` returns the registered
   targets, each annotated with the org's per-adapter `payroll.*` flag state.
2. HR enters worker IDs and picks a target. `payrollExport.export` (`.strict()` input)
   runs `assertWorkforceEnabled` + the per-target `evaluate(payroll.*)` FORBIDDEN gate,
   builds the PII-masked `PayrollFeed` via `buildPayrollFeed` (org-scoped), then
   `engine.generate(targetId, feed)`.
3. `writeAuditLog('payroll.export', resourceType:'EMPLOYEE')` records target + employee
   count; the file returns as `fileBase64` and the hook streams a browser download.

## Targets (10 user-facing)

| Target | Country | Flag | Format |
|--------|---------|------|--------|
| `symfonia` | PL | `payroll.symfonia` | CSV + XML |
| `comarch` | PL | `payroll.comarch` | CSV (Optima "Płace") |
| `enova` | PL | `payroll.enova` | CSV (enova365) |
| `datev` | DE | `payroll.datev` | DATEV Lohn ASCII (fixed 121-char records) + dark DATEVconnect REST seam |
| `sage-de` | DE | `payroll.sage-de` | CSV (Personalwirtschaft) |
| `rti-fps` / `rti-eps` | GB | `payroll.sage-uk` | RTI FPS/EPS XML (Sage/BrightPay/Moneysoft importable) |
| `adp` | US | `payroll.adp` | CSV (native ADP push deferred to v7.1) |
| `gusto` | US | `payroll.gusto` | native OAuth bridge → Gusto CSV fallback |
| `quickbooks` | US | `payroll.quickbooks` | native OAuth bridge → QuickBooks CSV fallback |

`gusto-csv` / `quickbooks-csv` are the CSV fallbacks the native bridges import directly —
not separate registered targets. Gusto/QuickBooks native OAuth adapters live on
`packages/integrations` ([[structure/packages]]); the live employee-push endpoint is the
deferred path (EXTERNAL-ENABLEMENT), so even with a flag APPROVED the bridge currently
resolves to the CSV export — the shipping path.

## Entry points

- Engine + profiles: `packages/payroll/src/{registry,engine/engine}.ts`, `profiles/*`.
- Feed-builder: `packages/api/src/services/payroll-feed.ts` (`buildPayrollFeed`).
- Boot registration: `packages/api/src/services/register-payroll-profiles.ts`.
- Router: `packages/api/src/routers/workforce/payroll-export-router.ts` (mounted dark in
  `root.ts` `conditionalWorkforceRouters`).
- Native adapters: `packages/integrations/src/adapters/{gusto,quickbooks}-adapter.ts`.

## UI surface

`apps/web-vite/src/components/payroll/` — thin flag-gated `payroll-export-page` → container
(loading/empty/error + employee-id entry) → `use-payroll-export` (sole tRPC boundary +
base64→blob download) → presentational panel. `PayrollExport` i18n namespace across
en/de/pl/ar/en-US. Route: `dashboard-routes.tsx` `payroll-export`.

## Agent mistakes

- `hireDate` / `terminatedAt` live on **`PersonnelFile`**, not `EmployeeProfile`
  (`EmployeeProfile.terminatedAt` is a separate admin instant for the IdP cooldown).
- Do **not** overload the payment-export factory — payroll export is a disjoint lifecycle.
- Profiles are **pure over `PayrollFeed`** (golden-fixture tested); they never touch Prisma.
- National IDs are **last-4 only** in the feed (DE `svNummer` / GB `niNumber` are market refs
  in `countryFields`, not encrypted-column last-4); a full ID reveals only via the audited
  `employeePii:read` path when a format legally requires it.
- Gusto/QuickBooks native push is **flag-deferred**; the CSV export is the shipping path.
  ADP native is deferred to v7.1; the RTI XSD validate seam is non-throwing when the offline
  HMRC bundle is absent.

## Related

[[structure/packages]] · [[structure/key-services]] · [[structure/api-routers-catalog]] ·
[[patterns/feature-flags]] · [[domains/employee-registry]] · [[domains/worker-foundation]]
