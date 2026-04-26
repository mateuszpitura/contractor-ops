# Phase 29: Linear Integration - Research

**Researched:** 2026-04-02
**Domain:** Linear API (OAuth 2.0, GraphQL, Webhooks) + existing adapter framework replication
**Confidence:** HIGH

## Summary

Phase 29 replicates the existing Jira bidirectional sync pattern for Linear. The codebase already has a well-established adapter framework (`BaseAdapter`, provider registry, unified OAuth callback, QStash webhook pipeline, `ExternalLink` model) that Linear slots into with minimal structural changes. The primary work is: (1) implementing a `LinearAdapter` extending `BaseAdapter`, (2) creating Linear-specific sync services mirroring the Jira ones, (3) adding Linear UI components following the Jira provider section pattern, and (4) adding `LINEAR` to the `IntegrationProvider` Prisma enum.

Linear uses OAuth 2.0 with short-lived tokens (24h) + refresh tokens, GraphQL for all API operations (issue CRUD, workflow state queries, user lookup), and HMAC-SHA256 webhook signatures via the `Linear-Signature` header. The webhook payload structure differs from Jira: Linear sends `stateId` UUIDs rather than status names, requiring a GraphQL lookup to resolve state names for the mapping layer. Workflow states have 6 categories: `triage`, `backlog`, `unstarted`, `started`, `completed`, `cancelled`.

**Primary recommendation:** Follow the Jira adapter implementation 1:1, substituting Linear's GraphQL API for Jira's REST API. Use raw `fetch` to `https://api.linear.app/graphql` (no SDK) to match the existing codebase pattern. Store Linear team ID (analogous to Jira project ID) in workflow template `configJson` for per-template routing.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Per-team mapping dialog, matching Jira's per-project approach
- D-02: Dialog pre-populates smart defaults based on Linear state names
- D-03: Status mapping required at connection time -- after OAuth, admin picks teams and maps statuses immediately
- D-04: Unmapped Linear states ignored silently, logged in webhook delivery records
- D-05: Target Linear team configured per-workflow template during workflow setup
- D-06: Auto-created issues include title and description only -- no labels, priority, project, cycle, or estimate
- D-07: Assignee matched by email -- look up Linear account by email, fall back to unassigned
- D-08: Chip displays issue identifier (e.g., "ENG-123") with colored status dot, clicking opens Linear in new tab
- D-09: Chip uses Linear purple accent tint/icon, distinct from Jira blue
- D-10: Linear gets own section in integrations settings tab, matching Jira's treatment
- D-11: Jira and Linear can coexist -- both connected simultaneously, different templates target either

