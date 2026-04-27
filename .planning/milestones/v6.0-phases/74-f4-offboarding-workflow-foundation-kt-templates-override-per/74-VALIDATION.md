---
phase: 74
slug: f4-offboarding-workflow-foundation-kt-templates-override-per
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-27
---

# Phase 74 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `74-RESEARCH.md` § Validation Architecture (lines 1162+).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 1.x (workspace), Playwright 1.x (e2e) |
| **Config file** | `vitest.workspace.ts` (root); per-package `vitest.config.ts` |
| **Quick run command** | `pnpm --filter @contractor-ops/{db,api,auth,offboarding-templates} test --run` |
| **Full suite command** | `pnpm test --run` |
| **Estimated runtime** | ~90 s quick / ~6 min full |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter <changed-package> test --run`
- **After every plan wave:** Run quick command above
- **Before `/gsd-verify-work`:** Full suite green; `pnpm i18n:parity` green; `pnpm lint:schema` green; `pnpm lint:logs` green
- **Max feedback latency:** 90 s for quick, 6 min for full

---

## Per-Task Verification Map

> Filled by `gsd-planner` after PLAN.md files land. Researcher proposed 8 plans across 4 waves; planner produces ~30-40 task rows mapping each to REQ-ID + threat-model entry + verification approach.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 74-01-01 | 01 | 0 | OFFB-01..11 (RED scaffolds) | — | Failing tests baseline | unit | `pnpm --filter @contractor-ops/offboarding-templates test --run` | ❌ W0 | ⬜ pending |
| 74-02-* | 02 | 1 | OFFB-01, OFFB-03 | T-74-02-* | Seed templates ship as typed-const + i18n keys | unit | `pnpm --filter @contractor-ops/offboarding-templates test --run` + `pnpm i18n:parity` | ❌ W0 | ⬜ pending |
| 74-03-* | 03 | 1 | OFFB-10 | T-74-03-permission-regression | OWNER-only override permission registered + CI table-test | unit | `pnpm --filter @contractor-ops/auth test rbac --run` | ❌ W0 | ⬜ pending |
| 74-04-* | 04 | 2 | OFFB-01, OFFB-02, OFFB-07, OFFB-10, OFFB-11 | T-74-04-schema-drop | Schema migration single ALTER per region (autonomous: false) | unit + manual review | `pnpm --filter @contractor-ops/db test --run` + visual `migration.sql` review | ❌ W0 | ⬜ pending |
| 74-05-* | 05 | 2 | OFFB-03, OFFB-10 | T-74-05-* | tRPC `workflowRoles.*` CRUD + `getCurrentUserPermissions` | integration | `pnpm --filter @contractor-ops/api test workflow-roles --run` | ❌ W0 | ⬜ pending |
| 74-06-* | 06 | 2 | OFFB-02 | T-74-06-pto-spam | PTO match rule + fallback chain + free-busy lookup | integration | `pnpm --filter @contractor-ops/api test pto-fallback --run` | ❌ W0 | ⬜ pending |
| 74-07-* | 07 | 3 | OFFB-03 | T-74-07-* | Settings > Workflow Roles UI (en/pl/de parity) | integration + e2e | `pnpm --filter @contractor-ops/web test workflow-roles --run` + Playwright | ❌ W0 | ⬜ pending |
| 74-08-* | 08 | 3 | OFFB-10, OFFB-11 | T-74-08-client-bypass | Override dialog + mutation + audit + permanent badge (server re-validates) | integration + e2e | `pnpm --filter @contractor-ops/web test override-dialog --run` + Playwright | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/offboarding-templates/src/__tests__/seeds.test.ts` — stubs for OFFB-01 (4 seed shape + i18n key existence)
- [ ] `packages/api/src/routers/__tests__/workflow-roles.test.ts` — stubs for OFFB-03 (CRUD + auto-selection)
- [ ] `packages/api/src/middleware/__tests__/rbac-override.test.ts` — stubs for OFFB-10 (OWNER-only permission)
- [ ] `packages/api/src/__tests__/pto-fallback.test.ts` — stubs for OFFB-02 (PTO match rule)
- [ ] `packages/db/src/__tests__/workflow-role-template-backfill.test.ts` — stubs for OFFB-01 (seed upsert idempotency)
- [ ] `apps/web/src/components/offboarding/__tests__/override-dialog.test.tsx` — stubs for OFFB-10/11 (server re-validation, badge persistence)
- [ ] `apps/web/src/components/admin/workflow-roles/__tests__/role-template-form.test.tsx` — stubs for OFFB-03 (en/pl/de field parity)
- [ ] `pnpm i18n:parity` baseline run captures the new `Offboarding.Templates.*` keyspace as expected presence (not new violations)

