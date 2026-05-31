# `packages/db/scripts/`

Scripts that operate against the regional Prisma databases. Each runs against a single `DATABASE_URL` per invocation; multi-region application is performed by setting the appropriate regional URL and re-running.

| Script | Purpose | Multi-region pattern |
|--------|---------|----------------------|
| `push-all-regions.ts` | Iterate over `DATABASE_URL_EU` + `DATABASE_URL_ME` and run `prisma db push` against each. | Built-in: iterates `REGION_ENV_VARS`. |
| `backfill-scope-capabilities.ts` | Backfill `IntegrationConnection.scopeCapabilities` for existing `GOOGLE_WORKSPACE` connections (Phase 70 D-14). Idempotent (`WHERE scopeCapabilities IS NULL`). | Manual per-region invocation (see below). |
| `backfill-compliance-policy.ts` | Backfill `ContractorComplianceItem.policyRuleId`, `severity`, `expiryJurisdictionTz` on existing rows from the `@contractor-ops/compliance-policy` registry (Phase 71 D-08 step 2). Idempotent (`WHERE policyRuleId IS NULL`). | Manual per-region invocation (see below). |

## `backfill-scope-capabilities.ts`

Single-region per invocation. Run twice — once per region.

```sh
# Dry-run first to see how many rows would be touched
DATABASE_URL=$DATABASE_URL_EU tsx packages/db/scripts/backfill-scope-capabilities.ts --dry-run
DATABASE_URL=$DATABASE_URL_ME tsx packages/db/scripts/backfill-scope-capabilities.ts --dry-run

# Apply
DATABASE_URL=$DATABASE_URL_EU tsx packages/db/scripts/backfill-scope-capabilities.ts
DATABASE_URL=$DATABASE_URL_ME tsx packages/db/scripts/backfill-scope-capabilities.ts
```

Idempotent: re-running writes 0 rows because the `WHERE scopeCapabilities IS NULL` filter excludes already-backfilled connections. Safe to re-run after partial failure.

The script mirrors `push-all-regions.ts` (dotenv from monorepo root + pino logging + single-region per invocation) but does NOT iterate regions itself — Standing Project Constraint (LOCAL-ONLY) means each region is applied manually, not as part of an automated multi-region runner.

## `backfill-compliance-policy.ts`

Phase 71 D-08 step 2. Populates `ContractorComplianceItem.policyRuleId`,
`severity`, and `expiryJurisdictionTz` on existing rows by resolving each
contractor's latest completed `ClassificationAssessment` against the typed-
const policy registry in `@contractor-ops/compliance-policy`.

```sh
# Dry-run first
DATABASE_URL=$DATABASE_URL_EU tsx packages/db/scripts/backfill-compliance-policy.ts --dry-run
DATABASE_URL=$DATABASE_URL_ME tsx packages/db/scripts/backfill-compliance-policy.ts --dry-run

# Apply
DATABASE_URL=$DATABASE_URL_EU tsx packages/db/scripts/backfill-compliance-policy.ts
DATABASE_URL=$DATABASE_URL_ME tsx packages/db/scripts/backfill-compliance-policy.ts
```

Idempotent: re-running reports 0 updates because the `WHERE policyRuleId IS NULL`
filter excludes already-backfilled rows.

**Skips:**
- Rows with `status = WAIVED` (preserves audit history per D-09)
- Contractors without a completed `ClassificationAssessment` (their rows stay
  with `policyRuleId = NULL`; Phase 73 dashboard surfaces "needs classification"
  badges for these)
- Rows whose `documentType` does not match any current registry rule (custom-
  org-template rows; legacy stale outcome rows)
- Contractors whose engagement `countryCode` is outside the registry's
  jurisdiction set (e.g. FR, NL, ES)

**Conservative defaults for fields not knowable from existing data (T-71-07-05):**
- `sector = null` → `de.eight_b_estg@v1` (construction-conditional) NOT emitted
- `requiresRegulatedEquipment = false` → `pl.udt@v1` (regulated-equipment-conditional) NOT emitted

Manual recompute via the admin UI (`recreateComplianceAssessment`, Phases 71-05/06)
can refine these after deploy.

## Phase 75 — Contract health check + Credential vault

**Migration:** `20260531124933_phase75_contract_health_credentials`

This migration is **additive** (5 new nullable columns on Contract; 2 new tables; 6 new enums; 1 new DocumentType enum value). It carries the LOCAL-ONLY constraint — engineers DO NOT apply automatically. After merging this PR:

