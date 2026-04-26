---
phase: 26
slug: calendar-wiring-fixes
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-30
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `packages/api/vitest.config.ts` |
| **Quick run command** | `cd packages/api && npx vitest run src/routers/__tests__/calendar.test.ts src/services/__tests__/calendar-sync.test.ts` |
| **Full suite command** | `cd packages/api && npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 26-01-01 | 01 | 1 | CAL-01 | unit | `cd packages/api && npx vitest run src/routers/__tests__/integration.test.ts` | ❌ W0 | ⬜ pending |
| 26-01-02 | 01 | 1 | CAL-02 | unit | `cd packages/api && npx vitest run src/routers/__tests__/workflow.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/api/src/routers/__tests__/integration.test.ts` — stubs for CAL-01 OAuth URL fix
- [ ] `packages/api/src/routers/__tests__/workflow.test.ts` — stubs for CAL-02 calendar event hook

---

## Validation Architecture

Extracted from 26-RESEARCH.md for Nyquist compliance.

### CAL-01: OAuth Connect URL Fix
- **What to verify:** Connect buttons navigate to authorization URL (not callback URL)
- **How to verify:** Integration router returns URL starting with provider's authorizationUrl domain
- **Automated check:** `grep "authorizationUrl" packages/integrations/src/adapters/outlook-calendar-adapter.ts`

### CAL-02: Runtime Calendar Event Hook
- **What to verify:** `startRun` calls `createTaskCalendarEvent` for calendar-enabled tasks
- **How to verify:** `grep "createTaskCalendarEvent" packages/api/src/routers/workflow.ts`
- **Automated check:** TypeScript compilation passes with calendar import in workflow.ts
