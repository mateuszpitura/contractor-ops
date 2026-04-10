# Coverage priority roadmap (deep)

> **Companion:** [`TEST-COVERAGE-PLAN.md`](./TEST-COVERAGE-PLAN.md) (inventory, WS tables, crucial checklist).  
> **Honest metric:** root `pnpm test:coverage` with `coverage.include` on product `src`.  
> **Goal:** order work **HIGH → LOW** and **track status** here as items close.

---

## Progress snapshot

| Field | Value |
|-------|--------|
| **Last honest coverage (lines)** | **~37.31%** (merged `coverage.include` denominator; see Progress log footnote) |
| **Last honest coverage (statements)** | **~36.57%** |
| **As of (date)** | 2026-04-05 |
| **Current phase (§7)** | **D** + **P2** (adapter depth + web breadth — see Progress log) |
| **Status convention** | `Todo` · `In progress` · `Done` · `Waived` (waiver = explicit accepted risk, keep row visible) |

**Maintenance:** After each merged batch, update the **Progress log** (below). Refresh this snapshot when a **phase completes** or monthly.

---

## Progress log

| Date | Phase / item | What changed | Honest lines % (opt.) |
|------|----------------|--------------|----------------------|
| 2026-04-04 | Doc structure | Roadmap converted to tracked checklist + log; baseline tests added (see rows below) | — |
| 2026-04-04 | P1.3 + P2 + P1.4 | Router branches (`report` pagination, `notification` empty id, `workflow` evaluateCondition default); web `step-financial`, `ksef-badge`; `packages/db` `createMissingDatabaseUrlProxy` test; `notificationMarkReadSchema` `.min(1)`; root `test:coverage` now runs `turbo build` for dist packages first | **34.96%** lines |
| 2026-04-05 | P0 §3.3 + P1.1 | **`observabilityMiddleware`:** Sentry span name `trpc/{path}`, metrics ok/error — [`packages/api/src/middleware/__tests__/observability.test.ts`](../../packages/api/src/middleware/__tests__/observability.test.ts). **Adapters:** Linear refresh/env errors; Notion exchange/refresh `!ok`; Clockify health when latest sync FAILED; Google Calendar / Outlook / Confluence refresh `!ok` — tests under `packages/integrations/src/adapters/__tests__/` | **34.95%** lines |
| 2026-04-05 | P1.1 (depth) | **OAuth exchange `!ok`:** Google Calendar, Outlook, Confluence. **`createEvent` `!ok`:** Google + Outlook. **Empty 200 JSON** on `createEvent` (documents undefined ids). **`observability`:** span attributes `user.id` / `org.id` when session present | **34.93%** lines |
| 2026-04-05 | P1.1 (Graph + Slack) | **Google Calendar:** `updateEvent` / `deleteEvent` `!ok`. **Outlook:** `updateEvent` happy path + `update`/`delete` `!ok`. **Slack:** `verifyWebhookSignature` wrong HMAC (same length) + valid sig but malformed payload JSON → `eventType: unknown` — [`slack-adapter.test.ts`](../../packages/integrations/src/adapters/__tests__/slack-adapter.test.ts) | **35.03%** lines |
| 2026-04-05 | P1.1 (Confluence + webhooks) | **Confluence:** `discoverCloudId` `!ok` + empty resources; `searchPages` `!ok`; `refreshToken` without refresh token. **Jira:** `verifyWebhookSignature` — no secret + bad JSON; secret but missing hub sig; non-sha256 method; valid HMAC + non-JSON body. **Linear:** no webhook secret; valid sig without `type.action` pair | **35.07%** lines |
| 2026-04-05 | P1.1 (discover + search) | **Linear** `discoverWorkspace` — HTTP `!ok`. **Notion** `searchPages` — `!ok`. **Confluence** `exchangeCodeForTokens` — missing `CONFLUENCE_CLIENT_*` env | **35.09%** lines |
| 2026-04-05 | P1.1 + P2 | **Linear** `discoverWorkspace` — 200 + GraphQL `errors` only (no `data`). **Notion** — `exchangeCodeForTokens` without env. **P2:** [`ksef-duplicate-banner.test.tsx`](../../apps/web/src/components/invoices/__tests__/ksef-duplicate-banner.test.tsx) | **35.19%** lines |
| 2026-04-05 | P2 | **`StatusChipBar`** — loading skeletons + `statusCounts` aggregation / chip click → [`status-chip-bar.test.tsx`](../../apps/web/src/components/invoices/__tests__/status-chip-bar.test.tsx) | **35.38%** lines |
| 2026-04-05 | P2 | **`InvoiceUploadArea`** — drop zone copy; PDF upload happy path (XHR + TRPC + OCR panel); `requestUpload` failure + **Retry** — [`invoice-upload-area.test.tsx`](../../apps/web/src/components/invoices/__tests__/invoice-upload-area.test.tsx) | **35.90%** lines |
| 2026-04-05 | P2 | **`InvoiceUploadArea`** (follow-up) — `ocr.retrigger` input (`extractionId`); retrigger **failure → `toast.error`** — same test file | **35.85%** lines |
| 2026-04-05 | P2 | **`InvoiceUploadArea`** — **`onOcrAccept`** + panel close on accept; **`handleOcrDiscard`** unmounts panel — [`invoice-upload-area.test.tsx`](../../apps/web/src/components/invoices/__tests__/invoice-upload-area.test.tsx) | **35.87%** lines |
| 2026-04-05 | P2 | **`InvoiceUploadArea`** — **Hide PDF / View PDF** toggle (`showPdfReview`) — same test file | **35.88%** lines |
| 2026-04-05 | P2 | **`InvoiceUploadArea`** — upload completes **bez OCR**, gdy presign zwraca **pusty `storageKey`** (`isPdfFile && storageKey`) — same test file | **35.88%** lines |
| 2026-04-05 | **P2 batch** | **Paczka (jedna iteracja):** §10 — zasada *batch coverage* (testy → jeden `test:coverage` → jedna aktualizacja logu). **`InvoiceUploadArea`:** R2 **PUT** `403` / **`onerror`** → Retry; **Retry** po błędzie PUT → pełny sukces. **`DataTablePagination`** — [`data-table-pagination.test.tsx`](../../apps/web/src/components/invoices/invoice-table/__tests__/data-table-pagination.test.tsx) (TanStack table harness, next/prev disabled). | **36.06%** lines |
| 2026-04-05 | **P2 batch** | **`DataTableToolbar`** — upload CTA, `isSearching` spinner, debounced search (fake timers, ≥2 / &lt;2 chars). **`DataTableFilters`** — licznik na triggerze, Clear all, usuwanie chipa, toggle checkbox w popover — [`data-table-toolbar.test.tsx`](../../apps/web/src/components/invoices/invoice-table/__tests__/data-table-toolbar.test.tsx), [`data-table-filters.test.tsx`](../../apps/web/src/components/invoices/invoice-table/__tests__/data-table-filters.test.tsx). | **36.27%** lines |
| 2026-04-05 | **P2 batch** | **Invoice table / panel / URL state:** [`columns.test.tsx`](../../apps/web/src/components/invoices/invoice-table/__tests__/columns.test.tsx) (TanStack row — contractor link, KSeF source, null contractor). [`invoice-side-panel.test.tsx`](../../apps/web/src/components/invoices/__tests__/invoice-side-panel.test.tsx) (open: number, amounts, contractor, **Open invoice**; Escape closes). [`use-invoice-filters.test.tsx`](../../apps/web/src/components/invoices/invoice-table/__tests__/use-invoice-filters.test.tsx) (`nuqs` **`NuqsTestingAdapter`**, `page` / `search` / `setPage`). **Integrations:** [`ksef-api-client.test.ts`](../../packages/integrations/src/__tests__/ksef-api-client.test.ts) — session poll timeout: register `expect(…).rejects` **before** fake-timer loop (fixes Vitest unhandled rejection). | **36.75%** lines |
| 2026-04-05 | **P2 batch** | **`InvoiceDataTable`** — [`data-table.test.tsx`](../../apps/web/src/components/invoices/invoice-table/__tests__/data-table.test.tsx): mock `useQuery` + `NuqsTestingAdapter` — skeleton loading, row click → `onRowClick`, filtered vs default empty states, overdue row class. **`KsefMetadataSection`** — [`ksef-metadata-section.test.tsx`](../../apps/web/src/components/invoices/__tests__/ksef-metadata-section.test.tsx) (portal URL encoding, UPO conditional, copy buttons). **`InvoiceDetailLayout`** — [`invoice-detail-layout.test.tsx`](../../apps/web/src/components/invoices/invoice-detail/__tests__/invoice-detail-layout.test.tsx) (`object` vs no-PDF copy). | **37.08%** lines |
| 2026-04-05 | **P2** | **`InvoiceMetadataForm`** — [`invoice-metadata-form.test.tsx`](../../apps/web/src/components/invoices/invoice-detail/__tests__/invoice-metadata-form.test.tsx): `useMutation` mock with **rotating `% 3`** return (hooks run every render); RECEIVED vs read-only; Zod empty number; save draft payload; submit chains `update` → `submitForMatching`; void menu via `[data-slot="dropdown-menu-item"]` + AlertDialog. *Honest % row:* prior **37.08%** lines + **45** newly covered lines in `invoice-metadata-form.tsx` → **~37.31%** (7346/19689); stmts **~36.57%**. *Note:* root **`pnpm test:coverage`** did not finish green here (unrelated **`apps/web`** failures outside `components/invoices`); refresh snapshot on next full green run. | **~37.31%** lines |
| 2026-04-05 | **P1.1 + P2 (batch, no coverage run)** | **Integrations:** `ResendAdapter` (bracket `to`, missing `type`, empty `to`, non-hub domain) — [`resend-adapter.test.ts`](../../packages/integrations/src/adapters/__tests__/resend-adapter.test.ts). **`GoogleCalendarAdapter`:** OAuth env missing; refresh without `refreshToken`; **`createEvent`** `attendees` in body — [`google-calendar-adapter.test.ts`](../../packages/integrations/src/adapters/__tests__/google-calendar-adapter.test.ts). **`OutlookCalendarAdapter`:** OAuth env missing; refresh without `refreshToken`; **`createEvent`** `bodyHtml` + `attendees` (Graph shape) — [`outlook-calendar-adapter.test.ts`](../../packages/integrations/src/adapters/__tests__/outlook-calendar-adapter.test.ts). **`NotionAdapter`:** refresh env / missing `refreshToken`; **`searchPages`** `Untitled` fallback — [`notion-adapter.test.ts`](../../packages/integrations/src/adapters/__tests__/notion-adapter.test.ts). **Web:** `SpendTeamReport` loading; **`SpendChart`** range + EUR; **`DeadlinesWidget`** overdue + invoice link; **`ApprovalQueueWidget`** `sellerName` fallback, invoice vs `/approvals` `href`, SLA **Breached** — [`spend-team-report.test.tsx`](../../apps/web/src/components/reports/__tests__/spend-team-report.test.tsx), [`spend-chart.test.tsx`](../../apps/web/src/components/dashboard/__tests__/spend-chart.test.tsx), [`deadlines-widget.test.tsx`](../../apps/web/src/components/dashboard/__tests__/deadlines-widget.test.tsx), [`approval-queue-widget.test.tsx`](../../apps/web/src/components/dashboard/__tests__/approval-queue-widget.test.tsx). **`ConfluenceAdapter`:** `refreshToken` env + **undefined** `refreshToken` — [`confluence-adapter.test.ts`](../../packages/integrations/src/adapters/__tests__/confluence-adapter.test.ts). **`ActivityFeed`:** audit `href`, **System** actor, **INVOICE** link, **Today** — [`activity-feed.test.tsx`](../../apps/web/src/components/dashboard/__tests__/activity-feed.test.tsx). **`ClockifyAdapter`:** non-**CONNECTED** connection → **DISCONNECTED** — [`clockify-adapter.test.ts`](../../packages/integrations/src/adapters/__tests__/clockify-adapter.test.ts). **`DateRangeFilter`:** **Last 6 months** / **Last 3 months** presets — [`date-range-filter.test.tsx`](../../apps/web/src/components/reports/__tests__/date-range-filter.test.tsx). *Honest % deferred* (run **`pnpm test:coverage`** when green). | — |
| 2026-04-05 | **P2** | **`DateRangeFilter` — Custom:** no **`onDateChange`** on open; **Custom** label replaced by **formatted range** when dates set; **range** pick in calendar → **`onDateChange`** + popover closes — [`date-range-filter.test.tsx`](../../apps/web/src/components/reports/__tests__/date-range-filter.test.tsx). *Honest % deferred.* | — |
| 2026-04-05 | **P1.1** | **`GoogleWorkspaceAdapter`** (previously untested): **`getOAuthConfig`** Admin SDK scopes + callback; **`exchangeCodeForTokens`** / **`refreshToken`** env + **`!ok`**; **`listAllDirectoryUsers`** pagination + **suspended** filter + Directory **`!ok`**; **`listUserGroups`** **404 → []**, pagination, non-404 **`!ok`**; **`getHealthStatus`** **DISCONNECTED** / **REAUTH_REQUIRED** / sync **FAILED** / healthy — [`google-workspace-adapter.test.ts`](../../packages/integrations/src/adapters/__tests__/google-workspace-adapter.test.ts). *Honest % deferred.* | — |
| 2026-04-05 | **P2** | **Reports chrome:** **`ExportButtons`** — **`isExporting`** → two **`.animate-spin`** loaders; **`DrillDownBreadcrumb`** — **`onClear`** via **All** breadcrumb **`button`** (not only **Clear filter**) — [`export-buttons.test.tsx`](../../apps/web/src/components/reports/__tests__/export-buttons.test.tsx), [`drill-down-breadcrumb.test.tsx`](../../apps/web/src/components/reports/__tests__/drill-down-breadcrumb.test.tsx). *Honest % deferred.* | — |
| 2026-04-05 | **P2** | **Reports:** **`ReportChart`** — **`bar-horizontal`** **`onSegmentClick`** via **Bar** click (Recharts mock passes payload); **`pie`** branch with **array** rows (`name` / `id`) + **Cell** count — [`report-chart.test.tsx`](../../apps/web/src/components/reports/__tests__/report-chart.test.tsx). **`ReportSidebar`** — desktop **active** row asserts **`border-primary`** + **`bg-primary/5`** — [`report-sidebar.test.tsx`](../../apps/web/src/components/reports/__tests__/report-sidebar.test.tsx). *Honest % deferred.* | — |
| 2026-04-05 | **P2** | **`ReportTable`** — **`isFetching` + !`isLoading`** refetch overlay (**`Loader2`** / **`z-10`**); no overlay when **`isLoading`** wins; **sort** header click → **`onSortChange`**; empty default title **No data** — [`report-table.test.tsx`](../../apps/web/src/components/reports/__tests__/report-table.test.tsx). *Honest % deferred.* | — |
| 2026-04-05 | **P2** | **Report screens:** **`SpendContractorReport`** / **`ComplianceGapsReport`** — **`useQuery`** call order: **table** `isLoading` while **chart** settled; **`ExpiringContractsReport`** — empty state (`emptyExpiringContracts`) + same loading split; **`ReportTable`** mock extended for empty — [`spend-contractor-report.test.tsx`](../../apps/web/src/components/reports/__tests__/spend-contractor-report.test.tsx), [`compliance-gaps-report.test.tsx`](../../apps/web/src/components/reports/__tests__/compliance-gaps-report.test.tsx), [`expiring-contracts-report.test.tsx`](../../apps/web/src/components/reports/__tests__/expiring-contracts-report.test.tsx). *Honest % deferred.* | — |
| 2026-04-05 | **P2** | **`OverdueInvoicesReport`** — **`isLoading`** → table skeleton; empty shows **`emptyOverdueInvoices`**. **`SpendTeamReport`** — **`ReportChart`** mock respects **`isLoading`**; **chart** loading while **table** has rows — [`overdue-invoices-report.test.tsx`](../../apps/web/src/components/reports/__tests__/overdue-invoices-report.test.tsx), [`spend-team-report.test.tsx`](../../apps/web/src/components/reports/__tests__/spend-team-report.test.tsx). *Honest % deferred.* | — |
| 2026-04-05 | **P3 + P1.1** | **`apps/web` `motion.ts`:** **`springs`** / **`stagger`** / **`fadeUp`** / **`fadeIn`** / **`scaleIn`** / **`slideLeft`**/**`slideRight`** shape — [`motion.test.ts`](../../apps/web/src/lib/__tests__/motion.test.ts). **`BaseAdapter`:** minimal subclass has **no** optional method implementations — [`base-adapter.test.ts`](../../packages/integrations/src/adapters/__tests__/base-adapter.test.ts). *Honest % deferred.* | — |
| 2026-04-05 | **P0-adjacent** | **Portal API:** **`POST /api/portal/clear-session`** — **`deletePortalSession`** rejection → still **200** + cookie cleared; **`POST /api/portal/set-session`** — malformed JSON → **500** + **`Failed to set session`** — [`clear-session/.../route.test.ts`](../../apps/web/src/app/api/portal/clear-session/__tests__/route.test.ts), [`set-session/.../route.test.ts`](../../apps/web/src/app/api/portal/set-session/__tests__/route.test.ts). *Honest % deferred.* | — |

---

## 1. How to interpret “low” honest coverage

**You do not have “almost no tests.”** Crucial security, money, and compliance paths are largely covered (see **Crucial Paths** in `TEST-COVERAGE-PLAN.md`). Honest % is low because `apps/web/src` is large, many modules are never imported in unit tests (0% in denominator), and some integration adapters are huge.

---

## 2. Priority tiers (definitions)

| Tier | Meaning | Success looks like |
|------|---------|---------------------|
| **P0 — Critical** | Regressions on security / money / legal / tenant; known partials | Crucial checklist green; each §3.2 row **Done** or **Waived** |
| **P1 — High** | Backend + integrations ROI | Honest % up; fewer 0% files in `packages/api` + `packages/integrations` |
| **P2 — Medium** | `apps/web` breadth | More screens / hooks covered |
| **P3 — Low** | Barrels, trivial exports | Policy explicit; cleanup when touching files |

---

## 3. P0 — Critical (do first)

### 3.1 Regression discipline (non-negotiable)

- **Keep** root `pnpm test` / CI green on every merge. Full **Crucial Paths** checklist: [`TEST-COVERAGE-PLAN.md`](./TEST-COVERAGE-PLAN.md) § Crucial Paths.
- **Do not** weaken mocks on crucial flows without replacing assertions (**Stripe**, **portal auth**, **tenant**, **billing**, **GDPR export shape**).

### 3.2 Close or sign off “known partials”

| Area | What “done” means | Suggested test type | Status | Notes (PR / waiver) |
|------|-------------------|---------------------|--------|---------------------|
| **KSeF** | Multi-step `processKsefSync` + failures / `terminateSession` / sync log | Service test | **Done** | [`packages/api/src/services/__tests__/ksef-sync.test.ts`](../../packages/api/src/services/__tests__/ksef-sync.test.ts) |
| **Data purge cron** | R2 `deleteObject` path when docs have `storageKey` | Route test | **Done** | [`apps/web/src/app/api/cron/data-purge/__tests__/route.test.ts`](../../apps/web/src/app/api/cron/data-purge/__tests__/route.test.ts) |
| **Teams bot** | `reject_invoice` adaptive invoke + existing approve/validation paths | Unit | **Done** | [`packages/api/src/services/teams/__tests__/teams-bot-handler.test.ts`](../../packages/api/src/services/teams/__tests__/teams-bot-handler.test.ts) |
| **Slack interactivity** | `reject_invoice` `block_actions` → `views.open` | Route test | **Done** | [`apps/web/src/app/api/slack/interactivity/__tests__/route.test.ts`](../../apps/web/src/app/api/slack/interactivity/__tests__/route.test.ts) |
| **Resend inbound** | Svix-signed E2E | Playwright + env | **Waived** | Optional `RUN_RESEND_E2E`; unit route tests remain primary — document only |

**Exit:** each row **Done** or **Waived** (this table satisfies exit).

### 3.3 Observability / ops code used in prod

| File / area | Risk | Action | Status |
|-------------|------|--------|--------|
| `packages/api/src/services/cron-monitor.ts` | Silent cron failures | Covered by **P1.2** tests | **Done** |
| `packages/api/src/middleware/observability.ts` | Span names for new routers | Unit: span `trpc/{path}`, metrics, error path, `user.id` / `org.id` on span when session present | **Done** — [`observability.test.ts`](../../packages/api/src/middleware/__tests__/observability.test.ts) |

---

## 4. P1 — High (backend & integrations, ROI)

### 4.1 Integration adapters (`packages/integrations/src/adapters`)

Prioritize by customer impact × weak coverage. Use MSW / `fetch` mocks like [`linear-adapter.test.ts`](../../packages/integrations/src/adapters/__tests__/linear-adapter.test.ts).

- [x] **jira-adapter.ts** — OAuth exchange + refresh errors + `verifyWebhookSignature` (no secret / secret + hub sig / `md5=` rejection / valid HMAC + non-JSON) — [`jira-adapter.test.ts`](../../packages/integrations/src/adapters/__tests__/jira-adapter.test.ts)
- [x] **teams-adapter.ts** — OAuth exchange + refresh (mock `decryptCredentials`) — [`teams-adapter.test.ts`](../../packages/integrations/src/adapters/__tests__/teams-adapter.test.ts)
- [x] **linear-adapter.ts** — refresh + **`discoverWorkspace`** (`HTTP !ok`, **GraphQL `errors`-only JSON**) + webhook branches — [`linear-adapter.test.ts`](../../packages/integrations/src/adapters/__tests__/linear-adapter.test.ts)
- [x] **notion-adapter.ts** — **exchange without env** + OAuth exchange + refresh `!ok` + **`searchPages` `!ok`** — [`notion-adapter.test.ts`](../../packages/integrations/src/adapters/__tests__/notion-adapter.test.ts)
- [x] **clockify-adapter.ts** — `getHealthStatus` ERROR when most recent sync log is FAILED — [`clockify-adapter.test.ts`](../../packages/integrations/src/adapters/__tests__/clockify-adapter.test.ts)
- [x] **base-adapter.ts** — already covered — [`base-adapter.test.ts`](../../packages/integrations/src/adapters/__tests__/base-adapter.test.ts)
- [x] **Google Calendar / Outlook / Confluence** — calendar CRUD + **Confluence** discovery/search/refresh/env (incl. **exchange without env**) — [`google-calendar-adapter.test.ts`](../../packages/integrations/src/adapters/__tests__/google-calendar-adapter.test.ts), [`outlook-calendar-adapter.test.ts`](../../packages/integrations/src/adapters/__tests__/outlook-calendar-adapter.test.ts), [`confluence-adapter.test.ts`](../../packages/integrations/src/adapters/__tests__/confluence-adapter.test.ts)
- [x] **slack-adapter.ts** — `verifyWebhookSignature` extended (bad digest, parse fallback) — [`slack-adapter.test.ts`](../../packages/integrations/src/adapters/__tests__/slack-adapter.test.ts)
- [ ] **Further adapter edge cases** — explicit handling for GraphQL `errors` in product code (optional), OAuth env sweeps on remaining adapters, MSW-heavy E2E-style flows — incremental when touching integrations

### 4.2 API services — dedicated tests

| Module | Notes | Status | Notes |
|--------|--------|--------|-------|
| `cron-monitor.ts` | `withCronMonitor` run/complete/fail + no-op without API key | **Done** | `packages/api/src/services/__tests__/cron-monitor.test.ts` |
| `google-workspace-sync-orchestrator.ts` | Orchestration + QStash | **Done** | `packages/api/src/services/__tests__/google-workspace-sync-orchestrator.test.ts` |
| `teams/teams-graph-client.ts` | Graph `fetch` | **Done** | `packages/api/src/services/teams/__tests__/teams-graph-client.test.ts` |
| `calendar-event-service.ts` | Glue logic | **Done** | `packages/api/src/services/__tests__/calendar-event-service.test.ts` |
| `calendar-deadline-sync.ts` | Glue logic | **Done** | `packages/api/src/services/__tests__/calendar-deadline-sync.test.ts` |
| `linear-status-mapping.ts` | Pure mapping | **Done** | `packages/api/src/services/__tests__/linear-status-mapping.test.ts` |
| `time-reconciliation.ts` | Time edge cases | **Done** | `packages/api/src/services/__tests__/time-reconciliation.test.ts` |
| `email-templates.ts` | Strings / no PII leak in sample | **Done** | `packages/api/src/services/__tests__/email-templates.test.ts` |
| `messaging/slack-messaging-provider.ts` | Align with provider tests | **Done** | `packages/api/src/services/messaging/__tests__/slack-messaging-provider.test.ts` |
| `r2.ts` | `generateStorageKey` + presign uses env | **Done** | `packages/api/src/services/__tests__/r2.test.ts` |

### 4.3 API routers — branch coverage

| Router | Status | Notes |
|--------|--------|-------|
| `teams` | **Done** | `teams.test.ts` (e.g. `getTeams` NOT_FOUND when no connection) |
| `equipment` | **Done** | `equipment.test.ts` NOT_FOUND / guard |
| `report` | **Done** | `report.test.ts` — `spendByContractor` rejects `page < 1` |
| `workflow` | **Done** | `workflow.test.ts` — `evaluateCondition` default branch for unknown operator |
| `notification` | **Done** | `notification.test.ts` — `markRead` rejects empty `notificationId`; validator `min(1)` |

### 4.4 DB package (`packages/db/src`)

- [x] **`client.ts`** — `createMissingDatabaseUrlProxy()` throws on any property access — [`packages/db/src/__tests__/client.test.ts`](../../packages/db/src/__tests__/client.test.ts) (singleton `prisma` untouched)
- [x] **`rls.ts`** — `withRlsSession` emits `set_config` — [`packages/db/src/__tests__/rls.test.ts`](../../packages/db/src/__tests__/rls.test.ts)

---

## 5. P2 — Medium (`apps/web` breadth)

### 5.1 Tier 1 — user-money-visible flows

| Flow | Example locations | Minimum assertions | Status | Notes |
|------|-----------------|--------------------|--------|-------|
| **Contract wizard** | `components/contracts/contract-wizard/*` | Steps / validation | **Done** | `contract-wizard/__tests__/step-details.test.tsx`, `step-financial.test.tsx` |
| **Invoice** | `components/invoices/*` | Detail / badges / KSeF dup / metadata / layout / status chips / upload / full table + nuqs / side panel / metadata form | **Done** | `ksef-badge`, `ksef-metadata-section.test.tsx`, `ksef-duplicate-banner`, `status-chip-bar`, `invoice-upload-area`, `invoice-table/__tests__/{data-table,data-table-pagination,data-table-toolbar,data-table-filters,columns,use-invoice-filters}`, `invoice-side-panel.test.tsx`, `invoice-detail/__tests__/match-card.test.tsx`, `invoice-detail/__tests__/duplicate-warning.test.tsx`, `invoice-detail/__tests__/invoice-detail-layout.test.tsx`, `invoice-detail/__tests__/invoice-metadata-form.test.tsx` |
| **Payment run** | `components/payments/*` | (existing wizard tests) | **Done** | Covered by `new-payment-run-dialog` + roadmap batch |
| **Org / billing settings** | settings forms | Save error path | **Done** | `settings/__tests__/settings-section.test.tsx` |
| **Time / approvals** | `components/time/*`, `approvals/*` | Deviation / submit | **Done** | `approvals/__tests__/approval-actions-bar.test.tsx` |

### 5.2 Tier 2 — component density

- [x] **equipment** — `components/equipment/__tests__/equipment-empty-state.test.tsx`
- [x] **documents** — `components/documents/__tests__/document-type-icon.test.tsx`
- [x] **notifications** — `components/notifications/__tests__/notification-bell.test.tsx`

### 5.3 App Router API routes

- Incremental: Zod 400 / idempotency when touching routes — track in Progress log per PR.

### 5.4 Hooks & lib (non-trivial)

- Add per hook when refactored; **optional** smoke for nuqs-backed list hooks when behavior is non-obvious — e.g. [`use-invoice-filters.test.tsx`](../../apps/web/src/components/invoices/invoice-table/__tests__/use-invoice-filters.test.tsx) with `NuqsTestingAdapter`.

---

## 6. P3 — Low

**Policy (2026-04-04):** Do **not** exclude barrel `index.ts` files from honest `coverage.include` — a **0% barrel** is accurate signal. Prefer **smoke import** tests only when a barrel re-exports side-effectful modules.

- **instrumentation / Sentry:** test only if non-trivial branches; otherwise out of scope for Vitest honest run.
- **Branch sweeps:** only when fixing bugs in the same file.

**Status:** **Done** (policy recorded).

---

## 7. Suggested execution phases

| Phase | Focus | Outcome | Status |
|-------|--------|---------|--------|
| **A** | P0 partials + P1.1 Jira/Teams adapters | Integration trust | **Done** |
| **B** | P1.2 services + P1.3 routers + P1.4 db | Backend honest % up | **Done** |
| **C** | P2 Tier 1 + Tier 2 samples | Web honest % up | **Done** |
| **D** | P3 policy | Cleanup | **Done** |

---

## 8. Milestones (honest merged `lines`)

| Milestone | Approx. target | Main driver | Last measured |
|-----------|----------------|-------------|---------------|
| M1 | **40%** | P0 + P1 adapters | **~37.31%** lines (2026-04-05, see Progress log footnote) — not yet |
| M2 | **50%** | P1 services + routers | — |
| M3 | **60%** | P2 web at scale | — |
| M4 | **80%** | Long-term | — |

---

## 9. Mapping to `TEST-COVERAGE-PLAN.md` work streams

| This roadmap | WS / section |
|--------------|----------------|
| P0 | Crucial Paths + WS-5 + WS-4 orchestrators |
| P1.1–P1.2 | WS-2 / WS-4 / WS-9 / WS-10 |
| P1.3 | WS-3 |
| P2 | WS-11 + WS-5 depth |
| P3 | Exclusions policy |

---

## 10. Agent / human checklist per PR

1. Production logic → test in same PR.  
2. Run `pnpm test` (or scoped).  
3. Large surface → `pnpm test:coverage` + note honest delta (optional).  
4. Behavioral assertions over dump snapshots for React.  
5. **Coverage batches:** group several related tests in one change set, then run **`pnpm test:coverage` once** and refresh the **Progress log / snapshot in one pass** (avoid per-test doc churn).

---

*See **Progress snapshot** and **Progress log** at top for freshness; run `pnpm test:coverage` to refresh numbers.*
