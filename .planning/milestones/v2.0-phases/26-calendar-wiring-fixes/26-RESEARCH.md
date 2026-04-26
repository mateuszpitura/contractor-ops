# Phase 26: Calendar Wiring Fixes - Research

**Researched:** 2026-03-30
**Domain:** OAuth connect flow bugs + workflow runtime calendar hook wiring
**Confidence:** HIGH

## Summary

This phase fixes two concrete integration wiring bugs: (1) personal calendar connect buttons navigate to the OAuth callback URL instead of the provider authorization URL, and (2) `startRun` in `workflow.ts` never calls `createTaskCalendarEvent` for tasks with calendar config enabled.

The codebase already contains all the building blocks: calendar adapters with correct OAuth configs, the `createTaskCalendarEvent` service function, the `calendarTaskConfigSchema` validator, and the Jira fire-and-forget pattern to replicate. The work is purely connecting existing pieces. A third bug was discovered during research: `getOAuthUrlGeneric` joins OAuth scopes with commas, but Google and Microsoft both require space-separated scopes.

**Primary recommendation:** Fix three bugs — (1) connect button URLs, (2) scope separator in `getOAuthUrlGeneric`, (3) add calendar fire-and-forget block to `startRun` — following the exact Jira pattern already in the codebase.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Claude's discretion on minimal correct fix for OAuth connect URL. Fix adapter slug mapping so connect buttons resolve the correct `authorizationUrl` from the adapter's OAuth config. Ensure Outlook uses slug `"outlook-calendar"` consistently.
- **D-02:** Create a dedicated "calendar integrations" block in `startRun`, separate from the Jira integration block. More readable and extensible if additional calendar hooks are added later. Same fire-and-forget `void` async pattern as Jira.
- **D-03:** Log server-side with `console.error` (structured log) AND show a non-blocking dismissible toast warning to the user ("Calendar event could not be created"). User is aware of the failure but not blocked from continuing their workflow.

### Claude's Discretion
- OAuth URL fix: exact code changes to resolve slug mismatch or URL field selection
- Calendar hook: exact placement within the `startRun` function body relative to Jira block
- Toast warning: implementation approach (tRPC response metadata vs websocket vs mutation return)

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAL-01 | System pushes contract expiry, approval SLA, and payment deadlines to Google/Outlook calendar | OAuth connect fix enables personal calendar connections; deadline sync service already exists in `calendar-deadline-sync.ts` |
| CAL-02 | Workflow steps can create calendar events (e.g., onboarding kickoff meeting) | `createTaskCalendarEvent` already exists; needs wiring in `startRun` to be called for calendar-enabled task runs |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Use `ctx7` CLI for library documentation lookup
- Apply security best practices (OAuth state CSRF protection already handled)
- Include proper error handling and logging (fire-and-forget with console.error)
- Treat accessibility as core (no UI changes needed in this phase)
- Deliver production-grade code, not demo-grade shortcuts

## Architecture Patterns

### Bug 1: Connect Button URLs (my-calendar-section.tsx)

**What's broken:** Lines 221-225 navigate directly to the callback URL:
```typescript
function handleGoogleConnect() {
  window.location.href = "/api/oauth/google-calendar/callback?action=connect";
}
function handleOutlookConnect() {
  window.location.href = "/api/oauth/outlook/callback?action=connect";
}
```

**Correct approach:** Use the existing `integration.getOAuthUrlGeneric` tRPC query to get the provider authorization URL, then navigate to it. This is the same pattern used by all other OAuth integrations.

**Fix pattern:**
```typescript
// Call tRPC to get the authorization URL, then redirect
const { data } = trpc.integration.getOAuthUrlGeneric.useQuery(
  { provider: "google-calendar" },
  { enabled: false }
);
// On button click: refetch and redirect to data.url
```

The adapter slugs are already correct in the registry:
- `GoogleCalendarAdapter.slug = "google-calendar"` (registered in `register-all.ts`)
- `OutlookCalendarAdapter.slug = "outlook-calendar"` (registered in `register-all.ts`)

### Bug 2: OAuth Scope Separator (integration.ts line 376)

**What's broken:** `getOAuthUrlGeneric` joins scopes with commas:
```typescript
scope: oauthConfig.scopes.join(","),
```

