# Test Coverage Implementation Plan

> Generated: 2026-04-04 | Status: Reference document for future implementation agents  
> **Last doc update:** 2026-04-05 — **P2:** **`InvoiceMetadataForm`** tests; honest % adjusted from last full snapshot + file delta (see **Progress log** footnote on full `test:coverage`).  
> **Deep priority order (P0→P3):** [COVERAGE-PRIORITY-ROADMAP.md](./COVERAGE-PRIORITY-ROADMAP.md)  
> Keep **Progress log**, **Current State**, **WS-5/WS-3/WS-11**, and **Coverage Math** in sync when adding tests.

## Final status (after two implementation batches — 2026-04-04)

**Batch A — structured plan (`test_coverage_roadmap`):** consistency fixes for **Crucial Paths** checklists, measurement guidance, named follow-ups (**Google Workspace** Zod / **portal-branding**), WS-3/4/5 depth priorities, WS-8/11 patterns, quality rules (`no it.todo`, no tautological mocks).

**Batch B — “100% roadmap” (`complete_test_roadmap`):** **Jira** + **Linear** router procedure coverage; **e-sign** URL/completion + download failure + **MT940** golden in **bank-statement**; **cron/reminders** focused tests + **Slack** `approve_invoice` + gated **Playwright** `e2e/integration/resend-inbound-smoke` (`RUN_RESEND_E2E=1`); **use-density** / **use-mobile**; **`@contractor-ops/logger`** package **Vitest** + factory binding tests; **WS-11** slices (contract wizard `step-details`, `new-payment-run-dialog`, `duplicate-warning`, `org-settings-form`, `login-form`, `use-template-form`, Tier-2: `linear-issue-chip`, `deviation-flag`, `tab-placeholder`, `plan-card`); **GDPR** export **`select`** checklist; **approval** `dispatch` + **`syncPaymentDueDeadline`**; **portal-profile** CONFLICT propagation; **`packages/api` `tsc` green**; **`turbo.json`** `test` → **`dependsOn: ["^build"]`**; Prisma/notification enum alignments for equipment returns + Teams.

**Gate:** Root **`pnpm test`** was green after these changes. **Not claimed:** literal 80% of every component file (~230+ modules in WS-11 math) — Tier 1/2 are **started + representative coverage**, not exhaustive per-folder. **KSeF** full multi-step sync remains **integration/E2E** territory vs router + **`ksef-sync.test.ts`**. **Resend** Playwright spec is **reachability/smoke** (e.g. 401 without Svix), not production Svix+E2E.

---

## Measured coverage (Vitest `@vitest/coverage-v8`, 2026-04-05 — post `InvoiceMetadataForm` batch; full merge pending green `pnpm test:coverage`)

### Merged monorepo (single report)

Root **`vitest.config.ts`** defines **`test.projects`** for `apps/web` + product `packages/*` (**not** `@contractor-ops/test-utils` — MSW/fixtures are test-only; that package still runs under **`pnpm test`** / **turbo**). **`pnpm test:coverage`** merges coverage (HTML + `coverage/` at repo root).

**Merged “honest” summary** (`coverage.include` = all product **`src`** under those apps/packages; **uncounted** = never imported during tests → **0%** for that file):

| Metric | Value |
|--------|------:|
| **Statements** | **~36.57%** (7553 / 20652) |
| **Branches** | **~26.87%** (3835 / 14273) |
| **Functions** | **~25.67%** (1330 / 5181) |
| **Lines** | **~37.31%** (7346 / 19689) |

*Derivation (2026-04-05):* previous merged totals (**37.08%** lines / **36.34%** stmts) plus instrumented deltas for newly covered `invoice-metadata-form.tsx` (Vitest: **+45** lines, **+46** stmts, **+84** branches, **+17** funcs). Re-run root **`pnpm test:coverage`** when the full **`apps/web`** suite is green to replace approximations.

**Previously ~71% merged** used Vitest’s default denominator (**mostly files touched** during the run). That answers “how well covered is the code we exercised?” — not “how much of the repo’s `src` is covered?”

**Prisma generated client** is excluded via **`coverage.exclude`:** `**/generated/**`, `**/.prisma/**` (and `packages/db` for standalone). **`packages/test-utils/**`** excluded. **Test code** excluded: `**/__tests__/**`, `**/*.test.{ts,tsx}`, `apps/web/src/test/**`, `**/*.d.ts`.

### Per-package (isolated `pnpm --filter … exec vitest run --coverage`)

| Package | % Stmts | % Branch | % Funcs | % Lines |
|---------|--------:|---------:|--------:|--------:|
| `@contractor-ops/api` | 69.28 | 53.42 | 70.22 | 69.77 |
| `@contractor-ops/web` | 75.63 | 66.22 | 70.55 | 76.93 |
| `@contractor-ops/validators` | 97.77 | 76.59 | 83.33 | 97.74 |
| `@contractor-ops/integrations` | 68.99 | 52.17 | 70.00 | 69.66 |
| `@contractor-ops/logger` | 78.57 | 53.33 | 100.00 | 78.57 |
| `@contractor-ops/auth` | 100.00 | 100.00 | 100.00 | 100.00 |
| `@contractor-ops/db` | 53.24 | 42.64 | 66.66 | 55.40 |

**How to reproduce:** merged honest — **`pnpm test:coverage`** from repo root. Per-package — `pnpm --filter @contractor-ops/<pkg> exec vitest run --coverage` — **`All files`** uses the **narrower** denominator (mostly executed modules), so those % are **higher** than merged honest.

**Per-package table:** isolated runs **without** full-repo `coverage.include`; barrel files (e.g. `validators/src/index.ts`) are often **outside** the denominator unless imported.

**`@contractor-ops/db`:** With **`packages/db/generated/**`** excluded, numbers reflect **`src/*.ts`** only (tenant/RLS/soft-delete, etc.), not the generated Prisma bundle.

### Where we actually are (realistically)

- **Crucial paths** (middleware, auth/RBAC, Stripe, billing, bank crypto, GDPR baseline, portal magic link, key crons, many routers/services): **strong unit/route coverage** — see checklists above; this is the highest-value layer for regressions.
- **Headline %:** **`api`** and **`integrations`** are **still below** the doc’s **80% statement** goal; **`web`** is closer on statements/lines but **not** at 80% either. **Branches** lag everywhere (often ~52–66% except validators) — conditional and error paths still under-tested.
- **`validators`** and **`auth`** are effectively **done** for coverage; **`logger`** is **good** on statements, thinner on branches.
- **WS-11 (React):** dozens of component tests exist, but **not** “every screen / every hook” — the **~120 component** inventory in **Coverage Math** is still mostly **gap**; growth is **incremental per PR**, not closed out.
- **E2E / integration:** Resend Playwright is **optional smoke**; KSeF full sync, live OAuth, Svix-signed inbound, etc. remain **outside** these Vitest % numbers.

---

## Progress log (keep updated when a phase finishes)

