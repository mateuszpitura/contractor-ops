---
phase: 94-theme-b-payroll-integration-adapters
plan: 04
subsystem: payroll-export-de
tags: [payroll, germany, datev, sage-de, fixed-width, feature-flag]
requirements: [PAYROLL-DE-01, PAYROLL-DE-02]
dependency_graph:
  requires:
    - "94-01 (contract + DTO)"
    - "94-02 (DE golden fixtures + RED tests)"
    - "94-03 (shared lib/csv-writer + lib/format)"
  provides:
    - "DatevProfile (Lohn ASCII, fixed-width length-guarded) + dark DATEVconnect seam"
    - "SageDeProfile (Personalwirtschaft CSV)"
    - "new payroll.sage-de flag (flags-core + signoff-registry, PENDING)"
  affects:
    - "94-09 (registerAllPayrollProfiles)"
    - "94-10 (feature-flags wiki + EXTERNAL-ENABLEMENT DATEVconnect row)"
tech_stack:
  added: []
  patterns:
    - "DATEV: EXTF header line + one fixed 121-char detail record per employee (padField/padZero + exact-length hard-guard throws on mismatch)"
    - "German transliteration (ü->ue …) for the ASCII DATEV file; Sage CSV keeps UTF-8 umlauts"
    - "DATEVconnect REST = wired-but-dark seam (available:false, no network) until subscribed"
key_files:
  created:
    - "packages/payroll/src/profiles/datev/{constants,generator,datevconnect-seam,index}.ts"
    - "packages/payroll/src/profiles/sage-de/{generator,index}.ts"
  modified:
    - "packages/payroll/src/index.ts (export DE profiles + register fns)"
    - "packages/feature-flags/src/flags-core.ts (+payroll.sage-de, V7_FLAG_KEYS)"
    - "packages/feature-flags/src/signoff-registry-flags.json (+payroll.sage-de PENDING)"
    - "packages/feature-flags/src/__tests__/v7-flags-registered.test.ts (19 -> 20 keys)"
decisions:
  - "Added payroll.sage-de (Sage DE != DATEV) so a Sage-only rollout can be isolated; UK vendors keep sharing payroll.sage-uk"
  - "DATEV record widths pinned in constants.ts; DATEV_RECORD_LENGTH derived + asserted per record (121)"
  - "DATEVconnect seam returns available:false + a note, no network call; ASCII file export is the shipping DE path"
metrics:
  tasks_completed: 3
  files_changed: 9
  completed_date: "2026-07-05"
---

# 94-04 Summary — German payroll export profiles

Built the two DE file-export profiles, turning the DE golden RED tests GREEN, and
added the discretionary `payroll.sage-de` flag so Sage DE has its own gate.

## Shipped
- **DatevProfile** (`payroll.datev`) — DATEV Lohn und Gehalt / LODAS ASCII: an EXTF
  header line + one fixed **121-char** detail record per employee, built with
  `padField`/`padZero` and an exact record-length hard-guard that throws on any width
  mismatch (an off-by-one rejects the whole file at import). German umlauts are
  transliterated to ASCII (ü→ue …).
- **DATEVconnect seam** — `pushViaDatevConnect` is wired but dark: it makes no network
  call and returns `{ available: false, note }` until the org subscribes; the ASCII
  file export is the shipping path.
- **SageDeProfile** (`payroll.sage-de`) — Sage HR / Personalwirtschaft UTF-8 CSV
  (umlauts preserved).
- **`payroll.sage-de` flag** added to `flags-core.ts` (category `payroll`, owner
  `payroll-platform`) + a PENDING `signoff-registry-flags.json` entry; the V7 flag
  cohort test moved 19 → 20 keys.

## Verification
- `pnpm -F @contractor-ops/payroll test datev sage-de` — 4/4 GREEN.
- `pnpm -F @contractor-ops/feature-flags test` — 124 GREEN.
- `pnpm -F @contractor-ops/payroll typecheck` + biome — clean.
