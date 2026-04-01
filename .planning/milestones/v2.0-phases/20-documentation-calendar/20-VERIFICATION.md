---
phase: 20-documentation-calendar
verified: 2026-03-30T00:00:00Z
status: passed
score: 18/18 must-haves verified
re_verification: false
---

# Phase 20: Documentation Calendar Verification Report

**Phase Goal:** External documentation and calendar deadlines are accessible from within Contractor Ops without context-switching
**Verified:** 2026-03-30
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every requirement has a test stub file before implementation begins | VERIFIED | 6 test stub files with `it.todo` entries exist in both `packages/integrations` and `packages/api` |
| 2 | Four new IntegrationProvider enum values exist in Prisma schema | VERIFIED | NOTION, CONFLUENCE, GOOGLE_CALENDAR, OUTLOOK_CALENDAR present in `integration.prisma` |
| 3 | IntegrationConnection has optional userId field for per-user connections | VERIFIED | `userId String?` + `@@index([organizationId, userId, provider])` confirmed in schema |
| 4 | Four adapter classes are registered and instantiable | VERIFIED | All 4 adapters imported and registered in `register-all.ts` via `registerAdapter()` |
| 5 | Zod validators exist for doc link metadata and calendar event config | VERIFIED | `docSearchResultSchema`, `attachDocInputSchema`, `calendarTaskConfigSchema`, `calendarEventMetadataSchema`, `deadlineTypeSchema` all exported and re-exported from validators index |
| 6 | User can attach a Notion or Confluence page link to a workflow task run | VERIFIED | `attachDocLink` service + `attach` tRPC procedure + `AttachDocDialog` component + `DocLinksSection` all wired end-to-end |
| 7 | User can detach a doc link from a workflow task run | VERIFIED | `detachDocLink` service + `detach` tRPC procedure + remove button with AlertDialog confirmation in `DocLinksSection` |
| 8 | User can search Notion and Confluence pages by title via tRPC | VERIFIED | `searchDocs` service proxies to NotionAdapter/ConfluenceAdapter; `search` tRPC procedure exposed; `AttachDocDialog` and Cmd+K both consume `trpc.docs.search` |
| 9 | Doc links are stored as ExternalLink records with NOTION_PAGE or CONFLUENCE_PAGE externalType | VERIFIED | `doc-link-service.ts` uses `entityType: "WORKFLOW_TASK_RUN"`, `externalType: "NOTION_PAGE" \| "CONFLUENCE_PAGE"` |
| 10 | System can create calendar events on Google Calendar and Outlook Calendar | VERIFIED | `createCalendarEvent` in `calendar-event-service.ts` instantiates GoogleCalendarAdapter and OutlookCalendarAdapter, calls their `createEvent` methods, stores results in ExternalLink |
| 11 | System pushes contract expiry, approval SLA, and payment due date deadlines to calendar | VERIFIED | `syncContractExpiryDeadline`, `syncApprovalSlaDeadline`, `syncPaymentDueDeadline` all exported from `calendar-deadline-sync.ts` with `[Contractor Ops]` title prefix per D-15 |
| 12 | System updates calendar events when source entity dates change | VERIFIED | `updateCalendarEvent` in event service; deadline sync functions call `updateCalendarEvent` when ExternalLink already exists for entity |
| 13 | Workflow task activation can create a calendar event with configured title and duration | VERIFIED | `createTaskCalendarEvent` in `calendar-deadline-sync.ts` with template substitution and duration calculation |
| 14 | Calendar events are pushed to both personal and org calendar when both connected | VERIFIED | `findCalendarConnections` in `calendar-event-service.ts` returns personal (userId match) + org (userId null) connections; `createCalendarEvent` iterates all and pushes to each |
| 15 | User can connect their personal Google or Outlook calendar from Settings > My Calendar | VERIFIED | `/settings/calendar/page.tsx` renders `MyCalendarSection` with connect buttons for Google and Outlook; i18n key `connectCalendar = "Connect Calendar"` confirmed |
| 16 | User can see active synced events count on My Calendar page | VERIFIED | `trpc.calendar.listEvents` query in `MyCalendarSection`; i18n confirms `activeSyncedEvents = "Active Synced Events"` and `eventsSynced = "{count} events synced"` |
| 17 | User can toggle calendar event creation per workflow task template and configure event | VERIFIED | `CalendarTaskConfig` component with Switch + `trpc.calendar.getTaskConfig`/`saveTaskConfig`; `CalendarEventConfigDialog` with title template, duration select, attendees textarea |
| 18 | Notion and Confluence provider cards appear in Settings > Integrations | VERIFIED | `integrations-tab.tsx` imports `NotionIcon`, `ConfluenceIcon`, `OrgCalendarSection` and renders provider cards for all four new providers |

