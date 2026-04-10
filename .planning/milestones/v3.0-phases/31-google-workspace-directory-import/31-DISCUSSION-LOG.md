# Phase 31: Google Workspace Directory Import - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-02
**Phase:** 31-google-workspace-directory-import
**Areas discussed:** OAuth & connection strategy, Import preview & selection UX, Role mapping approach, Periodic sync behavior

---

## OAuth & Connection Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Separate OAuth app | Dedicated GOOGLE_WORKSPACE_CLIENT_ID/SECRET with Admin SDK scopes. Keeps Calendar and Workspace credentials isolated | :heavy_check_mark: |
| Shared Google Cloud project | Same client ID, request additional Admin SDK scopes at connection time | |

**User's choice:** Separate OAuth app
**Notes:** Isolation between Calendar and Workspace credentials preferred

| Option | Description | Selected |
|--------|-------------|----------|
| OAuth with admin consent prompt | Standard OAuth flow scoped to admin.directory.user.readonly + admin.directory.group.readonly | :heavy_check_mark: |
| Service account with domain-wide delegation | Org admin creates service account, grants domain-wide delegation | |
| OAuth initial + service account for sync | OAuth for connection, service account for background sync | |

**User's choice:** OAuth with admin consent prompt
**Notes:** No service account complexity needed

| Option | Description | Selected |
|--------|-------------|----------|
| Separate section | Google Workspace gets its own ProviderConnectionCard in integrations tab | :heavy_check_mark: |
| Grouped under 'Google' | Single Google section with sub-tabs for Calendar and Workspace | |

**User's choice:** Separate section

| Option | Description | Selected |
|--------|-------------|----------|
| Straight to directory preview | After OAuth, redirect to import wizard with preview loaded | :heavy_check_mark: |
| Settings page first | Land on settings section, admin clicks 'Import Users' separately | |

**User's choice:** Straight to directory preview

---

## Import Preview & Selection UX

| Option | Description | Selected |
|--------|-------------|----------|
| Data table with checkboxes | TanStack Table with checkbox, avatar, name, email, department, org unit | :heavy_check_mark: |
| Card grid | User cards in grid layout | |
| Grouped list by org unit | Users grouped under org unit headers | |

**User's choice:** Data table with checkboxes

| Option | Description | Selected |
|--------|-------------|----------|
| Client-side pagination | Fetch all, display with client-side pagination/search | :heavy_check_mark: |
| Server-side pagination | Fetch one page at a time from Google API | |
| Virtual scroll | Load all, render with virtualization | |

**User's choice:** Client-side pagination

| Option | Description | Selected |
|--------|-------------|----------|
| Show with 'Already exists' badge, skip by default | Existing users greyed out with badge, unchecked by default | :heavy_check_mark: |
| Filter out entirely | Only show new users | |
| Show all with status column | Status column: New / Existing / Updated | |

**User's choice:** Show with 'Already exists' badge, skip by default

| Option | Description | Selected |
|--------|-------------|----------|
| Summary bar above table | Total found, already imported, new users count | :heavy_check_mark: |
| Just the table | Count in table footer only | |

**User's choice:** Summary bar above table

---

## Role Mapping Approach

| Option | Description | Selected |
|--------|-------------|----------|
| Default role + per-user override | Admin picks default role, can override individual users | :heavy_check_mark: |
| Per-user role column | Each row has role dropdown, no default | |
| Group-to-role mapping only | Map Google groups to roles, all users inherit | |

**User's choice:** Default role + per-user override

| Option | Description | Selected |
|--------|-------------|----------|
| Optional group-to-role mapping step | After selecting users, map Google groups to RBAC roles | :heavy_check_mark: |
| Groups as import filter | Pick which groups to import from | |
| Automatic mapping by group name | Auto-match group names to roles | |

**User's choice:** Optional group-to-role mapping step

| Option | Description | Selected |
|--------|-------------|----------|
| Send invites immediately | Standard Better Auth invite email right away | :heavy_check_mark: |
| Import silently, send later | Create records without emails | |
| Admin chooses per import | Checkbox: 'Send invite emails now' | |

**User's choice:** Send invites immediately

---

## Periodic Sync Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| QStash cron job | Daily at 2 AM org timezone, fire-and-forget | :heavy_check_mark: |
| Manual sync button only | Admin clicks 'Sync now', no automatic | |
| Webhook push notifications | Google Directory push notifications | |

**User's choice:** QStash cron job

| Option | Description | Selected |
|--------|-------------|----------|
| Flag in dashboard, admin imports manually | Notification for new users, admin reviews | :heavy_check_mark: |
| Auto-import with default role | Auto-create with default role | |
| Queue for batch review | Collect in review queue | |

**User's choice:** Flag in dashboard, admin imports manually

| Option | Description | Selected |
|--------|-------------|----------|
| Flag as 'departed' notification, no auto-action | Notification with departed badge, admin decides | :heavy_check_mark: |
| Auto-deactivate with notification | Auto-deactivate account | |
| Weekly digest email | Weekly summary of changes | |

**User's choice:** Flag as 'departed' notification, no auto-action

| Option | Description | Selected |
|--------|-------------|----------|
| Daily | Once per day via QStash cron | :heavy_check_mark: |
| Every 6 hours | 4x daily | |
| Weekly | Once per week | |

**User's choice:** Daily

---

## Claude's Discretion

- Google Workspace adapter implementation details
- Admin SDK API pagination strategy
- Summary bar design and badge styling
- Import progress indicator
- QStash cron configuration and sync service internals
- Error handling for partial imports
- Notification content for new hire / departure flags
