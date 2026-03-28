# Phase 19: Jira Integration - Research

**Researched:** 2026-03-28
**Domain:** Jira Cloud REST API v3 + OAuth 2.0 3LO + Dynamic Webhooks + Bidirectional Sync
**Confidence:** HIGH

## Summary

Phase 19 extends the existing Jira OAuth 2.0 3LO integration (Phase 18, read-only worklog import) to full issue lifecycle management: creating Jira issues from workflow tasks, bidirectional status sync via webhooks, and displaying linked issues as chips. The existing JiraAdapter, ExternalLink model, sync log infrastructure, and QStash webhook processing pipeline provide a solid foundation.

The Jira Cloud REST API v3 is well-documented and stable. Key operations -- issue creation, transition execution, project/issue type listing, and dynamic webhook registration -- all work with OAuth 2.0 3LO. Three additional scopes are needed: `write:jira-work` (issue creation/transitions), `manage:jira-webhook` (dynamic webhook registration), and the existing `read:jira-work` is already configured. Dynamic webhooks for 3LO apps expire after 30 days and must be refreshed proactively. Webhook payloads include a `changelog.items` array that reveals exactly which fields changed, making status transition detection straightforward.

**Primary recommendation:** Extend the existing JiraAdapter with webhook support (supportsWebhooks=true, verifyWebhookSignature, handleWebhook), add the three new OAuth scopes, build a Jira issue sync service following the jira-worklog-sync.ts patterns, and use a sync-origin marker on ExternalLink.metadataJson to prevent bidirectional sync loops.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Per-task template configuration -- admin marks specific WorkflowTaskTemplate entries as "Create Jira issue on activation". Only configured tasks create issues; others are unaffected
- **D-02:** Each task template has its own Jira project + issue type mapping stored in configJson. Granular control -- different tasks in the same workflow can target different Jira projects
- **D-03:** Jira OAuth scopes must be expanded from current read:jira-work to include write:jira-work for issue creation and status transitions
- **D-04:** Admin-configurable mapping table per Jira project -- maps WorkflowTaskStatus (TODO, IN_PROGRESS, DONE, etc.) to Jira transitions. Fetches available Jira statuses/transitions via API to populate the mapping UI
- **D-05:** Mapping scoped per Jira project -- one mapping table per project, reused across all workflow tasks targeting that project. Matches how Jira workflows are project-scoped
- **D-06:** True bidirectional sync -- changes flow both ways. Jira-to-app via Jira Connect webhooks (issue_updated events), app-to-Jira via REST API transition calls. Uses the same admin-configurable mapping in both directions
- **D-07:** Jira Connect webhooks registered via Jira REST API on connected projects. Routed through the existing unified webhook endpoint (/api/webhooks/jira) and QStash queue from Phase 12
- **D-08:** Last-write-wins conflict resolution -- whichever change arrives last takes effect. Sync log records both changes for audit. In practice, race conditions are rare since different people work in different systems
- **D-09:** Jira chips show issue key (e.g., PROJ-123) with a colored status badge (To Do/In Progress/Done). Click opens Jira issue in new tab. Compact, scannable
- **D-10:** Chips appear inline next to each linked workflow task in views AND a summary section at the top of the contractor's Workflows tab showing recent Jira activity
- **D-11:** Jira issue data (key, summary, status, URL) cached in ExternalLink.metadataJson. Updated via webhooks on status changes -- no live API calls for display