**Score:** 18/18 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/integrations/src/adapters/__tests__/notion-adapter.test.ts` | Notion adapter test stubs | VERIFIED | 6 `it.todo` entries, `describe("NotionAdapter")` |
| `packages/integrations/src/adapters/__tests__/confluence-adapter.test.ts` | Confluence adapter test stubs | VERIFIED | `describe("ConfluenceAdapter")` with `it.todo` entries |
| `packages/integrations/src/adapters/__tests__/google-calendar-adapter.test.ts` | Google Calendar test stubs | VERIFIED | `describe("GoogleCalendarAdapter")` with `it.todo` entries |
| `packages/integrations/src/adapters/__tests__/outlook-calendar-adapter.test.ts` | Outlook Calendar test stubs | VERIFIED | `describe("OutlookCalendarAdapter")` with `it.todo` entries |
| `packages/api/src/services/__tests__/doc-link-service.test.ts` | Doc link service test stubs | VERIFIED | `describe("DocLinkService")` with `it.todo` entries |
| `packages/api/src/services/__tests__/calendar-sync.test.ts` | Calendar sync test stubs | VERIFIED | `describe("CalendarEventService")`, `describe("CalendarDeadlineSync")`, `describe("CalendarTaskEventService")` |
| `packages/db/prisma/schema/integration.prisma` | NOTION/CONFLUENCE/GOOGLE_CALENDAR/OUTLOOK_CALENDAR enum values + userId field | VERIFIED | All 4 enum values present; `userId String?` field; composite index on `[organizationId, userId, provider]` |
| `packages/integrations/src/adapters/notion-adapter.ts` | Notion OAuth adapter with search | VERIFIED | `export class NotionAdapter extends BaseAdapter`; HTTP Basic auth header; `Notion-Version: 2022-06-28`; `searchPages` method |
| `packages/integrations/src/adapters/confluence-adapter.ts` | Confluence OAuth adapter with CQL search | VERIFIED | `export class ConfluenceAdapter extends BaseAdapter`; `search:confluence` scope; `searchPages` and `discoverCloudId` |
| `packages/integrations/src/adapters/google-calendar-adapter.ts` | Google Calendar OAuth adapter | VERIFIED | `export class GoogleCalendarAdapter extends BaseAdapter`; `If-Match` etag header; `createEvent`/`updateEvent`/`deleteEvent` |
| `packages/integrations/src/adapters/outlook-calendar-adapter.ts` | Outlook Calendar OAuth adapter | VERIFIED | `export class OutlookCalendarAdapter extends BaseAdapter`; MS Graph `graph.microsoft.com/v1.0/me/calendar/events` |
| `packages/validators/src/docs.ts` | Doc link metadata and search schemas | VERIFIED | `docSearchResultSchema`, `attachDocInputSchema`, `docSearchInputSchema`, `notionPageMetadataSchema`, `confluencePageMetadataSchema` |
| `packages/validators/src/calendar.ts` | Calendar event config and metadata schemas | VERIFIED | `calendarTaskConfigSchema`, `calendarEventMetadataSchema`, `deadlineTypeSchema`, `createCalendarEventInputSchema` |
| `packages/api/src/services/doc-link-service.ts` | Doc link attach/detach/list/search service | VERIFIED | Exports `attachDocLink`, `detachDocLink`, `getDocLinks`, `searchDocs`, `refreshDocMetadata`; uses `WORKFLOW_TASK_RUN` entity type |
| `packages/api/src/routers/docs.ts` | tRPC router for doc link CRUD and search | VERIFIED | `docsRouter` with `attach`, `detach`, `list`, `search`, `refreshMetadata` procedures using `tenantProcedure` |
| `packages/api/src/services/calendar-event-service.ts` | Calendar event create/update/delete with dual-push | VERIFIED | Exports `createCalendarEvent`, `updateCalendarEvent`, `deleteCalendarEvent`; `findCalendarConnections` helper; uses both `GOOGLE_CALENDAR_EVENT` and `OUTLOOK_CALENDAR_EVENT` external types |
| `packages/api/src/services/calendar-deadline-sync.ts` | Deadline watchers for contract, approval, payment | VERIFIED | Exports `syncContractExpiryDeadline`, `syncApprovalSlaDeadline`, `syncPaymentDueDeadline`, `createTaskCalendarEvent`; uses `[Contractor Ops]` title prefix constant |
| `packages/api/src/routers/calendar.ts` | tRPC router for calendar connections and events | VERIFIED | `calendarRouter` with `listConnections`, `listPersonalConnections`, `disconnect`, `listEvents`, `syncContractDeadline`, `syncPaymentDeadline`, `getTaskConfig`, `saveTaskConfig` |
| `apps/web/src/components/integrations/provider-icons.tsx` | SVG icons for all four providers | VERIFIED | Exports `NotionIcon`, `ConfluenceIcon`, `GoogleCalendarIcon`, `OutlookCalendarIcon` |
| `apps/web/src/components/integrations/doc-link-chip.tsx` | Clickable chip for linked doc page | VERIFIED | `export function DocLinkChip`; `target="_blank"`; `aria-label="Remove link to ${title}"` |
| `apps/web/src/components/integrations/doc-links-section.tsx` | Doc chips + attach button for task cards | VERIFIED | `export function DocLinksSection`; `trpc.docs.list`; "Attach Document" button |
| `apps/web/src/components/integrations/attach-doc-dialog.tsx` | Search dialog for finding doc pages | VERIFIED | `export function AttachDocDialog`; `trpc.docs.search`; `trpc.docs.attach` |
| `apps/web/src/components/search/command-palette.tsx` | Extended Cmd+K with Docs search group | VERIFIED | `CommandGroup heading="Docs"`; `doc: "bg-chart-3/10 text-chart-3 border-transparent"`; `trpc.docs.search`; `window.open(..., "_blank")`; `NotionIcon` imported |
| `apps/web/src/app/[locale]/(dashboard)/settings/calendar/page.tsx` | My Calendar personal settings page | VERIFIED | i18n renders "My Calendar" title; imports and renders `MyCalendarSection` |
| `apps/web/src/components/settings/my-calendar-section.tsx` | Personal calendar connection cards | VERIFIED | `export function MyCalendarSection`; `trpc.calendar.listPersonalConnections`; `trpc.calendar.listEvents`; i18n: "Connect Calendar", "Disconnect Calendar", "Active Synced Events", `GoogleCalendarIcon`, `OutlookCalendarIcon` |
| `apps/web/src/components/workflow/calendar-task-config.tsx` | Calendar event toggle in workflow task template | VERIFIED | `export function CalendarTaskConfig`; `trpc.calendar.getTaskConfig`; `trpc.calendar.saveTaskConfig`; i18n renders "Create calendar event when task activates" |
| `apps/web/src/components/workflow/calendar-event-config-dialog.tsx` | Calendar event configuration dialog | VERIFIED | `export function CalendarEventConfigDialog`; i18n renders "Save Event Config" and "Available variables: {contractor}, {contract}, {task}" |
| `apps/web/src/components/settings/integrations-tab.tsx` | Updated with Notion + Confluence + org calendar cards | VERIFIED | Imports `NotionIcon`, `ConfluenceIcon`, `OrgCalendarSection`; renders all three |

**Note on `_app.ts`:** Plan frontmatter references `packages/api/src/routers/_app.ts` but the actual file is `packages/api/src/root.ts`. This is a naming discrepancy in the plan only — `root.ts` correctly mounts `docs: docsRouter` and `calendar: calendarRouter`.

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/integrations/src/adapters/register-all.ts` | All four new adapters | `registerAdapter()` calls | WIRED | `registerAdapter(new NotionAdapter())`, `registerAdapter(new ConfluenceAdapter())`, `registerAdapter(new GoogleCalendarAdapter())`, `registerAdapter(new OutlookCalendarAdapter())` all present |
| `packages/api/src/routers/docs.ts` | `packages/api/src/services/doc-link-service.ts` | Service function imports | WIRED | `import { attachDocLink, detachDocLink, getDocLinks, searchDocs, refreshDocMetadata } from "../services/doc-link-service.js"` |
| `packages/api/src/services/doc-link-service.ts` | `packages/integrations/src/adapters/notion-adapter.ts` | Adapter search proxy | WIRED | `import { NotionAdapter } from "@contractor-ops/integrations/adapters/notion-adapter"`; `notionAdapter.searchPages()` called directly |
| `packages/api/src/services/doc-link-service.ts` | `packages/integrations/src/adapters/confluence-adapter.ts` | Adapter search proxy | WIRED | `import { ConfluenceAdapter } from "@contractor-ops/integrations/adapters/confluence-adapter"`; `confluenceAdapter.searchPages()` called |
| `packages/api/src/services/calendar-deadline-sync.ts` | `packages/api/src/services/calendar-event-service.ts` | Event lifecycle calls | WIRED | `import { createCalendarEvent, updateCalendarEvent } from "./calendar-event-service.js"` |
| `packages/api/src/services/calendar-event-service.ts` | `packages/integrations/src/adapters/google-calendar-adapter.ts` | Adapter event CRUD | WIRED | `import { GoogleCalendarAdapter }` + `googleAdapter.createEvent()` called |
| `packages/api/src/routers/calendar.ts` | `packages/api/src/routers/root.ts` | Router mount | WIRED | `calendar: calendarRouter` in `root.ts` |
| `packages/api/src/routers/docs.ts` | `packages/api/src/routers/root.ts` | Router mount | WIRED | `docs: docsRouter` in `root.ts` |
| `apps/web/src/components/integrations/doc-links-section.tsx` | `packages/api/src/routers/docs.ts` | `trpc.docs.list` and `trpc.docs.detach` | WIRED | Both `trpc.docs.list.queryOptions` and `trpc.docs.detach.mutationOptions` used |
| `apps/web/src/components/integrations/attach-doc-dialog.tsx` | `packages/api/src/routers/docs.ts` | `trpc.docs.search` and `trpc.docs.attach` | WIRED | `trpc.docs.search.queryOptions` and `trpc.docs.attach.mutationOptions` both present |
| `apps/web/src/components/search/command-palette.tsx` | `packages/api/src/routers/docs.ts` | `trpc.docs.search` | WIRED | `trpc.docs.search.queryOptions({ query: debouncedQuery, provider: "all" })` |
| `apps/web/src/components/settings/my-calendar-section.tsx` | `packages/api/src/routers/calendar.ts` | `trpc.calendar.listPersonalConnections` | WIRED | `trpc.calendar.listPersonalConnections.queryOptions()` and `trpc.calendar.listEvents.queryOptions()` |
| `apps/web/src/components/workflow/calendar-task-config.tsx` | `packages/api/src/routers/calendar.ts` | `trpc.calendar.getTaskConfig` and `saveTaskConfig` | WIRED | Both queries and mutations wired with proper cache invalidation |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `doc-links-section.tsx` | `trpc.docs.list` query result | `getDocLinks` → `prisma.externalLink.findMany` with `NOTION_PAGE`/`CONFLUENCE_PAGE` filter | Yes — DB query with entity scoping | FLOWING |
| `attach-doc-dialog.tsx` | `trpc.docs.search` query result | `searchDocs` → `notionAdapter.searchPages()` / `confluenceAdapter.searchPages()` (live API calls) | Yes — live provider API calls | FLOWING |
| `command-palette.tsx` Docs group | `trpc.docs.search` query result | Same as above | Yes | FLOWING |
| `my-calendar-section.tsx` events count | `trpc.calendar.listEvents` → `{ count }` | `prisma.externalLink.count` with `GOOGLE_CALENDAR_EVENT`/`OUTLOOK_CALENDAR_EVENT` filter | Yes — DB aggregate | FLOWING |
| `calendar-event-service.ts` | `findCalendarConnections` → connections array | `prisma.integrationConnection.findMany` with provider and userId filter | Yes — DB query | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — Phase 20 code requires external OAuth provider credentials (Notion, Confluence, Google Calendar, Outlook) and a running database. No standalone runnable entry points testable without service dependencies.

