---
phase: 94-theme-b-payroll-integration-adapters
plan: 01
subsystem: payroll-export-foundation
tags: [payroll, profile-registry, foundation-gate, einvoice-clone]
requirements: [PAYROLL-PL-01, PAYROLL-PL-02, PAYROLL-PL-03, PAYROLL-DE-01, PAYROLL-DE-02, PAYROLL-UK-01, PAYROLL-US-01]
dependency_graph:
  requires: []
  provides:
    - "@contractor-ops/payroll package (profile-registry engine, clone of packages/einvoice)"
    - "PayrollExportProfile contract (profileId/country/displayName/flagKey/generate)"
    - "PayrollFeed DTO + payrollFeedSchema (PII-masked canonical intermediate)"
    - "registry (register/get/list/clear) + PayrollExportEngine (generate/listTargets), country-code-free"
  affects:
    - "94-02 (RED net imports the contract + DTO)"
    - "94-03..08 (adapters implement PayrollExportProfile + register)"
    - "94-09 (api consumes engine + payrollFeedSchema)"
tech_stack:
  added:
    - "packages/payroll (deps: exceljs, zod, @contractor-ops/logger)"
  patterns:
    - "Static Map<string, Profile> registry with throw-on-duplicate + fail-fast get"
    - "Generic engine delegates profileId -> profile.generate; never contains country code"
    - "tsconfig excludes src/**/__tests__/** so later RED scaffolds cannot brick tsc --noEmit"
key_files:
  created:
    - "packages/payroll/package.json"
    - "packages/payroll/tsconfig.json"
    - "packages/payroll/vitest.config.ts"
    - "packages/payroll/src/index.ts"
    - "packages/payroll/src/registry.ts"
    - "packages/payroll/src/engine/engine.ts"
    - "packages/payroll/src/types/profile.ts"
    - "packages/payroll/src/types/feed.ts"
    - "packages/payroll/src/__tests__/registry.test.ts"
    - "packages/payroll/src/__tests__/engine.test.ts"
  modified:
    - "tsconfig.json (root references + packages/payroll)"
    - "vitest.monorepo.ts (payroll project, groupOrder 19)"
decisions:
  - "PayrollExportResult = { buffer, ext: csv|xml|txt, mime, warnings? } — warnings carry transliteration / non-throwing-XSD / CSV-fallback advisories"
  - "PayrollFeed carries nationalIdLast4 only; full national IDs are never a DTO field (revealed upstream into countryFields when a format legally requires it)"
  - "employmentStatus enum = ACTIVE|ON_LEAVE|SUSPENDED|TERMINATED (mirrors EmployeeProfile)"
  - "tsconfig excludes __tests__ (RED-safe); vitest still collects them"
metrics:
  tasks_completed: 3
  files_changed: 12
  completed_date: "2026-07-05"
---

# 94-01 Summary — payroll package foundation gate

Stood up `@contractor-ops/payroll` as a structural clone of `packages/einvoice`'s
profile-registry engine. Defined the shared `PayrollExportProfile` contract and the
canonical `PayrollFeed` DTO (with a matching `payrollFeedSchema` for boundary parsing),
plus a country-code-free registry and `PayrollExportEngine`.

## What shipped
- **Contract:** `PayrollExportProfile { profileId, country, displayName, flagKey, generate(feed, opts?) }`
  returning `PayrollExportResult { buffer, ext, mime, warnings? }`.
- **DTO:** `PayrollFeed` / `PayrollFeedEmployee` carrying `hireDate`, `terminatedAt`,
  `employmentStatus`, `etat`, `nationalIdLast4`, and an opaque `countryFields` map —
  no full-PII field. Zod schema exported for `.parse()` at the API boundary.
- **Registry + engine:** verbatim einvoice shape (throw-on-duplicate, fail-fast `getProfile`
  listing available ids, `listTargets()` projection). No adapters registered yet.
- **Workspace wiring:** package added to root `tsconfig.json` references and a `payroll`
  vitest project (groupOrder 19). tsconfig excludes `src/**/__tests__/**` so the Wave-2 RED
  scaffolds cannot break `tsc --noEmit`.

## Verification
- `pnpm -F @contractor-ops/payroll test` — 8/8 GREEN (registry + engine contract).
- `pnpm -F @contractor-ops/payroll typecheck` — clean.
- `pnpm -F @contractor-ops/payroll lint` (biome) — clean.

## Notes
- No adapters register at import time; the einvoice convention (explicit `register*Profile()`
  convenience fns) is used so `clearProfiles()` test isolation holds — the fns land with each
  adapter wave and get called from `registerAllPayrollProfiles()` in Wave 5.
- Repo-wide `pnpm lint:no-breadcrumbs` is red on pre-existing `packages/api`/`packages/db`
  comments from earlier merged phases; zero breadcrumbs introduced here.
