# Phase 18: Time Tracking - Research

**Researched:** 2026-03-27
**Domain:** Time tracking (manual logging, external imports, manager approval, invoice reconciliation)
**Confidence:** HIGH

## Summary

Phase 18 adds time tracking to the contractor portal and admin dashboard. The scope covers five distinct areas: (1) manual hour logging via a weekly timesheet grid and single-entry form in the portal, (2) manager review/approval workflow in admin, (3) Clockify time entry import via REST API, (4) Jira worklog import via REST API with standalone OAuth, and (5) invoice-vs-time reconciliation with configurable deviation thresholds.

The existing codebase provides strong foundations. The portal authentication (`portalProcedure`), integration framework (adapter pattern, OAuth flow, credential encryption), invoice matching service (deviation calculation, flags), and established UI patterns (portal top bar nav, admin sidebar nav, data tables) can all be reused directly. The primary new work is the Prisma schema for time entries/timesheets, two new tRPC routers (portal time + admin time), two integration adapters (Clockify + Jira), and approximately 15 new UI components.

**Primary recommendation:** Build in three waves -- (1) schema + core CRUD + portal UI, (2) manager approval flow + admin UI, (3) external imports + invoice reconciliation. Keep Clockify/Jira adapters thin (API client wrappers with credential decryption) following the KSeF adapter pattern.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Both entry modes -- weekly timesheet grid (Mon-Sun with project rows) as primary view, plus "Add single entry" button for ad-hoc logging
- **D-02:** Project-level granularity -- contractor picks a project (mapped to contract). Description field for task-level details. No separate task picker
- **D-03:** Explicit submit workflow -- entries go DRAFT > SUBMITTED > APPROVED/REJECTED. Contractor can edit drafts before submitting
- **D-04:** New "Time" top-level nav item in portal top bar, between Documents and Payments
- **D-05:** Both views for managers -- aggregated queue for quick batch approval + drill-into per-contractor timesheet for detailed review
- **D-06:** New "Time" top-level section in admin sidebar. Dedicated page with contractor list, pending reviews, and history
- **D-07:** Approve/reject only -- manager cannot edit entries. Rejection includes reason. Contractor must resubmit corrections. Clean audit trail
- **D-08:** Standalone approval -- direct manager approval (one person approves). Does not use existing multi-level approval chain system
- **D-09:** Clockify sync via on-demand polling -- contractor or manager clicks "Sync from Clockify" to pull entries for a date range using Clockify REST API. No background polling or webhooks
- **D-10:** Jira worklog import by contractor -- pull all worklogs by a contractor's Jira user across all issues for a period
- **D-11:** Imported entries are read-only with source badge (Clockify/Jira). Contractor can add a note/description but cannot edit hours
- **D-12:** Basic standalone Jira OAuth in this phase for worklog pull only. Phase 19 extends with full issue sync
- **D-13:** Auto-comparison on invoice submit -- system checks approved hours for that contract/period and computes expected amount (rate x hours) vs invoiced amount
- **D-14:** Configurable deviation threshold per org -- admin sets acceptable deviation % in settings (default 10%)
- **D-15:** Warning only -- deviation flag appears on invoice but does not block approval
- **D-16:** Display on both invoice detail page (new section) AND in Time admin section as reconciliation view

