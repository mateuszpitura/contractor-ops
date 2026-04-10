# Phase 34: Intelligent Onboarding Wizard - Research

**Researched:** 2026-04-05
**Domain:** Cross-tool import orchestration, multi-step wizard UI, async batch processing
**Confidence:** HIGH

## Summary

Phase 34 builds a full-page onboarding wizard that pulls team members and projects from 4 connected tools (Jira, Linear, Google Workspace, Slack), deduplicates by email, lets users preview/resolve conflicts, and runs async import with progress tracking. The codebase already has strong foundations: Google Workspace directory import wizard (3-step, email dedup, role mapping, bulk invite), all 4 OAuth adapters working, Jira/Linear project+status listing endpoints, and QStash for async processing.

The main new work is: (1) a cross-tool orchestration layer that fetches users from all 4 sources and merges them by email, (2) a new full-page route at `/onboarding/import` with 4-step wizard UI, (3) new tRPC endpoints for Jira/Linear/Slack user listing (none exist today), (4) project-to-workflow-template creation logic, and (5) async import with per-item retry via QStash.

**Primary recommendation:** Build a new `onboarding` tRPC router that orchestrates cross-tool fetching by calling existing adapter-specific routers internally. Reuse `directory-preview-table.tsx` and `role-assignment-controls.tsx` patterns from Google Workspace import. Use QStash for async import processing with a callback endpoint for progress tracking.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Replace existing onboarding checklist step 2 ("Invite Team") with "Import Team" that opens the cross-tool import wizard
- D-02: Full-page wizard at `/onboarding/import` (not a dialog) -- large preview tables need full width for 50+ rows across multiple sources
- D-03: Wizard also accessible from Settings > Integrations for re-importing after initial onboarding
- D-04: "Skip -- I'll invite people manually" link at bottom of step 1 completes the onboarding step and redirects to the members page with invite dialog
- D-05: Inline OAuth connection inside the wizard -- step 1 shows all 4 tools as cards. Unconnected tools show "Connect" button triggering OAuth popup. Connected tools show checkmark + "Import" toggle
- D-06: Tools displayed: Jira, Linear, Google Workspace, Slack -- each as a selectable card with connection status
- D-07: Merged person view -- one row per unique email. Each row shows source badges (Jira, Slack, Google, etc.) indicating which tools the person was found in
- D-08: Three status indicators per row: New (not in org), Conflict (name/data mismatch across sources), Exists (already an org member)
- D-09: Inline conflict resolution -- clicking a conflict badge opens dropdown showing values from each source. User picks which value to use or types custom. Unresolved conflicts block confirm
- D-10: Batch actions: checkbox column with select-all, toolbar with Import Selected / Skip Selected / Assign Role to Selected. Existing members auto-set to Skip
- D-11: Filters on preview table: All / New / Conflicts / Existing
- D-12: Auto-generate one workflow template per imported Jira project / Linear team. Statuses from the project become workflow steps
- D-13: User can preview and rename/reorder/remove steps before confirming. Each project card shows "Edit steps" and "Skip this project" actions
- D-14: Pre-configure bidirectional sync mappings during import -- the status mapping for Jira/Linear sync is set up automatically based on imported statuses

