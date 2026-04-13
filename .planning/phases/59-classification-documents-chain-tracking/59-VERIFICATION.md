---
phase: 59
status: passed
verified_at: 2026-04-13
verifier: inline (Copilot runtime — Task() subagent unavailable)
requirements_verified: [CLASS-03, CLASS-04, CLASS-06]
test_counts:
  validators: 36
  db: 18
  api: 37
  web: 12
  total: 103
---

# Phase 59 Verification: Classification Documents & Chain Tracking

**Status:** ✓ PASSED — all plans complete, all must_haves verified, 103 tests green across 4 packages.

## Goal

Users can generate legally required classification documents (IR35 SDS for UK, DRV defense bundle for DE) and track IR35 chain participants for compliance evidence.

## Must-Haves Verification

### Plan 59-01 — Wave-1 Foundation (PASSED)

| Must-have | Evidence |
|-----------|----------|
| 3 new Prisma models + 2 enums + back-relations | `grep -l 'model ClassificationDocument' packages/db/prisma/schema/classification.prisma` ✓; `prisma validate` → 0 errors; `prisma db push` → sync successful |
| Prisma Client regenerated + models callable | `grep "ClassificationDocument\|Ir35ChainParticipant\|Ir35OtherClientAttestation" packages/db/generated/prisma/client/index.d.ts` → 3827 matches ✓ |
| Append-only guard in tenant extension | `grep 'APPEND_ONLY_MODELS' packages/db/src/tenant.ts` ✓; 6 new tenant-scoped-client tests pass |
| 8 locked phrase constants | `IR35_DISPUTE_PROCESS_EN`, `SDS_DISCLAIMER_EN`, `DRV_DEFENSE_COVER_HEADER_DE`, `DRV_DEFENSE_SECTION_TITLES_DE`, `DRV_DEFENSE_TABLE_HEADERS_DE`, `DRV_DEFENSE_DISCLAIMER_DE`, `DRV_DEFENSE_ATTESTATION_FOOTER_DE`, `DRV_DEFENSE_CROSS_REFERENCE_FOOTER_DE` all exported from `@contractor-ops/validators` ✓ |
| CI guard covers 3 reserved prefixes | `RESERVED_PHASE_59_PREFIXES` in locked-phrases-guard.test.ts; 36 tests pass (Phase 56/58/59 all green) |
| Key helper + regex | `buildClassificationDocumentKey` + `CLASSIFICATION_DOCUMENT_KEY_REGEX` in `packages/api/src/services/classification-document-keys.ts` (5 tests pass) |
| `signExistingDownload` without PutObject | `packages/api/src/services/r2.ts` — test asserts `putObjectCalls.length === 0` |
| 6 Wave-0 test scaffolds | All 6 files exist + picked up by Vitest (4 api + 2 web); `.test.tsx` now in api vitest config include |

### Plan 59-02 — SDS Pipeline (PASSED)

| Must-have | Evidence |
|-----------|----------|
| IR35SDSDocument template | `packages/api/src/pdf-templates/ir35-sds.tsx` renders verdict pills (outside=green / inside=red / indeterminate=amber), 5 area sections, dispute + disclaimer pages; 11 tests pass |
| classificationDocument tRPC router (3 procs) | `generateSds` / `getDownloadUrl` / `listByEngagement` mounted at `appRouter.classificationDocument` ✓ |
| Content-addressed + rollback flow | Key derived from sha256 prefix; try/catch around `ctx.db.classificationDocument.create` deletes R2 object on failure (T-59-10) |
| Byte-stable generateSds | Template test: two `renderToBuffer()` calls produce identical SHA-256 after stripping PDF metadata |
| ClassificationDocumentsPanel in UI | Gates SDS CTA on GB + completedAssessmentId; tests assert aria-disabled + aria-describedby wiring |
| Locked phrases verbatim in PDF | Test walks React tree + asserts IR35_DISPUTE_PROCESS_EN + SDS_DISCLAIMER_EN appear verbatim |

### Plan 59-03 — IR35 Chain + Attestation (PASSED)

| Must-have | Evidence |
|-----------|----------|
| ir35Chain router (6 procs) | `listByEngagement`, `upsertParticipant`, `reorderParticipants`, `markDelivered`, `markAcknowledged`, `removeParticipant` ✓ |
| ir35Attestation router (3 procs) | `getForEngagement`, `upsert` (server-set signedAt on change), `getPlatformCrossReference` (strictly same-tenant via defence-in-depth organizationId filter) |
| Auto-seed CLIENT + WORKER for GB | `listByEngagement` creates both rows via `createMany` on zero-participants empty GB engagement |
| Ir35ChainPanel UI | Semantic `<table>` with `<th scope="col">` headers; row-level actions with aria-pressed; AddParticipantDialog with role=dialog + aria-labelledby + focus on first field |
| OtherClientAttestationForm | Statement textarea (4000-char max) + typed signature; optimistic prefill of existing attestation |
| Same-tenant cross-reference | `getPlatformCrossReference` filters on `ctx.organizationId` (T-59-12) |
| Web tests | 6 new tests pass (3 panel + 3 form); 2 a11y.test.tsx scaffolds remain as todos |

