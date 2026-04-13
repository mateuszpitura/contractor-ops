---
phase: 58
slug: classification-engine-rule-sets
status: shipped-pending-legal-review
nyquist_compliant: false
nyquist_compliant_reason: "Automated gates pass (locked-phrases guard + classification + validators + API suites green; web classification + country-compliance suites green). Remaining gate is external Steuerberater + UK tax-adviser sign-off — deferred post-deploy per .planning/STATE.md §Standing Project Constraints (local-only app)."
wave_0_complete: true
created: 2026-04-12
---

# Phase 58 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `58-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `vitest` 3.x (existing, repo-wide); `@testing-library/react` for RTL integration; `axe-core` for a11y. Playwright not needed in Phase 58. |
| **Config file** | Per-workspace `vitest.config.ts` (existing); new `packages/classification/vitest.config.ts` mirroring sibling packages |
| **Quick run command** | `pnpm --filter @contractor-ops/classification test && pnpm --filter @contractor-ops/validators test` (scoring + locked phrases) |
| **Full suite command** | `pnpm test` (workspace root) |
| **Estimated runtime** | ~5s quick (classification + validators); ~60-90s full monorepo |

---

## Sampling Rate

- **After every task commit:** `pnpm --filter @contractor-ops/classification test && pnpm --filter @contractor-ops/validators test`.
- **After every plan wave:** `pnpm test` (workspace root — all tests including router integration).
- **Before `/gsd-verify-work`:** full suite green + Steuerberater sign-off + UK tax-adviser sign-off.
- **Max feedback latency:** under 10s per task commit.

---

## Per-Requirement Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| CLASS-01 | Profile registry resolves GB→IR35, DE→Schein; throws for unknown country | unit | `pnpm --filter @contractor-ops/classification test src/__tests__/registry.test.ts` | ❌ W0 | ⬜ |
| CLASS-01 | Adding a new profile via `registerProfile` works without touching engine core | unit | same | ❌ W0 | ⬜ |
| CLASS-02 | IR35 dispositive rules (strong-inside on Sub/MOO → inside; strong-outside on Sub → outside) | unit | `pnpm --filter @contractor-ops/classification test profiles/ir35/__tests__/scoring.test.ts` | ❌ W0 | ⬜ |
| CLASS-02 | IR35 composite rule (≥3 leaning → verdict; else undetermined) | unit | same | ❌ W0 | ⬜ |
| CLASS-02 | IR35 question inventory has 5 areas with ≥3 questions each; every question has `caseLawCitation` | unit | `…/profiles/ir35/__tests__/rule-set.test.ts` | ❌ W0 | ⬜ |
| CLASS-05 | DRV weighted sum — CATEGORY_WEIGHTS sum to 100; thresholds (29.9 green / 30 amber / 60 amber / 60.1 red) | unit | `…/profiles/scheinselbstandigkeit/__tests__/scoring.test.ts` | ❌ W0 | ⬜ |
| CLASS-05 | DRV "Nicht anwendbar" scores 0 and is distinguishable from missing | unit | same | ❌ W0 | ⬜ |
| CLASS-05 | DRV economic-dependency billing-ratio 83% → rawScore 3; 50% → 0 | unit | same | ❌ W0 | ⬜ |
| CLASS-05 | Every DRV criterion has `drvReference` citation | unit | `…/profiles/scheinselbstandigkeit/__tests__/rule-set.test.ts` | ❌ W0 | ⬜ |
| CLASS-11 | `createDraft` on engagement with no assessments creates draft row scoped to org | integration | `packages/api/src/routers/__tests__/classification.test.ts` | ❌ W0 | ⬜ |
| CLASS-11 | `createDraft` with existing draft returns existing row (no dup) | integration | same | ❌ W0 | ⬜ |
| CLASS-11 | `submit` creates outcome + snapshot + `immutableAfter`; status → completed | integration | same | ❌ W0 | ⬜ |
| CLASS-11 | `submit` on already-completed row throws | integration | same | ❌ W0 | ⬜ |
| CLASS-11 | Re-run after completion creates NEW draft row (append-only); old completed row unchanged | integration | same | ❌ W0 | ⬜ |
| CLASS-11 | `listByContractor` returns all assessments across all engagements, draft-first then completedAt desc | integration | same | ❌ W0 | ⬜ |
| CLASS-11 | `acknowledgeDisclaimer` sets timestamp; re-ack is idempotent | integration | same | ❌ W0 | ⬜ |
| CLASS-11 | Multi-tenant scoping: Org A cannot read Org B's assessment | integration | same | ❌ W0 | ⬜ |
| CLASS-02+05 | `questionsSnapshot` is frozen on submit; subsequent rule-set constant changes do NOT affect stored snapshot | unit | `packages/classification/src/__tests__/snapshot.test.ts` | ❌ W0 | ⬜ |
| D-07 | Locked phrase guard — `CLASSIFICATION_SCHEIN_*` and `DISCLAIMER_*` keys absent from `messages/*.json` | unit | `packages/validators/src/__tests__/locked-phrases-guard.test.ts` (EXTEND) | ✅ extend | ⬜ |
| D-07 | DRV wizard step 4 renders `CLASSIFICATION_SCHEIN_ECONOMIC_DEP` verbatim | integration (RTL) | same | ✅ extend | ⬜ |
| D-07 | Disclaimer modal renders `DISCLAIMER_IR35_BODY` / `DISCLAIMER_SCHEIN_BODY` verbatim | integration (RTL) | same | ✅ extend | ⬜ |
| D-12 | Disclaimer modal blocks outcome until acknowledged (Escape + overlay-click disabled) | integration (RTL) | `apps/web/src/components/contractors/classification/__tests__/classification-disclaimer-dialog.test.tsx` | ❌ W0 | ⬜ |
| D-10 | Wizard autosave fires on blur + mutates draft row via tRPC | integration (RTL + MSW) | `apps/web/src/components/contractors/classification/wizard/__tests__/classification-wizard-shell.test.tsx` | ❌ W0 | ⬜ |
| D-09 | Wizard step guard blocks Next until current step Zod validates | integration (RTL) | same | ❌ W0 | ⬜ |
| D-16 | IR35 outcome page renders verdict banner + 5 area cards | integration (RTL snapshot) | `apps/web/src/app/[locale]/contractors/[id]/engagements/[engagementId]/classification/[assessmentId]/__tests__/outcome.test.tsx` | ❌ W0 | ⬜ |
| D-16 | DRV outcome page renders traffic-light banner + 4 category bars + criterion breakdown | integration (RTL snapshot) | same | ❌ W0 | ⬜ |
| D-08 | Outcome page reads from `questionsSnapshot`, NOT live rule-set constant | integration | same | ❌ W0 | ⬜ |
| WCAG AA | Disclaimer modal has `role="alertdialog"`, `aria-labelledby`, `aria-describedby`, initial focus on checkbox | a11y (axe) | `apps/web/src/components/contractors/classification/__tests__/a11y.test.tsx` | ❌ W0 | ⬜ |
| WCAG AA | Wizard progress bar has correct `aria-valuenow` / `aria-valuemax` fractional values | a11y (axe) | same | ❌ W0 | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs filled during planning.*

