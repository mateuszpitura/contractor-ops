---
phase: 94-theme-b-payroll-integration-adapters
plan: 06
subsystem: payroll-export-us-csv
tags: [payroll, us, adp, gusto, quickbooks, csv, shared-mapper]
requirements: [PAYROLL-US-01]
dependency_graph:
  requires:
    - "94-01 (contract + DTO)"
    - "94-02 (US CSV golden fixtures + RED tests)"
    - "94-03 (lib/csv-writer + lib/format)"
  provides:
    - "AdpProfile, GustoCsvProfile, QuickbooksCsvProfile"
    - "us-shared/mapper.ts (mapUsEmployeeToRow — the single US feed->row projection)"
  affects:
    - "94-07 (Gusto bridge falls back to GustoCsvProfile)"
    - "94-08 (QuickBooks bridge falls back to QuickbooksCsvProfile)"
    - "94-09 (registerAllPayrollProfiles)"
tech_stack:
  added: []
  patterns:
    - "One shared mapUsEmployeeToRow -> normalized US row; each target projects its own columns"
    - "SSN masked to ***-**-NNNN (ssnLast4 only in the row; full SSN never a mapper field)"
    - "comma-delimited CSV (US) vs semicolon (PL/DE) via the shared toCsvBuffer delimiter arg"
key_files:
  created:
    - "packages/payroll/src/profiles/us-shared/mapper.ts"
    - "packages/payroll/src/profiles/adp/{generator,index}.ts"
    - "packages/payroll/src/profiles/gusto-csv/{generator,index}.ts"
    - "packages/payroll/src/profiles/quickbooks-csv/{generator,index}.ts"
  modified:
    - "packages/payroll/src/index.ts (export US profiles + mapper)"
decisions:
  - "ADP registers under payroll.adp (CSV is the v7.0 ADP path; native ADP deferred to v7.1)"
  - "gusto-csv/quickbooks-csv carry payroll.gusto/payroll.quickbooks — the fallbacks the native bridges (94-07/08) delegate to when dark"
  - "ssnMasked = ***-**-<last4>; the test also asserts no full-SSN digit run leaks into the CSV"
metrics:
  tasks_completed: 3
  files_changed: 8
  completed_date: "2026-07-05"
---

# 94-06 Summary — US CSV payroll export floor

Built the US CSV file-export floor — the zero-dependency v7.0 US path and the
fallback the native OAuth bridges (Waves 4) delegate to when their flag is dark.
Full payroll suite is now 12/12 files, 30/30 tests GREEN.

## Shipped
- **`mapUsEmployeeToRow`** (`us-shared/mapper.ts`) — the single US feed→row
  projection (first/last/full name, `ssnLast4` + masked `***-**-NNNN`, filing status,
  work/other state, hire/termination dates). No full SSN field.
- **AdpProfile** (`payroll.adp`) — ADP Workforce Now import CSV (native ADP push
  deferred to v7.1; CSV is the v7.0 ADP path).
- **GustoCsvProfile** (`payroll.gusto`) + **QuickbooksCsvProfile**
  (`payroll.quickbooks`) — the CSV fallbacks the native bridges use when dark.

## Verification
- `pnpm -F @contractor-ops/payroll test adp gusto-csv quickbooks-csv` — 6/6 GREEN.
- `pnpm -F @contractor-ops/payroll test` (full) — 12 files / 30 tests GREEN.
- `pnpm -F @contractor-ops/payroll typecheck` + biome — clean.

SSN stays masked (`ssnLast4` / `***-**-NNNN`); the test asserts no full-SSN digit run
leaks into the CSV. A full SSN is revealed upstream by the audited feed-builder path
only where a format legally requires it.
