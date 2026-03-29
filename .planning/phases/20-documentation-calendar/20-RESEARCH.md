# Phase 20: Documentation & Calendar - Research

**Researched:** 2026-03-29
**Domain:** External service integration (Notion, Confluence, Google Calendar, Microsoft Outlook)
**Confidence:** HIGH

## Summary

Phase 20 adds four new integration adapters (Notion, Confluence, Google Calendar, Outlook Calendar) to the existing IntegrationProviderAdapter framework established in Phase 12 and refined through Phase 19 (Jira). The codebase already has 7 registered adapters, a generic OAuth flow, ExternalLink model for cached external entity metadata, a per-task configJson pattern for workflow task template configuration, and a command palette with grouped search results.

The documentation side (DOCS-01, DOCS-02) maps directly to the Jira pattern: ExternalLink with provider-specific externalType, metadataJson caching page title/icon/lastEdited, and a search API call proxied through tRPC. The calendar side (CAL-01, CAL-02) introduces a new pattern: per-user OAuth connections (not just org-level) and background event lifecycle management triggered by contract/approval/payment date changes.

**Primary recommendation:** Follow the Jira adapter pattern exactly for all four adapters. Use raw `fetch()` calls for all four APIs (no SDKs -- `googleapis` is 200MB, and the project already uses raw fetch for Jira/Atlassian). Store calendar eventId in ExternalLink to enable update/delete lifecycle.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Reuse ExternalLink model with provider=notion or provider=confluence. metadataJson caches page title, icon, and last edited timestamp.
- D-02: Multiple doc links per workflow step. ExternalLink already supports many-to-one relationships.
- D-03: Scope limited to workflow steps only for this phase. Doc linking on other entities deferred.
- D-04: Cached metadata: page title + provider icon + last edited date. Updated via webhook or lazy refresh on view.
- D-05: Dedicated "Docs" group in command palette alongside Contractors, Contracts, Invoices.
- D-06: Search by page titles only via Notion Search API and Confluence CQL. No full-text content search.
- D-07: Selecting a doc from Cmd+K opens the Notion/Confluence page in a new browser tab.
- D-08: All three deadline types auto-push: contract expiry, approval SLA deadlines, payment due dates.
- D-09: Workflow task templates get "Create calendar event" toggle in configJson with title template, duration, and attendees.
- D-10: Calendar events placed on actual deadline date. Calendar's native reminder system handles advance notifications.
- D-11: Auto-update on source data changes. Store calendar eventId in ExternalLink. Update or delete calendar event when source changes.
- D-12: Per-user personal calendar connection AND per-org shared calendar. Events pushed to both when both connected.
- D-13: Both Google Calendar and Microsoft Outlook supported from day one. Two adapters following IntegrationProviderAdapter pattern.
- D-14: Users connect calendar in Settings > My Calendar (personal settings). Per-user OAuth flow.
- D-15: Event title format: `[Contractor Ops] Contract expiry: {contractor} - {contract name}`. Deep link in description.

### Claude's Discretion
- Notion vs Confluence adapter internal implementation details
- OAuth scope selection for each doc/calendar provider
- Calendar event description content structure beyond the title format
- Webhook vs polling strategy for doc metadata freshness
- Loading states and error handling in Cmd+K doc search
- Org shared calendar connection UX (admin settings placement)

### Deferred Ideas (OUT OF SCOPE)
- Doc linking on contracts, contractors, and other entities beyond workflow steps
- Full-text content search across Notion/Confluence pages
- Bidirectional calendar sync (reading events back from external calendars)
- Notion/Confluence content rendering inline (page mirroring)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOCS-01 | User can attach Notion or Confluence page links to workflow steps | ExternalLink model reuse with externalType=NOTION_PAGE/CONFLUENCE_PAGE, Notion/Confluence adapter OAuth + search API |
| DOCS-02 | User can search and link Notion/Confluence pages from within Cmd+K | Notion POST /v1/search + Confluence GET /wiki/rest/api/search?cql= proxied through tRPC, "Docs" group in command palette |
| CAL-01 | System pushes contract expiry, approval SLA, and payment deadlines to Google/Outlook calendar | Google Calendar events.insert + MS Graph POST /me/calendar/events, per-user + per-org dual push, ExternalLink stores eventId for update/delete |
| CAL-02 | Workflow steps can create calendar events (e.g., onboarding kickoff meeting) | Per-task configJson with calendarEnabled/titleTemplate/duration/attendees, fire on task run creation |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Use `ctx7` CLI for library documentation (Context7 mandate)
- Monorepo with Turborepo -- all new code goes in existing packages (integrations, api, validators, web)
- Clean architecture: adapters in `packages/integrations`, routers/services in `packages/api`, validators in `packages/validators`, UI in `apps/web`
- Strong typing with Zod schema validation for all external inputs
- Per-provider encryption keys via `${SLUG_UPPER}_ENCRYPTION_KEY` env var pattern
- Security: least-privilege OAuth scopes, no secret exposure, defensive programming
- Accessibility: keyboard navigation, semantic HTML, screen-reader support in all UI
- Performance: avoid unnecessary re-renders, use appropriate caching (staleTime patterns)

