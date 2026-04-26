# Phase 31: Google Workspace Directory Import - Research

**Researched:** 2026-04-02
**Domain:** Google Admin SDK Directory API integration, OAuth 2.0, bulk user import, periodic sync
**Confidence:** HIGH

## Summary

This phase adds a Google Workspace directory import feature following the established integration adapter pattern. The codebase already has a `GoogleCalendarAdapter` using identical Google OAuth endpoints (`accounts.google.com`, `oauth2.googleapis.com`), so the `GoogleWorkspaceAdapter` mirrors that pattern with different scopes (`admin.directory.user.readonly`, `admin.directory.group.readonly`). The `GOOGLE_WORKSPACE` enum value already exists in `IntegrationProvider`, requiring no schema migration for the provider itself.

The Google Admin SDK Directory API uses standard REST with `pageToken`-based pagination (max 500 results per page via `maxResults`). The `users.list` endpoint returns `primaryEmail`, `name`, `orgUnitPath`, `organizations` (for department), `thumbnailPhotoUrl`, and `suspended` status. The `groups.list` endpoint (with `userKey` parameter) returns groups for a specific user. Both endpoints use `customer=my_customer` to scope to the authenticated admin's domain.

The bulk import leverages the existing `auth.api.createInvitation` flow from Better Auth (already used by `user.invite` tRPC mutation). The periodic sync uses the established QStash pattern (same as KSeF `_sync` route) with `verifySignatureAppRouter` wrapper, triggered by a QStash cron schedule. New hire and departure notifications use the existing `dispatch()` from `notification-service.ts`.

**Primary recommendation:** Extend `BaseAdapter` with `GoogleWorkspaceAdapter`, add directory-specific service methods (listUsers, listGroups, syncDirectory), create a QStash-backed sync endpoint, and build the multi-step import wizard UI following the Linear/Jira provider section pattern.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Separate OAuth app from Google Calendar -- dedicated `GOOGLE_WORKSPACE_CLIENT_ID` / `GOOGLE_WORKSPACE_CLIENT_SECRET` with Admin SDK scopes. Calendar and Workspace credentials stay isolated
- **D-02:** Standard OAuth flow with admin consent prompt -- scoped to `admin.directory.user.readonly` + `admin.directory.group.readonly`. No service account or domain-wide delegation
- **D-03:** Separate "Google Workspace" section in integrations settings tab with its own ProviderConnectionCard, distinct from Google Calendar
- **D-04:** After successful OAuth, redirect straight to the directory import wizard with preview already loaded
- **D-05:** Data table with checkboxes using TanStack Table -- columns: checkbox, avatar, name, email, department, org unit
- **D-06:** Client-side pagination -- fetch all users from Google API (paginated server-side), display in table with client-side pagination and search
- **D-07:** Users who already exist shown with "Already exists" badge, greyed out, unchecked by default
- **D-08:** Summary bar above the table showing total found, already imported, and new users count
- **D-09:** Default role + per-user override -- admin picks a default role, can override individual users
- **D-10:** Optional group-to-role mapping step after selecting users
- **D-11:** Imported users receive invite emails immediately via standard Better Auth invite flow
- **D-12:** QStash cron job for periodic sync -- daily at 2 AM org timezone
- **D-13:** New hires detected by sync flagged as dashboard notification -- admin reviews and imports manually
- **D-14:** Departures flagged as notification with "departed" badge. No auto-deactivation
- **D-15:** Admin can trigger manual sync anytime from the Google Workspace settings section

