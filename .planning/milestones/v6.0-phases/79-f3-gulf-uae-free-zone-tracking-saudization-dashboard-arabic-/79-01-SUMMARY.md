---
phase: 79
plan: 01
subsystem: gulf-validation-scaffold
tags: [testing, rtl, multi-region, gulf, wave-0]
requires:
  - F1 compliance engine (Phase 71/72) — ContractorComplianceItem + payment gate + reminder cron
  - packages/db region.ts (SUPPORTED_REGIONS, getRegionalClient)
  - packages/db/scripts/audit-enum-casing.ts (guard structure template)
provides:
  - 7 RED test scaffolds pinning critical behaviors C1-C10 for plans 79-03/79-04/79-05
  - makeMeOrg / makeFreeZoneAssignment / makeFreeZoneComplianceItem fixture factory
  - pnpm check:rtl-logical-props guard (GULF-08) wired into lint:ci
affects:
  - packages/api/src/__tests__ (new RED files + __fixtures__)
  - root package.json lint:ci chain
tech-stack:
  added: []
  patterns:
    - "describe.todo/it.todo RED-but-runnable scaffolds (pending, not error)"
    - "plain-object test fixtures (no DB writes) for fast unit tests"
    - "physical-direction Tailwind guard mirroring audit-enum-casing.ts structure"
key-files:
  created:
    - packages/api/src/__tests__/free-zone-payment-block.test.ts
    - packages/api/src/__tests__/free-zone-mainland-exclusion.test.ts
    - packages/api/src/__tests__/free-zone-supersession-isolation.test.ts
    - packages/api/src/__tests__/reminder-region-fanout.test.ts
    - packages/api/src/__tests__/permitted-activity-noc.test.ts
    - packages/api/src/__tests__/saudization-derivation.test.ts
    - packages/api/src/__tests__/gulf-override-audit.test.ts
    - packages/api/src/__tests__/__fixtures__/gulf-fixtures.ts
    - packages/db/scripts/check-rtl-logical-props.mjs
  modified:
    - package.json
decisions:
  - "RTL guard confirmed ABSENT (Pitfall 20) and built from scratch as a Node ESM script, not a Biome rule — matches the existing check:* script convention"
  - "Guard scoped to Gulf web-vite surfaces only (D-17 scope boundary); regex assembled from a character class so the script never self-trips even if scope widens"
  - "Fixtures structurally typed (not against generated Prisma client) so Wave 0 tests import them before FreeZoneAssignment schema lands in 79-02"
metrics:
  duration: ~25m
  completed: 2026-06-03
---

# Phase 79 Plan 01: Wave 0 Gulf Validation Scaffold Summary

Laid down 7 RED test scaffolds pinning Nyquist critical behaviors C1-C10, a shared ME-region Gulf fixture factory, and the previously-unconfirmed `ml-`/`mr-` RTL logical-property guard (Pitfall 20) — establishing the verification surface before any Gulf implementation lands.

## What Was Built

**Task 1 — 7 RED test scaffolds (commit `ea6b4872`)**
One `describe.todo`/`it.todo` file per behavior cluster under `packages/api/src/__tests__/`, each with a top-of-file comment mapping it to its C#/GULF-ID and target plan:

| File | Behavior | Requirement | Target plan |
|------|----------|-------------|-------------|
| free-zone-payment-block | C1 — expired FZ license hard-blocks payment | GULF-02 | 79-03 |
| free-zone-mainland-exclusion | C2 — Mainland gets no item / no block | GULF-01/02, D-04 | 79-03 |
| free-zone-supersession-isolation | C4 — FZ row survives supersession | Pitfall 2 | 79-03 |
| reminder-region-fanout | C3 — ME items enter the cascade | Pitfall 18 | 79-03 |
| permitted-activity-noc | C5 — ISIC mismatch + auto-NOC; uncoded skip | GULF-03, D-05..08 | 79-04 |
| saudization-derivation | C6+C7 — rate from manual headcount; band never auto-computed; trajectory ephemeral | GULF-05/06/07, D-10/D-12 | 79-04 |
| gulf-override-audit | C9 — drift override audit-logged + custom badge | GULF-10 | 79-05 |

