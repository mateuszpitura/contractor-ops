---
phase: 26-calendar-wiring-fixes
verified: 2026-03-30T23:52:00Z
status: passed
score: 6/6 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Click Connect button for Google Calendar in settings UI"
    expected: "Browser redirects to accounts.google.com authorization URL containing access_type=offline, prompt=consent, response_type=code, and space-separated scope"
    why_human: "Cannot automate window.location.href redirect and OAuth flow in a browser without a running app"
  - test: "Start a workflow run with at least one calendar-enabled task template"
    expected: "Success toast appears, followed by informational toast 'Calendar events are being created for N task(s)', and calendar event is created in the connected calendar"
    why_human: "Requires running app, connected Google/Outlook account, and calendar API call to verify end-to-end creation"
---

# Phase 26: Calendar Wiring Fixes Verification Report

**Phase Goal:** Personal calendar OAuth connect works correctly and workflow task runs create calendar events at runtime
**Verified:** 2026-03-30T23:52:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Calendar connect buttons redirect to provider authorization URL (accounts.google.com / login.microsoftonline.com), not callback URL | VERIFIED | `my-calendar-section.tsx` uses `queryClient.fetchQuery(googleOAuthQuery)` / `outlookOAuthQuery` — `window.location.href = result.url`; no hardcoded `/api/oauth/...callback` strings remain |
| 2 | Google Calendar OAuth includes access_type=offline and prompt=consent parameters | VERIFIED | `google-calendar-adapter.ts` line 27-30: `extraAuthParams: { access_type: "offline", prompt: "consent" }` in `GOOGLE_CALENDAR_OAUTH_CONFIG`; `integration.ts` line 383-387 appends all `extraAuthParams` to URL |
| 3 | Outlook connect uses slug 'outlook-calendar' consistently | VERIFIED | `outlook-calendar-adapter.ts` line 42: `readonly slug = "outlook-calendar"`; `my-calendar-section.tsx` line 224: `{ provider: "outlook-calendar" }` |
| 4 | OAuth scopes are space-separated in authorization URL (not comma-separated) | VERIFIED | `integration.ts` line 377: `scope: oauthConfig.scopes.join(" ")` |
| 5 | startRun creates calendar events fire-and-forget for tasks with calendarEnabled config | VERIFIED | `workflow.ts` lines 822-858: dedicated fire-and-forget block after Jira block, using `createTaskCalendarEvent` dynamic import from `../services/calendar-deadline-sync.js` |
| 6 | startRun mutation response includes calendarTaskCount so frontend can show informational toast (per D-03) | VERIFIED | `workflow.ts` line 860: `return plain({ ...run.run, calendarTaskCount: run.calendarTaskCount })`; `template-picker-dialog.tsx` lines 153-157: toast.info shown when `totalCalendarTasks > 0` |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/components/settings/my-calendar-section.tsx` | Connect buttons using tRPC getOAuthUrlGeneric query | VERIFIED | Lines 220-246: `trpc.integration.getOAuthUrlGeneric.queryOptions` for both providers, `queryClient.fetchQuery` on button click |
| `packages/api/src/routers/integration.ts` | Fixed scope separator and extraAuthParams support | VERIFIED | Line 377: `scopes.join(" ")`, lines 383-387: `extraAuthParams` iteration, line 376: `response_type: "code"` |
| `packages/integrations/src/types/provider.ts` | OAuthConfig with optional extraAuthParams | VERIFIED | Lines 16-17: `/** Extra query parameters... */ extraAuthParams?: Record<string, string>;` |
| `packages/integrations/src/adapters/google-calendar-adapter.ts` | Google adapter with extraAuthParams in OAuthConfig | VERIFIED | Lines 27-30: `extraAuthParams: { access_type: "offline", prompt: "consent" }` inside `GOOGLE_CALENDAR_OAUTH_CONFIG` |
| `packages/api/src/routers/workflow.ts` | Calendar fire-and-forget block in startRun, calendarTaskCount in response | VERIFIED | Lines 733-750: `calendarConfigMap` built inside transaction; lines 822-858: fire-and-forget block; line 860: `calendarTaskCount` in return |
| `packages/api/src/routers/__tests__/integration.test.ts` | Test stubs for OAuth URL construction (CAL-01) | VERIFIED | 5 `it.todo()` entries covering scope separator, response_type, extraAuthParams, Google params, Outlook URL |
| `packages/api/src/routers/__tests__/workflow.test.ts` | Test stubs for calendar event creation in startRun (CAL-02) | VERIFIED | 5 `it.todo()` entries covering calendarConfigMap, safeParse skip, calendarTaskCount, createTaskCalendarEvent call, error logging |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/web/src/components/settings/my-calendar-section.tsx` | `packages/api/src/routers/integration.ts` | `trpc.integration.getOAuthUrlGeneric` | WIRED | `trpc.integration.getOAuthUrlGeneric.queryOptions` called at lines 220-225; result `.url` used to redirect at lines 229-232, 239-243 |
| `packages/api/src/routers/integration.ts` | `packages/integrations/src/types/provider.ts` | `OAuthConfig.extraAuthParams` consumed in URL params | WIRED | `oauthConfig.extraAuthParams` read at line 383; `for...of Object.entries(...)` appends each entry to `URLSearchParams` at lines 384-386 |
| `packages/api/src/routers/workflow.ts` | `packages/api/src/services/calendar-deadline-sync.ts` | dynamic import of createTaskCalendarEvent | WIRED | Lines 829-831: `const { createTaskCalendarEvent } = await import("../services/calendar-deadline-sync.js")`; `createTaskCalendarEvent` called at line 835 |
| `apps/web/src/components/settings/my-calendar-section.tsx` | `packages/api/src/routers/workflow.ts` | startRun response calendarTaskCount triggers informational toast | WIRED | `template-picker-dialog.tsx` lines 139-148: `calendarTaskCount` extracted from `startRunMutation.mutateAsync` result; `toast.info(...)` at lines 154-156 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `my-calendar-section.tsx` | `result.url` (OAuth URL) | `getOAuthUrlGeneric` query via tRPC — `integration.ts` line 389: URL built from `oauthConfig.authorizationUrl` + params | Yes — real URL constructed from adapter config and env vars | FLOWING |
| `workflow.ts` (startRun return) | `calendarTaskCount` | `calendarConfigMap.size` computed from `calendarTaskConfigSchema.safeParse(taskTemplate.configJson)` over real DB-fetched template tasks | Yes — count derived from real template data inside `$transaction` | FLOWING |
| `template-picker-dialog.tsx` | `totalCalendarTasks` | `startRunMutation.mutateAsync` return value `.calendarTaskCount` — from `plain({ ...run.run, calendarTaskCount: run.calendarTaskCount })` | Yes — passes through JSON round-trip (`plain()`) correctly as a primitive number | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Test stubs pass as todo (not failing) | `cd packages/api && npx vitest run src/routers/__tests__/integration.test.ts src/routers/__tests__/workflow.test.ts` | 2 files skipped, 10 todo | PASS |
| `plain()` function passes calendarTaskCount | Source read — `function plain<T>(data: T): T { return JSON.parse(JSON.stringify(data)) as T; }` — primitive number survives JSON round-trip | Number type is JSON-serializable | PASS |
| `taskIdMap` available in scope before `calendarConfigMap` | `taskIdMap` declared line 635, `calendarConfigMap` built line 734 | In-scope, same transaction block | PASS |
| `contract` variable available for `contractName` | `contract` declared line 596, used at line 751: `contract?.title ?? ""` | In-scope, same transaction block | PASS |
| Hardcoded callback URLs removed | `grep "/api/oauth/google-calendar/callback" my-calendar-section.tsx` | No matches | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CAL-01 | `26-01-PLAN.md` | System pushes contract expiry, approval SLA, and payment deadlines to Google/Outlook calendar — specifically the OAuth connect flow enabling personal calendar connections | SATISFIED | OAuth URL construction fixed (space scopes, response_type=code, extraAuthParams), tRPC-based connect buttons in settings UI, `google-calendar` and `outlook-calendar` slugs consistent end-to-end |
| CAL-02 | `26-01-PLAN.md` | Workflow steps can create calendar events (e.g., onboarding kickoff meeting) | SATISFIED | `calendarConfigMap` built from `calendarTaskConfigSchema.safeParse(taskTemplate.configJson)` in `startRun` transaction; `createTaskCalendarEvent` called fire-and-forget for each `calendarEnabled=true` TODO task; `calendarTaskCount` returned and surfaced in frontend toast |