### Claude's Discretion
- Wizard step progression indicators and navigation UI
- Async import progress tracking UX (progress bars, toast notifications, etc.)
- Retry UX for individual failed items (ONBD-05)
- Loading states and skeleton patterns during data fetching from external APIs
- Email-based dedup algorithm implementation details
- Error handling for OAuth failures mid-wizard

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ONBD-01 | User sees "Where do you manage your team?" source selection during onboarding with connected tool options | Source selection cards with inline OAuth -- existing adapter OAuth flows + new wizard step 1 UI |
| ONBD-02 | System imports team members from connected tools (Jira, Linear, Google Workspace, Slack) with email-based dedup | New user-listing endpoints for Jira/Linear/Slack + existing Google Workspace `listDirectory` + merge-by-email algorithm |
| ONBD-03 | System imports projects and statuses from PM tools (Jira, Linear) to pre-configure workflow templates | Existing `jira.listProjects`/`jira.listProjectStatuses` + `linear.teams` (includes states) + new WorkflowTemplate creation logic |
| ONBD-04 | User can preview imported data with diff indicators (new/duplicate/conflict) and batch confirm, skip, or edit | Reuse `directory-preview-table.tsx` pattern, extend with multi-source badges and conflict resolution popover |
| ONBD-05 | Import runs async with progress tracking, and user can retry failed items without re-importing | QStash async processing + new progress tracking endpoint (polling or SSE) + per-item retry mutation |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Use `ctx7` CLI for library documentation (enforced)
- Schema validation for all external inputs (Zod)
- Never trust client input -- re-validate server-side (see Google Workspace `bulkImport` pattern)
- Apply security best practices (RBAC, rate limiting)
- Prefer clean architecture with clear boundaries
- Use strong typing, no unsafe shortcuts
- Production-grade code with proper error handling and observability
- Accessibility (WCAG) as core requirement

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | ^15.3.0 | App router, full-page route for wizard | Project standard |
| React | ^19.0.0 | UI components | Project standard |
| tRPC | ^11.0.0 | Type-safe API layer | Project standard |
| @tanstack/react-query | ^5.60.0 | Server state management, polling | Project standard |
| better-auth | ^1.5.0 | Auth + `createInvitation()` for member import | Project standard |
| @upstash/qstash | ^2.10.1 | Async import processing | Project standard |
| Zod | (in validators) | Input validation | Project standard |
| sonner | ^2.0.7 | Toast notifications | Project standard |
| nuqs | ^2.8.9 | URL state (for filters) | Project standard |
| next-intl | (in project) | i18n | Project standard |
| Prisma | (in project) | Database ORM | Project standard |

### Supporting (Already in Project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | (in project) | Icons | All UI icons |
| react-icons | (in project) | Brand icons (SiJira, SiLinear, etc.) | Provider brand icons on source cards |
| base-ui (shadcn) | (in project) | UI primitives (Card, Button, Table, etc.) | All UI components |

### No New Dependencies Needed
This phase uses only existing project dependencies. No new packages required.

## Architecture Patterns

### Recommended Project Structure
```
apps/web/src/
├── app/[locale]/(dashboard)/onboarding/
│   └── import/
│       └── page.tsx                    # Full-page wizard route (D-02)
├── components/onboarding/
│   ├── onboarding-checklist.tsx        # MODIFY: step 2 ctaHref -> /onboarding/import
│   ├── import-wizard.tsx               # Main 4-step wizard container
│   ├── source-selection-step.tsx       # Step 1: tool cards with OAuth
│   ├── people-review-step.tsx          # Step 2: merged preview table
│   ├── project-import-step.tsx         # Step 3: project/workflow cards
│   ├── confirm-import-step.tsx         # Step 4: summary + async progress
│   ├── source-card.tsx                 # Individual tool card component
│   ├── conflict-resolution-popover.tsx # Inline conflict resolver (D-09)
│   └── import-progress-tracker.tsx     # Async progress with retry buttons
packages/api/src/
├── routers/
│   └── onboarding-import.ts           # New tRPC router orchestrating cross-tool import
├── services/
│   └── onboarding-import-service.ts   # Cross-tool fetch, merge, dedup, workflow creation
```