Verified RED-but-runnable: scoped vitest run reports `7 skipped (7)` files / `26 todo (26)` tests with **zero** collection/syntax/import errors. (todo tests are reported as pending — the RED state a downstream plan turns GREEN.)

**Task 2 — Shared ME-region Gulf fixture factory (commit `aee81180`)**
`packages/api/src/__tests__/__fixtures__/gulf-fixtures.ts` exports `makeMeOrg` (`dataRegion: 'ME'`, `countryCode: 'AE'|'SA'`), `makeFreeZoneAssignment` (zone `DMCC` default, `licenseExpiresAt`, `permittedActivityIsicCodes`), and `makeFreeZoneComplianceItem` (severity `BLOCKING`, `policyRuleId 'uae.free_zone_license@v2'`, `documentType 'UAE_FREE_ZONE_LICENSE'`, `expiryJurisdictionTz 'Asia/Dubai'`, param-driven `status`). Plain-object factories (no DB writes); UPPER_SNAKE enum string values per D-17. `tsc --noEmit` reports no error referencing the fixtures file.

**Task 3 — RTL logical-property guard (commit `cab2d775`)**
RESEARCH (Pitfall 20) could not locate an existing `ml-`/`mr-` ban — confirmed absent (web-vite uses Biome; no `check:*` script targeted Tailwind margin classes). Built `packages/db/scripts/check-rtl-logical-props.mjs` (Node ESM, mirroring `audit-enum-casing.ts`): walks the Gulf web-vite surfaces (`saudization` + `contractors/free-zone`), fails on physical-direction utilities (margin/padding left+right, `left-`/`right-` positioning), prints offenders, `process.exit(1)`. Registered as `check:rtl-logical-props` and appended to the `lint:ci` chain (`grep -c` = 2). Runs clean (exit 0) on the currently-empty Gulf surface set.

## Verification Results

- `pnpm exec vitest run <7 files>` → `7 skipped / 26 todo`, no collection error.
- `tsc --noEmit -p tsconfig.json` (api) → no `gulf-fixtures` errors.
- `grep -c "check:rtl-logical-props" package.json` → 2 (script def + lint:ci entry).
- `pnpm check:rtl-logical-props` → exit 0 on empty Gulf set.
- **Seeded-offender confirmation (threat T-79-01-02):** a temp `ml-4` Gulf-surface file → guard exit 1 with the correct offender line; a logical-property (`ms-/me-/ps-/pe-`) file → exit 0 (no false-positive); seed files removed, no artifacts left untracked.
- Production guard: no `packages/api/src/services` or `packages/api/src/routers` source modified; no file deletions across the range.

## Deviations from Plan

None — plan executed exactly as written. The RTL guard was the only conditional branch (verify-or-build); research's "expected absent" outcome was confirmed and the build path taken.

## Threat Model Outcome

- **T-79-01-01** (fixture leaking into prod bundle) — accepted: fixtures live under `__tests__/__fixtures__`, no runtime import path from app code.
- **T-79-01-02** (RTL guard false-negative) — mitigated and confirmed: regex `\bm[lr]-`/`\bp[lr]-` catches both `ml-`/`mr-`; verified against a seeded offender (see above).
- **T-79-01-SC** (package installs) — N/A: zero new dependencies installed.

## Notes for Downstream Plans

- The fixtures are structurally typed (interfaces), not against the generated Prisma client, because `FreeZoneAssignment` / `SaudizationConfig` schema lands in **79-02**. Once those models exist, downstream plans may tighten the fixture return types to the generated row types.
- The full `packages/api` suite has ~44 pre-existing failing test files / 25 failing tests (the documented test-debt handoff) unrelated to this plan — out of scope per the scope-boundary rule; not touched.
- The reminder cron region fan-out (C3) and the supersession-exclusion of free-zone rows (C4) are the two highest-risk landmines; their RED scaffolds spell out the exact assertions 79-03 must satisfy.

## Self-Check: PASSED