| Date | Phase | What was completed |
|------|--------|-------------------|
| 2026-04-05 | **Roadmap P2 (`InvoiceMetadataForm`)** | **`invoice-metadata-form.test.tsx`** — RECEIVED vs read-only; walidacja numeru; **Save draft** → `invoice.update`; **Submit for matching** → `update` + `onSuccess` → `submitForMatching`; **Void** (menu item + AlertDialog). Mock `useMutation`: rotacja `% 3` (każdy render). Szacunkowe honest **~37.31%** lines — [COVERAGE-PRIORITY-ROADMAP.md](./COVERAGE-PRIORITY-ROADMAP.md) (pełny `test:coverage` czeka na zielony cały `apps/web`). |
| 2026-04-05 | **Roadmap P2 (batch: invoice data-table + KSeF metadata + detail layout)** | **`data-table.test.tsx`** — mock `useQuery`, `NuqsTestingAdapter`: skeleton, `onRowClick`, empty / filtered empty, overdue row, empty CTA w komórce (nie toolbar). **`ksef-metadata-section.test.tsx`** — link MF, UPO warunkowe, copy. **`invoice-detail-layout.test.tsx`** — `object` + brak PDF. Honest **~37.08%** lines / **~36.34%** stmts — [COVERAGE-PRIORITY-ROADMAP.md](./COVERAGE-PRIORITY-ROADMAP.md). |
| 2026-04-05 | **Roadmap P2 (batch: invoice columns + side panel + nuqs)** | **`columns.test.tsx`** — wiersz tabeli (link kontrahenta, KSeF, brak kontrahenta). **`invoice-side-panel.test.tsx`** — stan otwarty + Escape. **`use-invoice-filters.test.tsx`** — `NuqsTestingAdapter`, `page` / `search`. **`ksef-api-client.test.ts`** — brak unhandled rejection (wczesny `expect().rejects`). Honest **~36.75%** lines / **~36.03%** stmts — [COVERAGE-PRIORITY-ROADMAP.md](./COVERAGE-PRIORITY-ROADMAP.md). |
| 2026-04-05 | **Roadmap P2 (batch: invoice toolbar + filters)** | **`data-table-toolbar.test.tsx`** — upload CTA, `isSearching`, debounced search (fake timers). **`data-table-filters.test.tsx`** — licznik filtrów, Clear all, remove chip, toggle w popover. Honest **~36.27%** lines / **~35.56%** stmts — [COVERAGE-PRIORITY-ROADMAP.md](./COVERAGE-PRIORITY-ROADMAP.md). |
| 2026-04-05 | **Roadmap P2 (batch: upload XHR + invoice pagination)** | Jedna iteracja: **`invoice-upload-area`** — PUT **403** / **`onerror`** → Retry; Retry → pełny upload + toast; roadmap §10 *batch coverage*. **`data-table-pagination.test.tsx`** — stronicowanie + disabled prev/next. Honest **~36.06%** lines / **~35.35%** stmts — [COVERAGE-PRIORITY-ROADMAP.md](./COVERAGE-PRIORITY-ROADMAP.md). |
| 2026-04-05 | **Roadmap P2 (`InvoiceUploadArea` full)** | `invoice-upload-area.test.tsx` — drop zone; PDF pipeline; presign + Retry; **`onOcrAccept`** + discard; **`ocr.retrigger`** + retrigger **`toast.error`**; **Hide PDF / View PDF**; **pusty `storageKey` → brak OCR** (toast success nadal). Honest **~35.88%** lines / **~35.16%** stmts — [COVERAGE-PRIORITY-ROADMAP.md](./COVERAGE-PRIORITY-ROADMAP.md). |
| 2026-04-05 | **Roadmap P2 (`StatusChipBar`)** | `status-chip-bar.test.tsx` — loading vs chips, `status:*` / `matchStatus:*` counts, `onStatusChange`. Honest **~35.38%** lines / **~34.66%** stmts — [COVERAGE-PRIORITY-ROADMAP.md](./COVERAGE-PRIORITY-ROADMAP.md). |
| 2026-04-05 | **Roadmap P1.1 + P2 (KSeF dup banner)** | Linear `discoverWorkspace` GraphQL errors-only body; Notion exchange without env; `KsefDuplicateBanner` render + void confirm. Honest **~35.19%** lines — [COVERAGE-PRIORITY-ROADMAP.md](./COVERAGE-PRIORITY-ROADMAP.md). |
| 2026-04-05 | **Roadmap P1.1 discover + search** | Linear `discoverWorkspace` `!ok`; Notion `searchPages` `!ok`; Confluence exchange without env. Honest **~35.09%** lines — [COVERAGE-PRIORITY-ROADMAP.md](./COVERAGE-PRIORITY-ROADMAP.md). |
| 2026-04-05 | **Roadmap P1.1 Confluence + webhooks** | Confluence `discoverCloudId`/`searchPages` failure paths + empty refresh; Jira/Linear `verifyWebhookSignature` extra branches. Honest **~35.07%** lines — [COVERAGE-PRIORITY-ROADMAP.md](./COVERAGE-PRIORITY-ROADMAP.md). |
| 2026-04-05 | **Roadmap P1.1 Graph + Slack** | Google/Outlook `updateEvent`/`deleteEvent` `!ok` + Outlook update happy path; Slack webhook signature wrong HMAC + malformed payload. Honest merged **~35.03%** lines — see [COVERAGE-PRIORITY-ROADMAP.md](./COVERAGE-PRIORITY-ROADMAP.md). |
| 2026-04-05 | **Roadmap P1.1 (depth)** | Same doc: OAuth exchange `!ok` (Google/Outlook/Confluence), `createEvent` `!ok` + empty JSON success; observability span `user.id` / `org.id`. Honest merged **~34.93%** lines. |
| 2026-04-05 | **Roadmap P1.1 + §3.3** | See [`.planning/COVERAGE-PRIORITY-ROADMAP.md`](./COVERAGE-PRIORITY-ROADMAP.md) Progress log: `observabilityMiddleware` tests; Linear/Notion/Clockify + Google Calendar/Outlook/Confluence refresh/exchange error branches. Honest merged **~34.95%** lines. |
| 2026-04-04 | **COVERAGE-PRIORITY-ROADMAP** | Living checklist + progress log in [`.planning/COVERAGE-PRIORITY-ROADMAP.md`](./COVERAGE-PRIORITY-ROADMAP.md); honest merged **34.96%** lines / **34.25%** stmts; `pnpm test:coverage` builds validators/auth/integrations/logger first; extra tests: `report`/`notification`/`workflow`, `step-financial`, `ksef-badge`, `db/client`, `r2` key semantics, `notificationMarkReadSchema.min(1)`. |
| 2026-04-04 | **Roadmap 100% batch** | **`jira.test.ts` / `linear.test.ts`:** procedure depth (mappings, task config, linked issues/activity, disconnect, Linear `teams` GraphQL). **WS-4:** `esign-url-and-completion.test.ts`, MT940 in `bank-statement.test.ts`, esign download failure. **WS-5:** `cron/reminders` dedup/rule mocks; Slack `approve_invoice`; Playwright gated `e2e/integration/resend-inbound-smoke.spec.ts` + `pnpm e2e:integration`. **WS-8:** `use-density` / `use-mobile`; `packages/logger` Vitest + factory bindings. **WS-11:** `step-details`, `new-payment-run-dialog`, `duplicate-warning`, `org-settings-form`, `login-form`, `use-template-form`; Tier-2 `linear-issue-chip`, `deviation-flag`, `tab-placeholder`, `plan-card`. **`gdpr.test.ts`** export `select` checklist; **`approval.test.ts`** `dispatch` + `syncPaymentDueDeadline`; **`portal-profile.test.ts`** CONFLICT. **Schema/API:** Prisma `EntityType` `USER`/`RETURN_REQUEST`, `ActorType` `CONTRACTOR`; equipment return notification types; Teams invoice by `resourceId`; exported Graph client types; **`packages/api` `tsc` green**; **`turbo test` → `^build`**. |
| 2026-04-04 | **Baseline + depth** | Vitest v8 totals: see **Measured coverage** (`api` **69.28%** stmts, `web` **75.63%**, … — full table). Root **`pnpm test`** green. **`ksef.test.ts`:** `connect` (NIP/token + happy path), `triggerSync` (NOT_FOUND + QStash `publishJSON`). **`jira.test.ts`:** `listProjects` (missing connection, missing `cloudId`, mocked Jira API map). **WS-8:** `apps/web/src/lib/__tests__/navigation.test.ts` (`navigationGroups` keys, permissions, `navigationItems` flatMap). **WS-11:** `page-header.test.tsx`, `dashboard-greeting.test.tsx`. **WS-5:** `resend-inbound` — PDF attachment path (mocked Resend receiving API + `fetch` + S3 `send` + Prisma create chain). *(Superseded: `turbo` `test` now uses **`dependsOn: ["^build"]`**.)* |
| 2026-04-04 | **Phase 1** | WS-1 middleware (7 files), WS-7 auth (`roles`, `permissions`) + DB (`tenant`, `soft-delete`, `rls`), WS-8 web: `mask-pii`, `use-api-error`, `use-permissions` + parity with `@contractor-ops/auth`. Vitest wired for `packages/auth`, `packages/db`. |
| 2026-04-04 | **Phase 2a** | WS-5 (HIGH): tests for `POST /api/webhooks/stripe`, `GET /api/oauth/[provider]/callback` (missing params + no adapter), `GET /api/cron/reminders` (cron auth). Error contract: `packages/api/src/__tests__/errors-i18n-parity.test.ts` + missing keys `CONTRACTOR_HAS_ACTIVE_WORKFLOWS`, `PAYMENT_MIXED_CURRENCIES` in `en.json` / `pl.json`. API Vitest: `pool: "forks"`; fixed `notification-service` test expectation vs `getOrCreatePreferences` create payload. |
| 2026-04-04 | **Phase 2b** | WS-4 (HIGH): `bank-statement.test.ts` (CSV parse, `parseBankStatement`, `matchStatementToRun`), `import-processor.test.ts` (normalize/autoMap/validators/`processImportFile` + duplicate), `portal-magic-link.test.ts` (create/verify/find/send dev path), `esign-orchestrator.test.ts` (`sendForSignature` missing document). |
| 2026-04-04 | **Phase 2c** | WS-3 (HIGH baseline): `gdpr.test.ts` (exportData + requestErasure + audit), `jira.test.ts` (connectionStatus), `linear.test.ts` (connectionStatus), `ksef.test.ts` (connectionStatus, syncHistory, disconnect NOT_FOUND). *(Superseded by **Baseline + depth** row for `jira.listProjects` + `ksef` connect/triggerSync.)* |
| 2026-04-04 | **Phase 3 — WS-6** | Full validator coverage in `packages/validators/src/__tests__/`: env, contract, workflow, payment (first batch) plus equipment, jira, approval, time-tracking, document, ksef, notification, reminder, integration, calendar, user, organization, docs, helpers; invoice, contractor, linear, google-workspace. |
| 2026-04-04 | **Phase 4 — WS-2 (`integrations`)** | E-sign + signing-webhook + calendar/outlook/notion/confluence + **Google Workspace** (OAuth + Admin Directory users/groups with `fetch` mocks). **`packages/integrations` has no remaining `it.todo`.** **TIME_DEVIATION** covered in `invoice-matching.test.ts` (removed redundant todos from `reconciliation.test.ts`). |
| 2026-04-04 | **Plan follow-ups** | **`google-workspace.test.ts`:** real Zod tests for `googleDirectoryUserSchema`, `directoryImportInputSchema`, `groupRoleMappingSchema`; `users` array `.min(1)` on bulk import schema. **`portal-branding.test.ts`:** `portal.getSession` (org name + logo); mock `teams-graph-client` so `appRouter` loads without optional Graph SDK in slim installs. |
| 2026-04-04 | **WS-9 + WS-10 (integrations)** | **Adapters:** `base-adapter`, `ksef-adapter`, `clockify-adapter`, `slack-adapter`, `resend-adapter` tests in `packages/integrations/src/adapters/__tests__/`. **Services:** `esign-service.test.ts`, `qstash-client.test.ts` (`esign-webhook-handler` + `ocr-service` already covered). |
| 2026-04-04 | **Crucial — API services** | **`bank-account-crypto.test.ts`:** AES-256-GCM round-trip + IV uniqueness + format errors. **`ocr-extraction.test.ts`:** `triggerOcrExtraction` (credit block + QStash publish), `processOcrExtraction` (success + download failure), getters. |
| 2026-04-04 | **WS-5 crons + Resend inbound** | **`token-refresh`, `trial-notifications`, `job-health`, `data-purge`** route tests (401 + 200 smoke). **`resend-inbound`** route tests (missing env, missing Svix, bad signature, non-`email.received`). **`@contractor-ops/api`:** added `package.json` export for `./services/r2` (Vitest resolves dynamic import in `data-purge/route.ts`). |
| 2026-04-04 | **WS-3 + WS-4** | **`search.test.ts`:** `search.global` (Zod min length, empty sanitized query, merged `$queryRaw` triple). **`esign-orchestrator.test.ts`:** `sendForSignature` happy path + contract `PENDING_SIGNATURE` / `ExternalLink` (mocked `fetch`, R2, Prisma tx, `createSigningEnvelope`). |
| 2026-04-04 | **WS-3 reminder** | **`reminder.test.ts`:** `list` (org + sort), `create`, `update` (NOT_FOUND + success), `delete` (tx + `reminderInstance`/`reminderRule`), `toggleActive` (deactivate → cancel `PENDING` instances). |
| 2026-04-04 | **WS-3 docs + calendar** | **`docs.test.ts`:** `attach` (PRECONDITION_FAILED + `attachDocLink`), `detach`, `list`, `search`, `refreshMetadata` (mocked `doc-link-service` + `integrationConnection`). **`calendar.test.ts`:** `listConnections` / `listPersonalConnections`, `disconnect` (NOT_FOUND, FORBIDDEN, success), `listEvents`, `getTaskConfig`, `saveTaskConfig` (NOT_FOUND + merge). |
| 2026-04-04 | **WS-3 Google Workspace + portal-time** | **`google-workspace.test.ts`:** isolated `googleWorkspaceRouter` — `listDirectory` NOT_FOUND + merge stats, `syncStatus`, `listUserGroups`, `bulkImport`, `triggerSync` (mocked integrations adapter, auth invitations, QStash `publishJSON`). **`portal-time.test.ts`:** `portalProcedure` cookie session — `getTimesheet`, contracts, save/submit, `listTimesheets`, `getConnectedProviders`, `syncExternal` (NOT_FOUND / PRECONDITION_FAILED / CLOCKIFY / JIRA). |
| 2026-04-04 | **WS-4 equipment + virus** | **`equipment-workflow.test.ts`:** `handleEquipmentTaskStart` (non-EQUIPMENT skip, no contractor, auto-complete empty, OUTBOUND vs RETURN_REQUESTED offboarding); `checkShipmentTaskCompletion` (early exits, all-shipments gate, idempotent `updateMany`). **`virus-scanner.test.ts`:** mocked `clamscan` — clean / infected / throw, `isClamAvailable`. |
| 2026-04-04 | **WS-4 Linear + Slack** | **`linear-webhook-handler.test.ts`:** `processLinearWebhook` (invalid payload, ignored actions, unlinked, loop suppression, dedup); `registerLinearWebhook` / `deregisterLinearWebhook` (preconditions, GraphQL + config). **`slack-client.test.ts`:** AES token round-trip, `getSlackClient`, `getSlackUserIdForUser`, `sendReminderDM`, `syncWorkspaceUsers` (mocked `@slack/web-api` + Prisma). |
| 2026-04-04 | **WS-4 linear-issue-sync** | **`linear-issue-sync.test.ts`:** `detectScopeExpansionNeeded`; `linearGraphQL` (mocked `fetch` — success, 401, GraphQL errors, no data); `createLinearIssue` (connection preconditions); `syncTaskStatusToLinear` (no link, loop suppression, bad connection, missing `linearIssueId`, no `teamId`, `STATUS_UPDATE_UNMAPPED`). |
| 2026-04-04 | **WS-5 portal + health** | **`portal/set-session/__tests__/route.test.ts`:** Zod 400 + 200 + `Set-Cookie` (`portal_session`, `HttpOnly`). **`portal/clear-session`:** mocked `deletePortalSession` + cookie when `portal_session` present. **`health/__tests__/route.test.ts`:** mocked `prisma.$queryRaw` — 200 vs 503. |
| 2026-04-04 | **WS-5 webhooks/[provider]** | **`webhooks/[provider]/__tests__/route.test.ts`:** `POST` — 404 unknown / no `supportsWebhooks`, 401 bad signature, 200 + `webhookDelivery.create` + QStash `publishJSON` (mocked `getAdapter`, `registerAllAdapters`, Prisma). |
| 2026-04-04 | **WS-5 webhooks/_process** | **`webhooks/_process/__tests__/route.test.ts`:** `verifySignatureAppRouter` passthrough mock — 400 missing fields, 404 no handler / no delivery, 200 `handleWebhook` + `PROCESSED`, 500 `FAILED` on throw (mocked Prisma, registry, `handleSigningCompletion` stub). |
| 2026-04-04 | **OAuth callback (integration path)** | **`apps/web/.../oauth/[provider]/callback/__tests__/route.test.ts`:** mocked adapter + `verifyOAuthState` + `encryptCredentials` + Prisma — missing code/state, unknown adapter, missing client secret, bad state, create vs update, `linear` → `PENDING_MAPPING`, exchange throws. |
| 2026-04-04 | **WS-3 approval** | **`approval.test.ts`:** isolated `approvalRouter` — `listChains` (cached `INVOICE` chains), `getChain` (NOT_FOUND + success), `deleteChain` (NOT_FOUND + BAD_REQUEST when active `PENDING` flow). Use `createCallerFactory(approvalRouter)` → top-level `caller.listChains()` (not `caller.approval.*`). |
| 2026-04-04 | **WS-3 approval (queue + actions)** | **`approval.test.ts`:** `listPending` (empty page + `my`/`all`/`overdue` where clauses), `approve` (NOT_FOUND, BAD_REQUEST, FORBIDDEN, happy path + `invalidateByPrefix`); **`approval-engine` mock:** `advanceFlow` must resolve to `{ completed: boolean }` (not `undefined`) or router throws. |
| 2026-04-04 | **WS-3 approval (remainder)** | **`approval.test.ts`:** `reject` (NOT_FOUND + flow/invoice updates), `delegate` (BAD_REQUEST not-member + success + cache), `requestClarification`, `bulkApprove`/`bulkReject` (`Promise.allSettled` counts + errors), `submitForApproval` (NOT_FOUND, match/pending/chain guards, success via mocked `routeToChain` + `createApprovalFlow`), `getAuditTrail` (empty + minimal `submitted` event). |
| 2026-04-04 | **WS-3 portal (main router)** | **`portal.test.ts`:** isolated `portalRouter` — `requestMagicLink` (no contractors → anti-enumeration; with contractors → token + email), `verifyMagicLink` (BAD_REQUEST, NOT_FOUND, single-org session, multi-org picker + nonce), `selectOrg` (UNAUTHORIZED, NOT_FOUND, success), `logout` → `deletePortalSession`. |
| 2026-04-04 | **WS-11 import duplicates** | **`apps/web/.../import/__tests__/step-duplicates.test.tsx`:** `StepDuplicates` — banner count, **Skip all** / **Update all** bulk actions, per-row **Update existing** merge into `duplicateActions`, masked vs full tax ID (`usePermissions` + real `mask-pii`). |
| 2026-04-04 | **WS-5 QStash worker routes (batch)** | **`ocr/_process`**, **`ksef/_sync`**, **`google-workspace/_sync`** — each `POST`: `verifySignatureAppRouter` mocked as identity, 400 (missing/invalid body), 200 (mocked orchestrator), 500 on throw. **`@contractor-ops/api`:** added `package.json` export `./services/ksef-sync-orchestrator` so Vitest resolves the KSeF route import (same pattern as `ocr-extraction`, `r2`). |
| 2026-04-04 | **WS-3 portal (dashboard)** | **`portal.test.ts`:** `getSession` (org `findUnique` + layout payload), `overview` (counts, paid-invoice sum, upcoming deadline via `plain()` JSON dates). Session mock includes `email` + `contractor.displayName`. |
| 2026-04-04 | **WS-3 portal (contracts + invoices)** | **`portal.test.ts`:** `listContracts`, `getActiveContracts`, `getContract` (NOT_FOUND + empty docs; mocked `r2.createPresignedDownloadUrl` + `documentLink`), `listInvoices`, `getInvoice` (NOT_FOUND + activity log / `plain()` timestamps). Prisma mocks: `documentLink`, `paymentRunItem`. |
| 2026-04-04 | **WS-3 portal (self-service)** | **`portal.test.ts`:** `listDocuments` (presign), `listPayments`, `getUploadUrl` (PDF-only + `randomUUID` mock), `submitInvoice` (success + contract NOT_FOUND), `getProfile` (NOT_FOUND), `getNotificationPreferences` (defaults), `updateNotificationPreference` (upsert + `SECURITY_ALERTS` guard), `updateContactInfo`. Prisma: `document`/`invoice`/`invoiceFile` create, `contractor` findUnique/update, billing/change-request/notification prefs. |
| 2026-04-04 | **WS-3 portal (financial change)** | **`portal.test.ts`:** `submitFinancialChangeRequest` — `PORTAL_NO_CHANGES` (empty input), bank name + **previousValues** snapshot from `contractorBillingProfile`, **IBAN** strip spaces + `encryptBankAccount` + mask, **`createChangeRequest` mocked** — propagates **CONFLICT** (`TRPCError`). Mocks: `portal-change-request`, `bank-account-crypto`. |
| 2026-04-04 | **WS-5 auth catch-all** | **`auth/[...all]/__tests__/route.test.ts`:** mocked `better-auth/next-js` `toNextJsHandler` + `@contractor-ops/auth` — dynamic `import("../route.js")` asserts **GET**/**POST** are the handler exports (wiring regression guard; no HTTP round-trip). |
| 2026-04-04 | **WS-5 Slack legacy + Teams** | **`slack/oauth`:** missing code/state, bad/expired HMAC state, missing client id, failed token exchange, **create** + **update** connection + `syncWorkspaceUsers`. **`slack/interactivity`:** 401 bad/stale signature, 400 no `payload`, `view_submission` → `{ response_action: "clear" }`, `block_actions` → 200. **`teams/messages`:** mocked `botbuilder` + **`TeamsBotHandler`** — 200 on `process`, 500 on throw / invalid JSON. **`@contractor-ops/api`:** export `./services/teams/teams-bot-handler` for Vitest resolution (same pattern as other service subpaths). |
| 2026-04-04 | **WS-8 logger + avatar** | **`packages/api/src/__tests__/logger/`:** `metrics` (mocked `../logger/src/index.js` + Sentry) — increment / distribution / gauge. **`axiom-stream`:** real `createAxiomStream` — Writable + valid/invalid JSON write callbacks (no `@axiomhq/js` mock — package resolves only under `packages/logger`). **`apps/web/.../lib/__tests__/avatar-initials.test.ts`:** `getAvatarInitials` multi-word, single word, email fallback, `?`. |

## Current State

- **Test framework:** Vitest (all packages), React Testing Library (web), MSW v2 (HTTP mocking)
- **Existing test quality:** SOLID — tests assert outcomes (middleware, RBAC parity, route contracts). Run `pnpm test` at repo root for full status.
- **API routers:** `packages/api/src/routers/__tests__/` includes **`approval.test.ts`** (broad), **`portal.test.ts`** (~**35** tests: portal surface + financial change request; `r2`, `node:crypto`, `portal-change-request`, `bank-account-crypto` mocks), plus existing per-domain routers (see Progress log).
- **Web components:** **Import** — `step-duplicates`, `step-preview`; **shared** `page-header`; **dashboard** `dashboard-greeting`; **contract-wizard** `step-details`; **payments** `new-payment-run-dialog`; **invoice-detail** `match-card`, `duplicate-warning`; **settings** `org-settings-form`; **auth** `login-form`; **template-builder** `use-template-form`; **integrations** `linear-issue-chip`; **time** `deviation-flag`; **contractors** `tab-placeholder`; **billing** `plan-card` (+ existing KPI / badge tests). WS-11 Tier 3 and many Tier 1/2 files remain incremental.
- **QStash / background workers (`apps/web/src/app/api/`):** **`ocr/_process`**, **`ksef/_sync`**, **`google-workspace/_sync`** have `__tests__/route.test.ts` (signature wrapper mocked; service orchestrators mocked).
- **Better Auth HTTP bridge:** **`auth/[...all]/__tests__/route.test.ts`** — smoke test that **GET**/**POST** come from `toNextJsHandler(auth)` (mocks prevent loading full auth stack).
- **Legacy Slack + Teams HTTP:** **`slack/oauth`**, **`slack/interactivity`**, **`teams/messages`** each have **`__tests__/route.test.ts`** (HMAC / signature paths + Prisma + `fetch` mocks; Teams uses `CloudAdapter.process` stub).
- **Logger (`@contractor-ops/logger`):** package-local **`vitest`** — **`src/__tests__/index.test.ts`** (`createLogger` / factory `bindings()`). **`metrics`** + **`axiom-stream`** still covered from **`packages/api/src/__tests__/logger/`**.