### Pattern 1: Cross-Tool User Merge Algorithm
**What:** Fetch users from all selected sources in parallel, merge by lowercase email into unified person records with source tracking.
**When to use:** Step 2 data preparation -- after source selection, before preview.
**Example:**
```typescript
// Merge algorithm (server-side in onboarding-import router)
type SourcePerson = {
  email: string;
  name: string;
  source: "jira" | "linear" | "google_workspace" | "slack";
  avatarUrl?: string;
  metadata?: Record<string, unknown>; // source-specific data
};

type MergedPerson = {
  email: string;
  name: string;                    // resolved name (or first source)
  sources: SourcePerson[];         // all source records
  status: "new" | "conflict" | "exists";
  conflicts?: {
    field: string;                 // e.g., "name"
    values: Array<{ source: string; value: string }>;
    resolved?: string;
  }[];
};

function mergeByEmail(
  sourcePeople: SourcePerson[],
  existingEmails: Set<string>,
): MergedPerson[] {
  const byEmail = new Map<string, SourcePerson[]>();
  for (const person of sourcePeople) {
    const key = person.email.toLowerCase();
    const existing = byEmail.get(key) ?? [];
    existing.push(person);
    byEmail.set(key, existing);
  }

  return Array.from(byEmail.entries()).map(([email, sources]) => {
    const exists = existingEmails.has(email);
    const names = [...new Set(sources.map(s => s.name))];
    const hasConflict = !exists && names.length > 1;

    return {
      email,
      name: sources[0].name,
      sources,
      status: exists ? "exists" : hasConflict ? "conflict" : "new",
      conflicts: hasConflict
        ? [{ field: "name", values: sources.map(s => ({ source: s.source, value: s.name })) }]
        : undefined,
    };
  });
}
```

### Pattern 2: Adapter-Specific User Fetching
**What:** Each tool requires different API calls to list users. These must be fetched server-side via the existing credential/adapter infrastructure.
**When to use:** When building the cross-tool fetch endpoints.

**Jira Users:** `GET /rest/api/3/users/search?maxResults=1000` -- returns user objects with `emailAddress`, `displayName`, `accountId`. Needs pagination via `startAt`.

**Linear Users:** GraphQL query `{ organization { users { nodes { id name email } } } }` -- returns all workspace members.

**Google Workspace:** Already exists via `listDirectory` endpoint -- returns users with `primaryEmail`, `name.fullName`.

**Slack Users:** `GET https://slack.com/api/users.list` -- returns members array with `profile.email`, `profile.real_name`. Needs pagination via `cursor`. Filter out bots (`is_bot: true`) and deactivated (`deleted: true`).

### Pattern 3: Workflow Template Auto-Generation (D-12, D-14)
**What:** Create WorkflowTemplate + WorkflowTaskTemplate records from imported Jira projects/Linear teams, with statuses as task steps. Pre-configure status mappings in IntegrationConnection.configJson.
**When to use:** Step 4 async import -- after user confirms project selection.
**Example:**
```typescript
// For each selected project/team:
// 1. Create WorkflowTemplate (type: ONBOARDING or custom, status: DRAFT)
// 2. Create WorkflowTaskTemplate per status (sortOrder from status position)
// 3. Update IntegrationConnection.configJson.statusMappings[teamId/projectId]
//    with auto-mapped entries matching imported status names to internal task statuses

// Reuse existing Jira/Linear status mapping save patterns:
// - Jira: jira.saveStatusMapping mutation
// - Linear: linear.saveStatusMapping mutation
```

### Pattern 4: Async Import with QStash + Progress Polling
**What:** Fire import jobs to QStash, track progress in database, poll from client.
**When to use:** Step 4 import execution (ONBD-05).
**Example:**
```typescript
// Server: Create an ImportJob record in DB, then publish individual items to QStash
// Each item callback updates the ImportJob progress
// Client: Poll importJob status via tRPC query with refetchInterval

// ImportJob schema (can be stored in Settings metadata or a new table):
type ImportJob = {
  id: string;
  organizationId: string;
  totalItems: number;
  completedItems: number;
  failedItems: Array<{ email: string; error: string }>;
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: Date;
};

// Client polling pattern (existing in project):
const progressQuery = useQuery({
  ...trpc.onboardingImport.getProgress.queryOptions({ jobId }),
  refetchInterval: (query) =>
    query.state.data?.status === "completed" ? false : 2000,
});
```

### Pattern 5: OAuth Popup Within Wizard (D-05)
**What:** Reuse existing OAuth flows via `window.open()` popup from within the wizard.
**When to use:** Step 1 when user clicks "Connect" on an unconnected tool.
**Example:**
```typescript
// Existing OAuth callback patterns in the app already handle popup closing.
// The wizard step 1 just needs to:
// 1. Open OAuth URL in popup via window.open()
// 2. Listen for postMessage or poll for connection status
// 3. Update card state when connection confirmed

// Existing pattern from integration settings -- OAuth URLs are constructed
// by adapter.getOAuthConfig() and the redirect path handles token exchange.
```