### Claude's Discretion
- Timesheet grid component design and interaction details
- Single entry form field layout and validation
- Manager queue table columns and sorting defaults
- Per-contractor timesheet review layout
- Clockify/Jira sync button placement and loading states
- Source badge design for imported entries
- Deviation flag visual design and placement on invoice detail
- Reconciliation view layout in Time admin section
- Empty states for all time tracking views
- Loading skeleton patterns

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TIME-01 | Contractor can log hours manually in portal (date, hours, project/task, description) | New TimeEntry + Timesheet Prisma models, portal tRPC router, TimesheetGrid + SingleEntryForm components, portalProcedure middleware |
| TIME-02 | Manager can review and approve/reject submitted time entries | Admin tRPC router with approval/rejection mutations, ApprovalQueueTable + ContractorTimesheetReview components, timesheet status state machine |
| TIME-03 | System can import time entries from Clockify via API | Clockify adapter in integrations package, REST API client (X-Api-Key auth), date-range polling, read-only imported entries with source tracking |
| TIME-04 | System can import worklogs from Jira issues assigned to contractor | Jira adapter with OAuth 2.0 3LO, worklog fetch via JQL + per-issue worklog endpoints, ExternalLink mapping for Jira user |
| TIME-05 | System compares approved hours against invoice amount and flags deviations | Extend invoice-matching service with time-based expected amount calculation, configurable threshold in org settingsJson, ReconciliationCard on invoice detail |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @contractor-ops/db (Prisma) | Existing workspace | New TimeEntry, Timesheet models | Established DB layer with tenant scoping |
| @contractor-ops/api (tRPC) | Existing workspace | Portal + admin time routers | Existing router pattern with portalProcedure and tenantProcedure |
| @contractor-ops/integrations | Existing workspace | Clockify + Jira adapter implementations | Established adapter pattern (KSeF, DocuSign, etc.) |
| @contractor-ops/validators (Zod) | Existing workspace | Input validation schemas for all time endpoints | Project convention for all external inputs |
| next-intl | Existing | i18n for time tracking UI copy | Already used across portal and admin |
| shadcn/ui (Radix) | Existing | All UI components per UI-SPEC | Project standard component library |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | Existing (check) | Week calculations, date range handling, ISO week logic | Timesheet week boundaries, date formatting |
| sonner | Existing | Toast notifications for sync, submit, approve actions | All async action feedback |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom Clockify SDK | npm clockify-ts | Thin REST wrapper is simpler; SDK adds dependency for 2-3 endpoints |
| Custom Jira client | npm jira.js | Same reasoning -- only need worklog endpoints, not full SDK |
| Full approval chain system | Existing ApprovalFlow model | D-08 explicitly opts for standalone approval (one person) |

**Installation:**
No new npm packages required. All dependencies are already in the workspace (Prisma, tRPC, Zod, date-fns, shadcn components, next-intl). Clockify and Jira API calls use native fetch.

## Architecture Patterns

### Recommended Project Structure

```
packages/db/prisma/schema/
  time-tracking.prisma            # TimeEntry, Timesheet models + enums

packages/validators/src/
  time-tracking.ts                # Zod schemas for time entry CRUD, approval, sync

packages/api/src/
  routers/
    portal-time.ts                # Portal time entry endpoints (portalProcedure)
    time.ts                       # Admin time management endpoints (tenantProcedure)
  services/
    time-reconciliation.ts        # Hours-vs-invoice comparison logic
    clockify-sync.ts              # Clockify API fetch + entry creation
    jira-worklog-sync.ts          # Jira API fetch + entry creation

packages/integrations/src/
  adapters/
    clockify-adapter.ts           # OAuth/API key config, token management
    jira-adapter.ts               # OAuth 2.0 3LO config, token exchange

apps/web/src/
  app/[locale]/(portal)/portal/time/
    page.tsx                      # Portal time entry page
  app/[locale]/(dashboard)/time/
    page.tsx                      # Admin time tracking page
    [contractorId]/
      page.tsx                    # Per-contractor timesheet review
  components/time/
    timesheet-grid.tsx            # Weekly grid component
    timesheet-header.tsx          # Week selector + status + submit
    single-entry-form.tsx         # Dialog for ad-hoc entries
    time-entry-status-badge.tsx   # Status badge mapping
    time-source-badge.tsx         # Source badge (Manual/Clockify/Jira)
    approval-queue-table.tsx      # Admin pending reviews table
    contractor-timesheet-review.tsx # Admin per-contractor detail
    rejection-reason-dialog.tsx   # Rejection reason input
    external-sync-button.tsx      # Clockify/Jira sync trigger
    deviation-flag.tsx            # Deviation badge component
    reconciliation-card.tsx       # Invoice detail time comparison
    reconciliation-table.tsx      # Admin reconciliation view
    time-summary-stats.tsx        # Portal overview cards
```

