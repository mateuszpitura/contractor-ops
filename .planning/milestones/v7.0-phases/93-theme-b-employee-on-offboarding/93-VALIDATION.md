---
phase: 93
slug: theme-b-employee-on-offboarding
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-01
---

# Phase 93 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Seeded from `93-RESEARCH.md` § Validation Architecture. The Per-Task Verification Map is populated by the planner as tasks are authored.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (`vitest run`) — `packages/api/package.json`, `apps/web-vite/package.json` |
| **Config file** | `packages/api/vitest.config.ts`; root `vitest.config.ts` / `vitest.monorepo.ts` |
| **Quick run command** | `pnpm --filter @contractor-ops/api test <path>` |
| **Full suite command** | `pnpm --filter @contractor-ops/api test` (scoped — NEVER unscoped web-vite) |
| **Estimated runtime** | ~30s scoped-by-path; full scoped API suite minutes |

**MEMORY WARNING:** NEVER run the full web-vite suite unscoped — always `pnpm --filter @contractor-ops/web-vite test <path>` (kills Mac RAM).

---

## Sampling Rate

- **After every task commit:** Run scoped `pnpm --filter @contractor-ops/api test <changed-path>` (< 30s)
- **After every plan wave:** `pnpm --filter @contractor-ops/api test` + `pnpm typecheck --filter=@contractor-ops/api` + touched lint guards (`lint:schema`, `lint:audit-log`, `db:audit-enum-casing`, `i18n:parity`, `check:web-vite-*`)
- **Before `/gsd:verify-work`:** Full scoped API suite green + `db:check-drift` green
- **Max feedback latency:** 30 seconds (scoped)

---

## Per-Task Verification Map

> Populated by the planner. Seed rows below map each phase requirement to its automated proof (from RESEARCH.md § Validation Architecture).

| Req | Behavior | Test Type | Automated Command | File Exists |
|-----|----------|-----------|-------------------|-------------|
| EMP-OFF-02 | Worker-keyed `startRun` creates `WorkflowRun(entityType=EMPLOYEE, workerId, contractorId=null)` | unit | `pnpm -F @contractor-ops/api test worker-start-run` | ❌ W0 |
| EMP-OFF-02 | Worker `DeprovisioningRun` cooldown gate reads `EmployeeProfile.terminatedAt` + blocks pre-cooldown | unit | `pnpm -F @contractor-ops/api test worker-deprovisioning` | ❌ W0 |
| EMP-OFF-02 | `assertRunCompletable` still gates worker offboarding (IP + PENDING creds) | unit (regression) | `pnpm -F @contractor-ops/api test workflow-shared` | ✅ extend |
| EMP-OFF-02 | Step runner processes a worker-run step unchanged (externalUserId from step) | unit (regression) | `pnpm -F @contractor-ops/api test idp-deprovisioning-step-runner` | ✅ assert-no-change |
| EMP-ON-01 / EMP-OFF-01 | Per-market template boot-upsert idempotent (re-run = no dup) | unit | `pnpm -F @contractor-ops/<pkg> test upsert-on-boot` | ❌ W0 |
| EMP-OFF-01 | Cert PDF: immutable snapshot + CAS guard (second render skips) + disclaimer present | unit | `pnpm -F @contractor-ops/api test statutory-cert-pdf` | ❌ W0 |
| EMP-ON/OFF | Gov stub returns `{source:'STUB', available:false}` + no network | unit | `pnpm -F @contractor-ops/api test *-stub` | ❌ W0 (mirror elstam-stub) |
| all | New tenant-owning models don't leak cross-org (IDOR) | integration | `pnpm -F @contractor-ops/api test *cross-org*` | ❌ W0 |
| EMP-OFF-01 | Cert disclaimer strings absent from `messages/*.json` (locked-phrases) | guard | existing locked-phrases-guard test | ✅ extend |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/api/src/routers/workflow/__tests__/worker-start-run.test.ts` — EMP-OFF-02 worker branch
- [ ] `packages/api/src/routers/integrations/__tests__/worker-deprovisioning.test.ts` — worker cooldown + nullable-FK run creation
- [ ] `packages/<employee-templates>/src/__tests__/upsert-on-boot.test.ts` — idempotency (mirror `offboarding-templates/__tests__/upsert-on-boot.test.ts`)
- [ ] `packages/api/src/services/__tests__/statutory-cert-pdf.test.ts` — snapshot + CAS + disclaimer
- [ ] `packages/api/src/services/__tests__/*-stub.test.ts` — gov seam shape (mirror ELStAM)
- [ ] Two-org cross-leak regression for `StatutoryCertificate` + per-market template rows
- [ ] Extend locked-phrases-guard with new cert disclaimer keys

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Per-region Prisma migration apply (`db:migrate:all`) | all schema tasks | Drift-blocked repo posture — apply deferred to human gate | Author `__`-prefixed un-applied migration dir + `db:generate`; human applies per-region at deploy |
| Cert PDF visual watermark prominence (adviser-verify) | EMP-OFF-01 | Visual/legal judgment | Render a sample cert; confirm watermark + DRAFT status legible, signoff-registry PENDING |
| Live gov integration (E-Verify/ZUS/Abmeldung/RTI) | EMP-ON/OFF | Out of scope — stubs only this phase | Confirm stub seam returns `{source:'STUB', available:false}`, manual workflow step present |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