### Claude's Discretion
- Linear OAuth scope selection and token refresh implementation
- Webhook signature verification approach (Linear uses HMAC)
- Exact smart-default mapping algorithm for status names
- Linear GraphQL API query structure for issue CRUD and status transitions
- Loop prevention timing (dedup window, suppression duration)
- Linear team/workspace discovery flow during OAuth callback
- Error handling for Linear API rate limits

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIN-01 | Connect Linear workspace via OAuth 2.0 with refresh token support | OAuth flow fully documented: authorization at `linear.app/oauth/authorize`, token exchange at `api.linear.app/oauth/token`, 24h access tokens with refresh. Scopes: `read,write` needed. |
| LIN-02 | Admin can map Linear workflow states to internal task statuses per team | Linear has 6 state categories (triage/backlog/unstarted/started/completed/cancelled). Query via `team.states` GraphQL. Status mapping stored in `configJson.statusMappings[teamId]` following Jira pattern. |
| LIN-03 | Workflow task with Linear enabled auto-creates Linear issue | `issueCreate` mutation with `teamId`, `title`, `description`, `assigneeId`. User lookup by email via `users(filter: { email: { eq: "..." } })` GraphQL query. |
| LIN-04 | Status changes in Linear sync to linked workflow task via webhooks | Webhook sends `action: "update"` with `data.stateId` and `updatedFrom.stateId`. Must resolve stateId to state name via cached mapping or GraphQL lookup. HMAC-SHA256 via `Linear-Signature` header. |
| LIN-05 | Status changes on workflow task sync to Linear issue via GraphQL mutation | `issueUpdate(id, input: { stateId })` mutation. Must look up target stateId from status mapping. Loop prevention via `lastSyncOrigin` pattern (30s window). |
| LIN-06 | Linked Linear issue displays as clickable chip with status badge | ExternalLink with `externalType: "LINEAR_ISSUE"`, chip component mirrors `JiraIssueChip` with Linear purple branding. Status dot uses same semantic color tokens. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Raw fetch | N/A | Linear GraphQL API calls | Matches Jira adapter pattern -- no SDK, direct HTTP to `https://api.linear.app/graphql` |
| node:crypto | Built-in | HMAC-SHA256 webhook signature verification | Same as Jira adapter's `createHmac` pattern |
| zod | (existing) | Webhook payload + API response validation | Project-wide schema validation standard |
| Prisma | (existing) | ExternalLink, IntegrationConnection, WebhookDelivery | Existing models support Linear with enum addition |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @upstash/qstash | (existing) | Async webhook processing | Same pipeline as Jira webhooks |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw fetch | @linear/sdk v80.1.0 | SDK is 80+ versions ahead, adds bundle size, abstracts GraphQL. Raw fetch matches Jira pattern and keeps adapter lightweight. Skip SDK. |

**Installation:**
No new packages required. All dependencies are already in the monorepo.

## Architecture Patterns

### Recommended Project Structure
```
packages/integrations/src/adapters/
  linear-adapter.ts              # LinearAdapter extends BaseAdapter (OAuth + webhook verification)

packages/api/src/services/
  linear-webhook-handler.ts      # Inbound: webhook -> task status update (mirrors jira-webhook-handler.ts)
  linear-issue-sync.ts           # Outbound: task change -> Linear issue create/update (mirrors jira-issue-sync.ts)
  linear-status-mapping.ts       # Status mapping service with reverse lookup (mirrors jira-status-mapping.ts)

packages/validators/src/
  linear.ts                      # Zod schemas for webhook payload, task config, status mapping, metadata

apps/web/src/components/integrations/
  linear-provider-section.tsx    # Settings section (mirrors jira-provider-section.tsx)
  linear-status-mapping-dialog.tsx # Per-team status mapping (mirrors jira-status-mapping-dialog.tsx)
  linear-issue-chip.tsx          # Issue chip with Linear purple branding
  linear-logo.tsx                # Linear SVG logo component
```

### Pattern 1: Linear Adapter (OAuth + Webhook Verification)
**What:** `LinearAdapter` extending `BaseAdapter` with OAuth config and HMAC verification
**When to use:** Always -- this is the integration entry point
**Example:**
```typescript
// Source: Linear OAuth docs + existing JiraAdapter pattern
const LINEAR_OAUTH_CONFIG: OAuthConfig = {
  clientIdEnvVar: "LINEAR_CLIENT_ID",
  clientSecretEnvVar: "LINEAR_CLIENT_SECRET",
  authorizationUrl: "https://linear.app/oauth/authorize",
  tokenUrl: "https://api.linear.app/oauth/token",
  scopes: ["read", "write"],
  redirectPath: "/api/oauth/linear/callback",
};

class LinearAdapter extends BaseAdapter {
  readonly slug = "linear";
  readonly displayName = "Linear";
  readonly supportsOAuth = true;
  readonly supportsWebhooks = true;

  verifyWebhookSignature(rawBody: string, headers: Record<string, string>): WebhookVerificationResult {
    const signature = headers["linear-signature"];
    const secret = headers["x-webhook-secret"] ?? process.env.LINEAR_WEBHOOK_SECRET;
    if (!signature || !secret) return { valid: false };

    const computed = createHmac("sha256", secret).update(rawBody).digest("hex");
    const valid = timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(computed, "hex"));

    let eventType: string | undefined;
    if (valid) {
      try {
        const parsed = JSON.parse(rawBody) as { type?: string; action?: string };
        eventType = parsed.type ? `${parsed.type}.${parsed.action}` : undefined;
      } catch { /* ignore */ }
    }
    return { valid, eventType };
  }
}
```

