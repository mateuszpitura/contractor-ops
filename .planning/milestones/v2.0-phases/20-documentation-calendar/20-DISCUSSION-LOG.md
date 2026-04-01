# Phase 20: Documentation & Calendar - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-29
**Phase:** 20-documentation-calendar
**Areas discussed:** Doc linking model, Doc search in Cmd+K, Calendar event scope, Calendar provider UX

---

## Doc Linking Model

| Option | Description | Selected |
|--------|-------------|----------|
| ExternalLink reuse | Same model as Jira — ExternalLink with provider=notion/confluence, metadataJson caches page title + icon + last edited | ✓ |
| Simple URL field | Plain URL string on WorkflowTask — no metadata caching, no preview | |
| Dedicated DocLink model | New model specifically for doc links with fields for title, icon, provider, snippet | |

**User's choice:** ExternalLink reuse (Recommended)
**Notes:** Consistent with existing Jira integration pattern.

| Option | Description | Selected |
|--------|-------------|----------|
| Multiple links | A step can reference multiple docs. ExternalLink already supports many-to-one | ✓ |
| Single link only | One doc per step | |

**User's choice:** Multiple links (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Title + icon + last edited | Rich chip display, updated via webhook or lazy refresh | ✓ |
| Title only | Minimal, no staleness concerns | |
| Title + icon + snippet | First ~100 chars for hover preview | |

**User's choice:** Title + icon + last edited (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Workflow steps only | Matches DOCS-01 exactly. Clean scope | ✓ |
| Workflow steps + contracts | Contracts often reference external specs/SOWs | |
| Any entity | Generic doc attachment everywhere | |

**User's choice:** Workflow steps only (Recommended)

---

## Doc Search in Cmd+K

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated group | New "Docs" group in Cmd+K alongside existing groups | ✓ |
| Mixed into results | Doc pages appear alongside other search results | |
| Separate search mode | Type prefix like 'doc:' to switch to doc search | |

**User's choice:** Dedicated group (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Page titles only | Fast API call via Notion Search API and Confluence CQL | ✓ |
| Titles + content | Full-text search across page content | |
| Pre-indexed pages only | Only search pages already linked in the system | |

**User's choice:** Page titles only (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Open in new tab | Opens Notion/Confluence page in new browser tab | ✓ |
| Copy link + open | Copies URL to clipboard AND opens in new tab | |
| Attach to context | Offer to attach doc link if viewing a workflow step | |

**User's choice:** Open in new tab (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Title + workspace | Page title, provider icon, workspace/space name | ✓ |
| Title + snippet | Page title plus first ~50 chars of content | |

**User's choice:** Title + workspace (Recommended)

---

## Calendar Event Scope

| Option | Description | Selected |
|--------|-------------|----------|
| All three types | Contract expiry, approval SLA deadlines, payment due dates | ✓ |
| Configurable per type | Admin toggles which deadline types push | |
| Contract expiry only | Start with highest-value deadline | |

**User's choice:** All three types (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, per-template config | Task template gets calendar event toggle with title, duration, attendees | ✓ |
| Yes, manual only | User manually creates calendar event from active task | |
| No, deadlines only | Skip CAL-02, deadlines only | |

**User's choice:** Yes, per-template config (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Event on deadline day | Calendar event on actual deadline. Native reminders handle advance notice | ✓ |
| Advance reminder events | Separate events at configurable intervals before deadline | |
| Both event + reminder | Main event + single heads-up event N days before | |

**User's choice:** Event on deadline day (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, auto-update | Store calendar eventId in ExternalLink. Update/delete on source changes | ✓ |
| Create only, no updates | Fire and forget | |
| Update + notify | Auto-update + add note to event description | |

**User's choice:** Yes, auto-update (Recommended)

---

## Calendar Provider UX

| Option | Description | Selected |
|--------|-------------|----------|
| Per-user | Each user connects their own calendar | |
| Per-org shared calendar | Org connects one shared calendar | |
| Both options | Per-user personal + per-org shared calendar | ✓ |

**User's choice:** Both options

| Option | Description | Selected |
|--------|-------------|----------|
| Both from day one | Google Calendar API + Microsoft Graph API | ✓ |
| Google first, Outlook later | Ship Google Calendar first | |
| Outlook first, Google later | M365 first for EU enterprise | |

**User's choice:** Both from day one (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Personal settings page | Settings > My Calendar, per-user OAuth | ✓ |
| Integration settings | Admin integration page | |
| Inline prompt | Prompt when first deadline would push | |

**User's choice:** Personal settings page (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Prefixed + contextual | [Contractor Ops] + entity type + details. Deep link in description | ✓ |
| Clean, no prefix | No source prefix | |
| You decide | Claude picks best format | |

**User's choice:** Prefixed + contextual (Recommended)

---

## Claude's Discretion

- Notion vs Confluence adapter internal implementation details
- OAuth scope selection for each doc/calendar provider
- Calendar event description content structure
- Webhook vs polling for doc metadata freshness
- Loading states and error handling in Cmd+K doc search
- Org shared calendar connection UX placement

## Deferred Ideas

- Doc linking on contracts, contractors, and other entities — future phase
- Full-text content search across Notion/Confluence pages — future enhancement
- Bidirectional calendar sync — out of scope per requirements
- Notion/Confluence content rendering inline — out of scope per requirements
