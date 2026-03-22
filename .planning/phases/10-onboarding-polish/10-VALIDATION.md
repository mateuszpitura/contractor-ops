---
phase: 10
slug: onboarding-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (via packages/api/vitest.config.ts) |
| **Config file** | packages/api/vitest.config.ts |
| **Quick run command** | `cd packages/api && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd packages/api && npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/api && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd packages/api && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-00-01 | 00 | 1 | IMP-01, IMP-02, IMP-03, SRCH-01 | stub | Wave 0 creates stubs | ❌ W0 | ⬜ pending |
| 10-01-01 | 01 | 1 | IMP-01 | unit | `cd packages/api && npx vitest run src/services/__tests__/import-processor.test.ts -x` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | IMP-02, IMP-03 | unit | `cd packages/api && npx vitest run src/services/__tests__/import-processor.test.ts -x` | ❌ W0 | ⬜ pending |
| 10-02-01 | 02 | 2 | ONBD-01 | unit | `cd packages/api && npx vitest run src/routers/__tests__/settings.test.ts -x` | ❌ W0 | ⬜ pending |
| 10-02-02 | 02 | 2 | ONBD-02 | manual-only | Visual verification across all views | N/A | ⬜ pending |
| 10-03-01 | 03 | 2 | SRCH-01 | unit | `cd packages/api && npx vitest run src/routers/__tests__/search.test.ts -x` | ❌ W0 | ⬜ pending |
| 10-03-02 | 03 | 2 | SRCH-02 | manual-only | Keyboard interaction testing | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/api/src/services/__tests__/import-processor.test.ts` — stubs for IMP-01, IMP-02, IMP-03 (parsing, validation, duplicate detection)
- [ ] `packages/api/src/routers/__tests__/search.test.ts` — stubs for SRCH-01 (unified search endpoint)

*Existing test infrastructure (Vitest + globals) covers framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Empty state rendering with smart sequencing | ONBD-02 | Visual layout + context-dependent CTA content | Navigate to each entity list with no data; verify icon, heading, body, CTA match expected copy and link target |
| Command palette keyboard shortcuts | SRCH-02 | Browser keyboard event handling | Press Cmd+K on each page; verify palette opens; type entity name; verify results appear; press Enter to navigate |
| Onboarding checklist widget display | ONBD-01 | Visual component + dismissal behavior | Create new org; verify checklist appears on dashboard; complete steps; verify progress updates; dismiss and verify collapse |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
