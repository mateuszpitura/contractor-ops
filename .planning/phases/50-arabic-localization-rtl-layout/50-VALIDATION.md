---
phase: 50
slug: arabic-localization-rtl-layout
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 50 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (unit), Playwright (e2e/visual) |
| **Config file** | `apps/web/vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | `pnpm --filter web test -- --run` |
| **Full suite command** | `pnpm --filter web test -- --run && pnpm --filter web playwright test` |
| **Estimated runtime** | ~45 seconds (unit), ~120 seconds (e2e) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter web test -- --run`
- **After every plan wave:** Run full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 50-01-01 | 01 | 1 | L10N-02 | — | N/A | unit | `grep -r 'ps-\|pe-\|ms-\|me-\|text-start\|text-end' apps/web/src/components/ui/` | ❌ W0 | ⬜ pending |
| 50-01-02 | 01 | 1 | L10N-02 | — | N/A | unit | `pnpm --filter web test -- --run` | ❌ W0 | ⬜ pending |
| 50-02-01 | 02 | 1 | L10N-01 | — | N/A | unit | `test -f apps/web/messages/ar.json` | ❌ W0 | ⬜ pending |
| 50-02-02 | 02 | 1 | L10N-05 | — | N/A | unit | `pnpm --filter web test -- --run` | ❌ W0 | ⬜ pending |
| 50-03-01 | 03 | 2 | L10N-03 | — | N/A | unit | `grep -r '<Bdi\|<bdi' apps/web/src/components/` | ❌ W0 | ⬜ pending |
| 50-04-01 | 04 | 2 | L10N-04 | — | N/A | unit | `pnpm --filter web test -- --run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending / ✅ green / ❌ red / ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Existing vitest infrastructure covers unit tests
- [ ] Playwright infrastructure covers visual regression tests for RTL

*Existing infrastructure covers most phase requirements. Visual RTL regression tests may need new Playwright fixtures.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Arabic translation quality | L10N-01 | Professional translator review | Review `apps/web/messages/ar.json` for financial domain accuracy |
| Visual RTL layout correctness | L10N-02 | Visual rendering varies by browser | Open app in Arabic locale, navigate all pages, verify layout |
| Bidi text rendering | L10N-03 | Unicode BiDi edge cases | Enter mixed Arabic/English text in forms, verify display |
| Chart RTL readability | L10N-04 | Visual verification of chart axes | View dashboard charts in Arabic locale |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