### Pattern 2: GraphQL Helper for Linear API Calls
**What:** Thin wrapper for Linear GraphQL requests with error handling
**When to use:** All Linear API interactions (issue CRUD, state queries, user lookup)
**Example:**
```typescript
// Source: Linear GraphQL docs
async function linearGraphQL<T>(
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Linear API error: ${response.status}`);
  }

  const json = await response.json() as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors?.length) {
    throw new Error(`Linear GraphQL error: ${json.errors[0].message}`);
  }
  return json.data as T;
}
```

### Pattern 3: Webhook Payload Processing (State Change Detection)
**What:** Detecting status changes from Linear webhooks using `updatedFrom.stateId`
**When to use:** Inbound webhook processing
**Example:**
```typescript
// Source: Linear webhook docs
// Linear sends stateId UUIDs, NOT state names.
// The webhook payload includes:
// - data.stateId (new state UUID)
// - updatedFrom.stateId (previous state UUID, only present if state changed)
//
// To get the state NAME for mapping, either:
// 1. Cache team workflow states at connection time (preferred)
// 2. Query GraphQL: { workflowState(id: "uuid") { id name type } }

interface LinearWebhookPayload {
  action: "create" | "update" | "remove";
  type: "Issue";
  organizationId: string;
  webhookTimestamp: number;
  webhookId: string;
  url: string;
  actor: { id: string; type: string; name: string };
  data: {
    id: string;
    number: number;
    identifier: string; // e.g., "ENG-123"
    title: string;
    description?: string;
    stateId: string;
    teamId: string;
    assigneeId?: string;
    url: string;
  };
  updatedFrom?: {
    stateId?: string;
    // Other changed fields...
  };
}
```

### Pattern 4: Status Mapping with State Categories
**What:** Mapping Linear's 6 workflow state categories to internal task statuses
**When to use:** Smart defaults in mapping dialog + status resolution
**Example:**
```typescript
// Source: Linear docs - workflow state types
// Linear states have a `type` field: triage | backlog | unstarted | started | completed | cancelled

const SMART_DEFAULT_MAP: Record<string, string> = {
  triage: "TODO",
  backlog: "TODO",
  unstarted: "TODO",
  started: "IN_PROGRESS",
  completed: "DONE",
  cancelled: "CANCELLED",
};

