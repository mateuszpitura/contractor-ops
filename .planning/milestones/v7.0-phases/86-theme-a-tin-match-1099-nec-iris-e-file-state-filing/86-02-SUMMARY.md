---
phase: 86-theme-a-tin-match-1099-nec-iris-e-file-state-filing
plan: 02
subsystem: database
tags: [prisma, postgres, 1099-nec, iris, retention, soft-delete, feature-flags, seed]

# Dependency graph
requires:
  - phase: 85-theme-a-w-form-intake-tax-treaty-engine
    provides: TaxFormSubmission immutable+supersede model + WhtCertificate money-snapshot shape mirrored by Form1099Nec
  - phase: 83
    provides: retention-policy.ts (RETENTION_YEARS) + data-purge soft-delete chokepoint this plan registers into
provides:
  - Form1099Nec immutable, supersede-able, tenant-owning 1099-NEC model (DRAFT/ACTIVE/SUPERSEDED supersede chain, payerOrgId aggregation axis, box1/box4 minor units, cfsfStateCode, deletedAt)
  - IrisSubmission + IrisAck append-only records (schema VersionNum/VersionDt, six-state IrisAckStatus enum, Error Information Group JSON)
  - Tax1099Threshold tax-year-keyed config table ($600 TY2025 / $2,000 TY2026) and StateFilingConfig per-state CF/SF config table
  - Form1099Nec registered in MODEL_RETENTION_TYPE ('1099-NEC', 4yr) + softDeleteModels (data-purge chokepoint enforces IRS retention)
  - module.iris-efile confirmed as the single dark IRIS A2A transmit gate (no redundant flag)
affects: [86-03 tin-match, 86-04 1099 service, 86-05 iris generator, 86-06 transmitter/routers, 86-07 ui, phase-88 backup-withholding]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Immutable supersede-chain compliance record (Form1099Nec mirrors TaxFormSubmission: prior ACTIVE -> SUPERSEDED, new ACTIVE inserted)"
    - "Tax-year/per-state-keyed config tables instead of constants (threshold + CF/SF participation)"
    - "Retention enforcement via MODEL_RETENTION_TYPE + softDeleteModels (purge chokepoint refuses early hard-delete)"
    - "Reuse the existing PENDING module.iris-efile flag for the dark transmit path rather than minting a redundant flag"

key-files:
  created:
    - packages/db/prisma/seed/tax-1099-config.ts
  modified:
    - packages/db/prisma/schema/tax.prisma
    - packages/db/prisma/schema/organization.prisma
    - packages/db/prisma/schema/contractor.prisma
    - packages/db/prisma/seed/index.ts
    - packages/db/src/retention-policy.ts
    - packages/db/src/soft-delete.ts
    - packages/feature-flags/src/flags-core.ts

key-decisions:
  - "Form1099Nec carries payerOrgId explicitly (equals organizationId for self-org filings) so a future agent-org-filing split is non-breaking"
  - "snapshotJson holds last-4 TIN only, never a full SSN (mirrors TaxFormSubmission)"
  - "CF/SF participant list seeded as an adviser-verify placeholder identical for TY2025/TY2026; Maryland modeled as CF/SF-in-name-but-direct-filing"
  - "module.iris-efile reused for the dark A2A transmit path (A1); no iris-a2a-transmit flag minted"

patterns-established:
  - "Immutable supersede chain for CORRECTED 1099 returns"
  - "Tax-year-keyed and per-state-keyed config tables"
  - "Retention registration that closes the data-purge wiring point"

requirements-completed: [US-FORM-04, US-FORM-05, US-FORM-07]

# Metrics
duration: ~30min
completed: 2026-06-17
---

# Phase 86 Plan 02: 1099-NEC + IRIS Data Substrate Summary

**Immutable, supersede-able Form1099Nec + append-only IrisSubmission/IrisAck records + tax-year/per-state config tables, seeded ($600 TY2025 / $2,000 TY2026 + CF/SF participation) and retention-registered ('1099-NEC' 4yr at the purge chokepoint); the [BLOCKING] multi-region migration is held at a human gate.**

## Performance

- **Duration:** ~30 min (autonomous tasks 1-2)
- **Started:** 2026-06-17 (see plan execution)
- **Completed:** 2026-06-17 (autonomous tasks; Task 3 migration pending human approval)
- **Tasks:** 2 of 3 (Task 3 is a [BLOCKING] human-gated migration — not run)
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments
- Added five tenant-owning models to `tax.prisma`: `Form1099Nec` (immutable supersede chain), `IrisSubmission`, `IrisAck`, `Tax1099Threshold`, `StateFilingConfig`, plus `Form1099Status` and the six-state `IrisAckStatus` enums. `prisma validate` is green; none added to `globalModels`.
- Seeded `Tax1099Threshold` ($600 TY2025 / $2,000 TY2026, USD minor units) + per-state `StateFilingConfig` (CF/SF participants, Maryland direct-filing special case, non-CF/SF direct-file states) for TY2025/TY2026, every row carrying an adviser-verify note.
- Registered `Form1099Nec -> '1099-NEC'` in `MODEL_RETENTION_TYPE` and added it to `softDeleteModels`, closing the prior retention-map wiring point so the data-purge chokepoint enforces the 4-year IRS window.
- Confirmed `module.iris-efile` (PENDING, dark) as the single IRIS A2A transmit gate via a code comment; no redundant `iris-a2a-transmit` flag minted.

