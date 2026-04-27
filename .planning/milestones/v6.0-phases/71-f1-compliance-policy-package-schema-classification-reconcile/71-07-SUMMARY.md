---
phase: 71-f1-compliance-policy-package-schema-classification-reconcile
plan: 07
subsystem: database
tags: [prisma, backfill, multi-region, idempotent, dotenv]

requires:
  - phase: 71
    plan: 02
    provides: compliance-policy registry + resolvePolicyRules
  - phase: 71
    plan: 03
    provides: schema columns
provides:
  - "backfill-compliance-policy.ts script (single-region, idempotent, --dry-run flag)"
  - "Pure backfillComplianceItems() function for unit testing"
  - "packages/db/scripts/README.md updated with multi-region run pattern for both Phase 70 + Phase 71 backfills"
affects: []

tech-stack:
  added: ["@contractor-ops/compliance-policy as @contractor-ops/db dependency"]
  patterns: ["lazy dynamic import of @prisma/client inside main() so the pure function is testable without db:generate", "skipped-row counters split by reason (no-context, no-matching-rule)"]

key-files:
  created:
    - packages/db/scripts/backfill-compliance-policy.ts
  modified:
    - packages/db/scripts/README.md
    - packages/db/src/__tests__/backfill-compliance-policy.test.ts
    - packages/db/package.json

key-decisions:
  - "backfillComplianceItems() exported as a pure function so tests run without a real DB (Phase 70 sibling pattern)"
  - "Lazy import of PrismaClient inside main() — test file can import the module without triggering the prisma/default.js require chain"
  - "sector: null + requiresRegulatedEquipment: false defaults so de.eight_b_estg + pl.udt skip during backfill (admin recompute can refine post-deploy)"
  - "Skipped-row counters split: skippedContractorsNoContext + skippedRowsNoMatchingRule"

patterns-established:
  - "Backfill scripts: pure function for tests + thin CLI wrapper for prod; PrismaClient lazy-loaded inside the CLI main()"

requirements-completed: [COMPL-08]

duration: ~10min
completed: 2026-04-27
---

# Phase 71-07: Backfill-Compliance-Policy Script + Multi-Region Docs

**Idempotent single-region backfill runner for ContractorComplianceItem.policyRuleId/severity/expiryJurisdictionTz; 8 GREEN unit tests; multi-region run pattern documented in packages/db/scripts/README.md.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-04-27T13:08Z
- **Tasks:** 5
- **Files modified:** 4 (1 created script, 1 modified README, 1 modified package.json + test rewrite)

## Accomplishments
- New `packages/db/scripts/backfill-compliance-policy.ts` — pure function `backfillComplianceItems()` + CLI `main()` mirror Phase 70's `backfill-scope-capabilities.ts` shape
- Idempotent precondition: skips rows where `policyRuleId IS NOT NULL` (set already) or `status === 'WAIVED'` (preserves audit history)
- Skipped-row counters split: `skippedContractorsNoContext` (no completed assessment) + `skippedRowsNoMatchingRule` (custom org doc not in registry)
- Conservative defaults: `sector: null` + `requiresRegulatedEquipment: false` — conditional rules `de.eight_b_estg@v1` + `pl.udt@v1` not emitted at backfill (admin recompute can refine)
- `COUNTRY_TO_JURISDICTION` map (GB→UK, SA→KSA, AE→UAE, DE/PL passthrough); contractors outside the registry skipped
- 8 GREEN tests in `backfill-compliance-policy.test.ts`: populates policyRuleId, populates severity correctly per rule, populates expiryJurisdictionTz (Asia/Riyadh for KSA), idempotent skip, no-context skip with counter, no-matching-rule skip with counter, WAIVED-row skip, DE construction-conditional NOT-emitted
- `packages/db/scripts/README.md` extended with full Phase 71 backfill section
- `pnpm --filter @contractor-ops/db build/typecheck` exit 0
- All Phase 70 guards stay GREEN