### Pattern 1: Timesheet State Machine (D-03)

**What:** Time entries follow DRAFT > SUBMITTED > APPROVED/REJECTED lifecycle. Timesheets (weekly groupings) aggregate entries for submission and approval.
**When to use:** All time entry status transitions.
**Example:**
```typescript
// TimeEntry status transitions
enum TimeEntryStatus {
  DRAFT       // Contractor can edit
  SUBMITTED   // Locked for review, contractor cannot edit
  APPROVED    // Manager approved
  REJECTED    // Manager rejected with reason, contractor can edit again
}

// Timesheet represents a weekly submission unit
model Timesheet {
  id              String          @id @default(cuid())
  organizationId  String
  contractorId    String
  weekStartDate   DateTime        @db.Date  // Always a Monday
  status          TimesheetStatus @default(DRAFT)
  submittedAt     DateTime?
  reviewedAt      DateTime?
  reviewedByUserId String?
  rejectionReason String?
  totalMinutes    Int             @default(0) // Denormalized for quick queries
  // ... relations
}

model TimeEntry {
  id              String          @id @default(cuid())
  organizationId  String
  timesheetId     String
  contractorId    String
  contractId      String          // Maps to project (D-02)
  entryDate       DateTime        @db.Date
  minutes         Int             // Store as minutes, not hours (avoids float issues)
  description     String?
  source          TimeEntrySource @default(MANUAL)
  externalId      String?         // Clockify/Jira entry ID for dedup
  // ... timestamps, relations
}
```

### Pattern 2: Portal Time Router (following portal.ts pattern)

**What:** tRPC router using `portalProcedure` for contractor-scoped time operations.
**When to use:** All portal-facing time endpoints.
**Example:**
```typescript
// packages/api/src/routers/portal-time.ts
import { portalProcedure } from "../middleware/portal-auth.js";

export const portalTimeRouter = router({
  // Get or create timesheet for a given week
  getTimesheet: portalProcedure
    .input(z.object({ weekStartDate: z.string().date() }))
    .query(async ({ ctx, input }) => {
      // ctx.contractorId and ctx.organizationId from portalProcedure
      // Upsert timesheet for the week, return with entries
    }),

  // Save draft entries (auto-save on cell blur)
  saveDraftEntries: portalProcedure
    .input(saveDraftEntriesSchema)
    .mutation(async ({ ctx, input }) => {
      // Only allowed when timesheet status is DRAFT or REJECTED
    }),

  // Submit timesheet for review
  submitTimesheet: portalProcedure
    .input(z.object({ timesheetId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Transition DRAFT/REJECTED -> SUBMITTED
      // Lock all entries
    }),
});
```

### Pattern 3: Clockify API Integration (following KSeF sync pattern)

