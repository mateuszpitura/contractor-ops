# 97-01 SUMMARY — additive data-layer + module.hr-dashboard flag

**Wave:** 1 · **Status:** done · **Ships:** GREEN (foundation gate, not RED)

## What landed

RESEARCH C1–C4 confirmed the widgets' source columns did not exist at HEAD (P90 promoted only
`saudizationCategory`/`etat`/`employmentStatus` + `countryCode`/`terminatedAt`; P96 added
`managerWorkerId`). This plan additively promotes them, mirroring the P90 promoted-column +
`__`-prefixed-migration pattern.

- **`EmployeeProfile`** (`employee.prisma`) — four nullable, org-composite-indexed aggregation columns:
  `department String?`, `employmentType EmploymentType?` (NEW enum — the **contract-type** axis, a code
  comment states it is distinct from the `employmentStatus` lifecycle axis), `contractEndDate DateTime? @db.Date`
  (scheduled end, distinct from the administrative `terminatedAt` instant), `probationEndsAt DateTime? @db.Date`.
  `enum EmploymentType { FULL_TIME PART_TIME FIXED_TERM TEMPORARY APPRENTICE SEASONAL }`. Indexes:
  `@@index([organizationId, {department|employmentType|contractEndDate|probationEndsAt}])`.
- **`PersonnelFileDocument`** (`personnel.prisma`) — `expiresAt DateTime? @db.Date` (TZ-correct expiry anchor
  the doc-expiry widget reads through the pure compliance-policy math; null = non-expiring, excluded) +
  `docCategory EmployeeDocCategory?`. `enum EmployeeDocCategory { VISA WORK_PERMIT CONTRACT_RENEWAL MEDICAL_CERT TRAINING_CERT OTHER }`.
  `@@index([organizationId, expiresAt])`.
- **Migration** `packages/db/prisma/schema/migrations/__hr_dashboard_columns/{migration.sql,down.sql}` — hand-authored,
  additive-ALTER (two `CREATE TYPE`, six `ADD COLUMN`, five `CREATE INDEX`), all nullable → no backfill; paired
  reversible `down.sql`. `__`-prefixed → NOT applied by codegen; live per-region apply DEFERRED (EXTERNAL-ENABLEMENT).
- **Flag** `module.hr-dashboard` — registered in `flags-core.ts` (category `module`, default false, owner
  `workforce-platform`), gated via the new `module.hr-` prefix in `GATED_FLAG_NAMESPACE_PREFIXES`
  (`signoff-registry-flags.ts`) + a PENDING entry in `signoff-registry-flags.json`. Mirrors `module.employee-portal`;
  NOT added to `V7_FLAG_KEYS` (same as the portal — `V7_FLAG_KEYS` stays 20). Layered on `module.workforce-employees`.
- **Write-capture schemas** — the four registry fields added to `registerInputSchema` (in
  `employee-registry-router.ts`, where the schema actually lives — the plan's `employee-validators.ts` path was
  stale) as `.strict()`-compatible optionals + wired into `profileData`. `expiresAt`/`docCategory` added to the
  akta `attachInput` (`personnel-file/classify.ts`) + the `personnelFileDocument.create`. The dashboard only READS
  these; the registry/akta writes are the capture path.

## Verification
- `pnpm --filter @contractor-ops/db exec prisma validate` — valid. `pnpm db:generate` clean; `pnpm --filter @contractor-ops/db build` clean.
- `pnpm typecheck --filter=@contractor-ops/api --filter=@contractor-ops/feature-flags` — green.
- `pnpm -F @contractor-ops/feature-flags test` — 124 passed. `pnpm -F @contractor-ops/api test employee-registry personnel-file` — 17 passed.
- `pnpm lint:no-breadcrumbs` — my files clean (48 flagged are pre-existing on main, none touched here).
- Wiki (same change set): `structure/prisma-schema-areas.md` (promoted columns + doc-expiry) + `patterns/feature-flags.md` (HR-dashboard gate).

## Notes / deviations
- **Worktree rebased to `main`.** The worktree branched from a stale commit (~P91) missing P92 `LeaveBalance`,
  the `routers/workforce/` dir, etc. that the plans were written against. Fast-forwarded the clean branch to `main`
  (HEAD was a strict ancestor, zero unique commits — non-destructive) to realize the intended "off main" base.
- The registry/akta write schema lives inline in the routers (not `packages/validators/`); edited there per the plan's intent.
- `source_commit` frontmatter bumps on touched wiki pages are consolidated in 97-08 (the docs plan).