### Claude's Discretion
- Jira issue summary/description generation strategy (auto from task vs template with placeholders)
- Unmapped Jira status handling (silent log vs warning notification)
- Exact chip component design, colors for status badges
- Summary section layout on contractor Workflows tab
- Jira project picker and mapping configuration UI design
- Webhook registration lifecycle (when to register/deregister)
- Error handling for failed Jira API calls (create issue, transition)
- Loop prevention mechanism for bidirectional sync

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| JIRA-01 | Admin can connect Jira Cloud workspace via OAuth 2.0 | Extend JiraAdapter scopes to `read:jira-work`, `write:jira-work`, `manage:jira-webhook`, `offline_access`. Existing OAuth flow + cloudId discovery work unchanged. |
| JIRA-02 | Workflow steps can auto-create Jira issues with configurable project/type mapping | Jira REST API `POST /rest/api/3/issue` with project.id, issuetype.id, summary, description. Store mapping in WorkflowTaskTemplate.configJson. |
| JIRA-03 | Jira issue status changes auto-update linked workflow tasks (configurable mapping) | Dynamic webhooks via `POST /rest/api/3/webhook` with `jira:issue_updated` event + JQL filter. Parse changelog.items for status field changes. Reverse lookup via ExternalLink. |
| JIRA-04 | Linked Jira issues display on contractor and workflow views as clickable chips | JiraIssueChip component reading from ExternalLink.metadataJson (key, summary, status, statusCategory, url). UI-SPEC already defines chip design. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Jira Cloud REST API v3 | v3 (current) | Issue CRUD, transitions, project/type listing, webhook registration | Official Atlassian API, fully supported with OAuth 2.0 3LO |
| @upstash/qstash | (existing) | Async webhook processing queue | Already used in Phase 12 webhook pipeline |
| Prisma | (existing) | Database access, ExternalLink, IntegrationSyncLog | Project standard ORM |
| tRPC | (existing) | API layer for mapping config, project listing | Project standard API layer |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| crypto (node:crypto) | built-in | HMAC-SHA256 webhook signature verification | Verifying X-Hub-Signature header on incoming Jira webhooks |
| zod | (existing) | Validation for webhook payloads, mapping config, API responses | All external data boundaries |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw fetch for Jira API | jira.js npm package | Raw fetch is already established in jira-worklog-sync.ts; adding a dependency for a few endpoints is unnecessary overhead |
| HMAC webhook verification | IP allowlisting | HMAC is standard, IP lists change and are harder to maintain |

**Installation:**
No new packages needed. All required libraries are already in the project.

## Architecture Patterns

### Recommended Project Structure
```
packages/api/src/
  services/
    jira-issue-sync.ts          # Issue creation + transition execution (outbound)
    jira-webhook-handler.ts     # Webhook payload processing (inbound)
    jira-status-mapping.ts      # Mapping config CRUD + lookup helpers
  routers/
    jira.ts                     # tRPC router for Jira config, projects, issue types

packages/integrations/src/
  adapters/
    jira-adapter.ts             # Extended with webhooks, new scopes

apps/web/src/
  components/
    integrations/
      jira-issue-chip.tsx       # Reusable chip component
      jira-activity-summary.tsx # Contractor workflows tab summary
      jira-project-mapping-dialog.tsx
      jira-status-mapping-dialog.tsx
      jira-task-config.tsx      # Inline task template config
```

### Pattern 1: Outbound Sync (App -> Jira)
**What:** When a WorkflowTaskRun status changes, look up the Jira mapping and execute a transition via REST API.
**When to use:** Every workflow task status update where the task has a linked Jira issue.
**Example:**
```typescript
// Source: Jira Cloud REST API v3 docs
// POST https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/issue/{issueIdOrKey}/transitions
const body = { transition: { id: transitionId } };
// transitionId comes from the admin-configured status mapping table
```

### Pattern 2: Inbound Sync (Jira -> App)
**What:** When a Jira webhook delivers an issue_updated event with a status change in the changelog, reverse-lookup the WorkflowTaskRun via ExternalLink and update its status.
**When to use:** Every incoming webhook with `webhookEvent: "jira:issue_updated"` containing a status changelog item.
**Example:**
```typescript
// Webhook payload structure
const statusChange = payload.changelog.items.find(
  (item) => item.field === "status"
);
if (statusChange) {
  const jiraStatusName = statusChange.toString; // e.g. "In Progress"
  // Reverse lookup: Jira status name -> WorkflowTaskStatus via mapping table
  // Update WorkflowTaskRun.status accordingly
}
```

### Pattern 3: Loop Prevention via Sync Origin Marker
**What:** Before processing a webhook or executing an outbound transition, check if the change was self-originated to prevent infinite loops.
**When to use:** Every bidirectional sync operation.
**Example:**
```typescript
// On outbound sync: mark in ExternalLink.metadataJson
await prisma.externalLink.update({
  where: { id: linkId },
  data: { metadataJson: { ...existing, lastSyncOrigin: "APP", lastSyncAt: new Date().toISOString() } }
});

// On inbound webhook: check if change was self-originated
const link = await prisma.externalLink.findFirst({ ... });
const metadata = link.metadataJson as { lastSyncOrigin?: string; lastSyncAt?: string };
if (metadata?.lastSyncOrigin === "APP") {
  const syncAge = Date.now() - new Date(metadata.lastSyncAt!).getTime();
  if (syncAge < 30_000) {
    // Skip -- this is a bounce-back from our own outbound sync
    return;
  }
}
```