*Wave 0 ships failing-test scaffolds + the new `@contractor-ops/offboarding-templates` workspace skeleton; everything turns GREEN as Waves 1-3 land their implementations.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Multi-region schema migration apply (Plan 74-04 `autonomous: false`) | OFFB-01..11 | Live DB write per region; LOCAL-ONLY constraint defers production apply | Run `tsx packages/db/scripts/push-all-regions.ts` against `$DATABASE_URL_EU` then `$DATABASE_URL_ME`. Visual review of generated `migration.sql` for unexpected DROPs/RENAMEs (T-74-04 risk) before apply. |
| Outlook free-busy lookup against real tenant | OFFB-02 | Requires real Outlook OAuth grant; no sandbox in repo | Connect a test Outlook tenant in dev env; mark calendar busy; run offboarding workflow; verify fallback routing kicks in. |
| Google free-busy lookup against real tenant | OFFB-02 | Requires real GWS OAuth grant + scope-capabilities backfill (Phase 70 Plan 09 deferred apply) | Same as Outlook with a GWS tenant; verify D-08 PTO match rule on all-day vs timed events. |
| `(English)` indicator visual treatment on ops-added templates with locale gaps (D-15) | OFFB-03 | UI/UX judgment call — match existing design-system convention | Manual UI walkthrough: ops adds a role template with only `titleEn`; switch app locale to pl + de; confirm muted `(English)` suffix or info icon renders per design-system convention. |
| Override-dialog acknowledgement copy approval | OFFB-10 | Legal-sensitive copy (compliance-gap acknowledgement) — DEFERRED per LOCAL-ONLY | Working copy ships with "Needs verification by legal entity before production deploy" annotation in PLAN SUMMARY.md. No CI hard-block. |
| Settings > Calendar PTO Keywords ops-extension UI | OFFB-02 | Phase 73 owns broader admin polish; Phase 74 ships functional UI only | Verify ops can add a custom keyword (e.g., `Krank` for German healthcare leave); save reflects in next PTO check. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (planner fills per-task rows)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (8 scaffolds enumerated above)
- [ ] No watch-mode flags
- [ ] Feedback latency < 90 s for quick command
- [ ] `nyquist_compliant: true` set in frontmatter (planner flips after PLAN.md files pass plan-checker)

**Approval:** pending — flips to `approved YYYY-MM-DD` after gsd-plan-checker validates Dimension 8 coverage on all PLAN.md files.

---

## Threat Model Cross-Reference

> Per Phase 70 D-09..12 and Phase 76 D-04, every plan's `<threat_model>` block must include at least one entry that maps to a verification row above. Researcher's risk-register (74-RESEARCH.md § Risk Register, lines ~) seeds the canonical threats:

- **T-74-02-***: Seed-template i18n key drift between code constants and message catalog (Phase 70 `pnpm i18n:parity` catches at CI)
- **T-74-03-permission-regression**: Better Auth `statements` array merge collapses an existing role's permissions (CI table-test all 10 lowercase role names)
- **T-74-04-schema-drop**: `prisma migrate dev --create-only` produces unexpected DROP/RENAME in `migration.sql` (manual review mandatory; mirrors T-70-09-05)
- **T-74-05-***: tRPC mutation accepts client-supplied `overriddenByUserId` (server MUST derive from session)
- **T-74-06-pto-spam**: Recurring all-day company event triggers PTO false-positive (D-08 keyword-list refinement; planner adds title-suffix exclusion)
- **T-74-07-***: Ops-added template with empty per-locale field renders blank (D-15 `(English)` fallback enforced)
- **T-74-08-client-bypass**: Override dialog client-side validation bypassed via direct mutation call (server `requirePermission()` re-checks every invocation)
