---
phase: 94-theme-b-payroll-integration-adapters
plan: 09
subsystem: payroll-export-wiring
tags: [payroll, feed-builder, trpc, dark-mount, web-vite, i18n, audit, idor]
requirements: [PAYROLL-PL-01, PAYROLL-PL-02, PAYROLL-PL-03, PAYROLL-DE-01, PAYROLL-DE-02, PAYROLL-UK-01, PAYROLL-US-01]
dependency_graph:
  requires:
    - "94-03..08 (all profiles + native bridges)"
  provides:
    - "buildPayrollFeed (Worker+EmployeeProfile+PersonnelFile join, last-4 PII mask, org-scoped)"
    - "registerAllPayrollProfiles (boot hook registering the 10 targets)"
    - "payrollExport tRPC router (listTargets/export/connectNative) mounted dark behind module.workforce-employees"
    - "web-vite export surface (Page->Container->Hook->Component) + Payroll i18n across 5 locales + a dashboard route"
  affects:
    - "94-10 (docs)"
tech_stack:
  added:
    - "packages/api depends on @contractor-ops/payroll"
  patterns:
    - "Export procedure: assertWorkforceEnabled + per-target evaluate(payroll.*) FORBIDDEN gate + writeAuditLog + fileBase64 return (payment-export idiom)"
    - "conditionalWorkforceRouters spread (METHOD_NOT_FOUND when the module flag is OFF)"
    - "web-vite: hook = sole tRPC boundary; container owns state + loading/empty/error; panel presentational; page thin flag-gated"
key_files:
  created:
    - "packages/api/src/services/payroll-feed.ts"
    - "packages/api/src/services/register-payroll-profiles.ts"
    - "packages/api/src/routers/workforce/payroll-export-router.ts"
    - "apps/web-vite/src/components/payroll/hooks/use-payroll-export.ts"
    - "apps/web-vite/src/components/payroll/{payroll-export-container,payroll-export-panel,payroll-export-page}.tsx"
    - "apps/web-vite/src/pages/dashboard/payroll-export.tsx"
  modified:
    - "packages/api/src/root.ts (mount payrollExport in conditionalWorkforceRouters)"
    - "packages/api/src/__tests__/workforce-flag.test.ts (+payrollExport. namespace gating proof)"
    - "packages/integrations/src/index.ts (export GustoAdapter/QuickBooksAdapter + payload mappers)"
    - "packages/api/package.json (+@contractor-ops/payroll)"
    - "apps/web-vite/src/router/dashboard-routes.tsx (payroll-export route)"
    - "apps/web-vite/messages/{en,de,pl,ar,en-US}.json (PayrollExport namespace)"
decisions:
  - "buildPayrollFeed passes organizationId in the where (defense-in-depth over withTenantScope); the two-org fake proves isolation"
  - "gated on employee:read (payroll_officer holds it); export is a .mutation (audited) but reads employee data"
  - "the export returns fileBase64 (payment-export idiom); the hook triggers a browser download"
  - "gusto/quickbooks native push endpoint is the deferred live path — the router passes evaluateFlag but no pushNative, so enabled+connected still resolves to the CSV export (the shipping path)"
  - "registerAllPayrollProfiles registers the 10 user-facing targets; gusto-csv/quickbooks-csv are internal fallbacks the bridges import directly, not separate targets"
metrics:
  tasks_completed: 3
  files_changed: 17
  completed_date: "2026-07-05"
---

# 94-09 Summary — feed-builder + gated router + dark mount + export surface

Wired the payroll package into the app end-to-end, turning the feed-builder /
export-procedure / cross-org RED tests GREEN.

## Shipped
- **buildPayrollFeed** — joins Worker → EmployeeProfile → PersonnelFile (hire/termination
  anchors on PersonnelFile), masks national IDs to last-4 by market, formats etat to 2dp,
  validates with `payrollFeedSchema`. Org-scoped in the query (defense-in-depth).
- **registerAllPayrollProfiles** — boot hook registering the 10 targets (PL/DE/UK file
  exports + ADP + Gusto/QuickBooks bridges).
- **payrollExport router** — `listTargets` (each annotated with the org's per-adapter
  flag state), `export` (`.strict()` input, `assertWorkforceEnabled` + per-target
  `evaluate(payroll.*)` FORBIDDEN gate, `buildPayrollFeed`, `engine.generate`,
  `writeAuditLog('payroll.export')`, `fileBase64` return), and `connectNative` (the
  Gusto/QuickBooks OAuth entry point). Mounted inside `conditionalWorkforceRouters` so it
  is METHOD_NOT_FOUND when `module.workforce-employees` is OFF; `workforce-flag.test.ts`
  extended to prove `payrollExport.` is dark-gated.
- **web-vite surface** — `use-payroll-export` (sole tRPC boundary + base64→blob download),
  `payroll-export-container` (loading/empty/error + employee-id entry), `payroll-export-panel`
  (presentational target list + per-adapter enablement state + CSV/XML actions),
  `payroll-export-page` (thin flag-gated composer), a dashboard route, and the `PayrollExport`
  i18n namespace across en/de/pl/ar/en-US.

## Verification
- `pnpm -F @contractor-ops/api test payroll-feed payroll-export payroll-cross-org` — 9 GREEN.
- `pnpm -F @contractor-ops/api test workforce-flag` — 5 GREEN (payrollExport dark-gated).
- `pnpm typecheck --filter=@contractor-ops/api` + `--filter=@contractor-ops/web-vite` — clean.
- `pnpm check:web-vite-data-layer` + `check:web-vite-page-shells` + `check:web-vite-presentational` — OK.
- `pnpm i18n:parity` — OK across en/de/pl/ar (en-US covered).

de/pl/ar copy is machine-translated (native review deferred per EXTERNAL-ENABLEMENT);
en/en-US are canonical. The `useUniqueElementIds`/`noJsxPropsBind` biome warnings are
warn-level (not CI errors) and match the existing employee-lifecycle-panel precedent.