### Claude's Discretion
- Google Workspace adapter implementation details (extends BaseAdapter like Calendar)
- Admin SDK API pagination strategy for directory listing
- Exact summary bar design and badge styling
- Import progress indicator during bulk user creation
- QStash cron job configuration and sync service internals
- Error handling for partial imports (some users fail, others succeed)
- Notification content for new hire / departure flags

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GOOG-01 | Admin can connect Google Workspace with Admin SDK Directory API scopes via OAuth | GoogleWorkspaceAdapter extending BaseAdapter with Admin SDK scopes; OAuth callback route handles `google-workspace` slug automatically |
| GOOG-02 | User can preview Google Workspace users with name, email, department, and org unit before importing | `users.list` API returns `primaryEmail`, `name`, `orgUnitPath`, `organizations[].department`; TanStack Table with client-side pagination |
| GOOG-03 | Admin can selectively import Google Workspace users as org members with role assignment | Bulk import via `auth.api.createInvitation` loop; role assignment from default + per-user override |
| GOOG-04 | Admin can map Google Workspace groups to internal RBAC roles during import | `groups.list` with `userKey` parameter to get groups per user; role mapping step in wizard |
| GOOG-05 | System periodically syncs directory to detect new hires and flag departures (no auto-delete) | QStash cron job pattern (same as KSeF); `dispatch()` notification for new hires/departures |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **UI:** Use `frontend-design` plugin for all UI work; aim for production-ready, polished interfaces
- **Architecture:** Monorepo with Turborepo; clean architecture; SOLID/DRY
- **Libraries:** Use `ctx7` for library docs; up-to-date stable versions
- **Validation:** Schema validation for all external inputs (Google API responses, form inputs)
- **Security:** Least-privilege scopes; AES-256-GCM credential encryption; rate limiting
- **Env:** Keep `.env.example` up to date with new Google Workspace env vars
- **i18n:** Both `en` and `pl` translations required (from UI-SPEC)

## Standard Stack

### Core (Already in Project)
| Library | Purpose | Why Standard |
|---------|---------|--------------|
| `@upstash/qstash` | QStash cron + signature verification for sync endpoint | Already used for KSeF sync, webhook dispatch |
| `@tanstack/react-table` | Directory preview table with selection | Already used throughout app for data tables |
| `better-auth` | `createInvitation` API for bulk user invites | Existing invite flow in `user.invite` mutation |
| `next-intl` | i18n for wizard copy (en + pl) | Project standard for all UI text |
| `sonner` | Toast notifications for import progress | Project standard for toast notifications |
| `zod` | Schema validation for API responses and form inputs | Project standard for all validation |

### Supporting
| Library | Purpose | When to Use |
|---------|---------|-------------|
| `@sentry/nextjs` | Error monitoring for sync failures | Wrap sync handler with `Sentry.withMonitor` |
| `@contractor-ops/logger` | Structured logging for sync cron | `createCronLogger("google-workspace-sync")` |

### No New Dependencies Required
The Google Admin SDK Directory API is a standard REST API. No SDK package needed -- use `fetch()` directly, same as `GoogleCalendarAdapter`. This avoids adding the heavy `googleapis` npm package (100MB+) for two simple REST calls.

## Architecture Patterns

### Recommended Project Structure
```
packages/integrations/src/
  adapters/
    google-workspace-adapter.ts       # BaseAdapter extension (OAuth + directory API methods)
    register-all.ts                   # Add GoogleWorkspaceAdapter registration
  services/
    google-workspace-sync.ts          # Sync logic: compare directory vs org members

packages/api/src/
  routers/
    google-workspace.ts               # tRPC router: listDirectory, listGroups, bulkImport, triggerSync, syncStatus
  services/
    google-workspace-sync-orchestrator.ts  # Orchestrates full sync cycle

packages/validators/src/
  google-workspace.ts                 # Zod schemas for directory API responses, import input

apps/web/src/
  app/api/
    google-workspace/_sync/route.ts   # QStash callback endpoint for periodic sync
  components/integrations/
    google-workspace-provider-section.tsx  # Provider card + sync status + import CTA
    google-workspace-logo.tsx              # Brand SVG icon
    google-workspace/
      directory-import-wizard.tsx          # Multi-step dialog
      directory-preview-table.tsx          # TanStack Table with selection
      directory-summary-bar.tsx            # Count stats bar
      role-assignment-controls.tsx         # Default role + per-user override
      group-role-mapping-step.tsx          # Google groups -> role mapping
      import-confirm-step.tsx              # Final review step
      sync-status-section.tsx              # Last sync, next sync, manual trigger
```