## Coverage Target

- **Overall target: >=80% module coverage** — **Merged honest** Vitest v8 (root **`pnpm test:coverage`**, `coverage.include` on product `src`): see **Measured coverage** (~**34%** lines / ~**34%** stmts vs full declared `src`). **Per-package** runs (narrower denominator): api **69.28%**, web **75.63%**, integrations **68.99%**, validators **97.77%**, logger **78.57%**, auth **100%**, db **53.24%** stmts (**Prisma `generated/` excluded**). See **Coverage Math**.
- **100% coverage required for all "crucial" paths** — see next section

---

## Crucial Paths (100% Coverage Required)

These are the security, financial, and legal boundaries where a bug causes data breach, money loss, or compliance failure. Every path listed here MUST have tests.

### Security Boundaries
- [x] **All 7 middleware files** — auth, tenant isolation, RBAC, portal auth, sensitive action, rate limiting, observability (`packages/api/src/middleware/__tests__/`)
- [x] **Auth package roles + permissions** — `packages/auth/src/__tests__/roles.test.ts`, `permissions.test.ts`; `accessControlStatement` exported for parity
- [x] **DB tenant scoping** — `packages/db/src/__tests__/tenant.test.ts`
- [x] **DB soft-delete** — `packages/db/src/__tests__/soft-delete.test.ts`
- [x] **Portal cookie parsing** — covered in `portal-auth.test.ts` (middleware)
- [x] **PII masking** — `apps/web/src/lib/__tests__/mask-pii.test.ts`
- [x] **Frontend permission matrix** — `use-permissions-parity.test.ts` + `use-permissions.test.tsx`