## Task Commits

1. **Task 1: Add Form1099Nec + IRIS records + config tables** - `7e2fb2ad5` (feat)
2. **Task 2: Seed threshold + per-state config; register retention + soft-delete; confirm flag** - `336516f5d` (feat)
3. **Task 3: [BLOCKING] Generate client + apply multi-region migration** - NOT RUN (human gate — see Checkpoint below)

## Files Created/Modified
- `packages/db/prisma/schema/tax.prisma` - Five new tenant-owning models + `Form1099Status`/`IrisAckStatus` enums.
- `packages/db/prisma/schema/organization.prisma` - Back-relations `form1099Nec` / `irisSubmissions` / `irisAcks`.
- `packages/db/prisma/schema/contractor.prisma` - `form1099Nec` back-relation (left staged-but-uncommitted; see Deviations — pre-existing in-flight audit change in this file).
- `packages/db/prisma/seed/tax-1099-config.ts` - `seedTax1099Config`: threshold + per-state CF/SF seed.
- `packages/db/prisma/seed/index.ts` - Wired `seedTax1099Config` into `main()`.
- `packages/db/src/retention-policy.ts` - `Form1099Nec -> '1099-NEC'` in `MODEL_RETENTION_TYPE`.
- `packages/db/src/soft-delete.ts` - `Form1099Nec` added to `softDeleteModels`.
- `packages/feature-flags/src/flags-core.ts` - Code comment confirming `module.iris-efile` reuse.

## Decisions Made
- Carried `payerOrgId` on `Form1099Nec` as a distinct aggregation axis from `organizationId` for forward compatibility.
- `snapshotJson` holds last-4 TIN only — never a full SSN.
- CF/SF list seeded as an adviser-verify placeholder (drifts annually); Maryland modeled as the CF/SF-in-name-but-direct-filing special case.

## Deviations from Plan

### Conflict-risk handling (sequential executor on a dirty branch)

**1. contractor.prisma carried a pre-existing in-flight audit change**
- **Found during:** Task 1
- **Issue:** `packages/db/prisma/schema/contractor.prisma` already had an uncommitted audit change on this branch (`@@index([organizationId, taxId])` -> `@@unique([organizationId, taxId])`) unrelated to plan 86-02. Git stages whole files, so committing my one-line `form1099Nec` back-relation would have swept in that unrelated change. The classifier (correctly, per the sequential-execution rules) denied the mixed commit.
- **Resolution:** Committed Task 1 with only the clean files (`tax.prisma`, `organization.prisma`). The `form1099Nec` back-relation on `contractor.prisma` remains on disk (staged) so Prisma client generation will still pick it up, but it is NOT in my commit — surfaced here for the user to commit alongside (or separately from) the audit change.
- **Files affected:** `packages/db/prisma/schema/contractor.prisma`

No other deviations — schema/seed/retention/flag work followed the plan as written.

## Issues Encountered
- **Pre-existing `db:audit-enum-casing` failure** in `packages/db/prisma/schema/idp-deprovisioning.prisma` (Phase 76 file, clean). My new enums pass. Logged to `deferred-items.md`, not fixed (out of scope).
- **Pre-existing `lint:no-breadcrumbs` failures** (23) in Plan 86-01 Wave-0 RED test scaffolds (`packages/api/src/services/__tests__/*.test.ts`). None of my files are flagged. Logged to `deferred-items.md`, not fixed (out of scope).

## Known Stubs
- `StateFilingConfig` CF/SF participant list + `Tax1099Threshold` figures are developer-authored adviser-verify placeholders (intentional, per D-18 / Open Q3). Each row carries a `note` flagging re-verification per tax year. Resolved by adviser sign-off before production filing, not by a future plan.

## User Setup Required
The [BLOCKING] Task 3 migration must be run by a human against the live regional databases — see the CHECKPOINT in the executor return for exact commands, regions, and resume steps.

## Next Phase Readiness
- Schema + seed + retention wiring complete. Downstream plans (86-03 TIN-match, 86-04 1099 service, 86-05 IRIS generator, 86-06 transmitter/routers, 86-07 UI) require the regenerated Prisma client + applied migration from Task 3 before they typecheck against the five new models.
- BLOCKER: Task 3 multi-region migration (EU/ME/US) is unrun pending human approval.

## Self-Check: PASSED

- `packages/db/prisma/seed/tax-1099-config.ts` — FOUND
- `86-02-SUMMARY.md` — FOUND
- Commit `7e2fb2ad5` (Task 1) — FOUND
- Commit `336516f5d` (Task 2) — FOUND
- Five new models present in committed `tax.prisma` — confirmed (5)

---
*Phase: 86-theme-a-tin-match-1099-nec-iris-e-file-state-filing*
*Completed: 2026-06-17 (autonomous tasks 1-2; Task 3 migration held at human gate)*