### Anti-Patterns to Avoid
- **Fetching all tools sequentially:** Fetch from all selected sources in parallel using Promise.allSettled -- individual tool failures should not block others.
- **Trusting client-supplied role/group data for RBAC:** Always re-validate server-side (see Google Workspace bulkImport pattern where group memberships are re-fetched).
- **Storing wizard state in URL params:** Use React state for wizard steps -- nuqs URL state only for table filters (D-11).
- **Synchronous bulk import:** Even for small imports, use async processing with progress tracking to avoid request timeouts.
- **Building a new import table:** Use existing `auth.api.createInvitation()` for each user -- this is the established member creation pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Member invitation | Custom user creation logic | `auth.api.createInvitation()` via Better Auth | Handles email invites, org membership, role assignment, dedup |
| OAuth token management | Manual token refresh/storage | Existing adapter `refreshToken()` + credential encryption | AES-256-GCM per-provider, established pattern |
| Async job queue | Custom polling/retry infrastructure | QStash `publishJSON()` with callbacks | Built-in retry, dead-letter, already in project |
| Email dedup | Complex matching algorithms | Simple lowercase email normalization | Established in Google Workspace import, sufficient for business emails |
| Status mapping storage | New database table for mappings | Existing `configJson.statusMappings` on IntegrationConnection | Jira/Linear already use this pattern |
| Workflow template CRUD | New template creation endpoint | Existing `WorkflowTemplate` + `WorkflowTaskTemplate` Prisma models | Schema already supports all needed fields |

**Key insight:** The hardest part of this phase is not any single feature but the orchestration layer that coordinates across 4 different tools with different APIs. The individual pieces (OAuth, user listing, invitation, workflow creation) all have established patterns in the codebase.

## Common Pitfalls

### Pitfall 1: Jira/Slack API Pagination
**What goes wrong:** Jira `users/search` and Slack `users.list` are paginated. Missing pagination means only first page of users is imported.
**Why it happens:** Default page sizes are small (Jira: 50, Slack: 200).
**How to avoid:** Implement cursor/offset pagination loops for both APIs. Jira uses `startAt` offset; Slack uses `cursor` + `response_metadata.next_cursor`.
**Warning signs:** Tests pass with small datasets but production orgs with 200+ people see missing users.

### Pitfall 2: OAuth Token Expiry During Multi-Source Fetch
**What goes wrong:** Token expires between fetching source 1 and source 4, causing partial failures.
**Why it happens:** Google/Jira tokens expire in 1 hour; fetching from multiple sources takes time.
**How to avoid:** Check token expiry and refresh before each API call. The existing adapter `refreshToken()` pattern handles this -- ensure it is called per-source, not once at wizard start.
**Warning signs:** Intermittent "unauthorized" errors that only happen for the last source in the fetch order.

### Pitfall 3: Race Condition on Concurrent Imports
**What goes wrong:** Two admins run the wizard simultaneously, creating duplicate invitations for the same email.
**Why it happens:** `createInvitation()` might not enforce uniqueness atomically.
**How to avoid:** Check for existing pending invitations before creating new ones. Better Auth's `createInvitation` should handle this, but verify -- add a pre-check query for existing org members + pending invitations.
**Warning signs:** Duplicate invitation emails sent to same person.

### Pitfall 4: Slack Bot Users in Import List
**What goes wrong:** Slack `users.list` returns bot users, app users, and deactivated users alongside real members.
**Why it happens:** API returns all workspace members by default.
**How to avoid:** Filter on `is_bot === false`, `deleted === false`, and `is_app_user === false`. Also filter out `slackbot` (id: USLACKBOT).
**Warning signs:** Import preview shows "Slackbot" and integration bots as importable people.