## Standard Stack

### Core (No New Dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Raw `fetch()` | Node built-in | All 4 provider API calls | Project pattern -- Jira, KSeF, Clockify all use raw fetch. googleapis is 200MB. |
| Zod | Existing | Validator schemas for all API responses, configs | Already used across all integrations |
| Prisma | Existing | ExternalLink, IntegrationConnection models | Already used for all data access |
| tRPC | Existing | Router endpoints for doc search, calendar CRUD | Already used for all API routes |

### Supporting (Already in Project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-query | Existing | Client-side caching for doc search results | Cmd+K doc search with debounce |
| lucide-react | Existing | Provider icons (FileText for docs, Calendar for events) | Doc chips, calendar UI |
| next-intl | Existing | i18n for new UI strings | All new user-facing text |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw fetch for Google | `googleapis` npm (v171) | 200MB unpackedSize, project uses raw fetch everywhere |
| Raw fetch for MS Graph | `@microsoft/microsoft-graph-client` (v3) | Extra dependency, project uses raw fetch everywhere |
| Raw fetch for Notion | `@notionhq/client` | Small package but unnecessary abstraction over simple POST calls |

## Architecture Patterns

### Recommended Project Structure (New Files)
```
packages/integrations/src/adapters/
  notion-adapter.ts              # OAuth + search
  confluence-adapter.ts          # OAuth + CQL search (reuses Atlassian auth from Jira)
  google-calendar-adapter.ts     # OAuth + events CRUD
  outlook-calendar-adapter.ts    # OAuth + MS Graph events CRUD

packages/api/src/routers/
  docs.ts                        # Doc link CRUD + search proxy
  calendar.ts                    # Calendar event CRUD + deadline sync

packages/api/src/services/
  doc-link-service.ts            # Doc attach/detach, metadata refresh
  calendar-event-service.ts      # Event create/update/delete, deadline watchers
  calendar-deadline-sync.ts      # Cron/trigger: watches contract/approval/payment changes

packages/validators/src/
  docs.ts                        # Doc link metadata, search schemas
  calendar.ts                    # Calendar event config, metadata schemas

apps/web/src/components/
  workflow/doc-link-chip.tsx      # Clickable chip (like JiraIssueChip)
  workflow/attach-doc-button.tsx  # "Attach doc" action on task cards
  settings/my-calendar-section.tsx  # Personal calendar OAuth connection
```

### Pattern 1: Four Adapters Extending BaseAdapter
**What:** Each new provider gets an adapter class following the exact pattern of JiraAdapter
**When to use:** For OAuth config, token exchange, token refresh, webhook verification
**Example:**
```typescript
// packages/integrations/src/adapters/notion-adapter.ts
const NOTION_OAUTH_CONFIG: OAuthConfig = {
  clientIdEnvVar: "NOTION_CLIENT_ID",
  clientSecretEnvVar: "NOTION_CLIENT_SECRET",
  authorizationUrl: "https://api.notion.com/v1/oauth/authorize",
  tokenUrl: "https://api.notion.com/v1/oauth/token",
  scopes: [], // Notion uses integration capabilities, not scopes
  redirectPath: "/api/oauth/notion/callback",
};

export class NotionAdapter extends BaseAdapter {
  readonly slug = "notion";
  readonly displayName = "Notion";
  readonly supportsOAuth = true;
  readonly supportsWebhooks = false; // Use lazy refresh instead
}
```