// Additionally, match by state name for more specific defaults:
function smartDefaultForState(stateName: string, stateType: string): string {
  const nameLower = stateName.toLowerCase();
  if (nameLower.includes("block")) return "BLOCKED";
  if (nameLower.includes("done") || nameLower.includes("complete")) return "DONE";
  if (nameLower.includes("progress") || nameLower.includes("review")) return "IN_PROGRESS";
  if (nameLower.includes("cancel")) return "CANCELLED";
  // Fall back to category-based default
  return SMART_DEFAULT_MAP[stateType] ?? "TODO";
}
```

### Pattern 5: Assignee Email Lookup
**What:** Finding Linear user by email for issue assignment (D-07)
**When to use:** During issue creation
**Example:**
```typescript
// Source: Linear GraphQL schema
const FIND_USER_BY_EMAIL = `
  query FindUserByEmail($email: String!) {
    users(filter: { email: { eq: $email } }) {
      nodes { id name email }
    }
  }
`;
// Returns nodes array -- take first match or null (fallback to unassigned per D-07)
```

### Anti-Patterns to Avoid
- **Resolving stateId inline on every webhook:** Cache team workflow states in `configJson` at connection/mapping time. Do NOT call GraphQL on every webhook to resolve a stateId to a name.
- **Using Linear SDK:** The SDK adds heavy dependencies and auto-generated types. Raw fetch with typed responses matches existing patterns.
- **Shared status mapping service:** Do NOT try to make a generic status mapping service for both Jira and Linear. Jira uses transition IDs (POST to transitions endpoint), Linear uses stateId (mutation on issue). Keep them separate like the Jira services.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth flow | Custom OAuth implementation | Existing `BaseAdapter` + unified OAuth callback | Callback route already handles all providers generically |
| Webhook ingestion | Custom webhook route | Existing `/api/webhooks/[provider]` route | Auto-routes by provider slug, logs to WebhookDelivery |
| Async processing | Custom queue | Existing QStash pipeline | Fire-and-forget with retry, already wired to `_process` route |
| Credential encryption | Custom encryption | Existing `encryptCredentials`/`decryptCredentials` | AES-256-GCM with per-provider key pattern |
| Connection UI | Custom connection card | Existing `ProviderConnectionCard` component | Standard card with status badges, connect/disconnect actions |
| Detail sheet | Custom logs panel | Existing `ProviderDetailSheet` component | Sync log + webhook log tables with cursor pagination |

**Key insight:** The existing adapter framework handles 80% of the integration plumbing. The Linear-specific work is: adapter class, GraphQL queries, webhook handler, and status mapping logic.

## Common Pitfalls

### Pitfall 1: Linear Sends State UUIDs, Not Names
**What goes wrong:** Webhook payload contains `data.stateId` (UUID) not a human-readable status name. Without pre-cached state data, you cannot map the webhook to internal statuses.
**Why it happens:** Linear's data model uses UUIDs for workflow states, unlike Jira which sends status names in webhook payloads.
**How to avoid:** During team selection/mapping setup, fetch ALL workflow states for the selected team via `team.states` GraphQL query. Cache `stateId -> { name, type }` mapping in `configJson.stateCache[teamId]`. On webhook receipt, look up state name from cache. If stateId not found in cache (new state added after mapping), log as unmapped per D-04 and prompt admin to update mapping.
**Warning signs:** Webhook handler cannot find state name for a stateId.

### Pitfall 2: Token Expiry is 24 Hours (Not Days)
**What goes wrong:** Linear access tokens expire in 24 hours (86400 seconds). Jira tokens last longer. Forgetting to implement proactive refresh leads to stale tokens during outbound sync.
**Why it happens:** Linear changed to short-lived tokens (Oct 2025). Apps must refresh tokens regularly.
**How to avoid:** Store `tokenExpiresAt` in IntegrationConnection (field already exists). Before any outbound API call, check if token expires within 5 minutes and refresh proactively. Use the existing `refreshToken` pattern from BaseAdapter. Refresh endpoint: `POST https://api.linear.app/oauth/token` with `grant_type=refresh_token`. Linear provides a 30-minute grace period for stale refresh tokens.
**Warning signs:** 401 errors on outbound sync calls.

### Pitfall 3: Webhook Loop with State Updates
**What goes wrong:** App updates Linear issue state -> Linear sends webhook -> app updates task -> triggers outbound sync -> infinite loop.
**Why it happens:** Bidirectional sync without origin tracking.
**How to avoid:** Follow Jira's `lastSyncOrigin` pattern exactly. Before outbound mutation, set `lastSyncOrigin="APP"` + `lastSyncAt` on ExternalLink. On inbound webhook, check if `lastSyncOrigin="APP"` and `lastSyncAt` is within 30s window -- if so, suppress. Use same 30s/5s windows as Jira (LOOP_PREVENTION_WINDOW_MS=30000, DEDUP_WINDOW_MS=5000).
**Warning signs:** Rapid-fire sync logs alternating INBOUND/OUTBOUND for same issue.