### Pattern 1: Adapter Extension (follow GoogleCalendarAdapter exactly)
**What:** `GoogleWorkspaceAdapter` extends `BaseAdapter` with identical OAuth flow but different scopes and env vars
**When to use:** For all OAuth and token management
**Example:**
```typescript
// Source: packages/integrations/src/adapters/google-calendar-adapter.ts (adapted)
const GOOGLE_WORKSPACE_OAUTH_CONFIG: OAuthConfig = {
  clientIdEnvVar: "GOOGLE_WORKSPACE_CLIENT_ID",
  clientSecretEnvVar: "GOOGLE_WORKSPACE_CLIENT_SECRET",
  authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  scopes: [
    "https://www.googleapis.com/auth/admin.directory.user.readonly",
    "https://www.googleapis.com/auth/admin.directory.group.readonly",
  ],
  redirectPath: "/api/oauth/google-workspace/callback",
  extraAuthParams: {
    access_type: "offline",
    prompt: "consent",
  },
};

export class GoogleWorkspaceAdapter extends BaseAdapter {
  readonly slug = "google-workspace";
  readonly displayName = "Google Workspace";
  readonly supportsOAuth = true;
  readonly supportsWebhooks = false;
  // ... exchangeCodeForTokens, refreshToken identical to GoogleCalendarAdapter
  // ... plus directory-specific methods: listUsers, listUserGroups
}
```

### Pattern 2: QStash Cron Endpoint (follow KSeF _sync route)
**What:** QStash-verified POST endpoint for periodic directory sync
**When to use:** For daily sync and manual trigger
**Example:**
```typescript
// Source: apps/web/src/app/api/ksef/_sync/route.ts (adapted)
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";

async function handler(request: NextRequest) {
  const { organizationId, connectionId } = await request.json();
  const result = await processDirectorySync({ organizationId, connectionId });
  return NextResponse.json({ processed: true, ...result });
}

export const POST = verifySignatureAppRouter(handler);
```

### Pattern 3: Bulk Import via Better Auth Invite
**What:** Loop over selected users, call `auth.api.createInvitation` for each
**When to use:** When admin confirms import in wizard step 3
**Key consideration:** Handle partial failures -- collect successes and failures, return both counts

### Pattern 4: Provider Section UI (follow LinearProviderSection)
**What:** Standalone provider section component with connection card + controls
**When to use:** For the Google Workspace section in integrations tab
**Key:** After OAuth redirect, check for `google-workspace=connected` URL param to auto-open import wizard (D-04)

### Anti-Patterns to Avoid
- **Do NOT use `googleapis` npm package:** It adds 100MB+ for what amounts to two REST calls. Use `fetch()` directly like the Calendar adapter does
- **Do NOT auto-create or auto-delete users during sync:** D-13/D-14 explicitly require manual review. Sync only detects changes and creates notifications
- **Do NOT share OAuth credentials with Google Calendar:** D-01 mandates isolated credentials per integration
- **Do NOT block the import on individual invite failures:** Collect errors, report partial success

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth token exchange + refresh | Custom token management | `BaseAdapter` pattern + `GoogleWorkspaceAdapter.exchangeCodeForTokens/refreshToken` | Already handles token lifecycle, expiry, rotation |
| Credential encryption | Custom crypto | `encryptCredentials()` / `decryptCredentials()` from credential-service | AES-256-GCM with per-provider keys already built |
| OAuth state CSRF protection | Custom state parameter | `verifyOAuthState()` from integrations package | HMAC-signed state with provider in payload |
| QStash signature verification | Custom webhook auth | `verifySignatureAppRouter` from `@upstash/qstash/nextjs` | Handles key rotation automatically |
| User invitations | Custom email + account creation | `auth.api.createInvitation` from Better Auth | Handles email sending, account setup, org membership |
| In-app notifications | Custom notification system | `dispatch()` from `notification-service.ts` | Multi-channel (email, Slack, in-app) already wired |

**Key insight:** This phase is primarily about connecting well-established project patterns to Google's REST API. Nearly every infrastructure component already exists.

## Common Pitfalls

### Pitfall 1: Google Admin SDK Requires Admin Account
**What goes wrong:** OAuth succeeds but API calls return 403 Forbidden
**Why it happens:** The Admin SDK Directory API requires the OAuth consent to be granted by a Google Workspace admin (not just any Google account). Regular Gmail accounts cannot access directory APIs.
**How to avoid:** Show clear error message when API returns 403; include guidance in the connection card description ("Requires Google Workspace admin account")
**Warning signs:** 403 responses after successful OAuth token exchange