---

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DOCS-01 | 20-00, 20-01, 20-02, 20-04 | User can attach Notion or Confluence page links to workflow steps | SATISFIED | `attachDocLink` service + `attach` tRPC + `AttachDocDialog` + `DocLinksSection` all fully implemented and wired |
| DOCS-02 | 20-00, 20-01, 20-02, 20-04 | User can search and link Notion/Confluence pages from within Cmd+K | SATISFIED | `searchDocs` proxies to both providers; `search` tRPC procedure; `AttachDocDialog` search; Cmd+K "Docs" group with `window.open` new-tab behavior |
| CAL-01 | 20-00, 20-01, 20-03, 20-05 | System pushes contract expiry, approval SLA, and payment deadlines to Google/Outlook calendar | SATISFIED | `syncContractExpiryDeadline`, `syncApprovalSlaDeadline`, `syncPaymentDueDeadline` with D-15 title format; dual-push for personal+org connections; `syncContractDeadline`/`syncPaymentDeadline` tRPC triggers |
| CAL-02 | 20-00, 20-01, 20-03, 20-05 | Workflow steps can create calendar events (e.g., onboarding kickoff meeting) | SATISFIED | `createTaskCalendarEvent` in deadline-sync; `CalendarTaskConfig` switch + `CalendarEventConfigDialog` with title template, duration, attendees; `getTaskConfig`/`saveTaskConfig` tRPC procedures |