### Financial Operations
- [x] **Stripe webhook handler** — `apps/web/src/app/api/webhooks/stripe/__tests__/route.test.ts` (missing signature, bad signature, happy path, idempotent skip)
- [x] **Payment router** — `packages/api/src/routers/__tests__/payment.test.ts`
- [x] **Billing service** — `packages/api/src/services/__tests__/billing-service.test.ts` (+ webhook tests in `billing-webhook.test.ts`)
- [x] **Bank statement parsing** — `bank-statement.test.ts`: CSV + matcher + **MT940** golden (`mt940js` path)
- [x] **Bank account encryption** — `packages/api/src/services/__tests__/bank-account-crypto.test.ts` (AES-256-GCM round-trip, IV uniqueness, invalid format)
- [x] **Reconciliation TIME_DEVIATION flag** — asserted in `invoice-matching.test.ts` (within-threshold omits flag; outside threshold adds flag without forcing `DISCREPANCY` when amount matches contract)

### Legal / Compliance
- [x] **E-sign orchestrator** — `esign-orchestrator.test.ts` + **`esign-url-and-completion.test.ts`:** signing URL, completion/R2, download failure; **`sendForSignature`** happy path + missing document
- [x] **Signing webhook handler (baseline)** — `signing-webhook.test.ts` exercises `handleSigningWebhook` (SigningEvent create, idempotency, recipient/envelope/contract updates, `completed` flag) with mocked adapter normalization
- [x] **DocuSign adapter (baseline)** — `docusign-adapter.test.ts`: OAuth, mocked SDK envelope / embedded view / download / void, webhook normalize + HMAC verify
- [x] **Autenti adapter (baseline)** — `autenti-adapter.test.ts`: OAuth, `getEmbeddedSigningUrl` unsupported, `getSignedDocument`, webhook normalize + HMAC verify *(multi-step `createEnvelope` optional follow-up)*
- [x] **GDPR router** — `gdpr.test.ts`: exportData + erasure + audit + **per-table `select` shape** assertions (portability checklist)
- [x] **GDPR data purge cron (baseline)** — `apps/web/src/app/api/cron/data-purge/__tests__/route.test.ts` (cron auth + empty-run JSON); full R2 delete path still integration-tested separately

### Data Integrity
- [x] **Resend inbound email handler** — `resend-inbound/__tests__/route.test.ts` (config, Svix, verify failure, non-inbound) **+ PDF → R2 + DB** (mocked); **optional Playwright smoke** `e2e/integration/resend-inbound-smoke.spec.ts` when `RUN_RESEND_E2E=1` (not a full Svix-signed E2E)
- [x] **Import processor** — `import-processor.test.ts` (validation, `processImportFile` contractor + duplicate)
- [x] **OCR extraction (orchestrator)** — `packages/api/src/services/__tests__/ocr-extraction.test.ts` (`triggerOcrExtraction`, `processOcrExtraction`, getters; field normalization remains in `ocr-service` / adapters)
- [x] **KSeF router (baseline + connect/triggerSync)** — `ksef.test.ts`: connectionStatus, syncHistory, disconnect, `connect` (org NIP + token Zod + happy path), `triggerSync` (NOT_FOUND + QStash publish); full multi-step sync orchestration still integration/E2E
- [x] **Env validator (baseline)** — `packages/validators/src/__tests__/env.test.ts`: full `serverEnvSchema` happy path + `BETTER_AUTH_SECRET` / Stripe prefix / hex key / `CRON_SECRET` failures; client schema + `validateClientEnv`

### Authentication
- [x] **OAuth callback handler** — `apps/web/src/app/api/oauth/[provider]/callback/__tests__/route.test.ts` (errors + full mocked success: encrypt + Prisma create/update, Linear status)
- [x] **Portal magic link** — `portal-magic-link.test.ts` (create hash, verify, findContractorsByEmail, dev email log)
- [x] **Cron secret verification (baseline)** — `reminders` + **`token-refresh`**, **`trial-notifications`**, **`data-purge`**, **`job-health`** each have `__tests__/route.test.ts` (401 + authorized 200 smoke)
- [x] **Credential service** — `packages/integrations/src/__tests__/credential-service.test.ts`

### Error Contract
- [x] **API error constants** — `packages/api/src/__tests__/errors-i18n-parity.test.ts` (string exports from `errors.ts` ↔ `Errors` in en + pl)
- [x] **Frontend error hook** — `apps/web/src/hooks/__tests__/use-api-error.test.tsx`

---

## Work Streams (Priority Order)

### WS-1: Middleware Tests (CRITICAL — **7/7 covered**)

**Why:** Middleware enforces auth, RBAC, tenant isolation, rate limiting, and session freshness. A bug here is a security vulnerability. Currently all router tests mock middleware as identity functions, so no test catches middleware regressions.

**Where:** Create `packages/api/src/middleware/__tests__/`

**How:** Unlike router tests, middleware tests should NOT mock the middleware itself. Instead, create a minimal tRPC router with the middleware applied and call it with crafted contexts.

```typescript
// Example pattern for middleware tests
import { t } from "../../init.js";
import { authMiddleware } from "../auth.js";

const testRouter = t.router({
  protected: t.procedure.use(authMiddleware).query(() => "ok"),
});
const caller = t.createCallerFactory(testRouter);
```

#### Files to test:

| File (LOC) | Key behaviors to verify |
|---|---|
| `auth.ts` (35) | Throws UNAUTHORIZED when no session/user. Throws FORBIDDEN with "ACCOUNT_BANNED" when `user.banned=true`. Passes session+user into ctx on success. |
| `tenant.ts` (41) | Throws UNAUTHORIZED when no session. Throws FORBIDDEN when no `activeOrganizationId`. Calls `tenantStore.run()` with orgId. Passes `organizationId` into ctx. |
| `rbac.ts` (44) | `requirePermission()` factory returns middleware. Throws FORBIDDEN with PERMISSION_DENIED when `auth.api.hasPermission` returns `{success:false}`. Passes through on success. `adminProcedure` chains auth->tenant->rbac correctly. |
| `portal-auth.ts` (98) | Extracts `portal_session` cookie (manual parsing, no library). Throws UNAUTHORIZED on missing cookie header, missing cookie, invalid session, expired session. Calls `validatePortalSession()`. Runs `tenantStore.run()` with session's orgId. Passes `portalSession`, `contractorId`, `organizationId`, `contractor`, `portalSubdomain` into ctx. |
| `sensitive.ts` (46) | Throws FORBIDDEN with cause "REAUTH_REQUIRED" when session older than 5 minutes. Passes through when session is fresh. Uses `session.session.createdAt`. |
| `upload-rate-limit.ts` (74) | Allows first 10 uploads within 1-minute window. Throws TOO_MANY_REQUESTS on 11th. Resets after window expires. Throws UNAUTHORIZED when no userId. Passes `uploadRateLimit.remaining` into ctx. |
| `observability.ts` (97) | Creates Sentry span with `trpc/{path}`. Logs procedure start/completion with duration. Tracks metrics (`trpc.duration`, `trpc.calls`). Captures exception on error with correct tags. Adds `requestId` to ctx. |

**Mock strategy for middleware tests:**
- `auth.ts`: Mock `ctx.session` and `ctx.user` directly
- `tenant.ts`: Mock `tenantStore` from `@contractor-ops/db`
- `rbac.ts`: Mock `auth.api.hasPermission` from `@contractor-ops/auth`
- `portal-auth.ts`: Mock `validatePortalSession` from services, construct Headers with cookie
- `sensitive.ts`: Set `ctx.session.session.createdAt` to recent/old timestamps
- `upload-rate-limit.ts`: Call middleware multiple times with same userId, verify state across calls
- `observability.ts`: Mock `@sentry/nextjs`, `@contractor-ops/logger`, `@contractor-ops/logger/metrics`

---

### WS-2: Skeleton Test Implementation — **`packages/integrations` complete 2026-04-04**

**Why:** These files inflate perceived coverage. The MSW handlers and fixtures already exist for most of these providers — the test bodies just need to be written.

**Where:** Existing test files — replace `.todo()` with real tests.

**How:** Each adapter follows the same pattern: mock `fetch` via MSW, call adapter methods, verify HTTP requests and response transformation.

#### Files to implement:

| File | Todos | MSW handler exists? | Priority |
|---|---|---|---|
| `integrations/services/__tests__/signing-webhook.test.ts` | **Implemented:** `handleSigningWebhook` transaction path + idempotency | Yes (`webhook-replay.ts` has factories) | HIGH — contract legal state |
| `integrations/adapters/__tests__/docusign-adapter.test.ts` | **Implemented:** OAuth, SDK-mocked envelope lifecycle + webhooks | Yes (`docusign.ts` handler) | HIGH |
| `integrations/adapters/__tests__/autenti-adapter.test.ts` | **Implemented:** OAuth, `getSignedDocument`, webhooks, embedded unsupported | Yes (`autenti.ts` handler) | HIGH |
| `integrations/adapters/__tests__/google-calendar-adapter.test.ts` | **Implemented:** OAuth, create/update/delete event + `If-Match` | Yes (`google-calendar.ts` handler) | MEDIUM |
| `integrations/adapters/__tests__/outlook-calendar-adapter.test.ts` | **Implemented:** OAuth (form POST), Graph create/delete + `dateTime`/`timeZone` | Yes (`outlook-calendar.ts` handler) | MEDIUM |
| `integrations/adapters/__tests__/confluence-adapter.test.ts` | **Implemented:** OAuth, `discoverCloudId`, CQL `searchPages` | Yes (`confluence.ts` handler) | MEDIUM |
| `integrations/adapters/__tests__/notion-adapter.test.ts` | **Implemented:** OAuth (Basic), `searchPages` + Notion-Version | Yes (`notion.ts` handler) | MEDIUM |
| `integrations/__tests__/google-workspace-adapter.test.ts` | **Implemented:** OAuth scopes/extra params, slug/flags, exchange + refresh + errors | Yes (`google-workspace.ts` handler) | MEDIUM |
| `integrations/__tests__/google-workspace-directory.test.ts` | **Implemented:** `listAllDirectoryUsers` pagination, suspended filter, org dept, errors; `listUserGroups` pagination, 404, 503 | Yes (`google-workspace.ts` handler) | MEDIUM |
| `validators/src/__tests__/google-workspace.test.ts` | Schema validation for GWS directory user, import input, group–role mapping | N/A (pure Zod) | done |
| `api/services/__tests__/invoice-matching.test.ts` | TIME_DEVIATION flag (time recon vs contract amount) | N/A | done |
| `api/routers/__tests__/portal-branding.test.ts` | `settings.getBranding` / `updateBranding` + `portal.getSession` (org logo) | N/A | done |

**Pattern for adapter tests** (use existing `linear-adapter.test.ts` as reference):
```typescript
import { useMockServer } from "@contractor-ops/test-utils/msw/server";
import { selectHandlers } from "@contractor-ops/test-utils/msw/handlers";

const { server, capture } = useMockServer();

beforeEach(() => {
  server.use(...selectHandlers("docusign")); // or whichever provider
});
```

---

### WS-3: API Routers — **baseline + deep coverage (2026-04-04)** — see router table + `packages/api/src/routers/__tests__/`

**Why:** Historically under-tested routers now have **aligned** tests for **`jira.ts` / `linear.ts` / `ksef.ts`** surfaces (Progress log: **Roadmap 100% batch**). Further expansion only where product risk grows (portal E2E, GWS edge cases).

**Where:** Create files in `packages/api/src/routers/__tests__/`

**How:** Follow the exact pattern in `audit.test.ts` — `vi.hoisted()` for constants and mock Prisma, mock `@contractor-ops/auth`, `@contractor-ops/db`, and `@sentry/nextjs`, then create a tRPC caller.

| Router (LOC) | Key procedures to test | Priority |
|---|---|---|
| `gdpr.ts` (258) | **`gdpr.test.ts`:** exportData + requestErasure + **per-table `select` shape** assertions (portability checklist). | HIGH |
| `jira.ts` (554) | **`jira.test.ts`:** connectionStatus, listProjects, issue types/statuses, mappings, task config, linked issues/activity, save* + disconnect + webhook helpers (mocked services/`fetch`). | HIGH |
| `linear.ts` (436) | **`linear.test.ts`:** connectionStatus, `teams` GraphQL, mappings, task config, linked issue(s), parity-style error paths. | HIGH |
| `ksef.ts` (330) | **`ksef.test.ts`:** connect, disconnect, triggerSync, syncHistory, connectionStatus; orchestrator depth in `ksef-sync.test.ts`. | HIGH |
| `google-workspace.ts` (415) | **Baseline:** `google-workspace.test.ts` (`syncStatus`, `listDirectory`, `bulkImport`, `triggerSync`; mocked adapter + QStash). | MEDIUM |
| `calendar.ts` (227) | **Baseline:** `calendar.test.ts` (connections, disconnect rules, event count, task template config merge). | MEDIUM |
| `portal-time.ts` (336) | **Baseline:** `portal-time.test.ts` (`portalProcedure` + mocked `time-entry` / Clockify / Jira sync). | MEDIUM |
| `portal.ts` (~1.2k) | **Strong baseline:** `portal.test.ts` — full portal surface including **`submitFinancialChangeRequest`** (**~35 tests**). Optional: `createChangeRequest` **integration** (real Prisma duplicate guard), multi-source `listDocuments` dedup edge cases, E2E. | MEDIUM |
| `search.ts` (91) | **Baseline:** `search.test.ts` (org-scoped `$queryRaw` via ctx, merge). | MEDIUM |
| `reminder.ts` (173) | **Baseline:** `reminder.test.ts` (tenant-scoped list/create/update/delete/toggle). | LOW |
| `docs.ts` (144) | **Baseline:** `docs.test.ts` (Notion attach gate + `doc-link-service` delegation). | LOW |
| `approval.ts` (1266) | **`approval.test.ts`:** chains, queue, approve/reject/delegate/clarify, bulk, submit, audit trail + **`dispatch` (approve/reject)** + **`syncPaymentDueDeadline`** when flow completes with `dueDate`. | MEDIUM |

---

### WS-4: API Services (**HIGH paths covered** — esign URL/completion, MT940, import, portal-magic-link, linear/slack paths; see Progress log)

**Why:** Services contain core business logic. The untested ones include financial operations, signing workflows, and data processing.

**Where:** Create files in `packages/api/src/services/__tests__/`

**How:** Follow the pattern in `approval-engine.test.ts` for pure logic, or `billing-service.test.ts` for services with external dependencies.