### Pattern 2: ExternalLink for Both Docs and Calendar Events
**What:** Reuse ExternalLink model with different externalType values
**When to use:** For all four integrations
**Example:**
```typescript
// Doc links use:
//   externalType: "NOTION_PAGE" or "CONFLUENCE_PAGE"
//   entityType: "WORKFLOW_TASK_RUN"
//   metadataJson: { title, icon, lastEditedTime, workspaceName }

// Calendar events use:
//   externalType: "GOOGLE_CALENDAR_EVENT" or "OUTLOOK_CALENDAR_EVENT"
//   entityType: "CONTRACT" | "APPROVAL_FLOW" | "INVOICE" | "WORKFLOW_TASK_RUN"
//   externalId: calendar eventId (for update/delete)
//   metadataJson: { eventId, calendarId, title, startTime, endTime, link }
```

### Pattern 3: Per-User Calendar Connection (New Pattern)
**What:** Calendar is personal -- each user connects their own calendar, unlike org-level Jira/Notion
**When to use:** Calendar connections specifically (D-12, D-14)
**Key difference from existing pattern:**
- IntegrationConnection gets `userId` field (nullable -- null means org-level)
- Personal settings page "My Calendar" instead of admin integration settings
- Dual push: when creating events, find both user's personal + org shared connection

### Pattern 4: Deadline Watcher Service
**What:** Background service that detects contract/approval/payment date changes and syncs to calendar
**When to use:** CAL-01 implementation
**Trigger points:**
- Contract created/updated with expiryDate
- ApprovalFlow created/updated with SLA deadline
- Invoice/Payment created/updated with dueDate
- Called from existing tRPC mutations (fire-and-forget async, same pattern as Jira outbound sync)

### Anti-Patterns to Avoid
- **Using googleapis or @microsoft/microsoft-graph-client SDKs:** 200MB+ bloat, inconsistent with project's raw fetch pattern
- **Polling for doc metadata freshness:** Use lazy refresh on view (check if stale > 24h, refetch) rather than periodic cron
- **Creating separate reminder events:** Use the calendar's native reminder system (D-10)
- **Blocking mutations on calendar sync:** Use fire-and-forget async (precedent: Jira outbound sync D-19)
- **Hardcoding event title format:** Use configurable title templates in configJson

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth 2.0 flow | Custom OAuth implementation | Existing Phase 12 generic OAuth callback + token refresh cron | Already handles state signing, PKCE, encrypted storage |
| Calendar event reminders | Custom reminder system | Calendar's native reminder system | D-10 explicitly requires this; reminders are a calendar-native feature |
| Webhook signature verification | Custom per-provider verification | Existing webhook pipeline with BaseAdapter.verifyWebhookSignature | Unified pattern with HMAC/timing-safe comparison |
| Provider connection UI | Custom connection cards | Existing ProviderConnectionCard component | Generic connect/disconnect, health status, last sync |
| Search debouncing | Custom debounce logic | Existing command palette debounce pattern (200ms) | Already handles loading states, empty states |

## Common Pitfalls

### Pitfall 1: Notion OAuth Uses HTTP Basic Auth for Token Exchange
**What goes wrong:** Token exchange fails with 401
**Why it happens:** Notion requires HTTP Basic Authentication (base64-encoded client_id:client_secret) for token exchange, unlike most OAuth providers that accept body params
**How to avoid:** Use `Authorization: Basic ${btoa(clientId + ':' + clientSecret)}` header in exchangeCodeForTokens
**Warning signs:** 401 response from `https://api.notion.com/v1/oauth/token`

### Pitfall 2: Notion Has No OAuth Scopes -- Uses Integration Capabilities
**What goes wrong:** Passing scopes parameter breaks the OAuth flow
**Why it happens:** Notion integrations get capabilities set in the integration dashboard, not via OAuth scopes
**How to avoid:** Set `scopes: []` in OAuthConfig. Ensure integration has "Read content" capability in Notion dashboard.
**Warning signs:** OAuth error about invalid scope parameter

### Pitfall 3: Confluence Shares Atlassian OAuth with Jira
**What goes wrong:** User prompted to re-authorize when they already have a Jira connection
**Why it happens:** Both Jira and Confluence use `auth.atlassian.com` OAuth, potentially the same Atlassian app
**How to avoid:** Use a separate Atlassian OAuth app for Confluence, OR detect existing Atlassian tokens and request additional scopes. Recommend separate app for clean separation.
**Warning signs:** Scope conflicts, token sharing issues between Jira and Confluence connections

### Pitfall 4: Google Calendar Event Updates Require etag for Concurrency
**What goes wrong:** PATCH/PUT fails with 412 Precondition Failed
**Why it happens:** Google Calendar API uses etags for optimistic concurrency control
**How to avoid:** Store the event's etag in ExternalLink.metadataJson alongside eventId. Pass `If-Match` header on updates.
**Warning signs:** 412 errors on event updates