### Pitfall 2: Pagination Token Expires After 3 Days
**What goes wrong:** Stored pageTokens become invalid after 3 days
**Why it happens:** Google Directory API pageTokens have a 3-day TTL
**How to avoid:** Always paginate through all results in a single server-side pass (D-06 already requires this). Never store pageTokens for later use.
**Warning signs:** 400 errors on subsequent page fetches in long-running imports

### Pitfall 3: Group Membership Requires Per-User Lookups
**What goes wrong:** Trying to get all groups and their members is O(groups * members) API calls
**Why it happens:** The `groups.list` API with `userKey` returns groups for ONE user. There is no "list all members of all groups" bulk endpoint.
**How to avoid:** For D-10 group-to-role mapping, only fetch groups for the selected users (not all users). Use `groups.list?userKey=email` per selected user. Cache results during the wizard session.
**Warning signs:** Slow group resolution step when many users are selected

### Pitfall 4: OAuth Callback Must Handle Google Workspace Slug Mapping
**What goes wrong:** OAuth callback route uses `adapter.slug.toUpperCase()` to match the Prisma enum, but "google-workspace" uppercases to "GOOGLE-WORKSPACE" (with hyphen)
**Why it happens:** The existing callback route (line 77-109 of `/api/oauth/[provider]/callback/route.ts`) does `adapter.slug.toUpperCase() as never` for the provider enum
**How to avoid:** The slug must map correctly to `GOOGLE_WORKSPACE` enum. Use `slug.toUpperCase().replace(/-/g, '_')` or ensure the existing code already handles this (it does -- `GOOGLE_CALENDAR` maps from `google-calendar` via the same pattern). **Verify:** Check if the existing code handles hyphen-to-underscore mapping; if not, this is a bug that would also affect google-calendar. Likely already handled.
**Warning signs:** Prisma error on connection creation with invalid enum value

### Pitfall 5: Better Auth Invite Rate Limits
**What goes wrong:** Bulk import of 50+ users triggers rate limits or timeouts
**Why it happens:** `auth.api.createInvitation` sends an email per invite. Calling it 50 times in a tight loop may hit Resend rate limits (100/day on free tier, higher on paid).
**How to avoid:** Process invitations sequentially with a small delay, or batch in groups of 10. Track progress and report partial success. Consider using QStash to offload bulk invite processing.
**Warning signs:** 429 responses from Resend, invitation emails not arriving

### Pitfall 6: Department Field is Nested in Organizations Array
**What goes wrong:** `user.department` returns undefined
**Why it happens:** Google Admin SDK stores department inside `user.organizations[0].department`, not as a top-level field. The `organizations` field is an array of objects with `department`, `title`, `primary`, etc.
**How to avoid:** Access `user.organizations?.find(o => o.primary)?.department ?? user.organizations?.[0]?.department ?? null`
**Warning signs:** Department column always showing empty in preview table

### Pitfall 7: Suspended Users Should Be Excluded from Import Preview
**What goes wrong:** Admin imports a suspended Google user who cannot access anything
**Why it happens:** `users.list` returns suspended users by default
**How to avoid:** Filter the API response: exclude users where `suspended === true` from the import preview. Or show them with a "Suspended" badge and disable their checkbox.
**Warning signs:** Invited users who can never accept their invitation

## Code Examples

### Google Directory API: List All Users (Server-Side Pagination)
```typescript
// Source: https://developers.google.com/workspace/admin/directory/reference/rest/v1/users/list
interface GoogleDirectoryUser {
  id: string;
  primaryEmail: string;
  name: { givenName: string; familyName: string; fullName: string };
  thumbnailPhotoUrl?: string;
  orgUnitPath?: string;
  organizations?: Array<{
    department?: string;
    title?: string;
    primary?: boolean;
  }>;
  suspended?: boolean;
  isAdmin?: boolean;
}

interface GoogleUsersListResponse {
  users?: GoogleDirectoryUser[];
  nextPageToken?: string;
}

async function listAllDirectoryUsers(accessToken: string): Promise<GoogleDirectoryUser[]> {
  const allUsers: GoogleDirectoryUser[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      customer: "my_customer",
      maxResults: "500",
      projection: "FULL",
      orderBy: "EMAIL",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const response = await fetch(
      `https://admin.googleapis.com/admin/directory/v1/users?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Google Directory API list users failed (${response.status}): ${text}`);
    }

    const data: GoogleUsersListResponse = await response.json();
    if (data.users) {
      allUsers.push(...data.users.filter(u => !u.suspended));
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allUsers;
}
```

### Google Directory API: List Groups for a User
```typescript
// Source: https://developers.google.com/workspace/admin/directory/reference/rest/v1/groups/list
interface GoogleGroup {
  id: string;
  email: string;
  name: string;
  description?: string;
  directMembersCount?: string;
}