**What:** On-demand fetch from Clockify REST API using API key stored in encrypted credentials.
**When to use:** When contractor clicks "Sync from Clockify" (D-09).
**Example:**
```typescript
// Clockify REST API - fetch time entries for a user
// GET /api/v1/workspaces/{workspaceId}/user/{userId}/time-entries
// Headers: X-Api-Key: {apiKey}
// Query: start={ISO-8601}&end={ISO-8601}&page={n}&page-size={n}

async function fetchClockifyEntries(
  apiKey: string,
  workspaceId: string,
  userId: string,
  startDate: string,
  endDate: string,
): Promise<ClockifyTimeEntry[]> {
  const entries: ClockifyTimeEntry[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const res = await fetch(
      `https://api.clockify.me/api/v1/workspaces/${workspaceId}/user/${userId}/time-entries?start=${startDate}&end=${endDate}&page=${page}&page-size=100`,
      { headers: { "X-Api-Key": apiKey } },
    );
    const data = await res.json();
    entries.push(...data);
    hasMore = res.headers.get("Last-Page") !== "true";
    page++;
  }
  return entries;
}
```

### Pattern 4: Jira OAuth 2.0 3LO (D-12)

**What:** Jira Cloud OAuth flow for worklog access. Uses Atlassian's auth server.
**When to use:** Jira worklog import setup.
**Example:**
```typescript
// Jira OAuth 2.0 3LO adapter
const jiraOAuthConfig: OAuthConfig = {
  clientIdEnvVar: "JIRA_CLIENT_ID",
  clientSecretEnvVar: "JIRA_CLIENT_SECRET",
  authorizationUrl: "https://auth.atlassian.com/authorize",
  tokenUrl: "https://auth.atlassian.com/oauth/token",
  scopes: ["read:jira-work", "offline_access"],
  redirectPath: "/api/oauth/jira/callback",
};

// After OAuth: get accessible resources to find cloud ID
// GET https://api.atlassian.com/oauth/token/accessible-resources
// Then API calls use: https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/...

// Fetch worklogs: use JQL to find issues with user's worklogs
// GET /rest/api/3/search?jql=worklogDate>={start} AND worklogAuthor="{accountId}"
// Then per issue: GET /rest/api/3/issue/{issueKey}/worklog
```

### Pattern 5: Invoice Reconciliation (extending invoice-matching.ts)

**What:** Compare approved hours against invoice amount using contract rate.
**When to use:** On invoice submission (D-13), displayed on invoice detail (D-16).
**Example:**
```typescript
// packages/api/src/services/time-reconciliation.ts
interface TimeReconciliation {
  approvedMinutes: number;
  rateValueGrosze: number;   // From contract
  rateType: RateType;        // PER_HOUR, PER_DAY, etc.
  expectedAmountGrosze: number;
  invoicedAmountGrosze: number;
  deviationGrosze: number;
  deviationPercent: number;
  withinThreshold: boolean;
}

