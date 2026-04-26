---
plan: 64-02
phase: 64-legal-compliance-hardening
status: complete
commit: 054372d9
completed_at: 2026-04-26
---

# Plan 64-02: Disclaimer Signoff Registry + CI Production Deploy Gate

## What Was Built

Added 6 new locked phrases to `disclaimers.ts`: `BANNER_IR35_ADVISORY_EN`, `BANNER_SCHEIN_ADVISORY_DE`, `SDS_APPROVAL_STATEMENT_EN`, `DRV_UNVERIFIED_ENTRY_DISCLAIMER_DE`, `SOFTWARE_NOT_LEGAL_ADVICE_EN`, `SOFTWARE_NOT_LEGAL_ADVICE_DE`. Created `signoff-registry.json` with all 12 disclaimer keys (6 original + 6 new) seeded as PENDING. Created `signoff-registry-schema.ts` with Zod schema including APPROVED entry refine guard (requires approvedBy/approvedAt/approverRole). Created `signoff-registry.ts` with fail-fast module-load validation using `process.stderr.write` (no @contractor-ops/logger dep). Added `legal-gate-production` CI job to `.github/workflows/ci.yml` that blocks main branch deploys when any disclaimer is PENDING. Created `.github/CODEOWNERS` requiring `@contractor-ops/legal-platform` review on `signoff-registry.json` changes. Extended `locked-phrases-guard.test.ts` with 14 new Phase 64 registry guard tests — all 78 tests pass.

## Key Files Created

- `packages/validators/src/legal/signoff-registry.json` — 12 entries all PENDING
- `packages/validators/src/legal/signoff-registry-schema.ts` — Zod schema
- `packages/validators/src/legal/signoff-registry.ts` — runtime helpers
- `.github/CODEOWNERS` — legal-platform review gate

## Key Files Modified

- `packages/validators/src/legal/disclaimers.ts` — 6 new phrases + updated LOCKED_DISCLAIMERS
- `packages/validators/src/index.ts` — new exports
- `packages/validators/src/__tests__/locked-phrases-guard.test.ts` — 14 Phase 64 tests
- `.github/workflows/ci.yml` — legal-gate-production job

## Test Results

78 tests pass in locked-phrases-guard.test.ts (was 64 before). Pre-existing contractor.test.ts failure is unrelated.

## Manual-Only Verifications

Legal sign-off for all 12 disclaimer keys is DEFERRED — post-deploy item per Standing Project Constraints. All keys remain PENDING. To approve: submit a PR updating `signoff-registry.json` with `approvedBy`, `approvedAt`, `approverRole` fields, requires `@contractor-ops/legal-platform` CODEOWNERS review.

## Self-Check: PASSED

- signoff-registry.json has 12 keys all PENDING ✓
- SignoffRegistrySchema exports SignoffEntrySchema + SignoffRegistrySchema ✓
- isAllApproved() returns false (all PENDING) ✓
- getAllPending() returns 12 keys ✓
- fail-fast at module load (process.stderr.write + rethrow) ✓
- locked-phrases-guard.test.ts Phase 64 suite: 14/14 pass ✓
- CI legal-gate-production job only runs on main branch push ✓
- CODEOWNERS entry for signoff-registry.json ✓