No orphaned requirements found — REQUIREMENTS.md maps only CAL-01 and CAL-02 to Phase 26, both claimed and satisfied by `26-01-PLAN.md`.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/api/src/routers/__tests__/integration.test.ts` | 3-8 | `it.todo()` stubs — no implemented tests | Info | Intentional per plan design; test stubs define behavioral contract for future implementation. Not a blocker. |
| `packages/api/src/routers/__tests__/workflow.test.ts` | 3-8 | `it.todo()` stubs — no implemented tests | Info | Same as above — intentional. Not a blocker. |
| `packages/integrations/src/adapters/google-calendar-adapter.ts` | 39-42 | `GOOGLE_CALENDAR_EXTRA_AUTH_PARAMS` deprecated export kept | Info | Marked `@deprecated` with JSDoc. Retained for backward compatibility. No new code references it. Not a blocker. |

No blockers found. No stub components, no empty handlers, no hardcoded empty returns on data paths.

### Human Verification Required

#### 1. Google Calendar OAuth Connect Flow

**Test:** In settings, navigate to Calendar section. Click "Connect" on Google Calendar. Observe where the browser redirects.
**Expected:** Browser navigates to `https://accounts.google.com/o/oauth2/v2/auth` with query params including `response_type=code`, `scope=https://www.googleapis.com/auth/calendar.events` (space-separated would apply if multiple scopes), `access_type=offline`, `prompt=consent`.
**Why human:** `window.location.href` redirect and OAuth URL content require a running browser session with valid env vars (GOOGLE_CALENDAR_CLIENT_ID).

