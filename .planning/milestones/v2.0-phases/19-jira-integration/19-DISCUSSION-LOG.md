# Phase 19: Jira Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-28
**Phase:** 19-jira-integration
**Areas discussed:** Issue creation trigger, Status mapping, Webhook sync direction, Linked issue display

---

## Issue Creation Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Per-task template config | Admin marks specific task templates as "Create Jira issue on activation". Each task template has its own Jira project + issue type mapping. Granular control. | ✓ |
| On workflow run start | All tasks with Jira config get issues created at once when a run launches. Batch creation, simpler logic. | |
| On task status change | Issue created when task moves to IN_PROGRESS. Lazy creation. | |

**User's choice:** Per-task template config
**Notes:** None

### Follow-up: Mapping location

| Option | Description | Selected |
|--------|-------------|----------|
| Per task template | Each WorkflowTaskTemplate gets a Jira config section: target project, issue type, optional labels/components. | ✓ |
| Per workflow template | One Jira project + issue type for the whole workflow. | |
| Global default + override | Org-wide default with optional per-template override. | |

**User's choice:** Per task template
**Notes:** None

### Follow-up: Issue field generation

| Option | Description | Selected |
|--------|-------------|----------|
| Auto from task | Summary = task title, description = task description + link back. | |
| Template with placeholders | Admin writes templates with {{contractor.name}} etc. | |
| You decide | Claude picks during planning. | ✓ |

**User's choice:** You decide
**Notes:** None

---

## Status Mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Admin-configurable mapping | Admin builds a mapping table per Jira project. Fetches available Jira statuses/transitions via API. | ✓ |
| Convention-based defaults | Hardcoded defaults (TODO→To Do, etc.). Simple but breaks on custom workflows. | |
| Smart defaults + override | Auto-match by name similarity, admin can override. | |

**User's choice:** Admin-configurable mapping
**Notes:** None

### Follow-up: Mapping scope

| Option | Description | Selected |
|--------|-------------|----------|
| Per Jira project | One mapping table per Jira project, reused across workflows. | ✓ |
| Per workflow template | Each workflow template has its own mapping. | |
| You decide | Claude picks during planning. | |

**User's choice:** Per Jira project
**Notes:** None

### Follow-up: Unmapped status handling

| Option | Description | Selected |
|--------|-------------|----------|
| Ignore silently | Log in sync log but don't change workflow task status. | |
| Warning notification | Notify assignee or admin about unmapped transition. | |
| You decide | Claude picks during planning. | ✓ |

**User's choice:** You decide
**Notes:** None

---

## Webhook Sync Direction

| Option | Description | Selected |
|--------|-------------|----------|
| True bidirectional | Changes flow both ways. Jira→app via webhooks, app→Jira via API transition calls. Requires write:jira-work scope. | ✓ |
| Jira → app only | Jira is source of truth for status. App only reads. | |
| App → Jira only | Contractor Ops pushes to Jira but doesn't listen. | |

**User's choice:** True bidirectional
**Notes:** None

### Follow-up: Webhook mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Jira Connect webhooks | Register via Jira REST API for issue_updated events. Uses existing unified webhook endpoint and QStash. | ✓ |
| Jira Automation rules | User sets up Jira Automation to POST. Manual setup, less reliable. | |
| Polling for changes | Periodically poll Jira for issue updates. Adds latency. | |

**User's choice:** Jira Connect webhooks
**Notes:** None

### Follow-up: Conflict resolution

| Option | Description | Selected |
|--------|-------------|----------|
| Last-write wins | Whichever change arrives last takes effect. Sync log records both. | ✓ |
| Jira wins | Jira status takes priority on conflict. | |
| You decide | Claude picks during planning. | |

**User's choice:** Last-write wins
**Notes:** None

---

## Linked Issue Display

| Option | Description | Selected |
|--------|-------------|----------|
| Key + status badge | Chip shows Jira issue key with colored status badge. Click opens Jira in new tab. Compact. | ✓ |
| Key + summary + status | Chip shows issue key, truncated summary, and status. More context. | |
| Full card | Small card with key, summary, status, assignee, priority. | |

**User's choice:** Key + status badge
**Notes:** None

### Follow-up: Placement on contractor profile

| Option | Description | Selected |
|--------|-------------|----------|
| Workflow tab inline | Chips inline next to linked workflow tasks. No new tab. | |
| Dedicated Jira tab | New tab showing all linked Jira issues in a table. | |
| Both inline + summary section | Chips inline on tasks AND summary section at top of Workflows tab. | ✓ |

**User's choice:** Both inline + summary section
**Notes:** None

### Follow-up: Data caching strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Cached in ExternalLink metadata | Store issue data in metadataJson. Update via webhooks. Fast reads. | ✓ |
| Live fetch on view | Fetch from Jira API when rendering. Always fresh but adds latency. | |
| You decide | Claude picks during planning. | |

**User's choice:** Cached in ExternalLink metadata
**Notes:** None

---

## Claude's Discretion

- Jira issue summary/description generation strategy
- Unmapped Jira status handling approach
- Chip component design and status badge colors
- Summary section layout on contractor Workflows tab
- Webhook registration lifecycle
- Loop prevention for bidirectional sync
- Error handling for failed Jira API calls

## Deferred Ideas

None — discussion stayed within phase scope.