### Pitfall 4: Linear Webhook `organizationId` is Linear's Org ID, Not Ours
**What goes wrong:** The webhook payload's `organizationId` field is Linear's workspace UUID, not the internal organization ID. Using it directly to find IntegrationConnection fails.
**Why it happens:** Naming collision between Linear's org ID and our internal org ID.
**How to avoid:** Match webhook to IntegrationConnection via the `webhookId` field in the payload (stored during webhook registration) or by looking up the ExternalLink by `data.identifier` (issue key like "ENG-123"). Store Linear's `organizationId` in `configJson.linearOrganizationId` during OAuth and use it as a secondary lookup key.
**Warning signs:** Webhook processing fails with "connection not found" errors.

### Pitfall 5: Linear Webhook Registration is Per-Workspace, Not Per-Issue
**What goes wrong:** Unlike Jira's JQL-filtered dynamic webhooks, Linear webhooks are registered at workspace or team level. You cannot filter to specific issues.
**Why it happens:** Linear's webhook model is simpler -- subscribe to resource types (e.g., "Issue") for a team or entire workspace.
**How to avoid:** Register one webhook per team (using `teamId` parameter in `webhookCreate` mutation). Filter irrelevant events in the handler (check if `data.identifier` matches a known ExternalLink). This is actually simpler than Jira's approach.
**Warning signs:** Processing webhooks for unlinked issues (normal -- just return early).

### Pitfall 6: Missing `LINEAR` in IntegrationProvider Enum
**What goes wrong:** Prisma schema does not have `LINEAR` in the `IntegrationProvider` enum. Creating connections or webhook deliveries fails.
**Why it happens:** New provider not yet added to schema.
**How to avoid:** Add `LINEAR` to the `IntegrationProvider` enum in `integration.prisma` as the FIRST task (requires migration). All downstream code depends on this.
**Warning signs:** Prisma validation errors on connection creation.