### Pitfall 5: Workflow Template Type Mismatch
**What goes wrong:** Auto-generated workflow templates use the wrong `WorkflowTemplateType` or `WorkflowTaskType`.
**Why it happens:** Jira/Linear project statuses don't map 1:1 to the existing WorkflowTaskType enum.
**How to avoid:** Map imported statuses to `MANUAL_ACTION` task type (generic). Use `WorkflowTemplateType` appropriate for general-purpose templates (not `ONBOARDING` or `OFFBOARDING` specific). Let users customize after import.
**Warning signs:** Imported templates can't be used because task types don't match expected workflow engine behavior.

### Pitfall 6: Import Progress Lost on Page Refresh
**What goes wrong:** User refreshes during async import and loses all progress visibility.
**Why it happens:** Progress state stored only in React state, not persisted.
**How to avoid:** Store import job state in database (or Settings metadata). On page load, check for in-progress jobs and resume the progress view.
**Warning signs:** Users report "import just disappeared" after accidental page reload.

## Code Examples

### Existing Google Workspace Bulk Import Pattern (Reference)
```typescript
// Source: packages/api/src/routers/google-workspace.ts:279-344
// Pattern: sequential createInvitation() per user with succeeded/failed tracking
// SECURITY: Re-fetches group memberships server-side
for (const user of input.users) {
  try {
    const role = resolveUserRole(user.email, serverGroupMemberships, ...);
    await auth.api.createInvitation({
      headers: ctx.headers,
      body: { email: user.email, role, organizationId: ctx.organizationId },
    });
    succeeded.push({ email: user.email, role });
  } catch (error) {
    failed.push({ email: user.email, error: message });
  }
}
```

### Existing Linear Teams + States Fetch (Reference)
```typescript
// Source: packages/api/src/routers/linear.ts:115-170
// Already fetches teams with workflow states -- reuse for project import
const result = await linearGraphQL<TeamResponse>(accessToken, `{
  teams { nodes { id name key states { nodes { id name type color position } } } }
}`);
```

### Existing Jira Project + Status Listing (Reference)
```typescript
// Source: packages/api/src/routers/jira.ts:149-267
// listProjects: GET /rest/api/3/project -> { id, key, name }[]
// listProjectStatuses: GET /rest/api/3/project/{projectId}/statuses
//   -> { id, name, statusCategory: { key, name } }[]
```

### Onboarding Checklist Step Modification (Reference)
```typescript
// Source: apps/web/src/components/onboarding/onboarding-checklist.tsx:45-62
// MODIFY step 2 (invite-team):
{
  id: "invite-team",
  icon: UserPlus,
  optional: false,
  stepKey: "inviteTeam",
  ctaHref: "/onboarding/import",  // Changed from "/settings?tab=members"
}
```