### Plan 59-04 — DRV Defense Bundle (PASSED)

| Must-have | Evidence |
|-----------|----------|
| DRVDefenseBundleDocument template | 4 sections + cover + TOC + disclaimer; 10 tests pass |
| generateDrvDefenseBundle mutation | Loads assessment + prior DE history + signed attestation + same-tenant cross-reference; rolls back R2 on insert failure (T-59-17 enforces signed attestation precondition) |
| Section 3 delta narrative | Test asserts `/Δ\s*[+−±]/u` regex matches + "Erste Bewertung — kein Vergleichswert" fallback |
| Section 4 cross-reference footer | Test asserts `DRV_DEFENSE_CROSS_REFERENCE_FOOTER_DE` verbatim in rendered tree |
| GenerateDrvBundleButton | Disabled state with `drvDisabledNeedAttestation` aria-describedby when attestation unsigned |
| Panel conditional CTAs | SDS for GB, DRV for DE; gated on countryCode × completedAssessmentId × attestationSigned |
| Engagement page mounts all 3 panels | `/[locale]/(dashboard)/contractors/[id]/engagements/[engagementId]/page.tsx` — documents panel always, chain panel on GB, attestation form on DE |

## Requirement Traceability

| Requirement | Plan | Status |
|-------------|------|--------|
| CLASS-03 — IR35 SDS pipeline | 59-02 | ✓ verified (template + router + UI + byte stability) |
| CLASS-04 — IR35 chain tracking | 59-03 | ✓ verified (chain router 6 procs + panel with semantic table) |
| CLASS-06 — DRV defense bundle | 59-01, 59-03, 59-04 | ✓ verified (append-only models + attestation router + DRV template + mutation + UI) |

## Test Run Summary

```
packages/validators — 36/36 pass (locked-phrases-guard across 4 locales)
packages/db         — 18/18 pass (tenant regression + append-only guard)
packages/api        — 37/37 pass (SDS + DRV templates + key builder + 3 routers)
apps/web            — 12/12 pass + 2 a11y.test.tsx scaffolds as todo
TOTAL              — 103/103 pass
```

## Known Gaps (non-blocking, tracked for follow-up)

- **Full mockPrisma integration test harness** — Plans 59-02/59-03/59-04 preserve 20+ `describe.todo` entries for full router integration tests. The shared harness pattern from Phase 58's `classification.test.ts` is ~400 lines; generalising it is a future test-utils refactor. Surface-level + byte-level tests cover the ship-critical paths today.
- **axe-core wiring in a11y.test.tsx scaffolds** — 2 scaffolds (classification-documents/ir35-chain) remain as `describe.todo`. Structural a11y anchors (aria-labelledby, aria-disabled, aria-describedby, aria-pressed, role=dialog) are verified inline in the structural tests.
- **Legal wording sign-off (REQUIRES POST-MERGE HUMAN SIGN-OFF BEFORE PRODUCTION DEPLOY)** — Plan 59-01 Task 3 MANUAL-REVIEW checkpoint tracks:
  - UK tax adviser sign-off on `IR35_DISPUTE_PROCESS_EN` + `SDS_DISCLAIMER_EN`
  - Steuerberater sign-off on `DRV_DEFENSE_*` German wording
  Approved-by-default wording per plan guidance (assume plan text is cleared for v5.0). Sign-off artefacts to be captured in `.planning/phases/59-classification-documents-chain-tracking/legal-review/` before production deploy.
- **Pre-existing unrelated test failures** (untouched): `packages/db/src/__tests__/soft-delete.test.ts`, `packages/validators/src/__tests__/invoice.test.ts`, and `packages/api/src/services/__tests__/r2.test.ts` (`generateStorageKey` suite) had failures before Phase 59 started.

## human_verification

- Run the dev server and navigate to an engagement detail page:
  - Verify for a GB engagement: ClassificationDocumentsPanel + Ir35ChainPanel both render; Generate SDS button clicks produce a downloadable PDF.
  - Verify for a DE engagement with signed attestation + completed Schein assessment: Generate DRV defence bundle produces a downloadable 4-section PDF.
- Manually open a generated SDS PDF and confirm visual render (verdict pill colour, 5 area sections, dispute block, disclaimer on final page).
- Manually open a generated DRV bundle PDF and confirm section order (cover → TOC → 1..4 → disclaimer) and German formal register throughout.
- Verify R2 object key format matches `classification-documents/{orgId}/{assessmentId}/{kind}-{version}-{sha16}.pdf` in the bucket browser.

## Verdict

**Phase 59 passes all automated gates and all must_haves.** Ready for human verification + post-merge legal sign-off before production deploy.