async function computeTimeReconciliation(
  prisma: PrismaClient,
  organizationId: string,
  contractId: string,
  periodStart: Date,
  periodEnd: Date,
  invoicedAmountGrosze: number,
  thresholdPercent: number,
): Promise<TimeReconciliation | null> {
  // 1. Sum approved minutes for contract in period
  // 2. Get contract rate (rateValueGrosze + rateType)
  // 3. Calculate expected amount: (minutes / 60) * hourlyRateGrosze
  // 4. Compare with invoiced amount
  // 5. Apply threshold check
}
```

### Anti-Patterns to Avoid

- **Storing hours as floats:** Use integer minutes throughout. Display as hours with conversion (minutes / 60). Avoids floating-point arithmetic issues with currency calculations.
- **Coupling to approval chain system:** D-08 explicitly avoids the multi-level approval chain. Do not import or reference ApprovalFlow/ApprovalStep models. Keep standalone manager approval.
- **Making imported entries editable:** D-11 is clear -- imported entries are read-only for hours. Only notes/descriptions can be added. This prevents source-of-truth conflicts.
- **Blocking invoice approval on deviation:** D-15 specifies warning only. The deviation flag must never prevent invoice approval.
- **Building Clockify/Jira webhooks:** D-09 specifies on-demand polling only. No webhook endpoints, no background sync jobs.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Week boundary calculation | Custom week logic | `date-fns` startOfISOWeek/endOfISOWeek | ISO 8601 week rules are tricky (locale-dependent start day) |
| OAuth state CSRF protection | Manual HMAC | `generateOAuthState` from @contractor-ops/integrations | Already implemented and battle-tested in integration framework |
| Credential encryption | Custom crypto | `encryptCredentials` / `decryptCredentials` from @contractor-ops/integrations | Per-provider encryption key pattern established |
| Toast notifications | Custom notification system | Sonner (existing) | Already integrated across the app |
| Date picker | Custom calendar input | shadcn Calendar + Popover (existing) | Per UI-SPEC, already available |
| Deviation calculation for invoices | New matching engine | Extend existing `invoice-matching.ts` | MatchResult already has expectedAmountGrosze, amountDeltaGrosze, amountDeltaPercent, flags array |

**Key insight:** The existing invoice-matching service already computes deviation based on contract `rateValueGrosze`, but only for flat-rate contracts. Phase 18 extends this to compute expected amount from approved hours x hourly rate, feeding into the same MatchResult/flags pipeline.

## Common Pitfalls

### Pitfall 1: Float Precision in Hour-to-Currency Calculations
**What goes wrong:** Storing hours as Decimal(4,2) and multiplying by rate produces floating-point errors that compound in reconciliation.
**Why it happens:** 0.25 hours x 15000 grosze/h = 3750 grosze is exact, but intermediate float operations can introduce drift.
**How to avoid:** Store time as integer minutes in the database. Convert to hours only for display. All calculations use minutes: `(minutes * rateGrosze) / 60` with integer division or explicit rounding.
**Warning signs:** Reconciliation showing tiny deviations (0.01%) on entries that should match exactly.

### Pitfall 2: Week Boundary Timezone Issues
**What goes wrong:** Contractor in UTC+2 logs hours on Monday, but server in UTC calculates it as Sunday of the previous week.
**Why it happens:** Mixing Date (date-only) with DateTime (includes time) in week boundary calculations.
**How to avoid:** Store `entryDate` as `@db.Date` (date-only, no time component). Store `weekStartDate` as `@db.Date`. All week calculations use date-only values. The contractor's UI sends dates as YYYY-MM-DD strings, never timestamps.
**Warning signs:** Entries appearing in the wrong week when viewed by users in different timezones.

### Pitfall 3: Clockify Regional Base URLs
**What goes wrong:** Using `https://api.clockify.me/api/v1/` for all users, but EU/UK/AU/US users have different regional endpoints.
**Why it happens:** Clockify uses region-specific base URLs: `api.clockify.me` (global), `euc1.clockify.me` (EU), `use2.clockify.me` (US), `euw2.clockify.me` (UK), `apse2.clockify.me` (AU).
**How to avoid:** Store the workspace's regional base URL as part of the Clockify connection config. Let admin specify region during setup or auto-detect from workspace API response.
**Warning signs:** 401/404 errors from Clockify API for some users but not others.

### Pitfall 4: Jira Worklog Pagination Complexity
**What goes wrong:** Missing worklogs because the JQL search returns issues but not all worklogs, or worklog pagination per issue is not handled.
**Why it happens:** Jira's worklog retrieval is two-step: (1) JQL to find issues with user's worklogs, (2) per-issue GET to fetch actual worklog entries. Both endpoints paginate independently. JQL `maxResults` default is 50.
**How to avoid:** Paginate the JQL search (startAt + maxResults). For each issue, paginate the worklog endpoint. Use `worklogDate>=` and `worklogAuthor=` JQL filters to narrow the issue search. Filter worklogs client-side by author accountId since the issue worklog endpoint returns ALL worklogs, not just the user's.
**Warning signs:** Only getting worklogs from the first 50 issues, or missing worklogs on issues with 20+ total worklogs.

### Pitfall 5: Duplicate Import Prevention
**What goes wrong:** Clicking "Sync from Clockify" twice imports the same entries twice, doubling reported hours.
**Why it happens:** No dedup check on external IDs.
**How to avoid:** Store `externalId` (Clockify entry ID or Jira worklog ID) + `source` on TimeEntry. Use unique constraint on `(organizationId, contractorId, source, externalId)`. Upsert on import, not insert.
**Warning signs:** Hours doubling after repeated syncs.