---

## Wave 0 Requirements

Test infrastructure to create **before** implementation waves begin:

- [ ] `packages/classification/vitest.config.ts` — new test config (mirror sibling package)
- [ ] `packages/classification/src/__tests__/registry.test.ts` — registry smoke test
- [ ] `packages/classification/src/__tests__/snapshot.test.ts` — snapshot immutability
- [ ] `packages/classification/src/profiles/ir35/__tests__/scoring.test.ts` — dispositive + composite coverage
- [ ] `packages/classification/src/profiles/ir35/__tests__/rule-set.test.ts` — inventory assertions
- [ ] `packages/classification/src/profiles/scheinselbstandigkeit/__tests__/scoring.test.ts` — weighted sum + thresholds
- [ ] `packages/classification/src/profiles/scheinselbstandigkeit/__tests__/rule-set.test.ts` — inventory assertions
- [ ] `packages/api/src/routers/__tests__/classification.test.ts` — tRPC caller with test DB (mirror existing `legal.test.ts` / `equipment.test.ts` patterns)
- [ ] `apps/web/src/components/contractors/classification/**/__tests__/*.test.tsx` — RTL integration tests (wizard + outcome + disclaimer dialog + tile + list)
- [ ] **EXTEND** `packages/validators/src/__tests__/locked-phrases-guard.test.ts` — add `CLASSIFICATION_*` + `DISCLAIMER_*` coverage (file exists — extend, don't recreate)
- [ ] Prisma schema: `packages/db/prisma/schema/classification.prisma` + `[BLOCKING] pnpm --filter @contractor-ops/db db:generate && db:push` — no test runs until this lands

**Framework install:** None — vitest + RTL + axe already configured repo-wide.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| IR35 question inventory legal accuracy | CLASS-02 | Case-law-backed phrasing needs UK tax-adviser review; auto-verification of legal meaning not possible | UK tax-adviser reviews proposed IR35 question inventory (5 areas × ~3-5 questions) against CEST, Atholl House [2022] UKSC, PGMOL [2024] UKSC, Ready Mixed Concrete [1968], Lorimer [1994]; signs off with corrections integrated before Wave 3 merge |
| DRV criterion inventory + category-weight split | CLASS-05 | DRV Rundschreiben RS 2022/1 does not publish verbatim 20-criterion list or the 30/30/25/15 weight split; Steuerberater interpretation required | Steuerberater reviews proposed 20-criterion inventory + category weights + every criterion's `drvReference`; assessment language in German formal Sie register |
| Formal Sie register across DE classification strings | CLASS-05, D-07 | Natural-language register classification not reliably auto-verified beyond Du/Dir/Dein grep | Steuerberater reads all DE wizard prompts, help text, disclaimer modal copy, outcome page labels — confirms consistent formal Sie register |
| Locked phrases verbatim in rendered DE UI | D-07 | RTL tests catch presence but not legal-correct context — semantic sign-off requires expert | Steuerberater verifies `CLASSIFICATION_SCHEIN_*` phrases render in correct semantic context (not just verbatim string match) |
| Wizard UX first-run acceptance | D-09, D-10 | Subjective flow evaluation; keyboard navigation feels; error-recovery UX | Maintainer runs full IR35 + DRV wizard end-to-end for the 3 outcome paths (inside / outside / undetermined × green / amber / red); reports on confusion points, draft-resume behavior, print output fidelity |
| Outcome print/PDF fidelity | D-16 | Print CSS output cannot be reliably snapshot-tested | Maintainer opens print dialog for each outcome variant, verifies all collapsibles force-expanded, semantic-triad preserved, disclaimer visible, no cut-off text |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all ❌ W0 references
- [ ] No watch-mode flags in any command
- [ ] Feedback latency under 10s for quick command
- [ ] Every requirement CLASS-01/02/05/11 has at least one automated test row
- [ ] Locked-phrase CI guard extended for CLASSIFICATION_* + DISCLAIMER_*
- [ ] `nyquist_compliant: true` set in frontmatter once planner assigns task IDs + two-track review sign-offs (Steuerberater + UK tax-adviser) land

**Approval:** pending — flip to `approved YYYY-MM-DD` once plans land, task IDs fill TBD column, and both external reviews sign off.