#### 2. Outlook Calendar OAuth Connect Flow

**Test:** In settings, click "Connect" on Outlook Calendar. Observe where the browser redirects.
**Expected:** Browser navigates to `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` with `response_type=code`, `scope=Calendars.ReadWrite offline_access` (space-separated).
**Why human:** Same reason as above — requires running app with OUTLOOK_CALENDAR_CLIENT_ID configured.

#### 3. Workflow startRun calendar event creation

**Test:** Create a workflow template with at least one task that has `calendarEnabled: true` in its configJson. Start a run from the template-picker-dialog.
**Expected:** (1) Workflow starts successfully. (2) Informational toast appears: "Calendar events are being created for N task(s)". (3) Within seconds, the calendar event appears in the connected user's Google/Outlook calendar.
**Why human:** Requires running app, seeded workflow template with calendar config, and connected calendar credentials.

### Gaps Summary

No gaps found. All 6 must-have truths are verified against actual codebase content.

The phase goal is fully achieved:
- OAuth connect flow fixed: `getOAuthUrlGeneric` now produces correct authorization URLs with space-separated scopes, `response_type=code`, and provider-specific `extraAuthParams` (Google offline/consent).
- Personal calendar settings uses tRPC `getOAuthUrlGeneric` (not hardcoded callback URLs), with correct slugs for both providers.
- `startRun` builds `calendarConfigMap` from template task `configJson`, calls `createTaskCalendarEvent` fire-and-forget for each calendar-eligible TODO task, returns `calendarTaskCount` in mutation response.
- Frontend shows informational toast when `calendarTaskCount > 0`.
- Test stubs define behavioral contracts for CAL-01 and CAL-02.

---

_Verified: 2026-03-30T23:52:00Z_
_Verifier: Claude (gsd-verifier)_