## Task Commits

1. **Tasks 1–5 (script + tests + README + package.json dep + db build)** — `9c9e851f` (feat)

## Files Created/Modified
- `packages/db/scripts/backfill-compliance-policy.ts` — 300 lines (pure function + CLI main + lazy PrismaClient import)
- `packages/db/scripts/README.md` — extended with Phase 71 section (38 added lines)
- `packages/db/src/__tests__/backfill-compliance-policy.test.ts` — 8 real tests (was 6 it.todo)
- `packages/db/package.json` — added `@contractor-ops/compliance-policy: workspace:*` dep

## Decisions Made
- Lazy `await import('@prisma/client')` inside `main()` — without this, the test file's `import { backfillComplianceItems } from '../../scripts/backfill-compliance-policy.js'` would fail because top-level `import { PrismaClient }` triggers `@prisma/client/default.js` which requires a generated client (only available after `db:generate`)
- `PrismaLike` structural interface mirrors only the methods main() needs; avoids importing the full Prisma type
- Test file imports `@contractor-ops/compliance-policy` to ensure the registry side-effect runs once before tests

## Deviations from Plan

**1. [Rule 1 — Bug fix] Lazy PrismaClient import to make script testable**
- **Found during:** Task 4 (regression check) — running `pnpm --filter @contractor-ops/db test backfill-compliance-policy` failed with "Require stack: @prisma/client/default.js"
- **Issue:** Plan example imported `PrismaClient` at module top level. The test file imports the script module to access `backfillComplianceItems`; that triggers @prisma/client's default.js which fails without a fully-generated client (the generated file path differs from the import target).
- **Fix:** Moved `import { PrismaClient }` to a lazy `await import('@prisma/client')` inside `main()`. Created a `PrismaLike` structural interface for `loadContractorContexts()` so it accepts the lazy-loaded instance without needing PrismaClient as a top-level import.
- **Files modified:** packages/db/scripts/backfill-compliance-policy.ts
- **Verification:** Tests pass (8/8 GREEN); typecheck clean
- **Committed in:** 9c9e851f

---

**Total deviations:** 1 (lazy import for testability)
**Impact on plan:** Functional outcome unchanged. The CLI runs identically; only the test ergonomics improved.

## Issues Encountered
None — single deviation handled cleanly.

## User Setup Required (Manual Post-Deploy)

```sh
# After Plan 71-03 schema migration is applied to both regions:
DATABASE_URL=$DATABASE_URL_EU tsx packages/db/scripts/backfill-compliance-policy.ts --dry-run
DATABASE_URL=$DATABASE_URL_EU tsx packages/db/scripts/backfill-compliance-policy.ts
DATABASE_URL=$DATABASE_URL_ME tsx packages/db/scripts/backfill-compliance-policy.ts --dry-run
DATABASE_URL=$DATABASE_URL_ME tsx packages/db/scripts/backfill-compliance-policy.ts

# Idempotent — re-running reports 0 updates after a successful run.
# Phase 73's compliance dashboard will surface "needs classification"
# badges for any contractors skipped due to missing completed assessment.
```

## ROADMAP success criteria status — Phase 71 complete at code level
- ✓ #1: Materialisation + supersession (Plan 71-04)
- ✓ #2: TZ boundary (Plan 71-02)
- ✓ #3: Per-jurisdiction policy seeds (Plan 71-02)
- ✓ #4: Admin recompute mutation + UI (Plans 71-05 + 71-06)
- ✓ Backfill of existing rows (this plan; manual deploy-time run)

Phase 71 ships the engine + the registry + the schema + the UI button + the backfill. Legal-text approval (signoff PENDING→APPROVED) is the only remaining post-deploy task per Standing Constraint.

---
*Phase: 71-f1-compliance-policy-package-schema-classification-reconcile*
*Completed: 2026-04-27*
