---
phase: 77
slug: f2-idp-gws-slack-adapters-the-wedge
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-31
---

# Phase 77 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> **Upstream:** depends on Phase 76 being executed first (interface, saga, schema,
> router, scope registries). Phase 77 tests import Phase-76-built symbols; they go
> RED until Phase 76 lands, then GREEN as Phase 77 plans execute.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (monorepo standard; MSW for HTTP mocking per Phase 76 D-16 template) |
| **Config file** | per-package `vitest.config.ts` (`packages/integrations`, `packages/api`, `packages/auth`, `packages/feature-flags`, `apps/web-vite`) |
| **Quick run command** | `pnpm --filter @contractor-ops/integrations test <pattern>` (scope to the touched package + pattern) |
| **Full suite command** | `pnpm --filter @contractor-ops/integrations test && pnpm --filter @contractor-ops/api test <idp patterns> && pnpm --filter @contractor-ops/auth test && pnpm --filter @contractor-ops/feature-flags test` |
| **Estimated runtime** | ~30–90 s scoped (NEVER run full unscoped `apps/web-vite` test — kills RAM; always pass a path/pattern arg) |

---

## Sampling Rate

- **After every task commit:** Run the scoped quick command for the touched package + pattern.
- **After every plan wave:** Run the per-package suites for packages touched in that wave.
- **Before `/gsd:verify-work`:** `pnpm typecheck` (tsc, CI-canonical) green monorepo-wide + all scoped IdP suites green.
- **Max feedback latency:** ~90 s.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 77-01-* | 01 | 1 | IDP-03/04/12 | T-77-01-* | Additive types/enums; permission default OWNER+ADMIN only | unit + typecheck | `pnpm --filter @contractor-ops/integrations typecheck && pnpm --filter @contractor-ops/auth test permissions` | ❌ W0 (needs Phase 76 types) | ⬜ pending |
| 77-02-* | 02 | 2 | IDP-03 | T-77-02-* | Write scope required; PII-free hashes; 404→LIKELY_GONE | unit (MSW GWS) | `pnpm --filter @contractor-ops/integrations test google-workspace-deprovision` | ❌ W0 | ⬜ pending |
| 77-03-* | 03 | 2 | IDP-04 | T-77-03-* | SCIM via org-grid token only; Grid-detection non-fatal skip | unit (MSW Slack) | `pnpm --filter @contractor-ops/integrations test slack-deprovision` | ❌ W0 | ⬜ pending |
| 77-04-* | 04 | 3 | IDP-01/03/04/12 | T-77-04-* | QStash signature authn; server-side permission gate; cache after authz | unit + tRPC caller | `pnpm --filter @contractor-ops/api test idp-deprovision idp-preview idp-override` | ❌ W0 | ⬜ pending |
| 77-05-* | 05 | 4 | IDP-01/IDP-12 | T-77-05-* | Permission-gated override button; WCAG states; RTL parity | component + a11y | `pnpm --filter @contractor-ops/web-vite test idp` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Phase 77 does NOT ship its own Wave-0 RED scaffolds in a separate plan — instead each
plan ships its tests alongside its implementation (the Phase-76 dependency already
provides the MSW template + contract-test harness). The de-facto "Wave 0" is **Phase
76 execution**: until Phase 76 lands `Deprovisionable`, the saga schema, the router,
and the scope registries, every Phase 77 test is RED for a missing-symbol reason.

- [ ] Phase 76 executed (interface + saga + schema + router + scopes + MSW template)
- [ ] `packages/integrations/src/idp/error-classifier.ts` — pure-function table (77-01)
- [ ] MSW handlers for GWS Admin SDK token/signOut/users + Slack SCIM/admin.session/users (77-02/03, extend Phase 76 D-16 template)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Multi-region Prisma apply (additive columns/enums) | IDP-03/04/12 | LOCAL-ONLY standing constraint; `push-all-regions.ts` is a manual operator step (Plan 70-09 / 76-02 precedent) | After 77-01 lands schema: review generated SQL for no DROP/destructive ALTER, then `npx tsx packages/db/scripts/push-all-regions.ts` against `DATABASE_URL_EU` + `DATABASE_URL_ME` |
| Live GWS/Slack deprovision against real tenants | IDP-03/04 | CI uses MSW mocks; real-provider behavior + exact rate-limits verified in staging with a throwaway test user | Connect a sandbox GWS + Slack-Grid org, run deprovision on a disposable account, confirm suspend/revoke/sign-out + SCIM deactivate + audit rows |
| Exact API signatures / rate-limit numbers | IDP-03/04 | Context7 unavailable in planning sandbox; pin at adapter-execution time (CONTEXT.md Discretion) | During 77-02/03 execution, confirm `tokens.delete` scope (`.user.security`), Slack `admin.users.session.invalidate` scope string, and current QPS caps via Context7 `googleapis` / Slack docs |

---

## Validation Sign-Off

- [x] All tasks have automated verify or Wave-0 (Phase 76) dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (Phase 76 execution + classifier + MSW handlers)
- [x] No watch-mode flags
- [x] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
