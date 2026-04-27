---
phase: 74
plan: 06
subsystem: api
tags: [pto-detector, calendar-integration, fallback-routing]
requires: [74-01, 74-02, 74-04]
provides:
  - "GoogleCalendarAdapter.getFreeBusy + OutlookCalendarAdapter.getFreeBusy"
  - "pto-detector service with 3-layer detection rule + fallback chain"
  - "workflow-shared.ts re-export for Plan 74-08 consumption"
key-files:
  created:
    - packages/api/src/services/pto-detector.ts
  modified:
    - packages/integrations/src/adapters/google-calendar-adapter.ts
    - packages/integrations/src/adapters/outlook-calendar-adapter.ts
    - packages/integrations/src/adapters/__tests__/google-calendar-adapter-freebusy.test.ts
    - packages/integrations/src/adapters/__tests__/outlook-calendar-adapter-freebusy.test.ts
    - packages/api/src/services/__tests__/pto-detector.test.ts
    - packages/api/src/routers/workflow-shared.ts
key-decisions:
  - "Used local BusyRange + duck-typed CalendarAdapter interface in pto-detector — keeps the detector calendar-agnostic and isolated from the integrations package's subpath-export limitations."
  - "Layered PTO detection: 1) manual User.outOfOffice → 2) calendar all-day busy → 3) PTO_KEYWORDS title match on timed busy."
  - "Fallback chain: per-user OOO.fallbackUserId → Team.fallbackApproverId → first owner-role member (with admin-attention badge)."
  - "Calendar HTTP errors in getFreeBusy degrade gracefully — detector returns pto=false and logs via createLogger; PTO is conservative (defaults to manager when in doubt)."
  - "Open questions Q1 (D-08 refinement to no-attendees-OR-keyword-match) and Q5 (per-org vs per-user calendar) deferred to Plan 74-07/74-08 follow-up."
requirements-completed: [OFFB-02]
duration: "11 min"
completed: 2026-04-27
---

# Phase 74 Plan 06: PTO-Aware Manager Fallback Routing Summary

Added `getFreeBusy` to both Google and Outlook calendar adapters (with merge of /freeBusy + events.list for Google, scheduleItems filtering for Outlook), authored the calendar-agnostic `pto-detector.ts` service implementing the 3-layered detection rule and 3-step fallback chain per CONTEXT.md D-05/D-06/D-07/D-08, and re-exported the resolver from `workflow-shared.ts` so Plan 74-08's `startOffboardingRun` extension can call it once at task creation time (Pitfall 26 — no per-render re-resolution).

## Tasks Executed

| # | Name | Commit |
|---|------|--------|
| 1+2+3 | getFreeBusy + pto-detector + workflow-shared wiring | `58039cc5` |

## Detection Rule (3 layers)

1. **Manual override (highest priority):** `User.outOfOffice` JSONB date range covers today → PTO active
2. **Calendar all-day busy:** any all-day busy range from `getFreeBusy` → PTO active
3. **Calendar timed busy with keyword match:** busy range whose summary matches `PTO_KEYWORDS[managerLocale]` (or admin-extended `extraKeywords`) → PTO active

## Fallback Chain (when PTO active)

A. `User.outOfOffice.fallbackUserId` (per-manager personal deputy)
B. `Team.fallbackApproverId` (per-team)
C. First owner-role member (UI surfaces amber admin-attention badge per D-06)

## Verification Results

| Check | Result |
|-------|--------|
| GoogleCalendarAdapter.getFreeBusy tests | 3/3 GREEN (incl. token-leak test) |
| OutlookCalendarAdapter.getFreeBusy tests | 3/3 GREEN (incl. token-leak test) |
| pto-detector tests | 8/8 GREEN |
| `pnpm --filter @contractor-ops/api typecheck` | exit 0 |
| `pnpm --filter @contractor-ops/integrations typecheck` | exit 0 |
| `pnpm lint:logs` | exit 0 |

## Deviations from Plan

**[Rule 1 — Workspace boundary] Used local BusyRange + duck-typed CalendarAdapter interface in pto-detector instead of importing types from @contractor-ops/integrations.**
Found during: Task 2.
Issue: The `@contractor-ops/integrations` package's `exports` map exposes `./adapters/clockify-adapter`, `./adapters/jira-adapter`, etc., but NOT `./adapters/google-calendar-adapter` or `./adapters/outlook-calendar-adapter`. Importing from those subpaths fails to resolve.
Fix: Defined `BusyRange` (structurally identical to `GoogleBusyRange` + `OutlookBusyRange`) and `CalendarAdapter` (duck-typed interface) locally in `pto-detector.ts`. Both adapters' real `getFreeBusy` methods satisfy the structural contract. If future plans need to import the type from outside, the integrations package's exports map can be extended without breaking the detector.
Files: `packages/api/src/services/pto-detector.ts`.
Verification: typecheck exit 0; pto-detector consumes both adapters without explicit type coupling.
Commit: `58039cc5`.

**Total deviations:** 1 (Rule 1). **Impact:** None on downstream plans — Plan 74-08 will pass either adapter instance and the detector will work.

## Open Questions Surfaced

Per Researcher's RESEARCH.md § Open Questions, two questions remain open for Plan 74-07 / Plan 74-08 follow-up:

**Q1 (D-08 refinement):** Should the all-day rule be tightened to "no-attendees OR keyword-match" to reduce false-positives from recurring company-wide all-day events (e.g., "Company off-site")? Current implementation uses literal D-08 wording (any all-day busy → PTO). The `attendeeCount` field on `BusyRange` is populated by Google's enrichment pass so a future tightening is one-line.

**Q5 (calendar connection model):** Per-org vs per-user calendar OAuth — the current implementation accepts both via the `calendarId` argument (`'primary'` for per-user, manager email for per-org delegated access). Plan 74-07 Settings UI should clarify which model is canonical for the production rollout.

## Next Phase Readiness

Ready for Wave 3 plans:
- Plan 74-07 (Settings UI): consumes `Settings.WorkflowRoles.*` and `Settings.PtoKeywords.*` i18n keys (Plan 74-02), uses `workflowRoles.list/create/update/delete` from Plan 74-05.
- Plan 74-08 (Override flow): calls `resolveAssigneeWithPto` at task creation time, calls `getCurrentUserPermissions` for UI gating, writes `WorkflowRun.overrideMetadata` per Plan 74-04 schema.