interface GoogleGroupsListResponse {
  groups?: GoogleGroup[];
  nextPageToken?: string;
}

async function listUserGroups(accessToken: string, userEmail: string): Promise<GoogleGroup[]> {
  const allGroups: GoogleGroup[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      userKey: userEmail,
      maxResults: "200",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const response = await fetch(
      `https://admin.googleapis.com/admin/directory/v1/groups?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!response.ok) break; // User may not be in any groups (404)

    const data: GoogleGroupsListResponse = await response.json();
    if (data.groups) allGroups.push(...data.groups);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allGroups;
}
```

### Bulk Import with Partial Failure Handling
```typescript
// Source: packages/api/src/routers/user.ts (invite mutation pattern)
interface ImportResult {
  succeeded: Array<{ email: string; role: string }>;
  failed: Array<{ email: string; error: string }>;
}

async function bulkImportUsers(
  users: Array<{ email: string; role: string }>,
  organizationId: string,
  headers: Headers,
): Promise<ImportResult> {
  const result: ImportResult = { succeeded: [], failed: [] };

  for (const user of users) {
    try {
      await auth.api.createInvitation({
        headers,
        body: {
          email: user.email,
          role: user.role,
          organizationId,
        },
      });
      result.succeeded.push(user);
    } catch (error) {
      result.failed.push({
        email: user.email,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return result;
}
```

### Notification Dispatch for New Hire Detection
```typescript
// Source: packages/api/src/services/notification-service.ts (dispatch pattern)
import { dispatch } from "./notification-service.js";

await dispatch({
  organizationId,
  type: "DIRECTORY_NEW_HIRE",  // New notification type to add
  recipientUserIds: adminUserIds,
  title: `New team member detected: ${user.name.fullName}`,
  body: `${user.name.fullName} (${user.primaryEmail}) was added to Google Workspace.`,
  entityType: "ORGANIZATION",
  entityId: organizationId,
  metadata: { googleUserId: user.id, email: user.primaryEmail },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `googleapis` npm package (100MB+) | Direct REST API calls via `fetch()` | Project convention | Zero additional bundle size; cleaner types |
| Service account + domain-wide delegation | Standard OAuth with admin consent | D-02 decision | Simpler setup; no Google Cloud Console service account config |
| SCIM provisioning | Manual import + periodic sync | Phase scope decision | Covers 95% of use case at 10-200 employee scale |

## Open Questions

1. **Notification Type Enum Extension**
   - What we know: `NOTIFICATION_TYPES` in validators needs new entries (`DIRECTORY_NEW_HIRE`, `DIRECTORY_DEPARTURE`)
   - What's unclear: Whether the notification type is a string field or strict enum in Prisma (it is a `String` type in Prisma, not an enum, so just adding to validators array is sufficient)
   - Recommendation: Add to `NOTIFICATION_TYPES` array in `packages/validators/src/notification.ts`

2. **OAuth Callback Provider-to-Enum Slug Mapping**
   - What we know: Callback uses `adapter.slug.toUpperCase()` to set provider enum
   - What's unclear: Whether hyphen-to-underscore conversion is already handled (since `google-calendar` maps to `GOOGLE_CALENDAR`)
   - Recommendation: Verify existing behavior with `google-calendar` adapter; likely already works since that adapter is in production

3. **QStash Cron Schedule vs. Vercel Cron**
   - What we know: Existing crons use both patterns -- Vercel cron for trial-notifications/reminders/token-refresh, QStash for KSeF sync
   - What's unclear: D-12 says "QStash cron" but Vercel cron might be simpler for a daily job
   - Recommendation: Use QStash cron (matches D-12 decision) since it already carries `organizationId`/`connectionId` in the payload. Vercel cron is for system-wide jobs; QStash is for per-org jobs. Each connected org needs its own schedule.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| QStash | Periodic sync (D-12) | Configured | via `QSTASH_TOKEN` env | -- |
| Google OAuth | Connection (D-01) | Requires setup | New env vars needed | -- |
| Resend | Invite emails (D-11) | Configured | via `RESEND_API_KEY` env | -- |
| Sentry | Error monitoring | Configured | via `@sentry/nextjs` | -- |

**New environment variables required (add to .env.example):**
- `GOOGLE_WORKSPACE_CLIENT_ID` -- OAuth client ID for Admin SDK app
- `GOOGLE_WORKSPACE_CLIENT_SECRET` -- OAuth client secret
- `GOOGLE_WORKSPACE_ENCRYPTION_KEY` -- 32-byte hex key for AES-256-GCM credential encryption

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via `turbo test`) |
| Config file | Per-package `vitest.config.ts` (integrations package has `vitest run`) |
| Quick run command | `pnpm --filter @contractor-ops/integrations test` |
| Full suite command | `pnpm test` (runs `turbo test` across all packages) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GOOG-01 | GoogleWorkspaceAdapter OAuth config, token exchange, refresh | unit | `pnpm --filter @contractor-ops/integrations test -- --grep "google-workspace"` | Wave 0 |
| GOOG-02 | listAllDirectoryUsers pagination, response parsing, suspended user filtering | unit | `pnpm --filter @contractor-ops/integrations test -- --grep "directory"` | Wave 0 |
| GOOG-03 | bulkImport mutation with partial failure handling | unit | `pnpm --filter @contractor-ops/api test -- --grep "google-workspace"` | Wave 0 |
| GOOG-04 | listUserGroups API + group-to-role mapping logic | unit | `pnpm --filter @contractor-ops/integrations test -- --grep "groups"` | Wave 0 |
| GOOG-05 | Sync service: detect new hires, detect departures, dispatch notifications | unit | `pnpm --filter @contractor-ops/api test -- --grep "directory-sync"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @contractor-ops/integrations test`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/integrations/src/__tests__/google-workspace-adapter.test.ts` -- covers GOOG-01 (OAuth config, token exchange, refresh)
- [ ] `packages/integrations/src/__tests__/google-workspace-directory.test.ts` -- covers GOOG-02, GOOG-04 (user listing, group listing, response parsing)
- [ ] `packages/api/src/__tests__/google-workspace-sync.test.ts` -- covers GOOG-05 (sync detection logic)
- [ ] `packages/validators/src/__tests__/google-workspace.test.ts` -- covers Zod schema validation for API responses

## Sources

### Primary (HIGH confidence)
- Google Admin SDK Directory API: [users.list reference](https://developers.google.com/workspace/admin/directory/reference/rest/v1/users/list)
- Google Admin SDK Directory API: [groups.list reference](https://developers.google.com/workspace/admin/directory/reference/rest/v1/groups/list)
- Google OAuth scopes: [Choose Directory API scopes](https://developers.google.com/workspace/admin/directory/v1/guides/authorizing)
- Codebase: `packages/integrations/src/adapters/google-calendar-adapter.ts` -- production Google OAuth pattern
- Codebase: `apps/web/src/app/api/ksef/_sync/route.ts` -- production QStash cron endpoint pattern
- Codebase: `apps/web/src/app/api/oauth/[provider]/callback/route.ts` -- generic OAuth callback handler
- Codebase: `packages/api/src/routers/user.ts` -- existing `invite` mutation via Better Auth
- Codebase: `packages/api/src/services/notification-service.ts` -- existing notification dispatch

### Secondary (MEDIUM confidence)
- Google Directory API pagination: pageToken valid for 3 days, maxResults up to 500 (from official docs)
- `organizations` array structure for department extraction (from API reference)

### Tertiary (LOW confidence)
- None -- all findings verified against official docs or production codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use in production codebase
- Architecture: HIGH - follows established adapter/provider section/QStash patterns exactly
- Pitfalls: HIGH - verified against Google API docs and existing codebase patterns

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (Google Admin SDK is stable; project patterns are established)