### Pitfall 6: Jira Cloud ID Discovery
**What goes wrong:** Making API calls to Jira without the cloud ID, getting 404s.
**Why it happens:** Jira OAuth 2.0 3LO requires discovering the `cloudId` via the accessible-resources endpoint after authorization. The cloud ID is needed in the API URL path: `https://api.atlassian.com/ex/jira/{cloudId}/rest/api/3/...`
**How to avoid:** After token exchange, immediately call `GET https://api.atlassian.com/oauth/token/accessible-resources` and store the cloudId in the IntegrationConnection's configJson.
**Warning signs:** Jira API calls returning 404 or "site not found" errors.

### Pitfall 7: Timesheet Status Race Condition
**What goes wrong:** Contractor submits timesheet while manager is already reviewing a previous version of the entries.
**Why it happens:** No optimistic locking on timesheet status transitions.
**How to avoid:** Use Prisma's `update` with a `where` clause that includes the expected current status. If the update returns zero rows, the status has already changed -- throw a conflict error.
**Warning signs:** Entries being edited after submission, or approvals applied to stale data.

## Code Examples

### Database Schema (New Models)

```prisma
// packages/db/prisma/schema/time-tracking.prisma

model Timesheet {
  id               String          @id @default(cuid())
  organizationId   String
  contractorId     String
  weekStartDate    DateTime        @db.Date  // Always ISO Monday
  status           TimesheetStatus @default(DRAFT)
  totalMinutes     Int             @default(0)
  submittedAt      DateTime?
  reviewedAt       DateTime?
  reviewedByUserId String?
  rejectionReason  String?
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  organization     Organization @relation(fields: [organizationId], references: [id])
  contractor       Contractor   @relation(fields: [contractorId], references: [id])
  reviewedBy       User?        @relation("TimesheetReviewer", fields: [reviewedByUserId], references: [id])

  entries          TimeEntry[]

  @@unique([organizationId, contractorId, weekStartDate])
  @@index([organizationId])
  @@index([organizationId, status])
  @@index([organizationId, contractorId])
  @@index([organizationId, contractorId, weekStartDate])
}

model TimeEntry {
  id              String          @id @default(cuid())
  organizationId  String
  timesheetId     String
  contractorId    String
  contractId      String
  entryDate       DateTime        @db.Date
  minutes         Int             // Store as minutes (e.g., 480 = 8h, 15 = 0.25h)
  description     String?
  source          TimeEntrySource @default(MANUAL)
  externalId      String?         // For Clockify/Jira dedup
  metadataJson    Json?           // Provider-specific data (Clockify project, Jira issue key)
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  organization    Organization @relation(fields: [organizationId], references: [id])
  timesheet       Timesheet    @relation(fields: [timesheetId], references: [id])
  contractor      Contractor   @relation(fields: [contractorId], references: [id])
  contract        Contract     @relation(fields: [contractId], references: [id])

  @@unique([organizationId, contractorId, source, externalId])
  @@index([organizationId])
  @@index([organizationId, timesheetId])
  @@index([organizationId, contractorId, entryDate])
  @@index([organizationId, contractId, entryDate])
}

enum TimesheetStatus {
  DRAFT
  SUBMITTED
  APPROVED
  REJECTED
}

enum TimeEntrySource {
  MANUAL
  CLOCKIFY
  JIRA
}
```

### IntegrationProvider Enum Extension

```prisma
// Add to integration.prisma IntegrationProvider enum:
enum IntegrationProvider {
  SLACK
  RESEND
  GOOGLE_WORKSPACE
  MICROSOFT_365
  JIRA
  ESIGN
  DOCUSIGN
  AUTENTI
  KSEF
  ACCOUNTING
  OPEN_BANKING
  GITHUB
  GITLAB
  CLOCKIFY  // NEW for Phase 18
}
```

### Organization Settings Extension