| Service (LOC) | What it does | Priority |
|---|---|---|
| `esign-orchestrator.ts` (540) | **`esign-orchestrator.test.ts`** + **`esign-url-and-completion.test.ts`:** signing URL + completion/R2 paths + download failure branch. | HIGH |
| `linear-webhook-handler.ts` (495) | **Baseline:** `linear-webhook-handler.test.ts` (webhook early paths + register/deregister). | HIGH |
| `linear-issue-sync.ts` (563) | **Baseline:** `linear-issue-sync.test.ts` (`linearGraphQL`, scope detection, create/sync early paths + unmapped log). | HIGH |
| `import-processor.ts` (431) | Processes CSV/XLSX bulk imports: validate rows, detect duplicates, create records. | HIGH |
| `bank-statement.ts` (308) | Parses MT940/CSV bank statements, matches transactions to invoices. | HIGH |
| `equipment-workflow.ts` (299) | **Baseline:** `equipment-workflow.test.ts` (task start + shipment completion). | MEDIUM |
| `ocr-extraction.ts` (202) | Orchestrator: QStash trigger, R2 fetch, `extractInvoice` persistence. **Baseline:** `ocr-extraction.test.ts`. | MEDIUM |
| `portal-magic-link.ts` (149) | Generates and validates magic link tokens for contractor portal. Security-sensitive. | MEDIUM |
| `slack-client.ts` (371) | **Baseline:** `slack-client.test.ts` (token crypto, client factory, mapping, DM, sync). | MEDIUM |
| `virus-scanner.ts` (62) | **Baseline:** `virus-scanner.test.ts` (mocked ClamAV stream). | LOW |
| `bank-account-crypto.ts` (67) | Encrypts/decrypts bank account numbers. **Tested:** `bank-account-crypto.test.ts`. | LOW |
| `stripe-client.ts` (10) | Just exports Stripe instance — skip or trivial test. | SKIP |

---

### WS-5: API Route Handler Tests (**partial** — Stripe, OAuth callback smoke, reminders cron auth; see Progress log)

**Why:** Route handlers are the HTTP boundary — they handle webhook signature verification, cron auth, idempotency, and error responses. These are untested despite handling money (Stripe) and legal documents (signing).

**Where:** Create `apps/web/src/app/api/**/__tests__/` directories.

**How:** Route handlers export async functions (`POST`, `GET`). Test by constructing `NextRequest` objects and calling the function directly.

```typescript
// Example pattern for route handler tests
import { POST } from "../route";
import { NextRequest } from "next/server";

it("rejects missing stripe-signature header", async () => {
  const req = new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body: "{}",
  });
  const res = await POST(req);
  expect(res.status).toBe(400);
  const json = await res.json();
  expect(json.error).toBe("Missing stripe-signature header");
});
```

| Route handler | Key behaviors | Priority |
|---|---|---|
| `webhooks/stripe/route.ts` (123) | Signature verification, idempotency via StripeEvent table, Serializable transaction, retry on 500. | HIGH |
| `webhooks/[provider]/route.ts` | **Baseline:** `__tests__/route.test.ts` (adapter resolution, signature, enqueue `_process`). | HIGH |
| `webhooks/_process/route.ts` | **Baseline:** `__tests__/route.test.ts` (QStash wrapper mocked; delivery dispatch + `PROCESSED`/`FAILED`). | HIGH |
| `ocr/_process/route.ts` | **Baseline:** `__tests__/route.test.ts` (400 missing fields; 200 `processOcrExtraction`; 500 on error). | HIGH |
| `ksef/_sync/route.ts` | **Baseline:** `__tests__/route.test.ts` (400; 200 `processKsefSync`; 500). Requires `@contractor-ops/api` export for `ksef-sync-orchestrator`. | HIGH |
| `google-workspace/_sync/route.ts` | **Baseline:** `__tests__/route.test.ts` (400 Zod; 200 `processDirectorySync`; 500). | MEDIUM |
| `webhooks/resend-inbound/route.ts` (463) | Svix signature verification, org slug extraction from email address, rate limiting (100/hr/org), PDF filtering, R2 upload, invoice+document creation. | HIGH |
| `cron/reminders/route.ts` (459) | CRON_SECRET verification, reminder rule evaluation, dedup via ReminderInstance, recipient resolution (5 modes), overdue task detection with 24h dedup. | HIGH |
| `cron/token-refresh/route.ts` | OAuth token refresh for all connected integrations. | MEDIUM |
| `cron/trial-notifications/route.ts` | Trial expiry notifications. | MEDIUM |
| `cron/data-purge/route.ts` | GDPR data purge execution. | MEDIUM |
| `cron/job-health/route.ts` | Health monitoring for background jobs. | LOW |
| `oauth/[provider]/callback/route.ts` | OAuth callback handling, state validation (CSRF), token storage. | HIGH |
| `portal/set-session/route.ts` | **Baseline:** `__tests__/route.test.ts` (validation + cookie). | MEDIUM |
| `portal/clear-session/route.ts` | **Baseline:** `__tests__/route.test.ts` (`deletePortalSession` + clear cookie). | LOW |
| `health/route.ts` | **Baseline:** `__tests__/route.test.ts` (DB ping vs 503). | LOW |
| `trpc/[trpc]/route.ts` | tRPC adapter — tested indirectly through router tests. | SKIP |
| `auth/[...all]/route.ts` | **Baseline:** `__tests__/route.test.ts` — `GET`/`POST` from `toNextJsHandler(auth)` (mocked). | LOW |
| `slack/oauth/route.ts` (deprecated) | **Baseline:** `__tests__/route.test.ts` — HMAC state, `oauth.v2.access`, Prisma upsert, `encryptToken` + `syncWorkspaceUsers`. | MEDIUM |
| `slack/interactivity/route.ts` (deprecated) | **Baseline:** `__tests__/route.test.ts` — Slack signature, `payload` form field, `view_submission` + `block_actions`. | MEDIUM |
| `teams/messages/route.ts` | **Baseline:** `__tests__/route.test.ts` — mocked `CloudAdapter.process` + `TeamsBotHandler` (requires `@contractor-ops/api` export for `teams-bot-handler`). | MEDIUM |

**Mock strategy for route handler tests:**
- Mock `@contractor-ops/db` (prisma)
- Mock `@contractor-ops/api/services/*` (service functions called by handlers)
- Mock `@sentry/nextjs`
- Mock `@contractor-ops/logger`
- For Stripe: mock `stripe.webhooks.constructEvent`
- For cron: set `CRON_SECRET` env var and pass Bearer token in Authorization header
- For Resend: mock `resend.webhooks.verify`

---

### WS-6: Validator Schema Tests — **done (2026-04-04)**

**Why:** Validators are the boundary between external input and internal types. They prevent malformed data from reaching business logic.

**Where:** Create files in `packages/validators/src/__tests__/`

**How:** Pure Zod schema tests — no mocking needed. Call `.parse()` with valid/invalid inputs.

**Done:** Every schema module under `packages/validators/src/` has a corresponding `__tests__/*.test.ts` except `index.ts` (barrel). Includes `helpers.ts` and `docs.ts`.

```typescript
// Example pattern for validator tests
import { createContractInput } from "../contract.js";

describe("createContractInput", () => {
  it("accepts valid contract", () => {
    expect(() => createContractInput.parse(validInput)).not.toThrow();
  });
  it("rejects missing title", () => {
    expect(() => createContractInput.parse({ ...validInput, title: "" }))
      .toThrow();
  });
});
```

**Priority order** (by business impact and LOC):
1. `env.ts` (277) — HIGH — validates all environment variables, catches misconfig at startup
2. `contract.ts` (207) — HIGH — contract lifecycle inputs
3. `workflow.ts` (228) — HIGH — workflow template and step definitions
4. `payment.ts` (156) — HIGH — payment amounts, bank details
5. `equipment.ts` (156) — MEDIUM
6. `jira.ts` (152) — MEDIUM
7. `approval.ts` (129) — MEDIUM
8. `time-tracking.ts` (127) — MEDIUM
9. `document.ts` (123) — MEDIUM
10. `ksef.ts` (118) — MEDIUM
11. `notification.ts` (80), `integration.ts` (64), `user.ts` (35), `organization.ts` (33) — LOW (**`reminder` / `docs` / `calendar`:** baseline router tests)

---

### WS-7: Auth & DB Package Tests (CRITICAL — **done** — `packages/auth/src/__tests__`, `packages/db/src/__tests__`)

**Why:** `packages/auth` defines the RBAC matrix used by every protected endpoint. `packages/db` defines tenant scoping and soft-delete that protect every database query. A bug in either package compromises the entire application.

**Where:** Create `packages/auth/src/__tests__/` and `packages/db/src/__tests__/`

#### Auth Package (331 LOC total)

| File (LOC) | What to test | Priority |
|---|---|---|
| `roles.ts` (119) | **CRUCIAL.** Verify each of the 8 roles grants exactly the expected permissions. Test that `owner` has all permissions. Test that `readonly` cannot write. Test that `finance_admin` can approve invoices but not create contractors. Test that `external_accountant` has read-only access to finance data. | HIGH |
| `permissions.ts` (43) | Verify the `ac` access control statement contains all 14 resources with correct action sets. Verify the `Permission` type accepts valid combinations and the statement shape is correct. | HIGH |
| `config.ts` (156) | Test auth configuration: verify OAuth providers are registered, email verification is enabled, rate limiting rules exist. Mock Better Auth internals. | MEDIUM |
| `client.ts` (13) | Re-export only — SKIP | SKIP |

**How to test roles.ts:**
```typescript
import { roles } from "../roles.js";

describe("roles", () => {
  it("owner has full permissions on all resources", () => {
    // Better Auth roles expose permissions via role.statements
    // Verify owner includes every resource+action from permissions.ts
  });

  it("finance_admin cannot create contractors", () => {
    const perms = roles.finance_admin;
    // Verify contractor only has "read", not "create"/"update"/"delete"
  });

  it("readonly has no write permissions on any resource", () => {
    // Iterate all resources in readonly role, verify no "create"/"update"/"delete"
  });
});
```

#### DB Package (328 LOC total)

