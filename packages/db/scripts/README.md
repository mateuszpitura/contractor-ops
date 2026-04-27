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
