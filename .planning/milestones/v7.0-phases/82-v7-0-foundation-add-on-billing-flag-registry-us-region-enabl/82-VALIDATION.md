---
phase: 82
slug: v7-0-foundation-add-on-billing-flag-registry-us-region-enabl
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-07
---

# Phase 82 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `82-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (per-package) |
| **Config file** | `packages/db/vitest.config.ts`, `packages/api/vitest.config.ts`, `packages/feature-flags/vitest.config.ts` (all exist) |
| **Quick run command** | `pnpm --filter @contractor-ops/feature-flags test` (also `--filter @contractor-ops/db` / `--filter @contractor-ops/api`, scoped to the new test files) |
| **Full suite command** | `pnpm test` (turbo → vitest). **NEVER** run the web-vite suite unscoped (MEMORY: eats RAM) |
| **Lockstep enforcer** | `pnpm typecheck` (tsc, CI-canonical) — `Record<DataRegion,string>` makes the region change a compile-time gate |
| **Estimated runtime** | ~30s scoped per package |

---

## Sampling Rate

- **After every task commit:** Run the scoped quick run for the touched package (e.g. `pnpm --filter @contractor-ops/feature-flags test`)
- **After every plan wave:** `pnpm typecheck` (region lockstep is compile-time) + scoped tests for db / api / feature-flags / public-api
- **Before `/gsd:verify-work`:** Full scoped suite green + `pnpm lint:schema lint:audit-log lint:logs i18n:parity` (Standing Constraint)
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| SC | Behavior | Requirement | Test Type | Automated Command | File Exists | Status |
|----|----------|-------------|-----------|-------------------|-------------|--------|
| SC#1 | `requireAddOn('workforce')` denies org without add-on (ADD_ON_REQUIRED FORBIDDEN), allows org with it; composes after `requireTier('STARTER')` | FOUND7-01 | unit | `pnpm --filter @contractor-ops/api test add-on` | ❌ W0 — `packages/api/src/middleware/__tests__/add-on.test.ts` | ⬜ pending |
| SC#1 | REST error-handler maps `ADD_ON_REQUIRED` → 403 JSON | FOUND7-01 | unit | `pnpm --filter @contractor-ops/public-api test error-handler` | ❌ W0 | ⬜ pending |
| SC#1 | grant mutation owner-gated, audit-logged (`resourceType:'ORGANIZATION'`), invalidates sub cache | FOUND7-01 | unit | `pnpm --filter @contractor-ops/api test billing` | ⚠️ extend `packages/api/src/routers/__tests__/billing.test.ts` | ⬜ pending |
| SC#2 | boot gate `process.exit(1)` on a missing v7.0 cohort flag; passes when all present; `FLAG_SIGNOFF_BYPASS=local` downgrades | FOUND7-02 | unit | `pnpm --filter @contractor-ops/feature-flags test boot-gate` | ⚠️ extend `packages/feature-flags/src/__tests__/boot-gate.test.ts` | ⬜ pending |
| SC#2 | all v7.0 `V7_FLAG_KEYS` present in BOTH `FLAGS` and `signoff-registry-flags.json` (`getFlagSignoff(key) !== undefined`) | FOUND7-02 | unit | `pnpm --filter @contractor-ops/feature-flags test v7-flags` | ❌ W0 — `packages/feature-flags/src/__tests__/v7-flags-registered.test.ts` | ⬜ pending |
| SC#2 | the gate is actually CALLED at app boot (`apps/api` / `apps/public-api` / `apps/cron-worker` import + call `assertFlagSignoffsOrExit`) | FOUND7-02 | unit/integration | boot-entrypoint test asserts the call | ❌ W0 (Pitfall 1 — gate currently UNWIRED) | ⬜ pending |
| SC#3 | `SUPPORTED_REGIONS`, `regionSchema.options`, `REGION_ENV_MAP` keys, `REPLICA_ENV_MAP` keys all contain identical region sets (5-way lockstep) | FOUND7-03 | unit | `pnpm --filter @contractor-ops/db test region-lockstep` | ❌ W0 — `packages/db/src/__tests__/region-lockstep.test.ts` | ⬜ pending |
| SC#3 | `region=US` → `buildLazyBag` returns a US bag, no EU coercion, no throw | FOUND7-03 | unit | `pnpm --filter @contractor-ops/api test feature-flag` | ❌ W0 | ⬜ pending |
| SC#3 | `getRegionalClient('US')` does NOT throw "Unsupported data region" (throws only on missing env, lazily) | FOUND7-03 | unit | `pnpm --filter @contractor-ops/db test region` | ❌ W0 | ⬜ pending |
| SC#4 | `IRIS-TCC-ENROLLMENT.md` exists, records ~45-day lead + start date, cross-links Phase 86 | SC#4 | doc-exists | `test -f …/IRIS-TCC-ENROLLMENT.md && grep -q '45' …` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/api/src/middleware/__tests__/add-on.test.ts` — SC#1 allow/deny + chain order (after `requireTier`)
- [ ] `packages/db/src/__tests__/region-lockstep.test.ts` — SC#3 five-way region lockstep
- [ ] extend `packages/feature-flags/src/__tests__/boot-gate.test.ts` — SC#2 exit-on-missing for a v7.0 cohort key
- [ ] `packages/feature-flags/src/__tests__/v7-flags-registered.test.ts` — SC#2 all-keys-present (FLAGS ∧ signoff registry)
- [ ] public-api error-handler test for the `ADD_ON_REQUIRED` branch — SC#1 REST mapping
- [ ] doc-presence check for `IRIS-TCC-ENROLLMENT.md` — SC#4

*Fixtures: no conftest/fixture gaps — vitest configs already exist per package.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| (none) | — | Phase 82 is pure middleware/infra — all four success criteria have automated verification | — |

*All phase behaviors have automated verification. Note: Phase 82 ships NO user-facing UI strings, so no i18n-parity manual check applies here (`en-US.json` is a Phase 84 deliverable).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