All 4 requirements from REQUIREMENTS.md phase mapping are SATISFIED. No orphaned requirements detected.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/api/src/services/doc-link-service.ts` | 228, 249, 266, 275, 299 | `return []` | INFO | These are legitimate guard clauses: early exit when no integration connection exists for the org, and error fallbacks when provider API calls fail. They are not stubs — real DB queries and adapter calls precede them. |

No blockers or warnings found. No TODO/FIXME/placeholder comments in any implementation file. No empty handler stubs. No hardcoded empty props in rendered components.

---

### Human Verification Required

#### 1. OAuth Connect Flow (Google Calendar)

**Test:** In a dev environment with `GOOGLE_CALENDAR_CLIENT_ID` and `GOOGLE_CALENDAR_CLIENT_SECRET` set, navigate to `/settings/calendar`, click "Connect Calendar" for Google Calendar. Complete the OAuth flow.
**Expected:** Connection appears with "Connected" status, `userId` set on `IntegrationConnection`, and synced events count starts tracking.
**Why human:** Requires live OAuth credentials and redirect callback handling — cannot be verified statically.

#### 2. Doc Link Chip visual rendering

**Test:** Attach a Notion page to a workflow task run. View the task card.
**Expected:** `DocLinkChip` renders with Notion icon, truncated title, hover-reveal remove button, tooltip showing last edited time.
**Why human:** Visual layout, truncation behavior, hover states, and tooltip timing require a running browser.

#### 3. Cmd+K Docs search response time

**Test:** Open Cmd+K, type 3+ characters. Observe the "Docs" group.
**Expected:** Docs results appear below entity results within ~500ms for connected providers. Debounce prevents excessive API calls.
**Why human:** Performance and debounce behavior require a running application with connected providers.

#### 4. Dual-push verification

**Test:** With both a personal Google Calendar connection (userId set) and an org-level Outlook Calendar connection (userId null), trigger a contract expiry deadline sync.
**Expected:** Two calendar events created — one on personal Google Calendar, one on org Outlook Calendar. Both `ExternalLink` records visible in DB.
**Why human:** Requires multiple live OAuth connections and calendar API tokens simultaneously.

#### 5. CalendarEventConfigDialog i18n integration

**Test:** Open a workflow task template, click "Configure" on the calendar toggle row. View dialog.
**Expected:** Dialog shows "Calendar Event" title, "Available variables: {contractor}, {contract}, {task}" hint, "Save Event Config" button. Translations from `en.json` confirmed correct — verify rendered output matches.
**Why human:** i18n string interpolation edge cases require visual confirmation in a running browser.

---

### Gaps Summary

No gaps found. All 18 observable truths verified. All 28 artifacts exist and are substantive. All 13 key links are wired. All 4 requirements (DOCS-01, DOCS-02, CAL-01, CAL-02) are satisfied.

The only discrepancy found is a naming inconsistency in the plan frontmatter: plans reference `packages/api/src/routers/_app.ts` but the actual root router is `packages/api/src/root.ts`. This does not affect functionality — `root.ts` correctly mounts both `docs: docsRouter` and `calendar: calendarRouter` and is the file that was actually modified.

---

_Verified: 2026-03-30_
_Verifier: Claude (gsd-verifier)_
