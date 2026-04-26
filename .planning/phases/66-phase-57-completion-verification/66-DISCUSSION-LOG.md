# Phase 66: Phase 57 Completion & Verification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-26
**Phase:** 66-phase-57-completion-verification
**Areas discussed:** Phase scope shape, HMRC sandbox blocker, Pre-existing test failures, Verification depth

---

## Pre-discussion State Verification

Inventory of Phase 57 artifacts before Phase 66 opens:

| Artifact | State | Evidence |
|---|---|---|
| `validateVat` mutation | ✅ exists | `packages/api/src/routers/contractor.ts:1348` |
| `revalidateVat` mutation | ✅ exists | `packages/api/src/routers/contractor.ts:1409` |
| `setKleinunternehmer` mutation | ✅ exists | `packages/api/src/routers/organization.ts:108` |
| Phase 57 UI components (6 files) | ✅ exist | `vat-validation-status-pill`, `revalidate-vat-button`, `country-compliance-section`, `reverse-charge-line-toggle`, `invoice-footer-legal-notices`, `kleinunternehmer-toggle` (kebab-case under apps/web/src/components) |
| `57-VALIDATION.md` | ✅ approved | `nyquist_compliant: true`, `wave_0_complete: true`, `approved_at: 2026-04-13` |
| `57-VERIFICATION.md` | ❌ MISSING | not in `.planning/phases/57-government-api-clients/` |
| Plan 57-04 Task 3 (9 operator scenarios) | ⚠️ deferred | Per `57-04-SUMMARY.md` "Deferred — Task 3 Human-verify Checkpoint" — autonomous session + HMRC sandbox unprovisioned |
| 3 contractor.test.ts failures | ⚠️ pre-existing | `archive`, `updateLifecycleStage INACTIVE`, `bulkArchive` failing per `57-04-SUMMARY.md` "Out-of-Scope Discoveries" — root cause `da74861e refactor: deep lint cleanup` adding contract.count + contract.groupBy without test harness updates |
| HMRC dev-hub registration | ⚠️ pending | STATE.md ongoing blocker — multi-week, originally planned to start during Phase 56 |

---

## Phase scope shape

| Option | Description | Selected |
|--------|-------------|----------|
| Verification-only | Run /gsd-verify-work, write 57-VERIFICATION.md, that's it. | |
| Verification + 3 test fixes | Verification + extend mock Prisma harness for `contract.count` + `contract.groupBy`. | |
| Verification + re-run 57-04 acceptance | Re-run typecheck + tests, refresh evidence in 57-VERIFICATION.md. | |
| Verification + re-run + 3 test fixes | All three streams. | ✓ |

**User's choice:** Verification + re-run + 3 test fixes
**Notes:** Implies 3 work streams converging into the verification doc. CONTEXT.md D-04 mandates re-validation pass at planning time so already-resolved items get dropped.

---

## HMRC sandbox / Task 3 manual operator scenarios disposition

| Option | Description | Selected |
|--------|-------------|----------|
| Defer per local-only constraint | Mark Task 3 as 'Manual-Only Verification — pending HMRC sandbox provisioning'. Phase 66 closes without operator sign-off. | |
| Add MSW-driven programmatic equivalents | Replace each of the 9 scenarios with a vitest test driving existing components/routers through MSW handlers. | ✓ |
| Hard-block until creds arrive | Phase 66 doesn't close until HMRC dev-hub registration completes. | |

**User's choice:** Add MSW-driven programmatic equivalents
**Notes:** This permanently changes the PAY-03/05 acceptance gate from "operator + HMRC sandbox" to "deterministic CI." HMRC dev-hub registration continues independently as pre-deploy ops work and is no longer a Phase 66 closure gate (D-13/14). MSW handlers from Plans 57-01..57-03 already cover the needed scenarios.

---

## Pre-existing 3 contractor.test.ts failures

| Option | Description | Selected |
|--------|-------------|----------|
| Fix in this phase (mock harness) | Extend `makePrisma` test harness with `contract.count` + `contract.groupBy`. | ✓ |
| Document in VERIFICATION.md, defer fix | Note as pre-existing (NOT Phase 57), introduced by da74861e, tracked separately. | |
| Open backlog phase, defer | Add to backlog (999.x) for dedicated test-infra phase. | |

**User's choice:** Fix in this phase (mock harness)
**Notes:** Verification doc cannot honestly say "tests are green" while 3 reds sit in the same router file under verification. Fix is one-touch (extend shared harness), commit attribution makes clear it closes a regression from `da74861e` not a Phase 57 issue.

---

## Verification depth for 57-VERIFICATION.md

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid: programmatic + flagged manual gaps | Grep for required code symbols + run test commands + capture results; mark Task 3 + HMRC live exercise explicitly as Manual-Only deferred. | ✓ |
| Full /gsd-verify-work (goal-backward) | Use gsd-verifier agent for full goal-backward analysis from REQUIREMENTS.md. | |
| Lightweight: code grep + test results | Just confirm symbols exist + tests pass. | |

**User's choice:** Hybrid: programmatic + flagged manual gaps
**Notes:** Matches `63-VERIFICATION.md` shape so tooling that consumes verification artifacts works uniformly. PAY-02..05 each get an explicit row mapping to test IDs. HMRC live-credential exercise is the ONLY remaining manual-only item, deferred-pre-deploy under the same disposition pattern STATE.md uses for legal/regulatory.

---

## Claude's Discretion

- Exact mock-harness API shape (vi.fn() return defaults vs mockResolvedValue patterns) — match existing siblings like `invoice.count`
- Whether the 9 MSW scenarios map 1:1 to vitest cases or merge into parameterized tests — optimize for clarity not test count
- Format of Pre-Deploy Manual-Only section in 57-VERIFICATION.md — match whatever the project's existing VALIDATION.md `Manual-Only Verifications` section uses

## Deferred Ideas

- HMRC production onboarding (pre-deploy ops, not any phase)
- Phase 67 work (Phase 56 + 58 verification — out of scope)
- a11y test infrastructure (if axe-core not present, scenario 9 stays manual-only)
- Real Prisma test harness across packages/api (separate test-infra phase)
- VALIDATION.md vs VERIFICATION.md template unification (future docs/tooling phase)
- Manager-flag automation (auto-flip roadmap_complete from VERIFICATION.md presence — gsd-sdk improvement)