### Pitfall 5: Microsoft Graph Requires Specific DateTime Format
**What goes wrong:** Event creation fails with 400 Bad Request
**Why it happens:** Microsoft Graph requires dateTime in `YYYY-MM-DDTHH:mm:ss` format without timezone offset, plus a separate `timeZone` field
**How to avoid:** Format dates as `{ dateTime: "2026-03-29T09:00:00", timeZone: "UTC" }`
**Warning signs:** 400 errors mentioning datetime format

### Pitfall 6: Per-User Calendar Connection Model Change
**What goes wrong:** IntegrationConnection is org-scoped only -- no way to store per-user calendar connections
**Why it happens:** Current model has `organizationId` + `connectedByUserId` but no concept of "this connection belongs to user X"
**How to avoid:** Add optional `userId` field to IntegrationConnection. When null, connection is org-level. When set, it's personal.
**Warning signs:** All users in an org sharing the same calendar, or no way to distinguish personal vs org connections

### Pitfall 7: Notion API Requires Notion-Version Header
**What goes wrong:** API calls return 400 or unexpected response format
**Why it happens:** Notion API requires `Notion-Version` header on every request (currently `2022-06-28` is stable, newer versions available)
**How to avoid:** Always include `Notion-Version: 2022-06-28` header in all Notion API requests
**Warning signs:** Missing header errors, response format mismatches

## Code Examples

### Notion Search API Call
```typescript
// Source: https://developers.notion.com/reference/post-search
async function searchNotionPages(
  accessToken: string,
  query: string,
): Promise<Array<{ id: string; title: string; icon: string | null; lastEditedTime: string }>> {
  const response = await fetch("https://api.notion.com/v1/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
    body: JSON.stringify({
      query,
      filter: { property: "object", value: "page" },
      sort: { direction: "descending", timestamp: "last_edited_time" },
      page_size: 10,
    }),
  });

  if (!response.ok) throw new Error(`Notion search failed: ${await response.text()}`);
  const data = await response.json();
  return data.results.map((page: any) => ({
    id: page.id,
    title: page.properties?.title?.title?.[0]?.plain_text ?? "Untitled",
    icon: page.icon?.emoji ?? page.icon?.external?.url ?? null,
    lastEditedTime: page.last_edited_time,
  }));
}
```

### Confluence CQL Search
```typescript
// Source: https://developer.atlassian.com/cloud/confluence/rest/v1/api-group-search/
async function searchConfluencePages(
  accessToken: string,
  cloudId: string,
  query: string,
): Promise<Array<{ id: string; title: string; spaceKey: string; spaceName: string; url: string }>> {
  const cql = `type=page AND title~"${query}"`;
  const url = `https://api.atlassian.com/ex/confluence/${cloudId}/wiki/rest/api/search?cql=${encodeURIComponent(cql)}&limit=10`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) throw new Error(`Confluence search failed: ${await response.text()}`);
  const data = await response.json();
  return data.results.map((r: any) => ({
    id: r.content.id,
    title: r.content.title,
    spaceKey: r.content.space?.key ?? "",
    spaceName: r.content.space?.name ?? "",
    url: r.content._links?.webui ? `https://${cloudId}.atlassian.net/wiki${r.content._links.webui}` : "",
  }));
}
```

### Google Calendar Event Creation
```typescript
// Source: https://developers.google.com/workspace/calendar/api/v3/reference/events/insert
async function createGoogleCalendarEvent(
  accessToken: string,
  event: {
    summary: string;
    description: string;
    startDateTime: string; // ISO 8601
    endDateTime: string;
    attendees?: string[];
  },
): Promise<{ eventId: string; htmlLink: string }> {
  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: event.summary,
        description: event.description,
        start: { dateTime: event.startDateTime, timeZone: "UTC" },
        end: { dateTime: event.endDateTime, timeZone: "UTC" },
        attendees: event.attendees?.map((email) => ({ email })),
        reminders: { useDefault: true },
      }),
    },
  );

  if (!response.ok) throw new Error(`Google Calendar event creation failed: ${await response.text()}`);
  const data = await response.json();
  return { eventId: data.id, htmlLink: data.htmlLink };
}
```

### Microsoft Graph Calendar Event Creation
```typescript
// Source: https://learn.microsoft.com/en-us/graph/api/calendar-post-events
async function createOutlookCalendarEvent(
  accessToken: string,
  event: {
    subject: string;
    bodyHtml: string;
    startDateTime: string;
    endDateTime: string;
    attendees?: string[];
  },
): Promise<{ eventId: string; webLink: string }> {
  const response = await fetch(
    "https://graph.microsoft.com/v1.0/me/calendar/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subject: event.subject,
        body: { contentType: "HTML", content: event.bodyHtml },
        start: { dateTime: event.startDateTime, timeZone: "UTC" },
        end: { dateTime: event.endDateTime, timeZone: "UTC" },
        attendees: event.attendees?.map((email) => ({
          emailAddress: { address: email },
          type: "required",
        })),
      }),
    },
  );

  if (!response.ok) throw new Error(`Outlook event creation failed: ${await response.text()}`);
  const data = await response.json();
  return { eventId: data.id, webLink: data.webLink };
}
```

## OAuth Configuration Summary

### Notion
| Property | Value |
|----------|-------|
| Auth URL | `https://api.notion.com/v1/oauth/authorize` |
| Token URL | `https://api.notion.com/v1/oauth/token` |
| Token Auth | HTTP Basic (base64 client_id:client_secret) |
| Scopes | None (capabilities set in dashboard) |
| Extra Params | `owner=user`, `response_type=code` |
| Refresh | Yes -- `grant_type=refresh_token` at same endpoint |
| Env Vars | `NOTION_CLIENT_ID`, `NOTION_CLIENT_SECRET`, `NOTION_ENCRYPTION_KEY` |