```typescript
// Add to org settingsJson (existing pattern):
interface OrgTimeTrackingSettings {
  timeDeviationThresholdPercent?: number; // Default 10 (D-14)
}
// Accessed via: (org.settingsJson as Record<string, unknown>).timeDeviationThresholdPercent ?? 10
```

### Portal Nav Update

```typescript
// In portal-top-bar.tsx NAV_ITEMS array, add between Documents and Payments:
import { Clock } from "lucide-react";

const NAV_ITEMS = [
  { label: "Overview", href: "/portal", icon: LayoutDashboard },
  { label: "Contracts", href: "/portal/contracts", icon: FileText },
  { label: "Invoices", href: "/portal/invoices", icon: Receipt },
  { label: "Documents", href: "/portal/documents", icon: FolderOpen },
  { label: "Time", href: "/portal/time", icon: Clock },       // NEW
  { label: "Payments", href: "/portal/payments", icon: Banknote },
  { label: "Settings", href: "/portal/settings", icon: Settings },
] as const;
```

### Admin Sidebar Nav Update

```typescript
// In apps/web/src/lib/navigation.ts, add to "finance" group between "approvals" and "payments":
import { Clock } from "lucide-react";

// In finance group items array:
{
  key: "time",
  label: "Time",
  href: "/time",
  icon: Clock,
  permission: { resource: "time", actions: ["read"] },
},
```

### Clockify Adapter

```typescript
// packages/integrations/src/adapters/clockify-adapter.ts
// Clockify uses API key auth (not OAuth). Stored as encrypted credential.
// Config stored in IntegrationConnection.configJson:
// { workspaceId: string, userId: string, region: "global"|"eu"|"us"|"uk"|"au" }

const CLOCKIFY_REGIONS: Record<string, string> = {
  global: "https://api.clockify.me/api/v1",
  eu: "https://euc1.clockify.me/api/v1",
  us: "https://use2.clockify.me/api/v1",
  uk: "https://euw2.clockify.me/api/v1",
  au: "https://apse2.clockify.me/api/v1",
};
```

### Jira Worklog Fetch Flow

```typescript
// Step 1: JQL search for issues with user's worklogs in date range
// GET /rest/api/3/search?jql=worklogDate>="{start}" AND worklogDate<="{end}" AND worklogAuthor="{accountId}"&fields=key,summary&maxResults=100&startAt=0

// Step 2: For each issue, get worklogs
// GET /rest/api/3/issue/{issueKey}/worklog?startAt=0&maxResults=1000

// Step 3: Filter worklogs by author (endpoint returns ALL authors' worklogs)
// Step 4: Map to TimeEntry with source=JIRA, externalId=worklog.id, metadataJson={issueKey, issueSummary}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Clockify single global endpoint | Regional base URLs | 2024 | Must store/detect region per workspace |
| Jira OAuth 1.0 | OAuth 2.0 3LO | 2021 | Simpler flow, but requires cloud ID discovery step |
| Jira basic auth (API token) | OAuth 2.0 3LO or API token | Current | Both supported; OAuth 2.0 preferred for multi-tenant |
| Hours as decimal/float | Minutes as integer | Best practice | Eliminates floating-point precision issues |

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (existing) |
| Config file | Per-package vitest config (packages/api, packages/integrations) |
| Quick run command | `cd packages/api && pnpm test` |
| Full suite command | `pnpm -r test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TIME-01 | Create/update/submit time entries via portal | unit | `cd packages/api && pnpm vitest run src/routers/__tests__/portal-time.test.ts` | Wave 0 |
| TIME-02 | Manager approve/reject timesheet, status transitions | unit | `cd packages/api && pnpm vitest run src/routers/__tests__/time.test.ts` | Wave 0 |
| TIME-03 | Clockify API fetch, entry mapping, dedup | unit | `cd packages/integrations && pnpm vitest run src/__tests__/clockify-sync.test.ts` | Wave 0 |
| TIME-04 | Jira worklog fetch, OAuth token, entry mapping | unit | `cd packages/integrations && pnpm vitest run src/__tests__/jira-worklog-sync.test.ts` | Wave 0 |
| TIME-05 | Hours x rate vs invoice amount comparison | unit | `cd packages/api && pnpm vitest run src/services/__tests__/time-reconciliation.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/api && pnpm vitest run` (quick, <30s)
- **Per wave merge:** `pnpm -r test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/api/src/routers/__tests__/portal-time.test.ts` -- covers TIME-01
- [ ] `packages/api/src/routers/__tests__/time.test.ts` -- covers TIME-02
- [ ] `packages/integrations/src/__tests__/clockify-sync.test.ts` -- covers TIME-03
- [ ] `packages/integrations/src/__tests__/jira-worklog-sync.test.ts` -- covers TIME-04
- [ ] `packages/api/src/services/__tests__/time-reconciliation.test.ts` -- covers TIME-05