**Why it's wrong:** Google OAuth 2.0 and Microsoft Identity Platform both require space-separated scopes in the authorization URL. The adapter token exchange methods already use space-separated scopes correctly (see `outlook-calendar-adapter.ts` line 81). The comma separator was inherited from the Slack OAuth flow where Slack uses comma-separated scopes.

**Fix:** Change to `oauthConfig.scopes.join(" ")` in `getOAuthUrlGeneric`. This also fixes any other non-Slack providers that use this generic endpoint.

**Confidence:** HIGH - verified by comparing authorization URL construction in `getOAuthUrlGeneric` vs token exchange in both calendar adapters.

### Bug 3: Missing Google Calendar Extra Auth Params

**What's broken:** `GOOGLE_CALENDAR_EXTRA_AUTH_PARAMS` (`{ access_type: "offline", prompt: "consent" }`) is exported from the adapter but never consumed by `getOAuthUrlGeneric`. Without `access_type: "offline"`, Google will not return a refresh token, making the connection expire in ~1 hour with no way to refresh.

**Fix approach:** Either add an `extraAuthParams` method to the adapter interface, or special-case Google Calendar params in the generic OAuth URL builder. The adapter interface approach is cleaner and more extensible.

**Confidence:** HIGH - the constant is defined and exported but never used anywhere in the codebase.

### Bug 4: Missing Calendar Hook in startRun (workflow.ts)

**What's broken:** `startRun` creates Jira issues for jira-enabled tasks (lines 758-798) but has no equivalent block for calendar-enabled tasks. The `createTaskCalendarEvent` function exists in `calendar-deadline-sync.ts` but is never imported or called from `startRun`.

**Fix pattern (following Jira precedent exactly):**
```typescript
// Inside $transaction, alongside Jira eligibility:
const calendarEligibleTaskRunIds = new Set<string>();
for (const taskTemplate of template.tasks) {
  const parsed = calendarTaskConfigSchema.safeParse(taskTemplate.configJson);
  if (parsed.success && parsed.data.calendarEnabled) {
    const runId = taskIdMap.get(taskTemplate.id);
    if (runId) {
      calendarEligibleTaskRunIds.add(runId);
    }
  }
}

// Return from transaction includes calendarEligibleTaskRunIds

// After transaction, fire-and-forget block (separate from Jira per D-02):
const todoCalendarTasks = run.run.tasks.filter(
  (t) => t.status === "TODO" && run.calendarEligibleTaskRunIds.has(t.id),
);
if (todoCalendarTasks.length > 0) {
  void (async () => {
    try {
      const { createTaskCalendarEvent } = await import(
        "../services/calendar-deadline-sync.js"
      );
      for (const task of todoCalendarTasks) {
        createTaskCalendarEvent(prisma, {
          organizationId: ctx.organizationId,
          workflowTaskRunId: task.id,
          config: calendarTaskConfigSchema.parse(/* template configJson */),
          contractorName: run.contractorName,
          contractName: /* contract name */,
          taskName: task.title,
          userId: ctx.user!.id,
        }).catch((err) =>
          console.error(
            `[workflow/startRun] Calendar event creation failed for task ${task.id}:`,
            err,
          ),
        );
      }
    } catch (err) {
      console.error(
        "[workflow/startRun] Calendar event creation setup failed:",
        err,
      );
    }
  })();
}
```

**Key detail:** `createTaskCalendarEvent` needs the `CalendarTaskConfig` from the task template's `configJson`, not from the task run. The template config must be passed through the transaction return value (similar to how `jiraEligibleTaskRunIds` is returned). A `Map<string, CalendarTaskConfig>` mapping run IDs to their configs is needed.

**Confidence:** HIGH - exact pattern from Jira block at lines 758-798.

### Toast Warning for Calendar Failures (D-03)

**Challenge:** The fire-and-forget pattern means the mutation response is already returned by the time calendar creation fails. Options:

1. **Mutation return metadata** - Not viable; response already sent
2. **Optimistic assumption** - Return a `calendarTaskCount` in the response; frontend shows toast if count > 0 saying "Calendar events are being created" (informational, not error)
3. **Best effort with server logging only** - Calendar failures are logged server-side; no frontend toast for async failures

**Recommendation:** Since the fire-and-forget pattern means we cannot notify the frontend of async failures through the mutation response, use approach 3 (server-side logging only) for async calendar failures. The user will see the calendar event appear (or not) in their calendar UI. This matches the Jira pattern which also does not show toasts for async Jira failures.