### Confluence
| Property | Value |
|----------|-------|
| Auth URL | `https://auth.atlassian.com/authorize` (same as Jira) |
| Token URL | `https://auth.atlassian.com/oauth/token` |
| Token Auth | JSON body (same as Jira) |
| Scopes | `search:confluence`, `read:confluence-content.summary`, `offline_access` |
| Extra Params | `audience=api.atlassian.com`, `prompt=consent` |
| Refresh | Yes -- standard OAuth refresh |
| Env Vars | `CONFLUENCE_CLIENT_ID`, `CONFLUENCE_CLIENT_SECRET`, `CONFLUENCE_ENCRYPTION_KEY` |
| Note | Separate Atlassian OAuth app from Jira to avoid scope conflicts |

### Google Calendar
| Property | Value |
|----------|-------|
| Auth URL | `https://accounts.google.com/o/oauth2/v2/auth` |
| Token URL | `https://oauth2.googleapis.com/token` |
| Token Auth | JSON body |
| Scopes | `https://www.googleapis.com/auth/calendar.events` (read+write events) |
| Extra Params | `access_type=offline`, `prompt=consent` |
| Refresh | Yes -- `grant_type=refresh_token` |
| Env Vars | `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_ENCRYPTION_KEY` |

### Outlook Calendar (Microsoft Graph)
| Property | Value |
|----------|-------|
| Auth URL | `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` |
| Token URL | `https://login.microsoftonline.com/common/oauth2/v2.0/token` |
| Token Auth | JSON body |
| Scopes | `Calendars.ReadWrite`, `offline_access` |
| Extra Params | None special |
| Refresh | Yes -- standard OAuth refresh |
| Env Vars | `OUTLOOK_CLIENT_ID`, `OUTLOOK_CLIENT_SECRET`, `OUTLOOK_ENCRYPTION_KEY` |

## Prisma Schema Changes Required

### New IntegrationProvider Enum Values
```prisma
enum IntegrationProvider {
  // ... existing values ...
  NOTION
  CONFLUENCE
  GOOGLE_CALENDAR
  OUTLOOK_CALENDAR
}
```