## Open Questions

1. **Clockify API Key Per-Contractor vs Per-Org**
   - What we know: Clockify uses API keys per user. Each contractor would need their own key or the org admin provides a shared workspace API key.
   - What's unclear: D-09 says "contractor or manager clicks sync." If per-contractor, each needs to provide their Clockify API key. If per-org, admin provides once.
   - Recommendation: Per-org connection (admin connects Clockify workspace), then map contractors to Clockify users via ExternalLink. This follows the existing integration pattern where admin connects and users are mapped.

2. **Jira Account ID Mapping**
   - What we know: Jira worklogs are keyed by `accountId`. Need to map contractor to their Jira accountId.
   - What's unclear: Whether to auto-discover via email match or require manual mapping.
   - Recommendation: Store Jira accountId in ExternalLink (entityType=CONTRACTOR, externalType=JIRA_USER). Admin or contractor provides mapping during first sync. Similar to Slack user mapping pattern in integration router.

3. **Contract Rate for Reconciliation**
   - What we know: Contract model has `rateValueGrosze` and `rateType` (PER_HOUR, PER_DAY, etc.). Reconciliation needs hourly rate.
   - What's unclear: How to handle PER_DAY rates (what's a "day" in hours?) and MONTHLY_FIXED rates.
   - Recommendation: Only compute reconciliation for PER_HOUR contracts. For PER_DAY, allow org to set "hours per day" in settings (default 8). For MONTHLY_FIXED, skip reconciliation (expected amount is the fixed monthly rate regardless of hours).

## Sources

### Primary (HIGH confidence)
- Clockify API docs (https://docs.clockify.me/) -- endpoint structure, auth, pagination, regional URLs
- Atlassian Jira OAuth 2.0 3LO docs (https://developer.atlassian.com/cloud/jira/platform/oauth-2-3lo-apps/) -- authorization URL, token exchange, cloud ID discovery
- Atlassian Jira REST API v3 worklog group (https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-worklogs/)
- Existing codebase: portal-auth.ts, portal.ts, integration.ts, ksef.ts, invoice-matching.ts, navigation.ts, portal-top-bar.tsx -- verified patterns

### Secondary (MEDIUM confidence)
- Atlassian community posts on worklog JQL patterns (https://community.atlassian.com/t5/Jira-questions/How-to-get-user-worklog-per-person-using-Jira-Rest-Api/qaq-p/1076652)
- Clockify community on date filtering (https://forum.clockify.me/t/start-parameter-for-time-entries-endpoint-not-utc/776)

### Tertiary (LOW confidence)
- None -- all findings verified against official docs or existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in workspace, no new dependencies
- Architecture: HIGH -- follows established patterns (portal router, integration adapter, service layer)
- Pitfalls: HIGH -- verified against official API docs and existing codebase patterns
- External APIs (Clockify/Jira): MEDIUM -- endpoint details verified from official docs, but pagination edge cases need runtime validation

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable domain, APIs unlikely to change in 30 days)