If D-03 toast is strictly required, the cleanest approach is to NOT fire-and-forget calendar creation, but instead await it with a timeout and include success/failure in the mutation response. This would differ from the Jira pattern per D-02 but enable the toast.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth URL construction | Custom URL builder | `getOAuthUrlGeneric` tRPC query | Already handles state CSRF, redirect URI, env var validation |
| Calendar event creation | Direct API calls from router | `createTaskCalendarEvent` service | Already handles dual-push, ExternalLink storage, error resilience |
| Config parsing | Manual JSON access | `calendarTaskConfigSchema.safeParse()` | Type-safe with defaults, matches Jira pattern |

## Common Pitfalls

### Pitfall 1: Scope Separator Mismatch
**What goes wrong:** OAuth authorization fails silently or returns insufficient permissions because scopes are comma-separated instead of space-separated.
**Why it happens:** Slack uses comma-separated scopes; the generic OAuth builder was modeled after Slack.
**How to avoid:** Change `join(",")` to `join(" ")` in `getOAuthUrlGeneric`. Verify existing non-Slack providers (DocuSign, Jira, Notion, Confluence) are not broken by this change.
**Warning signs:** OAuth flow redirects to provider but returns "invalid_scope" error.

### Pitfall 2: Missing Refresh Token from Google
**What goes wrong:** Google connection works initially but expires after 1 hour with no refresh token available.
**Why it happens:** Google requires `access_type=offline` and `prompt=consent` in the authorization URL to return a refresh token.
**How to avoid:** Ensure `GOOGLE_CALENDAR_EXTRA_AUTH_PARAMS` are included in the authorization URL.
**Warning signs:** `credentials.refreshToken` is undefined after Google OAuth exchange.

### Pitfall 3: configJson Contains Both Jira and Calendar Config
**What goes wrong:** `calendarTaskConfigSchema.safeParse(configJson)` might fail or parse incorrectly because `configJson` also contains Jira fields.
**Why it happens:** Both schemas use `.default()` for missing fields and Zod's `safeParse` ignores unknown keys by default.
**How to avoid:** This actually works fine with Zod's default behavior. Zod strips unknown keys and applies defaults. Both `jiraTaskConfigSchema` and `calendarTaskConfigSchema` can safely parse the same `configJson` object.
**Warning signs:** None expected - this is a non-issue thanks to Zod's design.

### Pitfall 4: Template configJson vs Run configJson
**What goes wrong:** Calendar config is stored on `WorkflowTaskTemplate.configJson`, but `startRun` iterates over task runs which may not carry the config forward.
**Why it happens:** Task runs are created from templates but `configJson` conditions are evaluated during creation.
**How to avoid:** Read calendar config from the template (already available in the transaction) and pass it through as a map keyed by run ID.

### Pitfall 5: Scope Change Breaking Other Providers
**What goes wrong:** Changing scope separator from comma to space breaks Slack OAuth which requires comma-separated scopes.
**Why it happens:** Slack is the only provider using `getOAuthUrl` (legacy endpoint with comma separator), not `getOAuthUrlGeneric`.
**How to avoid:** Verify Slack uses the legacy `getOAuthUrl` endpoint (line 93), not `getOAuthUrlGeneric`. All other providers using the generic endpoint should use space-separated scopes.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest |
| Config file | `packages/api/vitest.config.ts` (assumed from existing test structure) |
| Quick run command | `cd packages/api && npx vitest run src/services/__tests__/calendar-sync.test.ts` |
| Full suite command | `cd packages/api && npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAL-01 | OAuth connect buttons redirect to provider authorization URL | manual | Manual browser test | N/A |
| CAL-01 | Scope separator uses space not comma in getOAuthUrlGeneric | unit | `npx vitest run src/routers/__tests__/integration.test.ts` | Needs check |
| CAL-02 | startRun calls createTaskCalendarEvent for calendar-enabled tasks | unit | `npx vitest run src/services/__tests__/calendar-sync.test.ts` | Stub exists (todo) |
| CAL-02 | Calendar config parsed from template configJson | unit | `npx vitest run src/services/__tests__/calendar-sync.test.ts` | Stub exists (todo) |

### Sampling Rate
- **Per task commit:** `cd packages/api && npx vitest run src/services/__tests__/calendar-sync.test.ts`
- **Per wave merge:** `cd packages/api && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/api/src/services/__tests__/calendar-sync.test.ts` — existing stubs need implementation for CAL-02 task event creation
- [ ] Scope separator test in integration router tests (if file exists)

## Code Examples

### Connect Button Fix (my-calendar-section.tsx)
```typescript
// Source: integration.ts getOAuthUrlGeneric pattern
// Replace direct callback URL navigation with tRPC OAuth URL query