### Wizard Step State Management Pattern (Reference)
```typescript
// Source: apps/web/src/components/integrations/google-workspace/directory-import-wizard.tsx
// Pattern: useState<WizardStep> for step navigation, useCallback for step transitions
const [step, setStep] = useState<WizardStep>(1);
// Each step renders conditionally based on `step` value
// Back/Continue buttons in sticky footer manage step transitions
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Dialog-based import wizard | Full-page wizard for large datasets (D-02) | This phase | Better UX for 50+ row tables |
| Single-source import | Multi-source merge with dedup | This phase | Cross-tool intelligence |
| Manual status mapping after import | Auto-configured sync mappings (D-14) | This phase | Zero post-import setup |
| Synchronous import | Async with progress + per-item retry | This phase | Handles large imports without timeouts |

## Open Questions

1. **Jira User Listing API Scope**
   - What we know: Jira has `GET /rest/api/3/users/search` but it requires `browse-users` scope. Need to verify the existing Jira OAuth scopes include this.
   - What's unclear: Whether the current Jira connection has sufficient scopes for user listing, or if scope expansion is needed.
   - Recommendation: Check existing Jira adapter scopes. If insufficient, the wizard should show "Scope expansion needed" on the Jira card (similar to existing `scopeExpansionNeeded` pattern in jira router).

2. **Linear User Listing via GraphQL**
   - What we know: Linear GraphQL supports `{ organization { users { nodes { id name email } } } }`.
   - What's unclear: Whether the existing Linear OAuth scopes include organization user read access.
   - Recommendation: Test the GraphQL query with existing credentials. Linear OAuth typically grants `read` scope which covers this.

3. **Import Job Persistence Model**
   - What we know: Need to track import progress across page refreshes (Pitfall 6).
   - What's unclear: Whether to create a new `ImportJob` database table or store in Settings metadata.
   - Recommendation: Use Settings metadata (existing `onboardingCompletedSteps` pattern) for simplicity. Store `{ importJobId, status, totalItems, completedItems, failedItems }` in org settings metadata. This avoids a migration and keeps the pattern consistent.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via vitest.config.ts in packages/api) |
| Config file | `packages/api/vitest.config.ts` |
| Quick run command | `cd packages/api && pnpm vitest run --reporter=verbose` |
| Full suite command | `pnpm turbo test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ONBD-01 | Source selection returns connection status for all 4 tools | unit | `cd packages/api && pnpm vitest run src/routers/__tests__/onboarding-import.test.ts -t "listSources"` | No -- Wave 0 |
| ONBD-02 | Cross-tool user merge deduplicates by lowercase email | unit | `cd packages/api && pnpm vitest run src/routers/__tests__/onboarding-import.test.ts -t "merge"` | No -- Wave 0 |
| ONBD-02 | Jira/Linear/Slack user listing endpoints return user arrays | unit | `cd packages/api && pnpm vitest run src/routers/__tests__/onboarding-import.test.ts -t "fetch"` | No -- Wave 0 |
| ONBD-03 | Workflow template creation from Jira/Linear projects | unit | `cd packages/api && pnpm vitest run src/routers/__tests__/onboarding-import.test.ts -t "workflow"` | No -- Wave 0 |
| ONBD-04 | Conflict detection identifies name mismatches across sources | unit | `cd packages/api && pnpm vitest run src/routers/__tests__/onboarding-import.test.ts -t "conflict"` | No -- Wave 0 |
| ONBD-05 | Import job tracks progress and supports per-item retry | unit | `cd packages/api && pnpm vitest run src/routers/__tests__/onboarding-import.test.ts -t "progress"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/api && pnpm vitest run src/routers/__tests__/onboarding-import.test.ts`
- **Per wave merge:** `pnpm turbo test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/api/src/routers/__tests__/onboarding-import.test.ts` -- covers ONBD-01 through ONBD-05
- [ ] Test fixtures for mock Jira/Linear/Slack/Google Workspace API responses
- [ ] Mock for `auth.api.createInvitation` (likely already exists in google-workspace test fixtures)

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `onboarding-checklist.tsx`, `directory-import-wizard.tsx`, `directory-preview-table.tsx`, `role-assignment-controls.tsx` -- existing import wizard patterns
- Codebase analysis: `google-workspace.ts` router -- bulk import with `createInvitation()`, server-side group re-fetch
- Codebase analysis: `jira.ts` router -- `listProjects`, `listProjectStatuses` endpoints
- Codebase analysis: `linear.ts` router -- `teams` endpoint with workflow states
- Codebase analysis: `linear-issue-sync.ts` -- `linearGraphQL` helper for arbitrary GraphQL queries
- Codebase analysis: `jira-issue-sync.ts` -- `buildJiraApiContext` helper for REST API calls
- Codebase analysis: `slack-adapter.ts` -- OAuth scopes include `users:read` and `users:read.email`
- Codebase analysis: `workflow.prisma` -- WorkflowTemplate/WorkflowTaskTemplate schema
- Codebase analysis: `integration.prisma` -- IntegrationProvider enum includes all 4 tools
- `34-CONTEXT.md` -- locked decisions D-01 through D-14
- `34-UI-SPEC.md` -- complete UI design contract

### Secondary (MEDIUM confidence)
- Jira REST API `users/search` endpoint for user listing (training data, common Jira API)
- Slack `users.list` API for workspace member listing (training data, well-known API)
- Linear GraphQL `organization.users` query (training data)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project, no new dependencies
- Architecture: HIGH -- extends well-established patterns (directory import wizard, adapter-based OAuth, QStash async)
- Pitfalls: HIGH -- identified from codebase analysis of existing import patterns and API pagination requirements

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable -- internal codebase patterns, no fast-moving external dependencies)