| File (LOC) | What to test | Priority |
|---|---|---|
| `tenant.ts` (119) | **CRUCIAL.** Test `withTenantScope` Prisma extension: (1) throws when no AsyncLocalStorage context, (2) injects `organizationId` into `where` for findMany/findFirst/findUnique/count/aggregate/groupBy, (3) injects `organizationId` into `data` for create/createMany, (4) injects `organizationId` into `where` for update/updateMany/delete/deleteMany/upsert, (5) skips global models (User, Session, Account, Organization, Member, etc.), (6) `tenantStore.run()` correctly scopes nested calls. | HIGH |
| `soft-delete.ts` (146) | **CRUCIAL.** Test `withSoftDelete` Prisma extension: (1) `delete` on soft-delete models (Organization, Contractor, Contract, Invoice, Document) converts to `update { deletedAt }`, (2) `deleteMany` converts similarly, (3) `findMany`/`findFirst`/`findFirstOrThrow`/`count` auto-add `deletedAt: null` filter, (4) non-soft-delete models pass through unchanged, (5) `lowerFirst` helper works correctly. | HIGH |
| `rls.ts` (25) | Test that RLS helper sets correct Postgres session variables (`app.org_id`, `app.user_id`). | MEDIUM |
| `client.ts` (38) | Prisma singleton setup — SKIP (infrastructure) | SKIP |

**How to test tenant.ts and soft-delete.ts:**

These are Prisma client extensions. Test by creating a mock Prisma-like object with `$extends`, applying the extension, and verifying the query interceptors modify args correctly.

```typescript
// Pseudo-pattern for testing Prisma extensions
import { withTenantScope, tenantStore } from "../tenant.js";

describe("withTenantScope", () => {
  it("throws when no tenant context", async () => {
    // Call a query outside tenantStore.run() — should throw
  });

  it("injects organizationId into findMany where", async () => {
    await tenantStore.run({ organizationId: "org_1" }, async () => {
      // Call extended prisma.someModel.findMany({ where: { status: "ACTIVE" } })
      // Verify the query function received { where: { status: "ACTIVE", organizationId: "org_1" } }
    });
  });

  it("skips global models", async () => {
    await tenantStore.run({ organizationId: "org_1" }, async () => {
      // Call extended prisma.user.findMany({})
      // Verify organizationId was NOT injected
    });
  });
});
```

---

### WS-8: Web Hooks, Libs & Cross-Cutting Tests (**partial** — PII, `use-api-error`, permission parity, errors i18n parity, **`avatar-initials`**, **`navigation.ts` structure tests**)

**Why:** These contain security logic (PII masking, permission checks), error handling (API error translation), and navigation structure that affects every page. The `use-permissions.ts` hook duplicates the backend RBAC matrix — if they drift apart, users see UI they can't use.

**Where:** Create `apps/web/src/hooks/__tests__/` and `apps/web/src/lib/__tests__/`

#### Hooks (234 LOC total)

| File (LOC) | What to test | Priority |
|---|---|---|
| `use-permissions.ts` (121) | **CRUCIAL.** Test `can(resource, actions)` for all 9 roles. Verify the permission matrix matches `packages/auth/src/roles.ts` exactly. Test: owner can do everything, readonly can only read, finance_admin can approve invoices but not manage contractors, it_admin can manage integrations but not view invoices. Test missing role returns false. | HIGH |
| `use-api-error.ts` (39) | **CRUCIAL.** Test SCREAMING_SNAKE_CASE regex detection. Test known error codes map to translations. Test unknown codes fall back to UNKNOWN_ERROR. Test raw string passthrough for legacy messages. Test null/undefined/object error inputs. | HIGH |
| `use-density.ts` (55) | Test Zustand store toggles between "comfortable"/"compact". Test CSS class application. | LOW |
| `use-mobile.ts` (19) | Test breakpoint detection at 768px. | LOW |

**How to test use-permissions.ts:**
```typescript
// Mock the auth client and dashboard context
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: vi.fn(() => ({ isPending: false, data: {} })) },
}));

vi.mock("@/components/layout/dashboard-context", () => ({
  useDashboardContext: vi.fn(() => ({ userRole: "finance_admin" })),
}));

import { renderHook } from "@testing-library/react";
import { usePermissions } from "../use-permissions";

it("finance_admin can approve invoices", () => {
  const { result } = renderHook(() => usePermissions());
  expect(result.current.can("invoice", ["approve"])).toBe(true);
});

it("finance_admin cannot create contractors", () => {
  const { result } = renderHook(() => usePermissions());
  expect(result.current.can("contractor", ["create"])).toBe(false);
});
```

#### Lib Utilities (307 LOC total)

| File (LOC) | What to test | Priority |
|---|---|---|
| `mask-pii.ts` (30) | **CRUCIAL.** Test `maskTaxId()`: "1234567890" -> "12••••••90", short strings (<=4 chars) -> "••••", null/undefined -> null, whitespace handling. Test `canViewSensitivePii()`: owner/admin/finance_admin/ops_manager/external_accountant -> true, all others -> false, undefined -> false. | HIGH |
| `navigation.ts` (159) | **Baseline:** `lib/__tests__/navigation.test.ts` — group keys, dashboard `permission: null`, sample RBAC entries, integrations query-tab href, `navigationItems` flatMap parity. | MEDIUM |
| `avatar-initials.ts` (28) | **Baseline:** `lib/__tests__/avatar-initials.test.ts` — multi-word, single word, email fallback, `?`. | LOW |
| `motion.ts` (90) | Animation config constants — SKIP (no logic) | SKIP |
| `utils.ts` (6) | `cn()` re-export — SKIP | SKIP |
| `auth-client.ts` (1) | Re-export — SKIP | SKIP |

#### Error Contract Consistency Test

| What to test | Priority |
|---|---|
| **CRUCIAL.** Create a cross-cutting test that imports all constants from `packages/api/src/errors.ts` (50+ keys) and verifies each one exists as a key in `apps/web/messages/en.json` under the `"Errors"` namespace, and also in `pl.json`. This catches drift between backend error codes and frontend translations. | HIGH |

---

### WS-9: Integration Adapters Without Test Files — **baseline done 2026-04-04**

**Why:** These adapters had no test files. They handle OAuth flows and API calls for external services.

**Where:** `packages/integrations/src/adapters/__tests__/`

| Adapter (LOC) | What it does | MSW handler? | Priority |
|---|---|---|---|
| `clockify-adapter.ts` (134) | **Tested:** `CLOCKIFY_REGIONS`, `getHealthStatus` (mock Prisma) | Yes (`clockify.ts`) | MEDIUM |
| `slack-adapter.ts` (195) | **Tested:** OAuth config, `exchangeCodeForTokens`, `refreshToken`, `verifyWebhookSignature` | Yes (`slack.ts`) | MEDIUM |
| `resend-adapter.ts` (154) | **Tested:** `verifyWebhookSignature` (mock Resend SDK) | Yes (`resend.ts`) | MEDIUM |
| `ksef-adapter.ts` (115) | **Tested:** `getHealthStatus` branches (mock Prisma) | Yes (`ksef.ts`) | MEDIUM |
| `base-adapter.ts` (45) | **Tested:** minimal concrete subclass | N/A (unit test) | LOW |

---

### WS-10: Integration Services Without Test Files — **baseline done 2026-04-04** (except full esign depth)

**Why:** Services orchestrate critical integration workflows.

**Where:** `packages/integrations/src/services/__tests__/`

| Service (LOC) | What it does | Priority |
|---|---|---|
| `esign-service.ts` (150) | **Tested:** `getESignAdapter`, facade delegation + embedded-signing null path (mock registry) | HIGH |
| `esign-webhook-handler.ts` (193) | **Already:** `signing-webhook.test.ts` | HIGH |
| `ocr-service.ts` (73) | **Already:** `ocr-service.test.ts` | MEDIUM |
| `qstash-client.ts` (29) | **Tested:** `getQStashClient` / `resetQStashClient` (mock `@upstash/qstash` `Client`) | LOW |

---

### WS-11: React Component Tests (~35+/230+ covered — incremental; count grows with new `__tests__`)

**Why:** Component tests catch rendering bugs, broken conditional logic, and accessibility regressions. Coverage is still low vs the 80% goal; add tests in Tier 1–2 first.

**Progress (2026-04-04):** Above plus **contract-wizard** `step-details`, **payments** `new-payment-run-dialog`, **invoice-detail** `duplicate-warning`, **settings** `org-settings-form`, **auth** `login-form`, **template-builder** `use-template-form`, **integrations** `linear-issue-chip`, **time** `deviation-flag`, **contractors** `tab-placeholder`, **billing** `plan-card`. Existing: `step-duplicates`, `page-header`, `dashboard-greeting`, `step-preview`, `match-card`, KPI cards, etc. — `apps/web/src/**/__tests__/`.

**Where:** Create `__tests__/` directories alongside components.

**How:** Follow the pattern in `kpi-cards.test.tsx` (behavioral assertions) and `match-card.test.tsx` (conditional rendering). Use the custom `setup()` helper from `apps/web/src/test/test-utils.tsx`.

**Priority tiers** (focus on components with business logic, not pure display):

**Tier 1 — Business Logic Components (must test for 80% target):**
- `contracts/contract-wizard/` — multi-step form with validation, lifecycle transitions
- `payments/payment-run-wizard/` — payment batch creation, amount calculations
- `import/step-duplicates.tsx` — **Baseline:** `step-duplicates.test.tsx` (banner, bulk skip/update, per-row action merge, tax ID masking). Deeper: edge cases with `create` action only if product expands.
- `invoices/invoice-detail/` — matching UI, approval actions, deviation display
- `settings/organization-settings/` — billing plan management, member invites
- `auth/` — login, signup, org selection flows
- `workflows/template-builder/` — includes `use-template-form.ts` (162 LOC) with complex form logic, field arrays, drag-reorder, Zod validation

**Tier 2 — Interactive Components (needed for 80% target):**
- `approvals/` — approval queue, action buttons, SLA indicators
- `time/` — timesheet grid, entry form, bulk actions
- `integrations/` — OAuth connection flow, sync status, config forms
- `contractors/contractor-profile/` — tab navigation, document upload, lifecycle actions
- `billing/` — subscription management, plan selector, usage display

**Tier 3 — Display Components (nice to have):**
- `reports/` — chart rendering, filter controls
- `dashboard/` — remaining dashboard widgets
- `notifications/` — notification list, mark-as-read
- `portal/` — remaining portal components beyond the 2 already tested