### IntegrationConnection - Add userId for Per-User Connections
```prisma
model IntegrationConnection {
  // ... existing fields ...
  userId  String?   // null = org-level, set = per-user personal connection
  user    User?     @relation("personalConnections", fields: [userId], references: [id])

  @@index([organizationId, userId, provider])
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Notion API v1 (no refresh tokens) | Notion OAuth with refresh tokens | 2023 | Must implement refresh flow |
| Confluence Server REST API | Confluence Cloud REST API v1 via Atlassian Cloud | Ongoing | Use cloud-specific auth.atlassian.com OAuth |
| Google Calendar API v2 | Google Calendar API v3 | Long-standing | v3 is the only supported version |
| Azure AD v1.0 OAuth | Microsoft identity platform v2.0 + Microsoft Graph v1.0 | 2020+ | Use /common/oauth2/v2.0 endpoints |

## Open Questions

1. **Notion Webhook Support**
   - What we know: Notion has no native webhook system for page changes
   - What's unclear: Whether lazy refresh (check staleness on view) is sufficient or if we need a polling cron
   - Recommendation: Start with lazy refresh (D-04 allows this). If metadata staleness becomes a UX issue, add a lightweight polling cron later.

2. **Confluence Webhook for Doc Metadata**
   - What we know: Confluence Cloud supports webhooks for page updates
   - What's unclear: Whether the webhook payload includes enough metadata or if we need a follow-up API call
   - Recommendation: Start with lazy refresh (same as Notion). Confluence webhooks can be added later since the Atlassian webhook infrastructure is already in place from Jira.

3. **Per-User Connection Discovery for Calendar Push**
   - What we know: Calendar events need to push to the user who created/owns the entity
   - What's unclear: How to determine which user's calendar to push to for auto-generated deadline events (contract expiry, etc.)
   - Recommendation: Push to the user who last modified the entity (contract owner, approval assignee, invoice creator). Also push to org shared calendar if connected.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.0 |
| Config file | packages/api/vitest.config.ts |
| Quick run command | `cd packages/api && npx vitest run --reporter=verbose` |
| Full suite command | `npx turbo test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOCS-01 | Attach/detach Notion/Confluence page links to workflow steps | unit | `cd packages/api && npx vitest run src/services/__tests__/doc-link.test.ts -x` | Wave 0 |
| DOCS-02 | Search Notion/Confluence pages from Cmd+K proxy | unit | `cd packages/api && npx vitest run src/routers/__tests__/docs.test.ts -x` | Wave 0 |
| CAL-01 | Push deadline events to Google/Outlook calendar | unit | `cd packages/api && npx vitest run src/services/__tests__/calendar-deadline-sync.test.ts -x` | Wave 0 |
| CAL-02 | Workflow task template creates calendar events | unit | `cd packages/api && npx vitest run src/services/__tests__/calendar-event.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/api && npx vitest run --reporter=verbose`
- **Per wave merge:** `npx turbo test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/api/src/services/__tests__/doc-link.test.ts` -- covers DOCS-01
- [ ] `packages/api/src/routers/__tests__/docs.test.ts` -- covers DOCS-02
- [ ] `packages/api/src/services/__tests__/calendar-deadline-sync.test.ts` -- covers CAL-01
- [ ] `packages/api/src/services/__tests__/calendar-event.test.ts` -- covers CAL-02
- [ ] `packages/integrations/src/adapters/__tests__/notion-adapter.test.ts` -- adapter unit tests
- [ ] `packages/integrations/src/adapters/__tests__/google-calendar-adapter.test.ts` -- adapter unit tests

## Sources

### Primary (HIGH confidence)
- Notion API official docs: https://developers.notion.com/reference/post-search - search endpoint details
- Notion OAuth docs: https://developers.notion.com/docs/authorization - OAuth flow, token exchange with Basic auth
- Atlassian Confluence scopes: https://developer.atlassian.com/cloud/confluence/scopes-for-oauth-2-3LO-and-forge-apps/ - search:confluence scope
- Confluence search API: https://developer.atlassian.com/cloud/confluence/rest/v1/api-group-search/ - CQL endpoint
- Google Calendar API scopes: https://developers.google.com/workspace/calendar/api/auth - calendar.events scope
- Google Calendar events.insert: https://developers.google.com/workspace/calendar/api/v3/reference/events/insert
- MS Graph create event: https://learn.microsoft.com/en-us/graph/api/calendar-post-events - Calendars.ReadWrite scope

### Secondary (MEDIUM confidence)
- Existing codebase: JiraAdapter, jira-issue-sync.ts, command-palette.tsx patterns verified via file reads
- ExternalLink schema: packages/db/prisma/schema/integration.prisma verified

### Tertiary (LOW confidence)
- Notion webhook support status (may have changed since training data)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies needed; all patterns exist in codebase
- Architecture: HIGH - Direct extension of Jira integration pattern with minor per-user connection addition
- Pitfalls: MEDIUM - OAuth quirks verified via official docs; calendar update concurrency needs validation in practice
- API details: HIGH - All four API endpoints verified against official documentation

**Research date:** 2026-03-29
**Valid until:** 2026-04-28 (30 days - APIs are stable, OAuth flows rarely change)