### Pattern 4: Dynamic Webhook Registration with 30-Day Refresh
**What:** Register Jira webhooks via REST API on project connection, refresh every ~25 days via cron.
**When to use:** When a Jira connection is established or when existing webhooks approach expiry.
**Example:**
```typescript
// POST https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/webhook
const body = {
  url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/jira`,
  webhooks: [{
    jqlFilter: `project = ${projectKey}`,
    events: ["jira:issue_updated"],
  }],
};
// Store webhook IDs in IntegrationConnection.configJson for refresh/cleanup
// PUT /rest/api/3/webhook/refresh to extend before 30-day expiry
```

### Anti-Patterns to Avoid
- **Live Jira API calls for display:** Never fetch Jira issue data on page render. Cache in ExternalLink.metadataJson, update via webhooks (D-11).
- **Global status mapping:** Don't create a single global mapping. Jira workflows are project-scoped, so mappings must be per-project (D-05).
- **Sync without origin tracking:** Never process a webhook without checking sync origin. This causes infinite loops in bidirectional sync.
- **Webhook registration without cleanup:** Always track webhook IDs and deregister on disconnect to avoid orphaned webhooks hitting a dead endpoint.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Webhook signature verification | Custom signature parsing | node:crypto HMAC-SHA256 + timingSafeEqual | Timing attack prevention, matches existing DocuSign pattern |
| Webhook queueing | Custom queue | QStash via existing /api/webhooks/[provider] pipeline | Already built, retries, signature verification |
| OAuth token management | Custom token store | Existing credential encryption + proactive refresh (Phase 12) | Token refresh, distributed lock, encryption all handled |
| Jira status category colors | Custom color mapping | Use Jira's 3 status categories (To Do/In Progress/Done) | Jira API returns statusCategory.key, always one of "new"/"indeterminate"/"done" |

**Key insight:** The Phase 12 integration foundation handles 80% of the infrastructure (OAuth, webhooks, health, sync logs). Phase 19 adds Jira-specific business logic on top.

## Common Pitfalls

### Pitfall 1: Bidirectional Sync Loops
**What goes wrong:** App updates Jira issue -> webhook fires -> app processes webhook -> updates Jira again -> infinite loop.
**Why it happens:** Jira has no native mechanism to suppress webhooks for API-initiated changes.
**How to avoid:** Track sync origin in ExternalLink.metadataJson with timestamp. On inbound webhook, skip processing if origin is "APP" and timestamp is within 30 seconds. On outbound sync, set origin to "APP" before calling Jira API.
**Warning signs:** Rapid-fire sync log entries for the same issue, QStash queue growing unexpectedly.

### Pitfall 2: Webhook Expiry (30-Day Lifecycle)
**What goes wrong:** Dynamic webhooks registered via REST API expire after 30 days. If not refreshed, inbound sync silently stops.
**Why it happens:** Atlassian enforces expiry on 3LO dynamic webhooks (unlike Connect app webhooks).
**How to avoid:** Store webhook IDs in IntegrationConnection.configJson. Run a cron job every ~25 days to call PUT /rest/api/3/webhook/refresh. Log refresh results to sync log.
**Warning signs:** Health dashboard shows "no recent webhooks" for Jira connections older than 30 days.

### Pitfall 3: Jira Transitions Are Not Status Names
**What goes wrong:** Trying to set a Jira issue status by name fails. Jira uses transition IDs, not status names.
**Why it happens:** Jira workflows have transitions (actions) that move issues between statuses. The same status can be reached via different transitions with different conditions.
**How to avoid:** Admin maps WorkflowTaskStatus to Jira transition IDs (fetched via GET /rest/api/3/issue/{key}/transitions). The mapping UI shows transition names but stores transition IDs.
**Warning signs:** 400 errors from Jira transition API with "It is not on the appropriate step" message.

### Pitfall 4: Dual Webhooks on Board Transition
**What goes wrong:** When an issue is transitioned via a Jira board (drag-and-drop), Jira fires TWO webhook events: one for the board move and one for the status change.
**Why it happens:** Jira Cloud board interactions trigger separate events for the board column change and the underlying status transition.
**How to avoid:** Deduplicate by checking if the same issue+status combination was already processed within a short window (5 seconds). Use the changelog item's `to` value as the dedup key.
**Warning signs:** Duplicate sync log entries for the same issue transition.

### Pitfall 5: Webhook Registration Limit (5 per app per user)
**What goes wrong:** OAuth 2.0 3LO apps are limited to 5 webhooks per app per user per tenant. Registering per-project webhooks can exceed this limit.
**Why it happens:** Atlassian enforces this limit to prevent abuse.
**How to avoid:** Register a single webhook with a broad JQL filter (e.g., no project filter, or use `project IN (...)` combining all configured projects). Update the JQL filter when projects are added/removed rather than creating new webhooks.
**Warning signs:** 400/429 errors when registering webhooks after connecting multiple projects.

### Pitfall 6: OAuth Scope Expansion Requires Reconnection
**What goes wrong:** Adding new scopes (write:jira-work, manage:jira-webhook) to an existing connection doesn't automatically grant them.
**Why it happens:** OAuth tokens carry the scopes granted at authorization time. New scopes require re-authorization.
**How to avoid:** When upgrading from Phase 18 (read-only), detect stale scope and prompt admin to reconnect. Check the `scope` field in stored credentials against required scopes.
**Warning signs:** 403 errors when trying to create issues or register webhooks with a Phase-18-era token.

### Pitfall 7: Jira Issue Description ADF Format
**What goes wrong:** Sending plain text in the `description` field when creating Jira issues results in rendering issues or errors.
**Why it happens:** Jira REST API v3 uses Atlassian Document Format (ADF), a structured JSON format, not plain text.
**How to avoid:** Wrap description text in minimal ADF: `{ type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: "..." }] }] }`.
**Warning signs:** 400 errors from issue creation with "Operation value must be valid" for the description field.

## Code Examples

Verified patterns from official sources:

### Create Jira Issue
```typescript
// Source: Jira Cloud REST API v3
// POST https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/issue
const issueBody = {
  fields: {
    project: { id: projectId }, // from task template configJson
    issuetype: { id: issueTypeId }, // from task template configJson
    summary: `${taskRun.title} - ${contractorName}`,
    description: {
      type: "doc",
      version: 1,
      content: [{
        type: "paragraph",
        content: [{ type: "text", text: taskRun.description ?? taskRun.title }],
      }],
    },
  },
};

