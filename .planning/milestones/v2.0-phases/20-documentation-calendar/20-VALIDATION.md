---
phase: 20
slug: documentation-calendar
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-29
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) |
| **Config file** | `packages/api/vitest.config.ts`, `packages/integrations/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @contractor-ops/api test -- --run` |
| **Full suite command** | `pnpm turbo test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @contractor-ops/api test -- --run`
- **After every plan wave:** Run `pnpm turbo test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 1 | DOCS-01 | unit | `pnpm --filter @contractor-ops/integrations test -- --run` | ❌ W0 | ⬜ pending |
| 20-01-02 | 01 | 1 | DOCS-01 | unit | `pnpm --filter @contractor-ops/api test -- --run` | ❌ W0 | ⬜ pending |
| 20-02-01 | 02 | 1 | CAL-01 | unit | `pnpm --filter @contractor-ops/integrations test -- --run` | ❌ W0 | ⬜ pending |
| 20-02-02 | 02 | 1 | CAL-01 | unit | `pnpm --filter @contractor-ops/api test -- --run` | ❌ W0 | ⬜ pending |
| 20-03-01 | 03 | 2 | DOCS-02 | unit | `pnpm --filter @contractor-ops/api test -- --run` | ❌ W0 | ⬜ pending |
| 20-04-01 | 04 | 2 | CAL-02 | unit | `pnpm --filter @contractor-ops/api test -- --run` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/integrations/src/adapters/__tests__/notion-adapter.test.ts` — stubs for Notion OAuth + search
- [ ] `packages/integrations/src/adapters/__tests__/confluence-adapter.test.ts` — stubs for Confluence OAuth + search
- [ ] `packages/integrations/src/adapters/__tests__/google-calendar-adapter.test.ts` — stubs for Google Calendar OAuth + event CRUD
- [ ] `packages/integrations/src/adapters/__tests__/outlook-calendar-adapter.test.ts` — stubs for Outlook/MS Graph OAuth + event CRUD
- [ ] `packages/api/src/services/__tests__/doc-link-service.test.ts` — stubs for doc linking service
- [ ] `packages/api/src/services/__tests__/calendar-sync.test.ts` — stubs for calendar sync service

*Existing test infrastructure covers framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cmd+K doc search UX | DOCS-02 | Visual interaction with command palette | Open Cmd+K, type doc query, verify "Docs" group appears with provider icons |
| Calendar event appears in Google/Outlook | CAL-01 | External API verification | Connect calendar, create contract with expiry, verify event appears in external calendar |
| Doc link chip click opens new tab | DOCS-01 | Browser behavior | Attach a Notion page to workflow step, click chip, verify new tab opens |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