**Do NOT test** (low value): layout shells, pure CSS wrappers, icon components, simple re-exports from shadcn/ui. **nuqs** URL hooks are usually thin; add a focused test only when sync behavior matters (see **`use-invoice-filters.test.tsx`** + `NuqsTestingAdapter`).

---

## Quality Guidelines for All New Tests

### Do:
- **Test business outcomes**, not implementation details. Assert what the function returns or what side effects occur, not which Prisma method was called.
- **Test edge cases**: null inputs, empty arrays, boundary values, concurrent calls.
- **Test error paths**: verify error codes, messages, and that partial state is rolled back.
- **Use the existing MSW handlers** from `packages/test-utils/src/msw/handlers/` — they already exist for 19 providers.
- **Use the existing fixtures** from `packages/test-utils/src/msw/fixtures/` for test data factories.

### Don't:
- Don't mock the function under test. If you mock a service, test the code that CALLS the service.
- Don't write tautological assertions (`expect(mockFn()).toBe(whatMockReturns)`).
- Don't add `.todo()` tests — either write the test or don't create the file.
- Don't test framework behavior (e.g., "tRPC returns 500 on thrown error").
- Don't add `console.log` to tests. Use Vitest's built-in assertion messages.

### Module Mock Template (for router tests):

```typescript
const { ORG_ID, USER_ID, mockPrisma } = vi.hoisted(() => {
  const ORG_ID = "org_test_001";
  const USER_ID = "user_test_001";
  type Rec = Record<string, any>;
  const mockPrisma: Rec = {
    // Add model mocks as needed
    $transaction: vi.fn(async (fn: (tx: Rec) => Promise<unknown>) => fn(mockPrisma)),
  };
  return { ORG_ID, USER_ID, mockPrisma };
});

vi.mock("@contractor-ops/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
      hasPermission: vi.fn().mockResolvedValue({ success: true }),
    },
  },
}));

vi.mock("@contractor-ops/db", () => ({
  prisma: mockPrisma,
  tenantStore: { run: (_ctx: unknown, fn: () => unknown) => fn(), getStore: vi.fn() },
  withTenantScope: vi.fn((c: unknown) => c),
  withSoftDelete: vi.fn((c: unknown) => c),
  createTenantClient: vi.fn(() => mockPrisma),
  createTenantClientFrom: vi.fn(() => mockPrisma),
}));

vi.mock("@sentry/nextjs", () => ({
  startSpan: vi.fn((_o: unknown, fn: (span: any) => unknown) =>
    fn({ setStatus: vi.fn(), setAttribute: vi.fn(), end: vi.fn() })),
  captureException: vi.fn(),
}));

vi.mock("../../services/cache.js", () => ({
  cached: vi.fn(async (_k: string, _t: number, fn: () => Promise<unknown>) => fn()),
  invalidate: vi.fn(async () => undefined),
  invalidateByPrefix: vi.fn(async () => undefined),
  CacheKeys: {}, CacheTTL: {},
}));
```

---

## Coverage Math: Path to 80%

### Module inventory (testable source files):

| Category | Total | Currently Tested | Gap |
|---|---|---|---|
| API Middleware | 7 | 7 | 0 |
| API Routers | 32 | ~25 | ~7 |
| API Services | 44 | ~28 | ~16 |
| API Route Handlers | 20 | ~20 | ~0 |
| API Core (errors.ts, context.ts) | 3 | partial | — |
| Integration Adapters | 16 | most baseline | — |
| Integration Services | 11 | most baseline | — |
| Validators | 27 | 27 | 0 |
| Auth Package | 3 | 3 | 0 |
| DB Package | 3 | 3 | 0 |
| Logger Package | 3 | 2 | 1 |
| Web Hooks | 4 | 4 | 0 |
| Web Lib | 4 | ~4 | ~0 |
| React Components (countable) | ~120 | ~21 | ~99 |
| **Total** | **~297** | **~97** | **~200** |

**Note:** Row counts remain **planning estimates**; **measured** Vitest v8 (2026-04-04): **merged honest** (~**34%** lines with `coverage.include` on product `src`) + per-package table (narrower denominator) in **Measured coverage**; per-package **statement** %: **api 69.28%**, **web 75.63%**, **integrations 68.99%**, **validators 97.77%**, **logger 78.57%**, **auth 100%**, **db 53.24%** stmts (Prisma **`generated/`** excluded).

**Headline:** **Merged honest** % from **`pnpm test:coverage`** (`coverage.include`); per-package **`pnpm --filter … exec vitest run --coverage`** answers “coverage among code that ran.” Target: **80%** ≈ **238** modules with tests at the roll-up level.

### What's needed to reach 80% (~159 more modules):

| Work Stream | New modules tested | Running total |
|---|---|---|
| WS-1 Middleware | +7 | 86 |
| WS-7 Auth/DB | +5 | 91 |
| WS-8 Web Hooks/Libs + Error contract | +6 | 97 |
| WS-2 Skeleton todos (existing files, real tests) | +12 | 109 |
| WS-6 Validators | +23 | 132 |
| WS-5 Route Handlers (HIGH+MEDIUM priority) | +12 | 144 |
| WS-3 Routers (HIGH+MEDIUM) | +8 | 152 |
| WS-4 Services (HIGH+MEDIUM) | +10 | 162 |
| WS-9 Integration Adapters | +5 | 167 |
| WS-10 Integration Services | +3 | 170 |
| WS-11 Components (Tier 1+2) | ~68 | **238 (80%)** |

**Crucial path items** (from the checklist above) account for ~35 modules. These must be done first regardless of 80% math.

---

## Execution Order Recommendation

**Phase 1 — Crucial Paths (security + financial + legal):**
1. **WS-1 (Middleware)** — 7 files, highest security impact, fastest to write
2. **WS-7 (Auth/DB)** — 5 files, RBAC matrix + tenant scoping + soft-delete
3. **WS-8 (Web Hooks/Libs)** — 6 files, PII masking + permission matrix parity + error contract
4. ~~**WS-2 partial (signing todos)**~~ — **DocuSign + Autenti adapter tests + `handleSigningWebhook` tests done**

**Phase 2 — Data Integrity Boundaries:**
5. ~~**WS-5 partial (HIGH route handlers)**~~ — **2a done:** Stripe, OAuth callback (**mocked** success + errors), reminders cron auth. **Extended:** Resend inbound + crons (baseline) + **QStash workers:** `ocr/_process`, `ksef/_sync`, `google-workspace/_sync` + **`auth/[...all]`** wiring smoke + **legacy** `slack/oauth`, `slack/interactivity`, **`teams/messages`** (see Progress log). **Resend:** PDF→R2→DB path covered in **`resend-inbound` route unit test** (mocked); optional **browser E2E**, live OAuth, deeper Teams/Slack paths remain incremental.
6. ~~**WS-4 partial (HIGH services)**~~ — **Done:** esign URL/completion tests, MT940 in `bank-statement.test.ts`, existing high-service baselines.
7. ~~**WS-3 partial (HIGH routers)**~~ — **Done:** deep **`jira` / `linear` / `ksef`** tests + **`gdpr`** select checklist + **`approval`** dispatch/calendar branch tests + **`portal-profile`** CONFLICT; remainder is **optional** (portal E2E, GWS edge cases, KSeF full sync **integration**).

**Phase 3 — Broad Coverage Sprint to 80%:**
8. ~~**WS-6 (Validators)**~~ — **done:** all validator modules + `helpers` / `docs` (see Progress log).
9. ~~**WS-2 (`integrations`)**~~ — **done.** ~~GWS validator stubs + portal-branding~~ — **done** (see Progress log).
10. ~~**WS-9 + WS-10 (integrations adapters + services)**~~ — **baseline done** (see Progress log). Deeper Clockify API / Slack message tests optional.
11. ~~**WS-3 + WS-4 + WS-5 remainder (roadmap scope)**~~ — **Done:** reminders cron depth, Slack approve path, Resend Playwright smoke, related API/service tests. **Incremental:** deeper **`TeamsBotHandler`** invoke scenarios, richer Slack shapes, live Resend+Svix E2E.
12. **WS-11 (Components Tier 1+2)** — **In progress:** representative Tier 1 + Tier 2 slices landed (see **Final status** + **WS-11 Progress**); ~68 tests in the **Coverage Math** model still approximate — add **one vertical per PR** toward 80% module goal.

---

## Files Explicitly Excluded from Testing

These files are intentionally excluded from coverage counting:

- `packages/api/src/index.ts` — barrel export, no logic
- `packages/api/src/init.ts` — tRPC setup, tested indirectly
- `packages/api/src/root.ts` — router aggregation, tested indirectly
- `packages/integrations/src/index.ts` — barrel export
- `packages/integrations/src/types/*.ts` — type definitions only
- `packages/auth/src/client.ts` — 1-line re-export
- `packages/auth/src/index.ts` — barrel export
- `packages/db/src/index.ts` — barrel export
- `packages/db/src/client.ts` — Prisma singleton setup
- `apps/web/src/lib/utils.ts` — 6-line `cn()` re-export
- `apps/web/src/lib/auth-client.ts` — 1-line re-export
- `apps/web/src/lib/motion.ts` — animation config constants
- `apps/web/src/app/api/trpc/[trpc]/route.ts` — tRPC adapter, tested via router tests
- `packages/api/src/services/stripe-client.ts` — 10-line Stripe instance export
- `packages/api/src/services/billing-constants.ts` — constant definitions
- Filter hooks (`use-contractor-filters.ts`, etc.) — pure nuqs URL state, no logic
- **`packages/logger`:** **`src/index.ts`** child factories covered by **`packages/logger/src/__tests__/index.test.ts`**; **`metrics.ts` / `axiom-stream.ts`** via **`packages/api/src/__tests__/logger/`** — *do not double-count* in “excluded” vs “covered”; Axiom multistream branch coverage remains best-effort
