---
phase: 94-theme-b-payroll-integration-adapters
plan: 02
subsystem: payroll-export-red-net
tags: [payroll, golden-fixtures, red-net, nyquist, conditional-skip, idor]
requirements: [PAYROLL-PL-01, PAYROLL-PL-02, PAYROLL-PL-03, PAYROLL-DE-01, PAYROLL-DE-02, PAYROLL-UK-01, PAYROLL-US-01]
dependency_graph:
  requires:
    - "94-01 (PayrollExportProfile contract + PayrollFeed DTO)"
  provides:
    - "15 RED test files (10 profile golden round-trips + 2 native adapters + feed/export/cross-org)"
    - "11 committed golden fixtures + shared feeds.ts + fixtures/README.md"
    - "conditional-skip live cases for Gusto/QuickBooks (skipIf(!CLIENT_ID))"
  affects:
    - "94-03..08 (turn the profile/adapter RED tests GREEN)"
    - "94-09 (turns feed/export/cross-org RED tests GREEN)"
tech_stack:
  added: []
  patterns:
    - "Golden-fixture round-trip: generate(feed) == committed golden file (byte-exact)"
    - "CSV goldens body-only; BOM asserted separately (buffer.subarray(0,3))"
    - "DATEV golden = header + fixed 121-char detail records (exact length asserted)"
    - "RTI XSD validate seam asserted non-throwing when bundle absent (IRIS model)"
    - "Native adapter live token-exchange it.skipIf(!process.env.*_CLIENT_ID)"
    - "Cross-org feed-builder IDOR via a fake org-scoped findMany (repo RED-scaffold idiom)"
key_files:
  created:
    - "packages/payroll/src/__tests__/fixtures/feeds.ts"
    - "packages/payroll/src/__tests__/fixtures/README.md"
    - "packages/payroll/src/__tests__/fixtures/{symfonia.golden.csv,symfonia.golden.xml,comarch.golden.csv,enova.golden.csv,datev.golden.txt,sage-de.golden.csv,rti-fps.golden.xml,rti-eps.golden.xml,adp.golden.csv,gusto.golden.csv,quickbooks.golden.csv}"
    - "packages/payroll/src/__tests__/{symfonia,comarch,enova,datev,sage-de,rti-fps,rti-eps,adp,gusto-csv,quickbooks-csv}.test.ts"
    - "packages/integrations/src/adapters/__tests__/{gusto-adapter,quickbooks-adapter}.test.ts"
    - "packages/api/src/services/__tests__/payroll-feed.test.ts"
    - "packages/api/src/routers/__tests__/{payroll-export,payroll-cross-org}.test.ts"
decisions:
  - "Goldens hand-built from each target's column/record contract; CSV bytes verified against actual exceljs output (semicolon for PL/DE, comma for US; LF; quote-on-quote-char; no trailing newline — generators append one \\n so goldens end with one)"
  - "national IDs synthetic + masked in goldens (last-4 / ***-**-NNNN); DE svNummer/steuerIdNr + GB niNumber are market refs in countryFields, not encrypted-column last-4"
  - "buildPayrollFeed signature designed now: (db, organizationId, employeeIds); org passed explicitly in the where (defense-in-depth over withTenantScope) so the cross-org fake proves isolation"
  - "payroll-export.test asserts the .strict() input schema + a pure assertPayrollTargetEnabled gate helper (both land in 94-09)"
metrics:
  tasks_completed: 3
  files_changed: 28
  completed_date: "2026-07-05"
---

# 94-02 Summary — the RED validation net

Seeded the Nyquist RED floor: every Wave-1 test from `94-VALIDATION.md` exists, is
collected by vitest, and is terminal-RED for the correct (missing-implementation)
reason — a failing proof for Waves 3-5 to satisfy.

## RED state (verified)
- **10 payroll profile tests** fail via `Cannot find module '../profiles/*'` — the
  registry + engine contract tests stay GREEN (8/8).
- **2 integrations adapter tests** fail via `Cannot find module '../gusto-adapter'` /
  `'../quickbooks-adapter'`; each carries an `it.skipIf(!process.env.*_CLIENT_ID)` live
  token-exchange case that auto-runs when partner creds land.
- **3 api tests** fail via `Cannot find module '../../services/payroll-feed'` /
  `'../workforce/payroll-export-router'`.

## Golden fixtures (committed, referenced)
11 goldens locked from each target's column/record contract, shared feeds in
`fixtures/feeds.ts`, provenance + adviser-verify notes in `fixtures/README.md`. CSV
goldens verified byte-exact against real exceljs output; the DATEV golden is a header
line + two fixed 121-char detail records (exact length asserted); RTI FPS/EPS carry
the GovTalkMessage → IRenvelope envelope and the test asserts the non-throwing XSD seam.

## Notes
- All three consumer package tsconfigs exclude `src/**/__tests__/**`, so the RED
  scaffolds do not brick `tsc --noEmit` (payroll + integrations typecheck GREEN).
- XML/ASCII goldens are locked to my generator design; if a Wave 3-6 generator's byte
  output differs, the committed golden is refined to the verified-faithful output (the
  golden is the contract; RED fails on missing module before any golden read).
