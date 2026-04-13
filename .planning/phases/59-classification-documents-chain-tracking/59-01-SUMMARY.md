---
phase: 59-classification-documents-chain-tracking
plan: 01
subsystem: database, validators, api-services, testing
tags: [prisma, ir35, drv, classification-documents, append-only, locked-phrases, r2-storage, ci-guard]

requires:
  - phase: 58-classification-engine-rule-sets
    provides: ClassificationAssessment model + ClassificationAssessmentStatus enum, locked DE phrases pattern, RESERVED_DISCLAIMER_KEYS + LOCKED_DISCLAIMERS precedents
provides:
  - Three new Prisma models (ClassificationDocument, Ir35ChainParticipant, Ir35OtherClientAttestation) + two enums (ClassificationDocumentKind, Ir35ChainRole) pushed to the live Neon DB
  - Back-relations wired on Organization, ContractorAssignment, Contractor, User, ClassificationAssessment
  - Append-only guard in the tenant-scoped Prisma client extension blocking update/updateMany/upsert on ClassificationDocument at runtime (D-06)
  - Eight new locked legal phrases (IR35_DISPUTE_PROCESS_EN, SDS_DISCLAIMER_EN, DRV_DEFENSE_* family — 6 constants) exposed from @contractor-ops/validators
  - CI guard (prefix-based) blocking IR35_DISPUTE_ / SDS_ / DRV_DEFENSE_ keys from leaking into apps/web/messages/*.json across all 4 locales
  - signExistingDownload(key, ttlSeconds?, filename?) R2 helper — signs a GET URL without re-uploading (D-05)
  - Content-addressed buildClassificationDocumentKey helper + CLASSIFICATION_DOCUMENT_KEY_REGEX
  - 6 Wave-0 test scaffolds (46 describe.todo placeholders total) for Plans 59-02 / 59-03 / 59-04
affects: 59-02, 59-03, 59-04

tech-stack:
  added: []
  patterns:
    - APPEND_ONLY_MODELS enforcement via $allOperations Prisma client extension
    - Content-addressed R2 key with sha256[0:16] suffix for deduplication + tenant prefix for defense-in-depth
    - Prefix-based locked-phrase CI guard (extensible without touching future constants)

key-files:
  created:
    - packages/db/src/__tests__/tenant-scoped-client.test.ts
    - packages/api/src/services/classification-document-keys.ts
    - packages/api/src/services/__tests__/classification-document-keys.test.ts
    - packages/api/src/pdf-templates/__tests__/ir35-sds.test.tsx
    - packages/api/src/pdf-templates/__tests__/drv-defense-bundle.test.tsx
    - packages/api/src/routers/__tests__/classification-document.test.ts
    - packages/api/src/routers/__tests__/ir35-chain.test.ts
    - apps/web/src/components/contractors/classification-documents/__tests__/a11y.test.tsx
    - apps/web/src/components/contractors/ir35-chain/__tests__/a11y.test.tsx
    - .planning/phases/59-classification-documents-chain-tracking/59-01-SUMMARY.md
  modified:
    - packages/db/prisma/schema/classification.prisma
    - packages/db/prisma/schema/contractor.prisma
    - packages/db/prisma/schema/organization.prisma
    - packages/db/prisma/schema/auth.prisma
    - packages/db/src/tenant.ts
    - packages/validators/src/legal/en.ts
    - packages/validators/src/legal/de.ts
    - packages/validators/src/legal/disclaimers.ts
    - packages/validators/src/index.ts
    - packages/validators/src/__tests__/locked-phrases-guard.test.ts
    - packages/api/src/services/r2.ts
    - packages/api/src/services/__tests__/r2.test.ts
    - packages/api/vitest.config.ts

key-decisions:
  - "Append-only enforcement lives in tenant-scoped Prisma client extension (not Postgres triggers) — keeps the guard in TypeScript, testable without a live DB, and co-located with tenant-scope logic"
  - "Content-addressed R2 keys use first 16 hex chars of sha256 (64 bits) — enough entropy for per-assessment uniqueness while keeping keys short"
  - "CI guard uses prefix matching (not per-key enumeration) — avoids future maintenance when Plans 59-02/59-04 add more IR35_/SDS_/DRV_DEFENSE_ constants"
  - "Extend packages/api/vitest.config.ts to include *.test.tsx — pdf-template scaffolds require .tsx; existing config only matched .ts (gap, not regression)"
  - "Omit classificationDocuments back-relation on ContractorAssignment — ClassificationDocument relates via ClassificationAssessment (no direct FK), adding the back-relation would fail prisma validate"

patterns-established:
  - "APPEND_ONLY_MODELS Set + APPEND_ONLY_BLOCKED_OPERATIONS Set checked at the top of $allOperations, before tenant-scoping"
  - "Locked-phrase modules export constants, RESERVED_*_KEYS array, LOCKED_* record, and are re-exported through packages/validators/src/index.ts"
  - "R2 helpers pair: putObjectAndSignDownload (new upload) + signExistingDownload (re-sign existing); default TTL 300s"

requirements-completed: [CLASS-03, CLASS-04, CLASS-06]

duration: 40min
completed: 2026-04-13
---

# Phase 59 Plan 01: Wave-1 Foundation Summary

**Stood up the entire Wave-1 foundation for Phase 59 — 3 new Prisma models + append-only guard + 8 locked legal phrases + 2 R2 helpers + 6 Wave-0 test scaffolds, all verified against the live Neon DB and the validators + api test suites.**

## What was built

1. **Prisma schema (Task 1)** — `ClassificationDocument`, `Ir35ChainParticipant`, `Ir35OtherClientAttestation` models + `ClassificationDocumentKind`, `Ir35ChainRole` enums. Pushed to Neon via `prisma db push` (no data loss; additive-only). Back-relations on Organization / ContractorAssignment / Contractor / User / ClassificationAssessment.

2. **Append-only guard (Task 2)** — `APPEND_ONLY_MODELS` Set checked at the top of the `$allOperations` hook in `packages/db/src/tenant.ts`. Throws `"ClassificationDocument is append-only; mutations after insert are forbidden (Phase 59 D-06)."` on update/updateMany/upsert. 6 new tests (`tenant-scoped-client.test.ts`) cover create OK, update/updateMany/upsert throw, findMany OK, and non-append-only models unchanged.

3. **Locked phrases (Task 3)** — 8 new constants:
   - `IR35_DISPUTE_PROCESS_EN` (legal/en.ts) — HMRC off-payroll dispute process, 45-day window
   - `SDS_DISCLAIMER_EN` (legal/disclaimers.ts) — Chapter 10 ITEPA 2003 disclaimer
   - `DRV_DEFENSE_COVER_HEADER_DE` + `SECTION_TITLES_DE` + `TABLE_HEADERS_DE` + `ATTESTATION_FOOTER_DE` + `CROSS_REFERENCE_FOOTER_DE` (legal/de.ts) — DRV defense bundle locked strings
   - `DRV_DEFENSE_DISCLAIMER_DE` (legal/disclaimers.ts)
   All re-exported from `packages/validators/src/index.ts`.

4. **CI guard extension (Task 4)** — `packages/validators/src/__tests__/locked-phrases-guard.test.ts` adds a prefix-based assertion: `messages/{locale}.json must not contain any key with prefix IR35_DISPUTE_, SDS_, or DRV_DEFENSE_`. Phase 56 + 58 tests remain green; 4 new test cases (1 per locale × en/pl/ar/de).

5. **R2 helpers (Task 5)** — `signExistingDownload(key, ttlSeconds?, filename?)` in `packages/api/src/services/r2.ts` — signs a GetObjectCommand without PutObject. `buildClassificationDocumentKey(...)` + `CLASSIFICATION_DOCUMENT_KEY_REGEX` in `packages/api/src/services/classification-document-keys.ts`. Full unit coverage (4 r2 + 5 key builder tests).

6. **Wave-0 test scaffolds (Task 6)** — 6 files × total 46 `describe.todo` entries mapping exactly to the acceptance criteria of Plans 59-02 / 59-03 / 59-04. Also extended `packages/api/vitest.config.ts` to include `*.test.tsx` so the pdf-template scaffolds are picked up.

## Verification

- `prisma validate` → 0 errors
- `prisma db push` → sync successful (Neon EU, pooled)
- `@contractor-ops/db` test — tenant-scoped-client + tenant regression green (soft-delete.test.ts has pre-existing failures unrelated to Phase 59)
- `@contractor-ops/validators` test — locked-phrases-guard.test.ts: 36 tests pass, 0 fail; invoice.test.ts has pre-existing failures unrelated to Phase 59
- `@contractor-ops/api` test — r2.test.ts: 4 new signExistingDownload tests pass; classification-document-keys.test.ts: 5 tests pass; scaffolds run as skipped/todo; pre-existing generateStorageKey test has 2 failures unrelated to Phase 59
- `pnpm --filter @contractor-ops/validators tsc --noEmit` → 0 errors

## Deviations from Plan

- **[Rule 1 — Bug] Omitted classificationDocuments back-relation on ContractorAssignment** — Task 1 listed adding `classificationDocuments ClassificationDocument[]` inside `ContractorAssignment`, but `ClassificationDocument` has no FK `contractorAssignmentId` (it relates to `ClassificationAssessment`). `prisma validate` fails if added. Back-relation exists correctly on `ClassificationAssessment` instead. The acceptance criterion `grep -l 'classificationDocuments\s*ClassificationDocument\[\]' packages/db/prisma/schema/contractor.prisma` therefore returns no match — I've documented the deviation in the commit. Plans 59-02 + 59-04 must query `classificationDocuments` via `classificationAssessment.classificationDocuments` (nested include) — this is the correct Prisma idiom anyway.

- **[Rule 1 — Bug] Removed `as const` from multi-line string concatenations** — TypeScript 5 rejects `as const` on `'...' + '...'` expressions (TS1355). The values are still typed as `string` (not literal type), but the CI guard tests and disclaimer test assertions still pass.

- **[Rule 1 — Bug] Extended two pre-existing tests in `locked-phrases-guard.test.ts`:**
  - `privacyScopedKeys` Set now excludes DRV_DEFENSE_* keys (the strings live in the DRV PDF template, not privacy notices)
  - `every LOCKED_DE_PHRASES value is a non-empty string` now recurses into nested-object values (DRV_DEFENSE_SECTION_TITLES_DE and DRV_DEFENSE_TABLE_HEADERS_DE are nested object maps)

- **[Rule 2 — Missing Critical] Extended vitest config** — `packages/api/vitest.config.ts` `include` array only matched `*.test.ts`; scaffolds required `*.test.tsx`.

**Total deviations:** 4 auto-fixed (3× Rule 1, 1× Rule 2). **Impact:** none — all changes are additive or test-harness adjustments; no business logic altered.

## Authentication Gates

None.

## Issues Encountered

None blocking Phase 59 execution. Pre-existing test failures in `packages/db/src/__tests__/soft-delete.test.ts`, `packages/validators/src/__tests__/invoice.test.ts`, and `packages/api/src/services/__tests__/r2.test.ts` (generateStorageKey suite) predate this plan and are documented in project test-debt backlog.

## Manual Review Gate (must resolve before Plan 59-02 / 59-04 merge)

- UK tax adviser sign-off on `IR35_DISPUTE_PROCESS_EN` + `SDS_DISCLAIMER_EN` wording against current HMRC off-payroll guidance (ITEPA 2003 Chapter 10).
- Steuerberater sign-off on `DRV_DEFENSE_*` German wording against DRV Rundschreiben RS 2022/1 + § 7a SGB IV.
- Capture sign-off artefacts in `.planning/phases/59-classification-documents-chain-tracking/legal-review/`:
  - `uk-adviser-sign-off-YYYYMMDD.md`
  - `steuerberater-sign-off-YYYYMMDD.md`

**Plan-level status:** ready for Plans 59-02 (SDS pipeline), 59-03 (chain + attestation), 59-04 (DRV bundle).

## Self-Check: PASSED

- key-files.created exist: `packages/api/src/services/classification-document-keys.ts`, `packages/db/src/__tests__/tenant-scoped-client.test.ts` ✓
- `git log --oneline --all --grep="59-01"` returns 5 commits ✓
- All 4 Task 1-5 automated verifications green ✓
- Task 6 scaffolds picked up by vitest (6 skipped/todo; 0 failed) ✓
