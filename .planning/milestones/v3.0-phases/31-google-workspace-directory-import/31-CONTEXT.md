# Phase 31: Google Workspace Directory Import - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Organizations using Google Workspace can import their team directory into the platform with role mapping. Admin connects via OAuth with Admin SDK scopes, previews directory users, selectively imports them as org members with role assignment (including group-to-role mapping), and the system periodically syncs to detect new hires and flag departures. Does NOT include SCIM provisioning, auto-deletion of users, or full identity lifecycle management.

</domain>

<decisions>
## Implementation Decisions

### OAuth & Connection Strategy
- **D-01:** Separate OAuth app from Google Calendar — dedicated `GOOGLE_WORKSPACE_CLIENT_ID` / `GOOGLE_WORKSPACE_CLIENT_SECRET` with Admin SDK scopes. Calendar and Workspace credentials stay isolated; admin can connect one without the other
- **D-02:** Standard OAuth flow with admin consent prompt — scoped to `admin.directory.user.readonly` + `admin.directory.group.readonly`. Google shows admin consent screen. No service account or domain-wide delegation needed
- **D-03:** Separate "Google Workspace" section in integrations settings tab with its own ProviderConnectionCard, distinct from Google Calendar. Follows Jira/Linear section pattern
- **D-04:** After successful OAuth, redirect straight to the directory import wizard with preview already loaded — fastest path to value

### Import Preview & Selection UX
- **D-05:** Data table with checkboxes using TanStack Table — columns: checkbox, avatar, name, email, department, org unit. Select all / search / filter by org unit. Consistent with existing tables in the app
- **D-06:** Client-side pagination — fetch all users from Google API (paginated server-side), display in table with client-side pagination and search. Most target orgs are under 200 users
- **D-07:** Users who already exist in the org (same email) shown with "Already exists" badge, greyed out, unchecked by default. Admin can check them to update role/department if needed
- **D-08:** Summary bar above the table showing total found, already imported, and new users count

### Role Mapping Approach
- **D-09:** Default role + per-user override — admin picks a default role (e.g., VIEWER) applied to all selected users, can override individual users in the table before confirming
- **D-10:** Optional group-to-role mapping step after selecting users — list of Google groups found among selected users, each with a role dropdown. Users in mapped groups get that role instead of the default. Unmapped groups fall back to default role
- **D-11:** Imported users receive invite emails immediately via standard Better Auth invite flow. Matches existing single-user invite behavior

### Periodic Sync Behavior
- **D-12:** QStash cron job for periodic sync — daily at 2 AM org timezone. Consistent with existing fire-and-forget pattern. OAuth refresh token keeps access alive
- **D-13:** New hires detected by sync flagged as dashboard notification — admin reviews and imports manually via import wizard. No auto-creation of user accounts
- **D-14:** Departures (removed/suspended in Google Workspace) flagged as notification with "departed" badge. No auto-deactivation — admin decides whether to deactivate. Matches GOOG-05 "flag departures, no auto-delete"
- **D-15:** Admin can trigger manual sync anytime from the Google Workspace settings section in addition to the daily cron

### Claude's Discretion
- Google Workspace adapter implementation details (extends BaseAdapter like Calendar)
- Admin SDK API pagination strategy for directory listing
- Exact summary bar design and badge styling
- Import progress indicator during bulk user creation
- QStash cron job configuration and sync service internals
- Error handling for partial imports (some users fail, others succeed)
- Notification content for new hire / departure flags

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Integration framework (adapter pattern to follow)
- `packages/integrations/src/adapters/google-calendar-adapter.ts` -- Existing Google OAuth adapter pattern (same auth endpoints, separate scopes)
- `packages/integrations/src/adapters/base-adapter.ts` -- Base class to extend for GoogleWorkspaceAdapter
- `packages/integrations/src/types/provider.ts` -- IntegrationProviderAdapter interface
- `packages/integrations/src/adapters/register-all.ts` -- Where to register the new adapter
- `packages/integrations/services/credential-service.ts` -- AES-256-GCM credential encryption

### User management (invite flow to reuse)
- `packages/api/src/routers/user.ts` -- Existing invite mutation using Better Auth `createInvitation`
- `packages/db/prisma/schema/integration.prisma` -- IntegrationProvider enum (GOOGLE_WORKSPACE already present)

### Settings UI (section pattern to replicate)
- `apps/web/src/components/settings/integrations-tab.tsx` -- Integrations tab where Google Workspace section goes
- `apps/web/src/components/settings/provider-connection-card.tsx` -- Standard connection card component
- `apps/web/src/components/settings/provider-detail-sheet.tsx` -- Detail sheet with sync/webhook logs
- `apps/web/src/components/integrations/linear-provider-section.tsx` -- Provider section pattern to replicate

### Async processing
- QStash cron for periodic sync (existing pattern across Calendar, KSeF sync)

### Requirements
- `.planning/REQUIREMENTS.md` -- GOOG-01 through GOOG-05

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BaseAdapter`: OAuth flow, token refresh, health status -- GoogleWorkspaceAdapter extends this
- `GoogleCalendarAdapter`: Same Google OAuth endpoints (`accounts.google.com`, `oauth2.googleapis.com`), different scopes -- reference for token exchange pattern
- `ProviderConnectionCard`: Standard connection UI with status badges
- `ProviderDetailSheet`: Sync log tables with cursor pagination
- `inviteUserSchema` + `auth.api.createInvitation`: Existing invite flow reusable for bulk import
- `GOOGLE_WORKSPACE` already in IntegrationProvider enum -- no migration needed
- TanStack Table used throughout the app for data tables with selection

### Established Patterns
- Provider adapter pattern: stateless adapters, all state in IntegrationConnection
- OAuth callback at `/api/oauth/[provider]/callback` -- automatic routing by slug
- AES-256-GCM per-provider encryption for credentials
- QStash for fire-and-forget async processing (cron + webhook)
- In-app notification system for alerting admins

### Integration Points
- `registerAllAdapters()` -- add GoogleWorkspaceAdapter registration
- Integrations settings tab -- add Google Workspace provider section
- OAuth callback route -- handles google-workspace slug automatically
- Notification system -- new hire / departure flags
- Dashboard -- sync status notifications

</code_context>

<specifics>
## Specific Ideas

No specific requirements -- follow the established adapter and settings patterns. The goal is that Google Workspace admins get a smooth import-and-sync experience matching the platform's existing integration quality.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 31-google-workspace-directory-import*
*Context gathered: 2026-04-02*
