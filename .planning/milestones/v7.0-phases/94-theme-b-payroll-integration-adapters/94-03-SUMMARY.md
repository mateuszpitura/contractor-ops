---
phase: 94-theme-b-payroll-integration-adapters
plan: 03
subsystem: payroll-export-pl
tags: [payroll, poland, symfonia, comarch, enova, csv, xml]
requirements: [PAYROLL-PL-01, PAYROLL-PL-02, PAYROLL-PL-03]
dependency_graph:
  requires:
    - "94-01 (contract + DTO)"
    - "94-02 (PL golden fixtures + RED tests)"
  provides:
    - "SymfoniaProfile (CSV + XML), ComarchProfile, EnovaProfile"
    - "shared lib/csv-writer.ts (exceljs + BOM + trailing newline) + lib/format.ts (escapeXml/splitName/isoDate/cf/transliterateDe)"
  affects:
    - "94-04/05/06 (reuse lib/csv-writer + lib/format)"
    - "94-09 (registerAllPayrollProfiles registers these)"
tech_stack:
  added: []
  patterns:
    - "toCsvBuffer(headers, rows, delimiter): exceljs writeBuffer + semicolon delimiter for PL + BOM prepend + \\n"
    - "displayName -> { firstNames, surname } via splitName (last token = surname)"
    - "profiles are pure PayrollFeed -> Buffer; PII stays last-4 (PESEL column = nationalIdLast4)"
key_files:
  created:
    - "packages/payroll/src/lib/csv-writer.ts"
    - "packages/payroll/src/lib/format.ts"
    - "packages/payroll/src/profiles/symfonia/{constants,generator,index}.ts"
    - "packages/payroll/src/profiles/comarch/{generator,index}.ts"
    - "packages/payroll/src/profiles/enova/{generator,index}.ts"
  modified:
    - "packages/payroll/src/index.ts (export PL profiles + register fns)"
decisions:
  - "One shared lib/csv-writer + lib/format for all CSV/XML profiles (DRY over per-file exceljs boilerplate); BOM literal lives in csv-writer.ts"
  - "Symfonia generate({format}) selects CSV (default) or XML; XML is one <Pracownik> line per employee, escapeXml-safe"
  - "German umlaut object keys tripped biome useNamingConvention(requireAscii) — transliterateDe uses a Map of string entries instead"
metrics:
  tasks_completed: 3
  files_changed: 9
  completed_date: "2026-07-05"
---

# 94-03 Summary — Polish payroll export profiles

Built the three PL file-export profiles as pure `PayrollFeed → PayrollExportResult`
generators, turning the PL golden-fixture RED tests GREEN on the first run (goldens
matched byte-for-byte).

## Shipped
- **SymfoniaProfile** — CSV (`payroll.symfonia`) via the shared exceljs+BOM writer
  (semicolon delimiter) and an XML variant selected by `opts.format`.
- **ComarchProfile** (`payroll.comarch`) — Comarch ERP Optima "Płace" import CSV.
- **EnovaProfile** (`payroll.enova`) — enova365 Kadry i Płace import CSV.
- Shared `lib/csv-writer.ts` (the exceljs + UTF-8 BOM + trailing-newline idiom) and
  `lib/format.ts` (`escapeXml`, `splitName`, `isoDate`, `compactDate`, `cf`,
  `transliterateDe`) reused by the DE/UK/US waves.

## Verification
- `pnpm -F @contractor-ops/payroll test symfonia comarch enova` — 7/7 GREEN.
- `pnpm -F @contractor-ops/payroll typecheck` + biome — clean.

National IDs stay masked: the PESEL column carries `nationalIdLast4` only; a full
PESEL is injected upstream by the feed-builder's audited reveal only when a format
legally requires it (deferred adviser-verify note in each profile's constants).