const response = await fetch(`${baseUrl}/issue`, {
  method: "POST",
  headers: { ...authHeaders, "Content-Type": "application/json" },
  body: JSON.stringify(issueBody),
});
const created = await response.json();
// created.id, created.key (e.g., "PROJ-123"), created.self
```

### Execute Jira Transition
```typescript
// Source: Jira Cloud REST API v3
// POST https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/issue/{issueKey}/transitions
const transitionBody = { transition: { id: mappedTransitionId } };

await fetch(`${baseUrl}/issue/${issueKey}/transitions`, {
  method: "POST",
  headers: { ...authHeaders, "Content-Type": "application/json" },
  body: JSON.stringify(transitionBody),
});
```

### Get Available Transitions (for mapping UI)
```typescript
// Source: Jira Cloud REST API v3
// GET https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/issue/{issueKey}/transitions
// Note: Transitions are context-dependent (vary by current issue status)
// For mapping UI, fetch transitions for a sample issue in each status
const response = await fetch(`${baseUrl}/issue/${issueKey}/transitions`, {
  headers: authHeaders,
});
const data = await response.json();
// data.transitions: [{ id: "21", name: "In Progress", to: { id: "3", name: "In Progress", statusCategory: { key: "indeterminate" } } }]
```

### List Jira Projects (for mapping UI)
```typescript
// Source: Jira Cloud REST API v3
// GET https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/project
const response = await fetch(`${baseUrl}/project`, { headers: authHeaders });
const projects = await response.json();
// projects: [{ id: "10000", key: "PROJ", name: "My Project" }]
```

### List Issue Types for Project (for mapping UI)
```typescript
// Source: Jira Cloud REST API v3
// GET https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/project/{projectId}
const response = await fetch(`${baseUrl}/project/${projectId}`, { headers: authHeaders });
const project = await response.json();
// project.issueTypes: [{ id: "10001", name: "Bug" }, { id: "10002", name: "Task" }]
```

### Register Dynamic Webhook
```typescript
// Source: Jira Cloud REST API v3 / Webhooks docs
// POST https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/webhook
const webhookBody = {
  url: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/jira`,
  webhooks: [{
    jqlFilter: `project IN (${configuredProjectKeys.join(", ")})`,
    events: ["jira:issue_updated"],
  }],
};

const response = await fetch(`${baseUrl}/webhook`, {
  method: "POST",
  headers: { ...authHeaders, "Content-Type": "application/json" },
  body: JSON.stringify(webhookBody),
});
const result = await response.json();
// result.webhookRegistrationResult: [{ createdWebhookId: 12345 }]
```

### Verify Webhook Signature (HMAC-SHA256)
```typescript
// Source: Jira Cloud Webhooks documentation
import { createHmac, timingSafeEqual } from "node:crypto";

function verifyJiraWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
): boolean {
  // Header format: sha256=<hex-signature>
  const [method, signature] = signatureHeader.split("=");
  if (method !== "sha256" || !signature) return false;

  const expected = createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  return timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expected, "hex"),
  );
}
```

### Process Webhook Status Change
```typescript
// Source: Jira Cloud webhook payload structure
interface JiraWebhookPayload {
  webhookEvent: "jira:issue_updated";
  timestamp: number;
  issue: {
    id: string;
    key: string;
    fields: {
      summary: string;
      status: {
        name: string;
        statusCategory: { key: "new" | "indeterminate" | "done" };
      };
      project: { id: string; key: string; name: string };
    };
  };
  changelog: {
    items: Array<{
      field: string;
      fieldtype: string;
      from: string;
      fromString: string;
      to: string;
      toString: string;
    }>;
  };
}

// Detect status change from changelog
const statusChange = payload.changelog.items.find(
  (item) => item.field === "status"
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Connect app webhooks (static) | Dynamic webhooks via REST API (OAuth 2.0 3LO) | June 2021 | 3LO apps can now register webhooks; Connect reaching EOL Dec 2026 |
| Workflow transition properties API | Bulk update workflows API | Removing June 2026 | Must NOT use workflow transition properties API; use transitions endpoint instead |
| Plain text issue descriptions | Atlassian Document Format (ADF) | Jira REST API v3 | All text content must be wrapped in ADF JSON structure |

**Deprecated/outdated:**
- **Atlassian Connect:** Reaching end of support December 2026. Use OAuth 2.0 3LO, not Connect.
- **Workflow transition properties:** Being removed June 1, 2026. Use the standard transitions endpoint.
- **REST API v2 for issue creation:** v3 requires ADF for rich text fields.

## Open Questions

1. **Jira project-level status mapping storage location**
   - What we know: D-05 says mapping is per Jira project. Needs to persist somewhere accessible by both inbound (webhook) and outbound (task status change) sync.
   - What's unclear: Whether to store as a separate DB model or in IntegrationConnection.configJson.
   - Recommendation: Store in IntegrationConnection.configJson as a `statusMappings` object keyed by project ID. Simpler than a new model, and the mapping set is small (6 workflow statuses x N projects). Example: `configJson.statusMappings["10000"] = { "TODO": "11", "IN_PROGRESS": "21", "DONE": "31" }`.

2. **Webhook secret management**
   - What we know: Jira dynamic webhooks support HMAC-SHA256 with a shared secret. The secret cannot be retrieved after registration.
   - What's unclear: Whether the dynamic webhook API for 3LO apps supports passing a custom secret (Connect apps do; 3LO may differ).
   - Recommendation: Generate a per-connection secret, store it encrypted alongside OAuth credentials, pass during webhook registration. If 3LO API doesn't support custom secrets, fall back to verifying webhook origin by matching issue key to known ExternalLinks (weaker but functional).

3. **Jira project statuses vs transitions for mapping UI**
   - What we know: The transitions API is context-dependent (returns transitions available from current status). Mapping UI needs ALL possible transitions for a project.
   - What's unclear: Best way to enumerate all transitions for a project without a sample issue in every status.
   - Recommendation: Use GET /rest/api/3/status/project/{projectId} to get all statuses for the project, then use the Jira workflow scheme API or simply document that the mapping table shows statuses (not transitions) and the sync service resolves the correct transition ID at runtime by calling GET /issue/{key}/transitions before executing.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `packages/api/vitest.config.ts` |
| Quick run command | `cd packages/api && npx vitest run --reporter=verbose` |
| Full suite command | `npx turbo test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| JIRA-01 | OAuth scope expansion detection and reconnect prompt | unit | `cd packages/api && npx vitest run src/services/__tests__/jira-issue-sync.test.ts -x` | Wave 0 |
| JIRA-02 | Issue creation from workflow task activation | unit | `cd packages/api && npx vitest run src/services/__tests__/jira-issue-sync.test.ts -x` | Wave 0 |
| JIRA-03a | Inbound: webhook status change updates WorkflowTaskRun | unit | `cd packages/api && npx vitest run src/services/__tests__/jira-webhook-handler.test.ts -x` | Wave 0 |
| JIRA-03b | Outbound: task status change triggers Jira transition | unit | `cd packages/api && npx vitest run src/services/__tests__/jira-issue-sync.test.ts -x` | Wave 0 |
| JIRA-03c | Loop prevention skips self-originated changes | unit | `cd packages/api && npx vitest run src/services/__tests__/jira-webhook-handler.test.ts -x` | Wave 0 |
| JIRA-04 | ExternalLink metadataJson contains chip display data | unit | `cd packages/api && npx vitest run src/services/__tests__/jira-issue-sync.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/api && npx vitest run --reporter=verbose`
- **Per wave merge:** `npx turbo test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/api/src/services/__tests__/jira-issue-sync.test.ts` -- covers JIRA-01, JIRA-02, JIRA-03b, JIRA-04
- [ ] `packages/api/src/services/__tests__/jira-webhook-handler.test.ts` -- covers JIRA-03a, JIRA-03c
- [ ] `packages/api/src/services/__tests__/jira-status-mapping.test.ts` -- covers mapping CRUD and lookup

## Sources

### Primary (HIGH confidence)
- [Jira Cloud REST API v3 - Issues](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/) - Create issue, transitions endpoints
- [Jira Cloud REST API v3 - Webhooks](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-webhooks/) - Dynamic webhook registration
- [Jira Cloud Webhooks documentation](https://developer.atlassian.com/cloud/jira/platform/webhooks/) - Webhook lifecycle, 30-day expiry, HMAC verification, 5-per-app limit
- [Jira OAuth 2.0 scopes](https://developer.atlassian.com/cloud/jira/platform/scopes-for-oauth-2-3LO-and-forge-apps/) - write:jira-work, manage:jira-webhook scope definitions
- [Jira OAuth 2.0 3LO apps](https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/) - OAuth flow documentation

### Secondary (MEDIUM confidence)
- [Jira Webhooks Guide with Payload Examples](https://inventivehq.com/blog/jira-webhooks-guide) - Webhook payload structure, changelog format
- [Example Jira Ticket Update Webhook Payload (GitHub Gist)](https://gist.github.com/icelander/f598d036f3d3513f9acdc6112bf18933) - Full JSON payload example
- [OAuth 2.0 3LO Webhooks announcement](https://community.developer.atlassian.com/t/oauth-2-0-3lo-webhooks-announcement/49242) - manage:jira-webhook scope for 3LO
- [Atlassian Community: Register webhook with 3LO OAuth2](https://community.developer.atlassian.com/t/how-can-i-register-a-webhook-using-the-rest-api-when-using-3lo-oauth2/30781) - Confirmed dynamic webhooks work with 3LO

### Tertiary (LOW confidence)
- [Avoiding endless loops on Jira issue events (Atlassian Community)](https://community.developer.atlassian.com/t/avoiding-endless-loops-on-jira-issue-events/70447) - Loop prevention approaches (community, not official)
- [Dual webhook on board transition (Atlassian Support)](https://support.atlassian.com/jira/kb/how-to-handle-two-web-hooks-triggered-when-a-issue-is-transitioned-from-one-status-to-another-via-board/) - Board-triggered dual events

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - using existing project infrastructure + well-documented Jira REST API v3
- Architecture: HIGH - extends proven patterns from Phase 12 (webhooks) and Phase 18 (Jira worklog sync)
- Pitfalls: HIGH - loop prevention and webhook expiry are well-documented; transition vs status distinction verified in official docs
- Webhook payload format: MEDIUM - verified against multiple sources but not tested with live API
- 3LO webhook secret support: LOW - unclear if 3LO dynamic webhooks accept custom HMAC secret parameter (Connect docs confirm it, 3LO-specific docs ambiguous)

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (Jira Cloud REST API v3 is stable; workflow transition properties removal June 2026 is the only time-sensitive item)