1. **Verify migration SQL:**
   ```sh
   cat packages/db/prisma/schema/migrations/20260531124933_phase75_contract_health_credentials/migration.sql
   ```
   Inspect the partial unique index (`ContractHealthCheckRun_dedup_succeeded` `WHERE status = 'SUCCEEDED'`) — Prisma cannot express this in the schema; it lives in raw SQL in the migration body. It deliberately constrains only SUCCEEDED rows so FAILED/PENDING re-runs are always allowed (D-03).

2. **Apply to all regions** (the runner iterates `DATABASE_URL_EU` + `DATABASE_URL_ME` and runs `prisma migrate deploy`, failing fast on the first region error):
   ```sh
   npx tsx packages/db/scripts/migrate-all-regions.ts
   # or via npm script:
   cd packages/db && pnpm run db:migrate:all
   ```
   To apply against a single region, set the regional URL as `DATABASE_URL` and run `prisma migrate deploy` directly:
   ```sh
   DATABASE_URL=$DATABASE_URL_EU pnpm --filter @contractor-ops/db exec prisma migrate deploy --schema prisma/schema
   ```

**On failure:** `migrate-all-regions.ts` logs which region failed and stops. Re-run after fixing the underlying cause; re-running against an already-migrated region is idempotent (Prisma's `_prisma_migrations` table records applied migrations).

**Backfill:** `Contract.jurisdiction` is left null for pre-Phase-75 rows. The health-check engine (Plan 75-06) falls back to `Contractor.countryCode` per RESEARCH §3 — no immediate backfill required. A post-deploy backfill PR can populate `Contract.jurisdiction` from `Contractor.countryCode` at any cadence without schema change.

> NOTE — the original Plan 75-02 referenced a `push-all-regions.ts` script; the current
> tree's multi-region runner is `migrate-all-regions.ts` (see 75-DRIFT-MAP). Usage adapted above.

**Plan 75-02 status (post-execute):**
- pnpm lint:schema: PASS for the 2 new models (both declare `organizationId`); the suite reports one PRE-EXISTING offence on `UserPinnedView` (auth.prisma, commit a1efc484 — unrelated to Phase 75, out of scope).
- pnpm typecheck: PASS
- pnpm --filter @contractor-ops/db test phase-75-schema: PASS (was RED in Plan 75-01)
- All other Phase 75 Wave 0 RED tests: still RED (preserved baseline)

## Phase 76 — F2 IdP deprovisioning saga + self-trigger provenance

**Migration:** `20260531164549_phase76_idp_deprovisioning`

This migration is **additive** (no data loss):
- 3 new tables: `DeprovisioningRun`, `DeprovisioningStep` (D-01 saga state), `IdpChangeProvenance` (D-09 self-trigger filter)
- 5 new enums (run/step status, step kind, provider, provenance action kind)
- 1 new nullable column: `ContractorAssignment.endedAt` (D-06 — administrative termination instant; drives the 14-day cooldown; distinct from `activeTo`)

Plan 76-02 is marked `autonomous: false` — the executor SHIPS the schema + migration SQL but does NOT apply it. Multi-region apply is a manual operator action per the Standing Constraint (LOCAL-ONLY).

After merging this PR:

1. **Review the migration SQL:**
   ```sh
   cat packages/db/prisma/schema/migrations/20260531164549_phase76_idp_deprovisioning/migration.sql
   ```
   Confirm: 3 `CREATE TABLE`, 5 `CREATE TYPE`, one `ALTER TABLE "ContractorAssignment" ADD COLUMN "endedAt"` (nullable, no default), the `DeprovisioningStep_runId_provider_stepKind_key` unique index, and the `IdpChangeProvenance` lookup/GC indexes. There must be **no** `DROP TABLE`, `DROP COLUMN`, or destructive `ALTER COLUMN`.

2. **Apply to all regions** (the runner iterates `DATABASE_URL_EU` + `DATABASE_URL_ME` and runs `prisma migrate deploy`, failing fast on the first region error):
   ```sh
   npx tsx packages/db/scripts/migrate-all-regions.ts
   # or via npm script:
   cd packages/db && pnpm run db:migrate:all
   ```
   To apply against a single region, set the regional URL as `DATABASE_URL` and run `prisma migrate deploy` directly:
   ```sh
   DATABASE_URL=$DATABASE_URL_EU pnpm --filter @contractor-ops/db exec prisma migrate deploy --schema prisma/schema
   ```

**On failure:** `migrate-all-regions.ts` logs which region failed and stops. Re-run after fixing the underlying cause; re-running against an already-migrated region is idempotent (Prisma's `_prisma_migrations` table records applied migrations). If EU succeeds and ME fails, fix the ME cause (network/auth/state drift) and re-run — only the unapplied region's migration replays.
