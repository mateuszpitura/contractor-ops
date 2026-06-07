---
phase: 83
slug: theme-a-us-region-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-07
---

# Phase 83 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `83-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (per-package) |
| **Config files** | `packages/db/vitest.config.ts`, `packages/api/vitest.config.ts`, `apps/cron-worker/vitest.config.ts` (all exist) |
| **Quick run command** | scoped per touched package (table below) |
| **Full suite command** | `pnpm test`. **NEVER** run the unscoped web-vite suite (RAM constraint) |
| **Lockstep enforcer** | `pnpm typecheck` — `Record<DataRegion,...>` maps make the bucket/region change a compile-time lockstep |
| **Estimated runtime** | ~30s scoped per package |

---

## Sampling Rate

- **After every task commit:** scoped quick run for the touched package (e.g. `pnpm --filter @contractor-ops/db test retention-policy`)
- **After every plan wave:** `pnpm typecheck` + scoped tests for db / api / cron-worker / auth
- **Before `/gsd:verify-work`:** full scoped suite green + `pnpm lint:schema lint:audit-log lint:logs lint:region-leakage i18n:parity` (Standing Constraint). **Never** the unscoped web-vite suite
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| SC | Behavior | Requirement | Test Type | Automated Command (scoped) | File Exists | Status |
|----|----------|-------------|-----------|----------------------------|-------------|--------|
| SC#1 | Prisma `DataRegion` enum includes `US` and matches `SUPPORTED_REGIONS` (closes the Phase-82 enum-drift gap) | US-INFRA-01 | unit | `pnpm --filter @contractor-ops/db test region-lockstep` | ⚠️ extend `packages/db/src/__tests__/region-lockstep.test.ts` | ⬜ pending |
| SC#1 | A US-billing org create writes `dataRegion:'US'` via the `organizationCreation.beforeCreate` hook; EU/ME default unchanged; `dataRegion` immutable on update | US-INFRA-01 | unit | scoped test for the Better Auth org-creation hook | ❌ W0 — new hook test | ⬜ pending |
| SC#1 | `getRegionalClient('US')` resolves (no "Unsupported region"); replicas off by default | US-INFRA-01 | unit | `pnpm --filter @contractor-ops/db test region` | ✅ `region.test.ts` (Phase 82 — extend) | ⬜ pending |
| SC#1 | tenant middleware routes a US org to the US client; `OrgMeta.dataRegion` is `DataRegion`-typed | US-INFRA-01 | unit | `pnpm --filter @contractor-ops/api test tenant-region` | ⚠️ extend `packages/api/src/__tests__/tenant-region.test.ts` | ⬜ pending |
| SC#2 | `getRegionalBucket('US')` returns `R2_BUCKET_NAME_US` when set; throws lazily when unset; unsupported region still throws | US-INFRA-02 | unit | `pnpm --filter @contractor-ops/api test regional-storage` | ⚠️ extend `packages/api/src/services/__tests__/regional-storage.test.ts` | ⬜ pending |
| SC#2 | `REGION_BUCKET_MAP` is `Record<DataRegion>` (missing US fails tsc) | US-INFRA-02 | typecheck | `pnpm typecheck --filter @contractor-ops/api` | n/a (compile-time) | ⬜ pending |
| SC#3 | retention resolver: `'1099-NEC'→4`, `'backup-withholding'→7`; `getRetentionCutoff(model,now)` returns the window for a mapped model, `null` for unmapped | US-INFRA-03 | unit | `pnpm --filter @contractor-ops/db test retention-policy` | ❌ W0 — new `packages/db/src/__tests__/retention-policy.test.ts` | ⬜ pending |
| SC#3 | **CANNOT hard-delete in-window:** a fixture-mapped row whose `deletedAt` is older than 90d but inside the 4yr/7yr window is NOT purged | US-INFRA-03 | unit | `pnpm --filter @contractor-ops/cron-worker test data-purge` | ⚠️ extend `apps/cron-worker/src/__tests__/data-purge.test.ts` | ⬜ pending |
| SC#3 | **PURGES after window:** a retained row past its window IS swept; a non-retained row past 90d IS swept (default preserved) | US-INFRA-03 | unit | `pnpm --filter @contractor-ops/cron-worker test data-purge` | ⚠️ extend `data-purge.test.ts` | ⬜ pending |
| SC#3 | soft-delete extension: a retained model in-window cannot be hard-deleted; non-retained behaves as today (`Invoice` fixture) | US-INFRA-03 | unit | `pnpm --filter @contractor-ops/db test soft-delete` | ⚠️ extend `packages/db/src/__tests__/soft-delete.test.ts` | ⬜ pending |
| SC#3 | gdpr erasure: a retained fixture model is soft-deleted-with-exemption (statutory citation in summary + audit), NOT hard-deleted via `deleteByOrgAndCount` | US-INFRA-03 | unit | `pnpm --filter @contractor-ops/api test gdpr` | ⚠️ extend `packages/api/src/routers/__tests__/gdpr.test.ts` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/db/src/__tests__/retention-policy.test.ts` — SC#3 resolver (NEW)
- [ ] auth test for the `organizationCreation.beforeCreate` US-assignment hook — SC#1 creation (NEW)
- [ ] extend `packages/db/src/__tests__/region-lockstep.test.ts` — Prisma-enum ↔ SUPPORTED_REGIONS assertion (closes Phase-82 drift)
- [ ] extend `apps/cron-worker/src/__tests__/data-purge.test.ts` — cannot-delete-in-window + purges-after-window (fixture-mapped model)
- [ ] extend `packages/db/src/__tests__/soft-delete.test.ts` — retained-in-window guard (Invoice fixture)
- [ ] extend `packages/api/src/routers/__tests__/gdpr.test.ts` — retention-exemption branch
- [ ] extend `packages/api/src/services/__tests__/regional-storage.test.ts` — `R2_BUCKET_NAME_US` + US bucket resolution/lazy-throw
- [ ] extend `packages/api/src/__tests__/tenant-region.test.ts` — US org → US client routing

*Fixtures: no conftest gaps — every package has a vitest config; the `Invoice` soft-delete fixture is reused as the representative retained model (D-06; real tax tables attach in Phase 86).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real `us-east-1` Neon DB + US R2 bucket provisioning | US-INFRA-01/02 | LOCAL-ONLY — no real US infra exists; optional env + lazy-throw means routing is unit-testable without it | Post-deploy: provision US Neon + R2, set `DATABASE_URL_US` / `R2_BUCKET_NAME_US`, smoke-test a US org create |
| Per-region production migration apply (`ALTER TYPE DataRegion ADD VALUE 'US'`) | US-INFRA-01 | `prisma migrate dev` blocked by pre-existing drift; applied locally via direct ALTER | Deferred: apply the additive enum migration per region (EU then ME) post-merge |

*The three success criteria all have automated unit coverage; the manual items are infra-provisioning / production-migration, consistent with LOCAL-ONLY posture.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
