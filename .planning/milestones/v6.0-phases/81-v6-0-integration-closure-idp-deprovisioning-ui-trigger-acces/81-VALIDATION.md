---
phase: 81
slug: v6-0-integration-closure-idp-deprovisioning-ui-trigger-acces
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-06
---

# Phase 81 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `81-RESEARCH.md` → Validation Architecture (HIGH confidence; harness templates verified against live tests).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (workspace; turbo `pnpm test`) |
| **Server tests** | `packages/api/src/__tests__/*.test.ts` + `packages/api/src/services/__tests__/*.test.ts` |
| **web-vite tests** | `apps/web-vite/src/**/__tests__/*.test.tsx` (per-domain `_render.tsx` helper) |
| **Auth tests** | `packages/auth/src/__tests__/roles.test.ts` |
| **Quick run (server)** | `pnpm --filter @contractor-ops/api test <path>` |
| **Quick run (web-vite)** | `pnpm --filter @contractor-ops/web-vite test <path>` — **NEVER unscoped (kills RAM)** |
| **Quick run (auth)** | `pnpm --filter @contractor-ops/auth test roles` |
| **Quick run (integrations)** | `pnpm --filter @contractor-ops/integrations test slack-adapter` |
| **Estimated runtime** | scoped file ~5–20s |

---

## Sampling Rate

- **After every task commit:** Run the touched package's scoped quick-run for the relevant test file.
- **After every plan wave:** `pnpm --filter @contractor-ops/api test` + `pnpm --filter @contractor-ops/auth test` + scoped web-vite tests.
- **Before `/gsd:verify-work`:** both E2E flows green + `pnpm lint:ci` (includes `check:web-vite-data-layer` + i18n en/de/pl/ar parity).
- **Max feedback latency:** < 30 seconds (scoped runs).

---

## Per-Requirement Verification Map

> Task IDs are assigned by the planner; this maps the binding behaviors to their test surface. Each task in PLAN.md must reference the matching row via `<automated>` verify or a Wave 0 dependency.

| Req | Behavior | Test Type | Automated Command | File Exists |
|-----|----------|-----------|-------------------|-------------|
| INT-01 derivation (D-05) | Multi-provider run creates GWS+Slack steps when both enabled+signoff; GWS-only when only GWS | unit | `pnpm --filter @contractor-ops/api test deprovisioning-start` | ✅ extend (`deprovisioning-start.test.ts`) |
| INT-01 D-06 | Empty provider set → throws `DEPROVISIONING_INTEGRATION_NOT_CONFIGURED` (no zero-step run) | unit | same file | ❌ W0 (new case) |
| INT-01 D-10 gate | `startDeprovisioningRun` / `getDeprovisioningEligibility` reject without `idp:start_run` | unit | same file (mock `hasPermission` → false) | ❌ W0 (new case) |
| INT-01 D-10 seed | owner/admin/it_admin hold `idp:start_run`; no other role does; `override_step_failure` stays owner/admin-only | unit | `pnpm --filter @contractor-ops/auth test roles` | ⚠️ update `roles.test.ts:75-86` |
| INT-01 D-01 | `contractorId → assignmentId` resolves most-recent ENDED assignment | unit | new resolver test (api) | ❌ W0 |
| INT-01 D-09 | Existing run for assignment → "view run"; re-trigger returns existing run (P2002, per-assignment key) | unit | `deprovisioning-start.test.ts` (P2002 case exists :227) | ✅ extend |
| INT-01 E2E | ACCESS_REVOKE trigger → start → run created (hook + container composition) | integration | new web-vite hook test + composition | ❌ W0 |
| INT-02 recovery (D-12) | approve → `onComplianceItemSatisfied` fires → held flow PENDING_COMPLIANCE → PENDING | unit | `pnpm --filter @contractor-ops/api test compliance-upload-review` | ✅ extend |
| INT-02 D-14 | notification dispatch failure does NOT roll back the approval | unit | same file | ❌ W0 (new case) |
| INT-02 E2E | portal upload → admin approve → payment gate releases | integration | extend composition or new test | ❌ W0 |
| D-08 (regression) | Slack suspend/revoke execute via org-grid token | unit | `pnpm --filter @contractor-ops/integrations test slack-adapter` | ✅ exists (`slack-adapter.test.ts`) |

*Status legend: ✅ exists/extend · ❌ Wave 0 (new) · ⚠️ update existing invariant.*

---

## Wave 0 Requirements

- [ ] Extend `packages/api/src/__tests__/deprovisioning-start.test.ts` — multi-provider derivation, empty-set throw (D-06), `idp:start_run` gate (D-10), per-assignment idempotency key (D-09).
- [ ] Extend `packages/api/src/__tests__/compliance-upload-review.test.ts` — assert `onComplianceItemSatisfied` fires (D-12) + D-14 notification-failure isolation (add `$queryRaw` / `approvalFlow.update` to mock).
- [ ] New: `contractorId → assignmentId` resolver test (api) — most-recent ENDED disambiguation (D-01).
- [ ] New: web-vite `use-start-deprovisioning` hook test — mirror `use-deprovisioning-run` test pattern + `_render.tsx`.
- [ ] Update `packages/auth/src/__tests__/roles.test.ts` (:75-86) invariants for `idp:start_run` (owner+admin+it_admin grant; rewrite the "only owner/admin hold idp" assertion).
- [ ] E2E: extend `v6-cross-feature-composition.test.ts` (or new `81-int-closure.test.ts`) to compose BOTH flows — the existing composition test deliberately excluded F2 (line 28-30); this fills that gap.
- [ ] Setup: verify 76-WR1 `@@unique([organizationId, idempotencyKey])` index applied locally before relying on P2002 (open question A5).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real provider account suspension (GWS/Slack live API) | INT-01 | Hits external IdP APIs — not exercised in CI; adapters are unit-tested with mocked clients | Staging org with seeded GWS + Slack org-grid credentials → trigger run → confirm provider-side suspension out-of-band |

*All in-process behaviors have automated verification; only live external-API side effects are manual.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