function handleConnect(provider: "google-calendar" | "outlook-calendar") {
  // Use trpc to fetch the authorization URL, then redirect
  // The getOAuthUrlGeneric endpoint constructs the correct authorizationUrl
  // with HMAC-signed state, scopes, and redirect URI
}
```

### Fire-and-Forget Calendar Block (workflow.ts)
```typescript
// Source: workflow.ts lines 758-798 (Jira fire-and-forget pattern)
// Place AFTER the Jira block, BEFORE the return statement

// Fire-and-forget: create calendar events for calendar-enabled tasks (non-blocking)
const todoCalendarTasks = run.run.tasks.filter(
  (t) => t.status === "TODO" && run.calendarEligibleTaskRunIds.has(t.id),
);
if (todoCalendarTasks.length > 0) {
  void (async () => {
    try {
      const { createTaskCalendarEvent } = await import(
        "../services/calendar-deadline-sync.js"
      );
      for (const task of todoCalendarTasks) {
        const config = run.calendarConfigMap.get(task.id);
        if (!config) continue;
        createTaskCalendarEvent(prisma, {
          organizationId: ctx.organizationId,
          workflowTaskRunId: task.id,
          config,
          contractorName: run.contractorName,
          contractName: run.contractName ?? "",
          taskName: task.title,
          userId: ctx.user!.id,
        }).catch((err) =>
          console.error(
            `[workflow/startRun] Calendar event creation failed for task ${task.id}:`,
            err,
          ),
        );
      }
    } catch (err) {
      console.error(
        "[workflow/startRun] Calendar event creation setup failed:",
        err,
      );
    }
  })();
}
```

### Scope Separator Fix (integration.ts)
```typescript
// Source: integration.ts line 376
// Before (broken for Google/Microsoft):
scope: oauthConfig.scopes.join(","),

// After (correct for all OAuth 2.0 providers except Slack which uses legacy endpoint):
scope: oauthConfig.scopes.join(" "),
```

## Open Questions

1. **Toast for async calendar failures (D-03)**
   - What we know: Fire-and-forget means mutation response is already sent when calendar fails
   - What's unclear: Whether D-03 strictly requires a user-visible toast, or if server-side logging suffices
   - Recommendation: Log server-side only (matching Jira pattern). If toast is required, consider awaiting calendar creation with a timeout and returning status in mutation response.

2. **Other providers using getOAuthUrlGeneric with comma scopes**
   - What we know: DocuSign, Jira, Notion, Confluence also use OAuth but may go through `getOAuthUrlGeneric`
   - What's unclear: Whether these providers accept space-separated scopes correctly
   - Recommendation: Verify during implementation. DocuSign, Jira (Atlassian), Notion, and Confluence all follow RFC 6749 which specifies space-separated scopes. Comma was Slack-specific.

3. **Contract name availability in startRun**
   - What we know: `contractorName` is already extracted in the transaction; contract may be null
   - What's unclear: Whether `contract.name` or equivalent field exists
   - Recommendation: Check contract model for name field; fall back to empty string if no contract

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of `my-calendar-section.tsx` lines 220-226 (connect button bug)
- Direct codebase inspection of `integration.ts` line 376 (scope separator bug)
- Direct codebase inspection of `workflow.ts` lines 558-801 (startRun + Jira pattern)
- Direct codebase inspection of `calendar-deadline-sync.ts` lines 262-308 (createTaskCalendarEvent signature)
- Direct codebase inspection of `google-calendar-adapter.ts` lines 34-37 (unused EXTRA_AUTH_PARAMS)
- Direct codebase inspection of `outlook-calendar-adapter.ts` line 81 (space-separated scopes in token exchange)

### Secondary (MEDIUM confidence)
- RFC 6749 Section 3.3 specifies space-delimited scope values (training data, well-established standard)
- Google OAuth 2.0 requires `access_type=offline` for refresh tokens (training data, well-established)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries needed, all code exists in codebase
- Architecture: HIGH - exact patterns exist (Jira fire-and-forget) to replicate
- Pitfalls: HIGH - bugs identified by direct code inspection with clear root causes

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable; internal codebase fixes only)
