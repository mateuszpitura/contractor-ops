---
phase: 59
slug: classification-documents-chain-tracking
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-13
---

# Phase 59 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `59-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `vitest` 3.x (existing, repo-wide); `@testing-library/react` for RTL integration; `axe-core` for a11y; no Playwright for this phase |
| **Config file** | Per-workspace `vitest.config.ts` (existing in `packages/api`, `packages/validators`, `packages/db`, `apps/web`) |
| **Quick run command** | `pnpm --filter @contractor-ops/api test && pnpm --filter @contractor-ops/validators test` (api routers + templates + locked phrases) |
| **Full suite command** | `pnpm test` (workspace root — all tests including web RTL) |
| **Estimated runtime** | ~10s quick (api + validators); ~60-90s full monorepo |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @contractor-ops/api test && pnpm --filter @contractor-ops/validators test && pnpm --filter @contractor-ops/db test`
- **After every plan wave:** Run `pnpm test` (workspace root)
- **Before `/gsd-verify-work`:** Full suite green + UK tax-adviser sign-off on `IR35_DISPUTE_PROCESS_EN` + Steuerberater sign-off on `DRV_DEFENSE_*` German wording
- **Max feedback latency:** under 10s per task commit

---

## Per-Requirement Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| CLASS-03 | `generateSds` renders verdict-first PDF and persists row (org-scoped) | integration | `pnpm --filter @contractor-ops/api test src/routers/__tests__/classification-document.test.ts` | ❌ W0 | ⬜ |
| CLASS-03 | `generateSds` on draft assessment throws `PRECONDITION_FAILED` | integration | same | ❌ W0 | ⬜ |
| CLASS-03 | `generateSds` × 2 on same assessment produces identical SHA-256 (byte stability) | integration | same | ❌ W0 | ⬜ |
| CLASS-03 | SDS template renders coloured pill matching `outcome.verdict` | unit | `pnpm --filter @contractor-ops/api test src/pdf-templates/__tests__/ir35-sds.test.tsx` | ❌ W0 | ⬜ |
| CLASS-03 | SDS template renders one section per IR35 area from `areaResults` | unit | same | ❌ W0 | ⬜ |
| CLASS-03 | SDS template includes `IR35_DISPUTE_PROCESS_EN` verbatim on final page | unit | same | ❌ W0 | ⬜ |
| CLASS-03 | SDS template reads from `questionsSnapshot`, NOT live rule-set constants | unit | same | ❌ W0 | ⬜ |
| CLASS-03 | SDS template falls back to "Undetermined" pill when `verdict='undetermined'` | unit | same | ❌ W0 | ⬜ |
| CLASS-04 | `listByEngagement` auto-seeds CLIENT + WORKER on first call (GB engagement) | integration | `packages/api/src/routers/__tests__/ir35-chain.test.ts` | ❌ W0 | ⬜ |
| CLASS-04 | `upsertParticipant` rejects `linkedContractorId` from another org | integration | same | ❌ W0 | ⬜ |
| CLASS-04 | `markDelivered` sets `sdsDeliveredAt` timestamp | integration | same | ❌ W0 | ⬜ |
| CLASS-04 | `markAcknowledged` sets `sdsAcknowledgedAt` independently of delivery | integration | same | ❌ W0 | ⬜ |
| CLASS-04 | `reorderParticipants` assigns `orderIndex = position`; rejects foreign ids | integration | same | ❌ W0 | ⬜ |
| CLASS-04 | Multi-tenant: Org A cannot list / mutate Org B's chain | integration | same | ❌ W0 | ⬜ |
| CLASS-04 | CLIENT / WORKER removal blocked or auto-recreated (deterministic) | integration | same | ❌ W0 | ⬜ |
| CLASS-06 | `generateDrvDefenseBundle` renders 4-section PDF and persists row | integration | `packages/api/src/routers/__tests__/classification-document.test.ts` | ❌ W0 | ⬜ |
| CLASS-06 | DRV bundle Section 3 contains ALL completed DE assessments (not just latest) | integration | same | ❌ W0 | ⬜ |
| CLASS-06 | DRV bundle Section 4 cross-reference only includes same-tenant assignments | integration | same | ❌ W0 | ⬜ |
| CLASS-06 | DRV bundle embeds `attestationText` + `signedName` + dated line verbatim | integration | same | ❌ W0 | ⬜ |
| CLASS-06 | DRV template renders verbatim `DRV_DEFENSE_*` locked strings | unit | `packages/api/src/pdf-templates/__tests__/drv-defense-bundle.test.tsx` | ❌ W0 | ⬜ |
| D-05 | `signExistingDownload` signs URL without re-uploading (no `PutObjectCommand`) | unit | `packages/api/src/services/__tests__/r2.test.ts` (EXTEND) | ✅ EXTEND | ⬜ |
| D-06 | Prisma client extension blocks `ClassificationDocument.update(...)` | integration | `packages/db/src/__tests__/tenant-scoped-client.test.ts` (EXTEND) | ✅ EXTEND | ⬜ |
| D-06 | `ClassificationDocument` schema has required indexes | unit | Prisma schema parse test (repo pattern) | ❌ W0 | ⬜ |
| D-07 | R2 object key matches `^classification-documents/{orgId}/{assessmentId}/(sds|drv-defense-bundle)-[^/]+-[a-f0-9]{16}\.pdf$` | unit | `packages/api/src/services/__tests__/classification-document-keys.test.ts` | ❌ W0 | ⬜ |
| D-08 | `getDownloadUrl` returns `expiresInSeconds = 300` | integration | `classification-document.test.ts` | ❌ W0 | ⬜ |
| D-09 | Re-running `generateSds` after rule-set version change does NOT rewrite old row bytes | integration | same | ❌ W0 | ⬜ |
| D-18 | Locked-phrase guard: `IR35_DISPUTE_*`, `SDS_*`, `DRV_DEFENSE_*` absent from `messages/*.json` | unit | `packages/validators/src/__tests__/locked-phrases-guard.test.ts` (EXTEND) | ✅ EXTEND | ⬜ |
| WCAG AA | Generate buttons have accessible names + `aria-disabled` tied to assessment status | a11y (axe) | `apps/web/src/components/contractors/classification-documents/__tests__/a11y.test.tsx` | ❌ W0 | ⬜ |
| WCAG AA | IR35 chain table semantic markup: `<table>`, `<th scope="col">`, labelled actions | a11y (axe) | `apps/web/src/components/contractors/ir35-chain/__tests__/a11y.test.tsx` | ❌ W0 | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs filled during planning.*

---

## Wave 0 Requirements

Test infrastructure to create **before** implementation waves begin:

- [ ] `packages/api/src/pdf-templates/__tests__/ir35-sds.test.tsx` — SDS template unit tests (verdict pill, per-area sections, locked phrases, snapshot freeze)
- [ ] `packages/api/src/pdf-templates/__tests__/drv-defense-bundle.test.tsx` — DRV bundle unit tests (4 sections, locked phrases, risk history depth)
- [ ] `packages/api/src/routers/__tests__/classification-document.test.ts` — router integration tests (generate × 2, getDownloadUrl TTL, byte stability, same-tenant cross-ref, multi-tenant)
- [ ] `packages/api/src/routers/__tests__/ir35-chain.test.ts` — router integration tests (auto-seed, upsert, reorder, markDelivered/Acknowledged, multi-tenant)
- [ ] `packages/api/src/services/__tests__/classification-document-keys.test.ts` — key-format regex test
- [ ] EXTEND `packages/api/src/services/__tests__/r2.test.ts` — `signExistingDownload` no-upload test
- [ ] EXTEND `packages/db/src/__tests__/tenant-scoped-client.test.ts` — `ClassificationDocument.update` block test
- [ ] EXTEND `packages/validators/src/__tests__/locked-phrases-guard.test.ts` — `IR35_DISPUTE_*` / `SDS_*` / `DRV_DEFENSE_*` prefix assertions
- [ ] `apps/web/src/components/contractors/classification-documents/__tests__/` — RTL behavior + axe a11y tests
- [ ] `apps/web/src/components/contractors/ir35-chain/__tests__/` — RTL behavior + axe a11y tests
- [ ] Prisma schema change: append `ClassificationDocument` + `Ir35ChainParticipant` + `Ir35OtherClientAttestation` to `packages/db/prisma/schema/classification.prisma` + back-relations in `contractor.prisma` / `organization.prisma` / `auth.prisma` + `[BLOCKING] pnpm --filter @contractor-ops/db db:generate && db:push` — no api tests can run until this lands

Framework installation: none required — Vitest + RTL + axe + `@react-pdf/renderer` + AWS SDK v3 are all already configured repo-wide.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Generated SDS PDF visually matches Phase 56 design language (fonts, spacing, pill styling) | CLASS-03 (UX) | Pixel-diff regression tooling isn't configured; visual approval is a one-time check | Generate a sample SDS with fixture data, open in macOS Preview + Adobe Reader, compare to `gdpr-privacy-notice.pdf` baseline exemplar |
| Generated DRV bundle reads naturally in German and fits auditor expectations | CLASS-06 (legal) | Only a Steuerberater with Rentenversicherungsrecht expertise can judge | Export sample bundle PDF; email to review contact; capture sign-off in Plan 59-04 commit |
| `IR35_DISPUTE_PROCESS_EN` wording matches current HMRC off-payroll guidance | CLASS-03 (legal) | Only a UK tax-adviser / accountant can confirm regulatory currency | Export draft constant; share with adviser; capture sign-off before merging Plan 59-02 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter (gate lifted once all Wave-0 tests exist and pass baseline)

**Approval:** pending