### Pitfall 7: Linear Issue Identifier Format
**What goes wrong:** Using `data.id` (UUID) instead of `data.identifier` (e.g., "ENG-123") as the ExternalLink `externalId`.
**Why it happens:** Linear issues have both a UUID `id` and a human-readable `identifier`.
**How to avoid:** Use `data.identifier` as `externalId` in ExternalLink (matches Jira's `issueKey` pattern). Use `data.id` (UUID) for GraphQL mutations (`issueUpdate(id: "uuid")`). Store both in metadata.
**Warning signs:** ExternalLink lookup fails because webhook sends identifier but link stores UUID.

## Code Examples

### Linear OAuth Token Exchange
```typescript
// Source: https://linear.app/developers/oauth-2-0-authentication
async exchangeCodeForTokens(code: string, redirectUri: string): Promise<CredentialBlob> {
  const clientId = process.env.LINEAR_CLIENT_ID;
  const clientSecret = process.env.LINEAR_CLIENT_SECRET;

  const response = await fetch("https://api.linear.app/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId!,
      client_secret: clientSecret!,
      code,
      redirect_uri: redirectUri,
    }),
  });

  const data = await response.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    scope: string[];
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenType: data.token_type,
    scope: Array.isArray(data.scope) ? data.scope.join(",") : data.scope,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}
```

### Discover Linear Teams After OAuth
```typescript
// Source: https://linear.app/developers/graphql
const TEAMS_QUERY = `
  query {
    teams {
      nodes {
        id
        name
        key
        states {
          nodes {
            id
            name
            type
            color
            position
          }
        }
      }
    }
    organization {
      id
      name
      urlKey
    }
  }
`;
// Call after token exchange to populate configJson with available teams + org info
```

### Create Linear Issue (Outbound Sync)
```typescript
// Source: https://linear.app/developers/graphql
const CREATE_ISSUE_MUTATION = `
  mutation IssueCreate($input: IssueCreateInput!) {
    issueCreate(input: $input) {
      success
      issue {
        id
        identifier
        number
        title
        url
        state { id name type }
        team { id name key }
      }
    }
  }
`;

// Variables:
const input = {
  teamId: "team-uuid",
  title: taskRun.title,
  description: taskRun.description ?? taskRun.title,
  assigneeId: resolvedAssigneeId ?? undefined, // D-07: null if no email match
};
```

### Update Linear Issue State (Outbound Sync)
```typescript
// Source: https://linear.app/developers/graphql
const UPDATE_ISSUE_STATE = `
  mutation IssueUpdate($id: String!, $stateId: String!) {
    issueUpdate(id: $id, input: { stateId: $stateId }) {
      success
      issue {
        id
        identifier
        state { id name type }
      }
    }
  }
`;
// id: the issue UUID (stored in ExternalLink metadata as linearIssueId)
// stateId: the target workflow state UUID from status mapping
```

### Linear Webhook Payload Schema (Zod)
```typescript
// Source: https://linear.app/developers/webhooks
export const linearWebhookPayloadSchema = z.object({
  action: z.enum(["create", "update", "remove"]),
  type: z.literal("Issue"),
  organizationId: z.string(),
  webhookTimestamp: z.number(),
  webhookId: z.string(),
  url: z.string().url(),
  actor: z.object({
    id: z.string(),
    type: z.string(),
    name: z.string().optional(),
  }),
  data: z.object({
    id: z.string(),
    number: z.number(),
    identifier: z.string(), // e.g., "ENG-123"
    title: z.string(),
    description: z.string().optional(),
    stateId: z.string(),
    teamId: z.string(),
    assigneeId: z.string().nullable().optional(),
    url: z.string(),
  }),
  updatedFrom: z.object({
    stateId: z.string().optional(),
  }).optional(),
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Long-lived OAuth tokens | 24h access tokens + refresh tokens | Oct 2025 | Must implement token refresh; 30-min grace period on refresh |
| Linear SDK for API calls | Raw GraphQL preferred for lightweight integrations | Ongoing | SDK is auto-generated, very large; raw fetch with typed responses is standard for server-side integrations |

**Deprecated/outdated:**
- Long-lived Linear API tokens created before Oct 2025 must migrate by April 2026 to refresh token flow

## Open Questions

1. **Webhook registration: workspace-level or team-level?**
   - What we know: Linear supports both. Team-level (`teamId` param in `webhookCreate`) is more targeted.
   - What's unclear: Whether workspace-level webhook auto-covers new teams added later.
   - Recommendation: Register per-team webhooks matching the per-team mapping model (D-01). Store webhook IDs in `configJson.webhooks[teamId]` for cleanup.

2. **State cache invalidation**
   - What we know: Team workflow states are cached at mapping time. Linear teams can add/remove states later.
   - What's unclear: Whether Linear sends a webhook for workflow state changes.
   - Recommendation: Cache states at mapping time. If a webhook arrives with unknown stateId, log as unmapped (D-04). Provide a "refresh states" button in the mapping dialog.

3. **OAuth token exchange Content-Type**
   - What we know: Linear docs show `application/x-www-form-urlencoded` for token exchange (standard OAuth 2.0). Jira uses `application/json`.
   - What's unclear: Whether Linear also accepts JSON body.
   - Recommendation: Use `application/x-www-form-urlencoded` with `URLSearchParams` as shown in official docs.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (existing) |
| Config file | `packages/integrations/vitest.config.ts` |
| Quick run command | `cd packages/integrations && pnpm vitest run --reporter=verbose` |
| Full suite command | `pnpm turbo test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIN-01 | OAuth config, token exchange, refresh | unit | `cd packages/integrations && pnpm vitest run src/adapters/__tests__/linear-adapter.test.ts -x` | Wave 0 |
| LIN-02 | Status mapping save/get/lookup with Linear state categories | unit | `cd packages/api && pnpm vitest run src/__tests__/linear-status-mapping.test.ts -x` | Wave 0 |
| LIN-03 | Issue creation with assignee email lookup | unit | `cd packages/api && pnpm vitest run src/__tests__/linear-issue-sync.test.ts -x` | Wave 0 |
| LIN-04 | Inbound webhook: signature verify, state change detection, loop prevention | unit | `cd packages/integrations && pnpm vitest run src/__tests__/linear-adapter-webhooks.test.ts -x` | Wave 0 |
| LIN-05 | Outbound sync: task status -> Linear state mutation | unit | `cd packages/api && pnpm vitest run src/__tests__/linear-issue-sync.test.ts -x` | Wave 0 |
| LIN-06 | Issue chip rendering with Linear branding | manual-only | Visual verification in browser | N/A |

### Sampling Rate
- **Per task commit:** `cd packages/integrations && pnpm vitest run --reporter=verbose`
- **Per wave merge:** `pnpm turbo test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/integrations/src/adapters/__tests__/linear-adapter.test.ts` -- covers LIN-01, LIN-04
- [ ] `packages/api/src/__tests__/linear-status-mapping.test.ts` -- covers LIN-02
- [ ] `packages/api/src/__tests__/linear-issue-sync.test.ts` -- covers LIN-03, LIN-05
- [ ] `packages/validators/src/__tests__/linear.test.ts` -- covers webhook payload validation

## Project Constraints (from CLAUDE.md)

- **ctx7 CLI:** Use for library documentation lookups (not directly needed here -- Linear API is documented via official web docs)
- **Clean architecture:** Linear adapter in `packages/integrations`, sync services in `packages/api`, UI in `apps/web` -- follows existing bounded context pattern
- **Schema validation:** All webhook payloads, API responses, and configs must use Zod schemas (per `packages/validators` pattern)
- **Security:** HMAC-SHA256 webhook verification mandatory; credential encryption via existing AES-256-GCM per-provider pattern; `LINEAR_ENCRYPTION_KEY` env var required
- **No SDK:** Raw fetch matches existing Jira pattern and keeps dependencies minimal
- **Strong typing:** All Linear API responses must be typed via Zod schemas or TypeScript interfaces
- **Env vars:** Add `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET`, `LINEAR_ENCRYPTION_KEY`, `LINEAR_WEBHOOK_SECRET` to `.env.example`

## Sources

### Primary (HIGH confidence)
- [Linear OAuth 2.0 Authentication](https://linear.app/developers/oauth-2-0-authentication) -- OAuth flow, scopes, token refresh, PKCE
- [Linear Webhooks](https://linear.app/developers/webhooks) -- Webhook setup, HMAC-SHA256 verification, payload structure
- [Linear GraphQL API](https://linear.app/developers/graphql) -- Issue CRUD, workflow states, teams, users
- [Linear Rate Limiting](https://linear.app/developers/rate-limiting) -- 5000 req/hr, 2M complexity points/hr for OAuth apps
- [Linear GraphQL Schema (GitHub)](https://github.com/linear/linear/blob/master/packages/sdk/src/schema.graphql) -- IssueCreateInput fields, WorkflowState type enum

### Secondary (MEDIUM confidence)
- [Linear Webhooks Guide (InventiveHQ)](https://inventivehq.com/blog/linear-webhooks-guide) -- Payload examples, verified against official docs
- [Linear Issue Status Docs](https://linear.app/docs/configuring-workflows) -- State categories: triage, backlog, unstarted, started, completed, cancelled

### Tertiary (LOW confidence)
- None -- all findings verified with official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new packages, replicates existing Jira pattern
- Architecture: HIGH -- 1:1 mirror of proven Jira adapter/sync/mapping/UI pattern
- Pitfalls: HIGH -- verified against Linear API docs, cross-referenced with Jira implementation experience
- Linear API: HIGH -- all endpoints, payloads, and authentication verified with official docs

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable -- Linear API changes are infrequent)
