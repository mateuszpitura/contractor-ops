---
phase: 85
slug: theme-a-w-form-intake-tax-treaty-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-16
---

# Phase 85 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 85-RESEARCH.md § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (turbo-orchestrated) |
| **Config file** | `packages/api/vitest.config.ts` (services + routers); `apps/web-vite/vitest.config.ts` (UI) |
| **Quick run command** | `pnpm --filter @contractor-ops/api test <path>` |
| **Full suite command** | `pnpm --filter @contractor-ops/api test` (API package only) |
| **Estimated runtime** | ~30–90s (scoped) |

> ⚠ NEVER run the full web-vite suite unscoped — it exhausts Mac RAM (CLAUDE.md memory). Always pass a path arg: `pnpm --filter @contractor-ops/web-vite test src/components/portal/tax-forms`.

---

## Sampling Rate

- **After every task commit:** Run the single new/extended test file for the task (`pnpm --filter @contractor-ops/api test <path>`).
- **After every plan wave:** `pnpm --filter @contractor-ops/api test` (API package full) + scoped web-vite component tests by path.
- **Before `/gsd:verify-work`:** API package green + scoped web-vite green + `pnpm typecheck` + `pnpm check:web-vite-data-layer` + `i18n:parity` gate + `pnpm check:wiki-brain`.
- **Max feedback latency:** ~90 seconds (scoped).

---

## Per-Task Verification Map

| Requirement | Wave | Behavior | Test Type | Automated Command | File Exists |
|-------------|------|----------|-----------|-------------------|-------------|
| US-LOC-02 | 1 | US treaty row resolves correct rate by (residency, US, income type); specific beats `XX` | unit | `pnpm --filter @contractor-ops/api test src/services/__tests__/treaty-rate.service.test.ts` | ❌ W0 |
| US-LOC-02 | 1 | No treaty row → 30% statutory default | unit | same file | ❌ W0 |
| US-LOC-02 | 1 | US rows do NOT affect `calculateWht` SA path (non-breakage regression) | unit | `pnpm --filter @contractor-ops/api test src/services/__tests__/tax-rate.service.test.ts` | ✅ extend |
| US-LOC-03 | 1 | W-8BEN article auto-populates from residency + treaty row | unit | treaty-rate.service test | ❌ W0 |
| US-LOC-02/03 | 1 | Manual override + reason wins over auto; emits audit | unit | treaty-rate.service test | ❌ W0 |
| US-FORM-01 | 2 | W-9 submit inserts immutable row; supersede prior; audit row written | integration | `pnpm --filter @contractor-ops/api test src/routers/portal/__tests__/tax-form.test.ts` | ❌ W0 |
| US-FORM-01 | 2 | Re-cert inserts NEW row + sets prior status=SUPERSEDED (immutability) | integration | same | ❌ W0 |
| US-FORM-01 | 2 | Full SSN never appears in snapshot / portal response (PII) | integration | same (assert no full SSN in output) | ❌ W0 |
| US-FORM-02 | 2 | W-8BEN-E captures LOB category (line 14b) + treaty article (line 15) | integration | same | ❌ W0 |
| US-FORM-02 | 1 | Foreign company → W-8BEN-E; foreign individual → W-8BEN (routing) | unit | `src/services/__tests__/tax-form-routing.test.ts` | ❌ W0 |
| US-FORM-01/02 | 2 | ESIGN attestation captures typed name + ts + IP + contractorId into snapshot | integration | tax-form integration test | ❌ W0 |
| US-FORM-01/02 | 2 | Staff read/track surface returns status without leaking full SSN (RBAC) | integration | `src/routers/core/__tests__/tax-form-staff.test.ts` | ❌ W0 |
| US-FORM-01/02 | 3 | Wizard renders loading/empty/error + RTL (ar) parity | component | `pnpm --filter @contractor-ops/web-vite test src/components/portal/tax-forms` | ❌ W0 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/api/src/services/__tests__/treaty-rate.service.test.ts` — US-LOC-02/03 (resolution, override, default, auto-populate)
- [ ] `packages/api/src/services/__tests__/tax-form-routing.test.ts` — form-routing logic (US-FORM-01/02)
- [ ] `packages/api/src/routers/portal/__tests__/tax-form.test.ts` — portal submit/draft/supersede/PII/ESIGN (needs portal-session test harness — pattern exists in portal session tests)
- [ ] `packages/api/src/routers/core/__tests__/tax-form-staff.test.ts` — staff read/track RBAC
- [ ] Extend `packages/api/src/services/__tests__/tax-rate.service.test.ts` — US-rows-don't-break-SA regression
- [ ] `apps/web-vite/src/components/portal/tax-forms/__tests__/` — wizard states + RTL
- [ ] Framework install: none (vitest present)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Per-country treaty rate/article numerical accuracy | US-LOC-02/03 | Adviser-deferred per D-04 — seeded as annotated placeholders; legal/tax-adviser verifies before production | Cross-check seeded `treatyRate`/`treatyArticle` rows against IRS treaty tables with a tax adviser |
| UAE/KSA = no US income-tax treaty (30% statutory) | US-LOC-02 | Direction high-confidence but adviser-confirm (research A6) | Confirm UAE/KSA seed as `treatyRate: null` / 30% statutory |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
