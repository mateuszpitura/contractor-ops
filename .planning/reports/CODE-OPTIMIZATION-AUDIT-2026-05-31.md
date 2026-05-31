# Code Optimization & Quality Audit — contractor-ops

**Date:** 2026-05-31
**Branch:** `audit/post-migration-parity`
**Scope:** Read-only static audit (no tests, builds, migrations, or mutating commands were run)

This audit was performed immediately after the Next.js `apps/web` → Vite `apps/web-vite` migration (the old `apps/web` is deleted) and during the in-progress dead-i18n-key cleanup (Wave 4-A..4-D). It synthesizes verified findings from 16 specialist auditors across nine dimensions: Architecture, Code Quality, Performance, Testing, Tooling/DX, Security, i18n, Dependencies, and Dead Code. Findings were already triaged for false positives; where a reviewer issued a `correctedSeverity`, that value is used here. The dominant theme is **post-migration residue and seam-level gaps**, not structural rot — the underlying architecture (tenant isolation, tRPC discipline, the Page→Container→Hook→Component layering, the money/tax primitives, the guard suite) is genuinely sound.

---

## 1. Executive Summary

The codebase is in good structural health. The migration did not break the architecture; it left **mechanical debt at the edges** and exposed a few **enforcement gaps** where guards and CI do not cover the surfaces that matter most. The highest-leverage themes:

1. **CI does not type-check the largest hand-written app.** `apps/web-vite` (~217k LOC) builds via `vite build` (esbuild, no type checking) and there is no `pnpm typecheck` step in any CI workflow. The repo's strongest correctness lever — `strict: true` TS — is unenforced on the app most under churn. Compounded by an **orphaned `i18n:types` turbo task** that means a fresh-clone typecheck fails today.
2. **Security guards run only in a bypassable pre-push hook.** The five most security-relevant custom guards (raw-SQL tenant scoping, audit-log, raw-fetch, idempotency, silent-catch) and `lint:no-next` never run in GitHub CI. A PR introducing an unscoped tenant query or a missing audit log can merge green.
3. **Money-movement mutations lack an audit trail and a webhook fails open.** `finance/payment.ts` writes zero `writeAuditLog` across 9 money-moving mutations (lock/export/cancel/mark-paid/import-statement); the InPost webhook signature path returns `true` on an empty secret, allowing unauthenticated event injection against any misconfigured org in production.
4. **Per-request auth cost is doubled.** Better Auth `cookieCache` is disabled, so `getSession` hits the DB on every request, and `requirePermission` adds a second session/member lookup via `hasPermission` — a fixed latency/pool-pressure tax on the entire authenticated surface (372 gated procedures).
5. **Frontend errors are invisible to on-call.** The SPA's only React error boundary logs to `console` and never to Sentry, and there is no top-level boundary around the provider tree — production render crashes white-screen with no event.
6. **Massive post-migration comment residue violates the repo's own rule.** ~400+ files carry `apps/web` / "Step N codemod port" / "Phase NN · Plan" / GAP-ID breadcrumbs that the project explicitly forbids in source. Plus ~52–178 dead `eslint-disable` comments in a Biome-only repo (suppress nothing), ~9 orphaned components, dead one-shot scripts, and two unused 80–91M icon packages.
7. **i18n seams are weak.** The landing app (separate runtime) has zero parity/coverage tooling and a confirmed production crash on `en-GB`/`ar-SA` blog pages; the web-vite parity gate grandfathers 494 genuinely-missing ar/pl translations.
8. **Currency formatting is reinlined ~20+ times** with a hardcoded `/100`, producing a reachable 100x display bug for JPY (a selectable org currency) and a maintenance-tax bypass of the shared `packages/shared/money.ts` helpers.

### Health by dimension

| Dimension | Rating | Rationale |
|---|---|---|
| Architecture | **Good** | No app→app imports, no package cycles, clean public-api↔tRPC seam, real service layer. Issues are entrypoint contract inconsistency and a god-package surface, not structural. |
| Code Quality | **Fair** | Strong boundary validation on webhooks/gov-API, contained `any`. Dragged down by ~40 unvalidated integration response casts, dead `eslint-disable` noise, and four missing strict-TS flags. |
| Performance | **Good** | Route-split SPA, tuned Prisma indexes/pooling, FILTER-aggregate dashboards. A few real hotspots: auth double round-trip, one list N+1, uncapped counts. |
| Testing | **Fair** | Excellent backend coverage incl. tenant-isolation suite; hooks well-tested (the data-layer "gap" was a false positive). Real gaps: tautological/stubbed Phase-74 security tests, no coverage thresholds, stale handoff. |
| Tooling/DX | **Needs work** | No typecheck in CI on the biggest app, orphaned `i18n:types`, security guards only in bypassable pre-push, `lint:no-next` wired nowhere. The enforcement layer has holes exactly where churn is highest. |
| Security | **Good** | Strong AsyncLocalStorage tenant isolation, HMAC API auth, portal IDOR defense. Gaps are targeted: payment audit trail, fail-open InPost webhook, stub secret store, stale baseline docs. |
| i18n | **Fair** | web-vite ICU/RTL system is excellent. Landing runtime is untooled with a live crash; 494 baselined missing ar/pl keys; pervasive breadcrumb comments. |
| Dependencies | **Good** | Disciplined: no version drift, 7-day release-age guard enforced, no Redux. Cleanups only: 2 unused giant icon packages, dead vendor-chunk rules, one misfiled dep. |
| Dead Code | **Fair** | Hard guards held (zero `next/*` imports). But ~9 orphan components, 37 dead i18n keys, ~14 dead scripts, dead placeholder barrel, and the breadcrumb-comment problem above. |

---

## 2. Findings by Dimension

Within each dimension, findings are ordered by severity (Critical → High → Medium → Low) then by effort (S → M → L → XL). Effort key: **S** ≤ half-day, **M** ~1–3 days, **L** ~1–2 weeks, **XL** multi-week.

### 2.1 Architecture

**State of area:** The dependency graph is healthy — no app→app imports, no package-level cycles, and a notably clean seam where `apps/public-api` (Hono) reuses the tRPC `publicApiRouter` via `createPublicCaller` with zero duplicated DB logic. The tRPC layer is more disciplined than its LOC suggests: 63 domain-grouped namespaces, a real validators + service layer, idempotency/advisory-lock/audit-writer libs, and god-routers that mostly delegate. The web-vite Page→Container→Hook→Component discipline genuinely holds (thin pages, ~1:1 container:hook, enforced boundary), and the "Redux + TanStack + nuqs overlap" premise was false — there is no Redux. The real issues cluster at the **package entrypoint/build layer**, **reusable domain logic living inline in routers**, **audit-trail gaps**, and **post-migration hygiene residue**.

| Severity | Effort | Title | Evidence (file:line) | Recommendation |
|---|---|---|---|---|
| High | M | `payment.ts` has zero audit logging across 9 money-moving mutations and no step-up auth | `packages/api/src/routers/finance/payment.ts` (create:487, lockAndExport:703, updateItemStatus:892, markAllPaid:950, cancel:1013, importStatement:1093, confirmStatementMatches:1146); `packages/api/src/middleware/sensitive.ts:16-17` | Add tx-scoped `writeAuditLog` to all money-moving mutations; switch destructive/export ones to `sensitiveActionProcedure`. **Cross-ref Security 2.6.** |
| Medium | S | Two divergent reverse-charge resolution paths (create vs update) | `packages/api/src/routers/finance/invoice.ts:228,360,366,813,921`; `packages/api/src/services/reverse-charge.service.ts:211` | Collapse onto `applyReverseCharge`; delete router-local `resolveReverseCharge`. |
| Medium | S | Raw `new Error` throws bypass the global TRPCError/errorKey contract | `core/ocr.ts:123,136`; `core/approval.ts:388`; `compliance/zatca.ts:180`; `init.ts:88-169`; `errors.ts` | Replace with `TRPCError({ code, message: E.* })`; add a guard forbidding `throw new Error(` in `src/routers/**`. |
| Medium | M | `packages/api` entrypoint is raw `src/*.ts`; prod relies on Node type-stripping + a dead 4.6MB dist | `packages/api/package.json` exports `./src/index.ts`; `apps/api/Dockerfile:96`; `apps/api/dist/plugins/trpc.js`; `tsconfig.base.json` (no `erasableSyntaxOnly`) | Pick one contract: point exports at `dist` for the node runtime, **or** drop the api build + add `erasableSyntaxOnly: true` so CI fails on any non-erasable construct. |
| Medium | M | `einvoice.ts` is the non-conformant god-router (dynamic logger import + silent noop, 11 casts, inline mock-typed db) | `packages/api/src/routers/core/einvoice.ts:83-92,141-148` | Use top-level `createLogger`; type db param as shared `TenantScopedDb`; drop unknown casts; add audit on finalize/send/void. |
| Medium | M | Inconsistent src-vs-dist export contract across packages (e.g. `auth` types-from-src/runtime-from-dist; `validators` `.` vs `./roles`) | `packages/auth/package.json`; `packages/validators/package.json`; `packages/compliance-policy` (no build script) | Adopt one documented convention; fix `auth` so types+runtime resolve to one tree; document the rule in a package template. |
| Medium | M | VAT-rate defaults hardcoded as country-coupled magic strings instead of the DB `taxRate` authority | `services/tax-rate.service.ts:14`; `zatca-submission.ts:381,393`; `peppol-orchestrator.ts:104`; `einvoice-finalize.ts:536`; `einvoice/profiles/zatca/generator.ts:159` | Introduce one country-VAT-profile resolver; unify the dual `'15'`/`'15.00'` ZATCA literals. |
| Medium | M | Domain enums in `validators` are non-exported → re-declared as literal `z.enum` arrays in 4+ web-vite files | `validators/src/contractor.ts:9`, `contract.ts:37`; `web-vite .../contractor-wizard/wizard-dialog.tsx:44`, `step-company.tsx:21`, etc. | Export the enums + inferred types from `validators`; import them in the frontend; optionally guard inline `z.enum` duplicates. |
| Medium | L | `packages/api` is a god-package: 50 router namespaces + 44 subpath exports, 10 with zero external consumers | `packages/api/package.json` (46 exports keys); cron-worker reaches into `@contractor-ops/api/lib/advisory-lock` etc. | Remove the 10 zero-consumer subpaths; extract a thin `@contractor-ops/api-services` for cron-shared logic; track god-files for splitting. |
| Low | S | Dead placeholder `apps/web-vite/src/index.ts` with stale "Step 7" comment | `apps/web-vite/src/index.ts` | Delete the file (no consumers; no package `exports`). **Cross-ref Dead Code 2.8.** |
| Low | S | 404 catch-all renders unstyled, non-localized bare HTML | `apps/web-vite/src/router.tsx:172-186` | Replace with a localized not-found page using the design system + `useTranslations`, under the `/:locale` subtree. |
| Low | S | `lint-guards` consumed only via deep relative imports into `src/`, bypassing its own exports | `scripts/lint-schema.mjs:15`, `lint-logs.mjs:20`, `i18n-parity.mjs:19`; `packages/lint-guards/package.json` | Import by package name from the barrel (or add subpath exports); declare it as a devDependency. |
| Low | S | No circular-dependency / boundary guard despite a documented near-miss cycle | `scripts/` (15 guards, none for cycles); no madge/dependency-cruiser | Add a ~40-line package-graph cycle guard wired into `lint:ci` (graph is acyclic today). |
| Low | M | Reusable domain logic (state machines, SLA/compliance scoring, VAT resolution) lives inline in routers | `contractor.ts:32,56,142`; `approval.ts:182,87,310`; `workflow-execution.ts:64,125,183,199`; `invoice.ts:228,254` | Opportunistically lift pure rules into `services/` when touching each router; not a big-bang refactor. |
| Low | M | `portal.ts` is a 1678-LOC kitchen-sink router mixing 6+ portal domains | `packages/api/src/routers/portal/portal.ts:177` | Split into sub-routers (auth/invoices/documents/equipment/profile), mirroring `portalTime`. |
| Low | M | `validators`↔`einvoice` cycle avoided by duplicating German legal constants across two packages | `einvoice/.../xrechnung-de/constants.ts:82-128`; `validators/src/legal/de.ts`; parity test | Extract locked legal phrases into a dependency-free leaf (`packages/shared` or a new `legal-constants`); strip Phase/threat-id breadcrumbs. |

### 2.2 Code Quality

**State of area:** External-input boundaries are mostly well-guarded — inbound webhooks and QStash callbacks use Zod `safeParse`, gov-API responses use Zod `.parse()`, and Biome's `noExplicitAny` keeps implicit-any drift contained (only ~9 genuine `as any` survive, all `biome-ignore`'d). The serious gap is **~40 integration adapters casting `response.json()` to inline types with no schema validation** — asymmetric with the courier/gov clients next door that *do* validate. The rest is stale post-migration residue (`as any` enum casts whose migration already shipped, dead `eslint-disable` comments) and four missing `tsconfig` strict flags.

| Severity | Effort | Title | Evidence (file:line) | Recommendation |
|---|---|---|---|---|
| High | L | Integration adapters trust external API responses via bare `as` cast — no Zod | `integrations/src/adapters/{linear:105,notion:112,jira:111,confluence:110,google-workspace:142,outlook-calendar:163,docusign:218,slack:129}`; `api/routers/integrations/jira.ts:80` | Add per-provider response Zod schemas (or a shared `parseJsonResponse(res, schema)` helper); prioritize OAuth token-exchange/refresh paths where a bad parse persists a corrupt credential. |
| Medium | S | Stale `'RENDERING' as any` enum casts on a CAS concurrency primitive — migration shipped | `late-payment-claim-pdf.ts:74`; `late-interest-pdf-reaper.ts:44,85,88`; `db/.../enums.ts:754`; `invoice.prisma:372` | Drop the 4 casts + breadcrumb comments; re-typecheck api + cron-worker. |
| Medium | S | Org bank info (IBAN/BIC) read from JSON metadata with field-by-field `as` cast | `finance/payment.ts:380,383,391` | `safeParse` the org settings/bankAccount shape; at minimum `typeof === 'string'` guard before treating iban/bic as strings. **Cross-ref Security.** |
| Medium | L | `tsconfig.base` missing `noUncheckedIndexedAccess` (+ 3 lower-value strict flags) | `tsconfig.base.json:6`; `find-or-throw.ts:39`; `biome.json:34` | Enable `noUncheckedIndexedAccess` as a tracked migration (api package first); enable `noImplicitReturns` now; defer `exactOptionalPropertyTypes`; promote Biome `noUnusedVariables` to error instead of `noUnusedLocals`. Do **not** enable all four at once. |
| Low | S | 14 dead `eslint-disable` comments in a Biome-only repo | `use-audit-log-tab.ts:73`; `portal-login-verify-container.tsx:105`; `clockify-sync.ts:203`; `data-grid.tsx:113` | Delete from hand-written source; convert genuine suppressions to `biome-ignore`. **Cross-ref Style 2.3 / Dead Code 2.8.** |

### 2.3 Code Style, Idiom & Comment Hygiene

**State of area:** Biome-only repo (no eslint config, no eslint dependency anywhere). `biome-ignore` justifications are consistently high quality, production source has zero TODO/FIXME, and naming is consistently kebab-case. The hygiene problem is **narrow and mechanical**: a flood of migration breadcrumb comments and dead `eslint-disable` no-ops. *(This dimension's breadcrumb + eslint-disable findings overlap heavily with web-vite Architecture 2.1, Dead Code 2.8, and i18n 2.10 — they describe the same residue from different angles; treat as one cleanup workstream.)*

| Severity | Effort | Title | Evidence (file:line) | Recommendation |
|---|---|---|---|---|
| Medium | S | 178 dead `eslint-disable` comments (13 in non-test prod source) suppress nothing | `biome.json`+`biome.ci.json`, no eslint; `data-grid.tsx:17,113`; `onboarding-import-service.ts:71,181`; `bank-statement.ts:39`; `zatca/signer.ts:47` | Delete per-file; convert load-bearing ones (`no-explicit-any`, `no-require-imports`) to `biome-ignore`; bulk-remove test-file disables. |
| Medium | M | 363 banned planning-doc / migration breadcrumb comments across 159 prod files | `contractor-e-invoicing-section.tsx:1-2`; `sort-code-validator.tsx:1-2`; `classification-disclaimer-dialog.tsx:2`; grep `Phase N · Plan` = 363 lines / 159 files | Codemod-strip leading breadcrumb blocks (reviewed, not raw `sed`); add a `scripts/` guard failing on `apps/web/` paths + `Plan \d+-\d+`/`(D-\d+)` tokens. **Cross-ref 2.1, 2.8, 2.10.** |
| Low | S | Two parallel lint-suppression idioms for identical rules (dead eslint-disable vs live biome-ignore) | exhaustive-deps: dead in 4 files vs live in 10; no-explicit-any: 42 dead vs 49 live | Resolve in the eslint-disable removal pass; the canonical idiom is `biome-ignore`; optionally guard against the `eslint-disable` token returning. |

### 2.4 Error Handling, Logging & Observability

**State of area:** Backend observability is genuinely strong and ahead of typical SaaS — the tRPC observability middleware logs + captures every procedure error to Sentry with request/user/org context, the prod `errorFormatter` redacts stacks, all three services init Sentry first with process-level handlers, PII is scrubbed via `beforeSend`, and cron jobs run through a trace-id-bound runner. The gaps are all on the **frontend** and in **fire-and-forget side-effects**, plus two **guard weaknesses** (`lint-silent-catch` only checks the literal `safe-swallow:` token, and skips integrations/einvoice/cron-worker).

| Severity | Effort | Title | Evidence (file:line) | Recommendation |
|---|---|---|---|---|
| High | S | web-vite route error boundary logs to console, never to Sentry | `components/error/route-error-boundary.tsx:62-77`; `sentry.ts:42` (only `browserTracingIntegration`) | In the effect, `Sentry.captureException(error, { tags: { 'react.boundary':'route', pathname } })` for error/unknown kinds; keep console for dev. |
| Medium | S | No top-level React error boundary — provider/bootstrap errors white-screen unreported | `main.tsx:58-72`; `router.tsx:72-78` | Wrap the provider tree in `Sentry.ErrorBoundary` with a full-page fallback. |
| Medium | S | Notification email / Slack-Teams dispatch failures swallowed with no logging | `services/notification-service.ts:408-413,449-457` | Replace empty bodies with `log.warn({ err, userId, type, channel }, ...)`; keep fire-and-forget. Same for `workflow-execution.ts:133-146,150-158`. |
| Medium | S | `lint-silent-catch` accepts blanket `pre-existing` reasons, defeating its paper-trail intent | `scripts/lint-silent-catch.mjs:113-121`; `notification-service.ts:410`; `idempotency.ts:95` | Reject empty or `/pre-existing/i` reasons; sweep the 28 sites with real one-line reasons or the log fix above. |
| Medium | M | `lint-silent-catch` scan roots exclude integrations, einvoice, cron-worker | `scripts/lint-silent-catch.mjs:65-70`; `resend-adapter.ts:115`; `zatca/signer.ts:510` | Add `packages/integrations/src`, `packages/einvoice/src`, `apps/cron-worker/src` to `scanRoots`; audit other `lint-*` guards' roots too. |
| Low | S | public-api + Fastify error handlers can return raw `error.message` to clients on 500 | `public-api/src/lib/error-handler.ts:69`; `apps/api/src/plugins/sentry.ts:28` | Return a generic message for `status>=500`; keep full detail in logs/Sentry only. |

### 2.5 Performance

**State of area:** Broadly performance-conscious. **Frontend:** every route is `React.lazy`-split, `manualChunks` is well-structured, QueryClient defaults are sane, tRPC uses `httpBatchLink`, web-vitals is instrumented. **Backend:** cursor+offset pagination helpers, `COUNT_CAP` guards (on some lists), FILTER-aggregate cached dashboards, read-replica routing, `p-limit` fan-out, batch `groupBy` enrichment (no N+1 in `contractor.list`). **DB/Prisma:** every tenant table has `organizationId`-leading composite indexes, pooling tuned for Neon, multi-region routing with circuit breaker, outbox `FOR UPDATE SKIP LOCKED`. The real gaps are specific: a doubled auth round-trip, one list N+1, eager entry-graph weight, uncapped counts, and soft-delete index coverage.

| Severity | Effort | Title | Evidence (file:line) | Recommendation |
|---|---|---|---|---|
| High | S | Better Auth `cookieCache` disabled → 2 auth DB round-trips per gated tRPC call (372 procedures) | `auth/src/config.ts:227-230`; `api/src/context.ts:27-33`; `middleware/rbac.ts:44-46` | Enable `session.cookieCache` (e.g. `{ enabled:true, maxAge:300 }`); resolve active-member role once per request and have `requirePermission` use the cached role map. |
| High | M | N+1 + redundant per-row org/contract reads in `time.reconciliation` (~60 queries/page) | `core/time.ts:445-464`; `services/time-reconciliation.ts:43-76` | Hoist org settings out of the loop; reuse the already-`include`d contract; batch `timeEntry.groupBy`. Reduces ~60 → 3 queries/page. |
| Medium | S | posthog-js bundled into entry chunk despite consent gate (~50-60KB gzip on every cold boot) | `lib/posthog.ts:14`; `main.tsx:20,46`; `lib/posthog-identity-sync.tsx:15` | Make posthog-js dynamically imported inside `initPostHog()` after consent; keep Sentry eager. |
| Medium | S | recharts (+d3) loaded on first authenticated paint via dashboard index chunk | `dashboard/spend-chart.tsx:17-25`; `dashboard-home-container.tsx:23,125`; `router/dashboard-routes.tsx:77` | `lazy()`-load `SpendChart` with a Suspense Skeleton fallback (mirror `PdfViewer`). |
| Medium | S | Unbounded `findMany` in `portal.listInvoices` / `portal.listPayments` | `portal/portal.ts:633-654,834-857` | Apply `cursorClause`+`paginateByExtraRow`; add `take` limit; page the portal hooks. |
| Medium | S | Uncapped `count()` on high-traffic invoice/contractor/document lists | `invoice.ts:689-708`; `contractor.ts:485`; `document.ts:410-420` (contrast `notification.ts:54-66`, `audit.ts:172-183`) | Apply the blessed `count({ where, take: COUNT_CAP })` pattern; surface a capped-total indicator. |
| Medium | M | Redundant list count-probe queries on every list page + always-mounted top bar | `use-contractor-list.ts:77,111`; `use-invoice-list.ts:60,61`; `use-top-bar.ts:20` | Derive emptiness from the existing list query's `total`; add a cheap `contractor.hasAny` (`SELECT EXISTS`) for the top bar. |
| Medium | M | Soft-delete indexes don't cover `deletedAt IS NULL` predicate | `db/src/soft-delete.ts:24,36-44`; `contractor.prisma:87-93`; `invoice.prisma:73-85`; baseline migration:5117-5131 | Add partial indexes `WHERE "deletedAt" IS NULL` (raw SQL migration) on the hottest Invoice/Contractor composites; drop the non-partial duplicates. |
| Medium | S | Unbounded `id`-list pre-fetch in contractor/contract list search | `contractor.ts:440-451`; `contract.ts:404-453` (contrast `search.ts:72-105` LIMIT 5) | Push tsvector + ORDER BY + LIMIT/OFFSET into one raw SQL query; at minimum add a defensive LIMIT to the id pre-fetch. |
| Low | S | Per-step N+1 user lookup in `approval.getAuditTrail` despite already-joined actor data | `core/approval.ts:1366-1386,1403-1421` | Collect distinct `approverUserId`s; one `user.findMany({ where: { id: { in } } })` into a Map. |
| Low | S | `contractor.list` parent `findMany` uses `include` (all scalar cols incl. `customFieldsJson`) instead of `select` | `core/contractor.ts:456-484` | Replace `include` with explicit `select`; exclude `customFieldsJson`. Same review for invoice/document lists. |
| Low | S | `documentId` foreign keys lack a leading index on InvoiceFile/PaymentExport/WorkflowAttachment | `invoice.prisma:92-102`; `payment.prisma:76-90`; `workflow.prisma:204-213` | Add `@@index([organizationId, documentId])` (matches DocumentLink/OcrExtraction convention). |
| Low | M | `customFieldsJson->>'billingModel'` filter has no supporting index (seq scan) | `contractor.ts:417-426`; `contractor.prisma:37`; baseline migration:990,5092-5093 | Add an expression index, or promote `billingModel` to a real typed column on Contractor. |
| Low | S | Per-query PII-redaction string scan on every slow-query log event | `db/src/client.ts:89-96,109-120,35-41` | Low priority; if touched, precompile the PII-table list into one RegExp at module load. |

### 2.6 Security

**State of area:** The core tenant-isolation architecture is strong — a single AsyncLocalStorage-backed Prisma extension auto-injects `organizationId` on every read/write, region+ACTIVE-status gating lives in tenant middleware, the public REST API enforces HMAC key auth + scope + tier, and the external portal defends multi-org login against IDOR with a verification nonce. Auth modes are cleanly separated; tenant context is always server-derived. The gaps are **targeted**: audit-trail coverage on money movement, a fail-open webhook, a stub secret store, and stale baseline docs.

| Severity | Effort | Title | Evidence (file:line) | Recommendation |
|---|---|---|---|---|
| High | S | InPost webhook signature verification fails open on empty secret — unauthenticated injection in prod | `services/courier/inpost-webhook-handler.ts:36`; `apps/api/src/routes/webhooks/inpost.ts:36-49,102-120` | Make `verifyInPostSignature` fail closed in production when secret is empty; skip empty-secret configs in `matchOrgBySignature`. |
| High | M | Payment-run money-movement mutations write no audit log | `finance/payment.ts:700-703,947-1004,1010-1056`; `scripts/lint-audit-log.mjs:56-76` | Add `writeAuditLog` (tx) on lockAndExport/markAllPaid/cancel/importStatement/confirmStatementMatches/removeFromRun/applySkonto; extend the guard to flag sensitive-model mutations lacking an audit call. **Same issue as Architecture 2.1 — single fix.** |
| Medium | M | Secret store hardwired to in-memory stub; HMRC gov-API credential lookup never wired to Infisical | `secrets/src/index.ts:27-36`; `api/src/gov-api-clients.ts:103`; `gov-api/.../hmrc-vat-client.ts:209-210` | Implement env-driven `getSecretStore` wiring (Infisical + CachedStore, MemoryStore only dev/test), or gate gov-api behind a flag that throws a clear "secret store not configured" error. |
| Medium | M | Security baseline docs describe the deleted `apps/web` Next.js app, not the Fastify surface | `SECURITY-AUDIT.md:62-79,104-107`; `docs/PRODUCTION-CHECKLIST.md:104-148`; `apps/api/src/plugins/csrf-origin.ts:29-55`; `server.ts:71-107` | Re-derive the controls tables against `apps/api/src` + `apps/web-vite`; **confirm where CSP/HSTS/X-Frame-Options are emitted for the SPA — if nowhere, log it as a regression.** |
| Low | S | Raw-SQL tenant-scope guard doesn't cover `$executeRaw`/`$executeRawUnsafe` | `scripts/check-raw-sql-tenant-scoped.ts:7-9,56`; `services/outbox/index.ts:214-239` | Extend `CALL_PATTERN` to `$executeRaw(?:Unsafe)?` with the same `organization_id`-or-`safe-raw-sql:` requirement (current sites already pass). |

### 2.7 Testing

**State of area:** Backend test coverage is genuinely strong — `packages/api` has ~245 test files including a near-1:1 router-test ratio, a dedicated 952-LOC cross-tenant isolation suite, classification scoring coverage, and 23 MSW provider integration tests. **A claimed "web-vite data layer is virtually untested" finding was a false positive** (corrected to Low): the auditor counted only `use-*.test.ts` and missed `.test.tsx` — real count is ~194 hook tests / ~169 hooks tested (~51%), and the hooks layer is in fact the *best*-tested. The genuine gaps are **tautological/stubbed security tests** and **no coverage thresholds**.

| Severity | Effort | Title | Evidence (file:line) | Recommendation |
|---|---|---|---|---|
| High | M | Phase-74 workflow override/template tests are tautological or stubbed for security-sensitive paths | `workflow-execution-template-selection.test.ts:40-50,73-81,97-100`; `workflow-override-blocking-task.test.ts:16-20,54-58` | Rewrite via `createCallerFactory(appRouter)` importing the real input schema; convert `it.todo` to real assertions (RBAC FORBIDDEN, AuditLog+SKIPPED in one `$transaction`, PRECONDITION_FAILED). |
| Medium | S | No coverage thresholds — coverage regressions invisible in CI | root `vitest.config.ts` (no `thresholds` block); `package.json` `test:coverage` | Add per-project `coverage.thresholds` as a ratchet floor at current levels; higher floors for api finance/compliance, classification, einvoice, validators. |
| Medium | M | Stale test-debt handoff cited as authoritative; ~16 failing files may persist | `.planning/handoffs/test-cleanup-2026-04-27.md:5,14,64`; `__tests__/errors-i18n-parity.test.ts:21` | Run `pnpm --filter @contractor-ops/api test` once (out of scope here), then fix-or-quarantine and archive/update the handoff + MEMORY entry. |
| Low | S | 26 skipped describe blocks in web-vite for missing/moved components | `wht-certificate-template.test.tsx:12`; `gdpr-privacy-notice-template.test.tsx:11`; `pdf-preview.test.tsx:13`; `de-locale.test.ts:11` | Delete [OBSOLETE]/[SUPERSEDED] files; port-or-remove the 17 [DEFERRED — component missing] blocks (don't leave skip stubs inflating the count). |
| Low | XL | web-vite container tests sparse (data layer largely covered via hooks) | container `*.test` ≈ 4/302; hooks well-covered | Lower priority given hooks are tested. Add container three-state (loading/empty/error) tests opportunistically for finance/compliance domains. |

### 2.8 Dead Code & Post-Migration Residue

**State of area:** Hard guards held — zero `next/*` imports remain in web-vite, and commented-out code is effectively nonexistent. But the migration left measurable residue: orphaned components, breadcrumb comments, dead scripts, dead i18n keys, and dead `eslint-disable` comments. None are correctness bugs; all are maintainability drag shipping in source.

| Severity | Effort | Title | Evidence (file:line) | Recommendation |
|---|---|---|---|---|
| Medium | S | ~9 orphaned components left by the port (never imported, ~700 LOC) | `components/feature.tsx`; `admin/admin-shell.tsx`; `workflows/workflow-board-container.tsx`, `workflow-nav-badge-container.tsx`; `invoices/invoice-detail/invoice-metadata-fields.tsx` (+4) | Delete the 9 files + colocated tests; re-typecheck web-vite. |
| Medium | S | 37 dead i18n keys persist after Wave 4; the detector isn't wired to CI | `scripts/audit-i18n-unused-keys.ts`; `apps/web-vite/messages/en.json`; `package.json` (no `i18n:unused`) | Feed the 37 paths to `delete-i18n-keys.ts`; wire `audit-i18n-unused-keys.ts` into CI (advisory then blocking at 0). **Cross-ref i18n 2.10.** |
| Medium | M | Migration breadcrumb comments in 423 files reference the deleted `apps/web` tree | `admin-shell.tsx:2-7`; `feature.tsx:2-6`; `onboarding-consent-step.tsx:1-12`; `lib/format-date.ts:1-3` | Reviewed codemod stripping provenance blocks; preserve genuine invariant comments. **Same residue as 2.1/2.3/2.10 — one workstream.** |
| Low | S | ~14 one-shot codemod/translation scripts (~588KB) wired to nothing | `scripts/apply-{ar,de,pl}-translations*.ts`; `fix-tdyn-loose.ts`; `fix-tkey-passthrough.ts`; `migrate-i18n-*.ts`; `patch-sanitize-escapes.mjs` | Delete the one-shot scripts; keep reusable tools; move any "reference material" under `.planning/`. |
| Low | S | 52 hand-written `eslint-disable` comments suppress nothing | `use-audit-log-tab.ts:73`; `data-grid.tsx:17,113`; `zatca/signer.ts:47` | Same fix as Code Quality 2.2 / Style 2.3 (one pass). |
| Low | S | Dead placeholder `apps/web-vite/src/index.ts` | `apps/web-vite/src/index.ts` | Delete. **Same as Architecture 2.1.** |

### 2.9 Dependencies & Bundle Weight

**State of area:** Disciplined — state is TanStack Query + nuqs + one tiny zustand store (no Redux), the 7-day `minimumReleaseAge` supply-chain guard is enforced in both `pnpm-workspace.yaml` and `.npmrc`, versions are consistent (no drift), and `manualChunks` is thoughtfully ordered. The issues are post-migration residue: two unused giant icon packages, a misfiled test-only dep, dead vendor-chunk rules, and two overlapping primitive libraries.

| Severity | Effort | Title | Evidence (file:line) | Recommendation |
|---|---|---|---|---|
| Medium | S | `react-icons` (whole meta-package, 83M) imported for a single Linear icon | `apps/web-vite/package.json`; `components/integrations/brand-icons.tsx:1,42` | Inline the Linear SVG (matching the file's other inline brands); drop `react-icons`; update the `vendor-icons` rule. |
| Medium | S | `@tabler/icons-react` declared in `packages/ui` but imported nowhere (91M unused) | `packages/ui/package.json:124`; 0 imports repo-wide | Remove from `packages/ui/package.json`; filtered typecheck on consumers. |
| Low | S | ~13 dead vendor-chunk rules reference Next.js-era libs not present in web-vite | `apps/web-vite/vite.config.mjs:80,82,83-95,97-103,116-119` | Delete dead rules (Redux/intl/finance/floating/logger); repoint `vendor-ui` to the libs actually used (`@base-ui/react`, `radix-ui`). |
| Low | S | `intl-messageformat` in production deps but only imported by a test-setup file | `apps/web-vite/package.json`; `src/test-utils/setup-test-i18n.ts:26` | Move to `devDependencies` (keep range compatible with i18next-icu). |
| Low | S | `next-themes` peer dep feeds only dead (Sonner wrapper) or Next-only (WorldMap) components | `packages/ui/package.json`; `shadcn/sonner.tsx:10` (0 importers); `ace/world-map.tsx:5` (landing only) | Delete the unused Sonner wrapper; keep `next-themes` only while WorldMap needs it. |
| Low | L | `packages/ui` ships two overlapping headless-primitive libraries (`@base-ui/react` + `radix-ui`) | `packages/ui/package.json`; `@base-ui/react` 27x vs `radix-ui` 4x (reui/*) | Standardize on `@base-ui/react`; port the 4 `reui/*` consumers; then drop `radix-ui`. Real refactor — track, don't treat as dead code. |

### 2.10 i18n & Localization

**State of area:** The web-vite i18n system (i18next + i18next-icu, 4 locales) is genuinely strong: correct per-language ICU plural forms, RTL via CSS logical properties (396 logical vs 28 physical), and a real guard suite wired into CI. The serious problems are at the **seams**: the landing app's separate, untooled runtime (with a live crash), a parity baseline grandfathering 494 missing ar/pl translations, and breadcrumb-comment residue overlapping the Architecture/Style/Dead-Code findings.

| Severity | Effort | Title | Evidence (file:line) | Recommendation |
|---|---|---|---|---|
| High | S | `en-GB`/`ar-SA` landing locales crash blog pages — missing `footer.newsletter` block | `landing/src/i18n/locales/{en-GB,ar-SA}.json`; `blog/[slug]/page.tsx:189-193,60`; `get-translations.ts:9`; `scripts/patch-landing-i18n.mjs:206` | Add the 5-key `footer.newsletter` block to both files; add both locales to the patch script's `locales`; stand up a landing parity gate (next finding). |
| Medium | M | Landing app i18n has near-zero parity/coverage tooling — effectively ungated | `i18n-parity.mjs:16`; `audit-i18n-code-coverage.ts:14`; `ci.yml:56-71` (web-vite only); `audit-translations-quality.ts:52-65` (landing set covers only en/pl/de/ar, advisory `continue-on-error`) | Run `runI18nParity` against `landing/src/i18n/locales` (base `en`, peers incl. `en-GB`/`ar-SA`) in CI; generate/validate `TranslationMessages` from `en.json` instead of casting. |
| Medium | L | i18n:parity baseline tolerates 494 real missing translations (295 ar, 199 pl) | `.i18n-parity-baseline.json` (2969 lines); `Admin.BoeRate.*`, `Classification.ExpertHelp.*`; `pl.json` literal English fallback | Treat baseline as a tracked backlog; translate ar+pl Admin/Classification clusters first; shrink the baseline as keys land; promote `i18n:quality` from advisory to tracked. |
| Low | S | `audit-i18n-unused-keys` exists but is unwired — dead-key cleanup is manual (Waves 4-A..D) | `scripts/audit-i18n-unused-keys.ts:2-35`; no `i18n:unused` script | Add `i18n:unused` + run as advisory CI emitting per-namespace dead-key counts. **Same as Dead Code 2.8.** |
| Low | S | 28 physical-direction Tailwind classes (`mr-`/`ml-`/`pl-`/`pr-`) on RTL surfaces | `late-interest-card.tsx:269,271`; `api-keys-tab.tsx:219,266,351,388` | Replace with logical `me-`/`ms-`/`pe-`/`ps-`; add a grep guard against new physical classes. |
| Low | M | ~412 files carry deleted-app/next-intl breadcrumb comments | `source-badge.tsx:4`; `use-rtl-chart-config.ts:1-9`; `typed-keys.ts:1-12` | Same codemod-strip pass as 2.1/2.3/2.8. |
| Low | S | CLAUDE.md + `packages/ui` claim landing/cms use next-intl — dependency does not exist | `packages/ui/.../translations-provider.tsx:11,18`; `landing/.../translation-context.tsx:1-52`; `cms/src/i18n/config.ts:1-15` | Update the stack table + provider header to say landing/cms use a hand-rolled React-Context translator. |

---

## 3. Prioritized Backlog (all dimensions)

Ranked by severity (impact) high→low, then effort low→high. "Why now" reflects the post-migration window and unguarded-surface risk.

| Rank | Severity | Effort | Dimension | Finding | Why now |
|---|---|---|---|---|---|
| 1 | High | M | Tooling/DX | No typecheck in CI; web-vite builds with zero type checking | Largest app is mid-migration churn with no automated type gate — regressions merge silently. |
| 2 | High | S | Tooling/DX | `i18n:types` turbo task orphaned; fresh-clone `pnpm typecheck` fails | Hard blocker for Rank 1 — must be fixed before typecheck can run in CI. |
| 3 | High | S | Tooling/DX | 5 security/correctness guards run only in bypassable pre-push | Unscoped tenant query / missing audit log can merge green right now. |
| 4 | High | S | Security | InPost webhook fails open on empty secret (unauth injection in prod) | Live production attack surface for any misconfigured org. |
| 5 | High | M | Security / Arch | Payment money-movement mutations write no audit log | No forensic trail on money leaving the system; SOC2/GDPR gap. |
| 6 | High | S | Code Quality / Obs | web-vite route error boundary never reports to Sentry | Prod render crashes invisible to on-call across the biggest app. |
| 7 | High | S | Performance | Better Auth `cookieCache` disabled → 2 auth DB round-trips/request | Fixed latency + Neon pool pressure on all 372 gated procedures. |
| 8 | High | M | Performance | `time.reconciliation` N+1 (~60 queries/page) | Manager-facing list degrades sharply on deep-history tenants. |
| 9 | High | S | i18n | `en-GB`/`ar-SA` landing blog pages crash (missing footer block) | 500s on two named launch markets, shipping now. |
| 10 | High | L | Code Quality | ~40 integration adapters trust external JSON via bare `as` (incl. OAuth credentials) | Corrupt secrets/state persist silently; violates repo `as`-on-external rule. |
| 11 | High | M | Testing | Phase-74 workflow override tests tautological/stubbed | Green tests for an unverified compliance-gate override (RBAC+audit+tx). |
| 12 | Medium | S | Code Quality | Stale `'RENDERING' as any` casts on a CAS concurrency primitive | Type checking off on a race-prevention path; dead now that migration shipped. |
| 13 | Medium | S | Performance | posthog-js in entry chunk despite consent gate | ~50-60KB gzip on every cold boot for nothing; trivial lazy fix. |
| 14 | Medium | S | Performance | recharts on first authenticated paint | Heaviest vendor group blocks dashboard interactivity. |
| 15 | Medium | S | Performance | Unbounded portal `listInvoices`/`listPayments` | Payload grows without bound for long-tenured contractors. |
| 16 | Medium | S | Performance | Uncapped `count()` on invoice/contractor/document lists | Full scans on large tenants; external API-key consumers can trigger. |
| 17 | Medium | S | Tooling/DX | `lint:no-next` guard wired into nothing | Migration-invariant guard provides zero protection on the exact branch it matters. |
| 18 | Medium | S | Dead Code | ~9 orphaned components (~700 LOC) | Mislead grep; keep dead i18n keys alive; clean removal. |
| 19 | Medium | S | Dead Code / Style | Dead `eslint-disable` comments (52–178) suppress nothing | Some mask real Biome violations (any/require); false suppression idiom. |
| 20 | Medium | S | Dependencies | `react-icons` (83M) + `@tabler/icons-react` (91M) unused/over-imported | ~174M install + supply-chain surface for one icon / zero usage. |
| 21 | Medium | S | Code Quality | Org IBAN/BIC read via field-by-field `as` cast | Money-movement correctness risk on malformed metadata. |
| 22 | Medium | S | Obs | Notification email/Slack failures swallowed unlogged | Silent delivery outages; only learned from user complaints. |
| 23 | Medium | S | Obs | `lint-silent-catch` accepts blanket `pre-existing` reasons | Guard green while real swallows hide among 28 boilerplate sites. |
| 24 | Medium | M | Obs | `lint-silent-catch` skips integrations/einvoice/cron-worker | Highest-risk silent-failure surface is unguarded. |
| 25 | Medium | M | Tooling/DX | Async-bug + import-cycle rules CI-only (not local/pre-push) | Long feedback loop for floating-promise/cycle bugs. |
| 26 | Medium | M | Architecture | `packages/api` entrypoint raw `src/*.ts` + dead 4.6MB dist | Latent prod-only crash if a future non-erasable construct lands. |
| 27 | Medium | M | Performance | List count-probe queries on every list page + top bar | Doubles expensive `contractor.list` compute per navigation. |
| 28 | Medium | M | Performance | Soft-delete indexes don't cover `deletedAt IS NULL` | Scaling tax that worsens with row count + deletion ratio. |
| 29 | Medium | S | Performance | Unbounded `id`-list pre-fetch in contractor/contract search | Memory/parse blowup on broad searches; defeats GIN index. |
| 30 | Medium | M | Arch / Domain | minor/100 currency formatting reinlined ~20+ times (JPY 100x bug) | Reachable display bug + dozens of sites to fix when locale rules change. |
| 31 | Medium | S | Architecture | Divergent reverse-charge paths (create vs update) | Tax-legally load-bearing; can classify the same invoice differently. |
| 32 | Medium | S | Architecture | Raw `new Error` throws bypass TRPCError contract | 500s + no i18n key + false Sentry noise on user/not-found conditions. |
| 33 | Medium | S | Dead Code | Duplicate KSeF FA(3) parser with unsafe minor-unit conversion | Dead copy reintroduces a fixed precision bug if ever wired up. |
| 34 | Medium | M | Architecture | Domain enums non-exported → frontend re-declares literals | Three-way drift on core vocabulary (contractor/rate type). |
| 35 | Medium | M | Architecture | VAT-rate defaults hardcoded vs DB authority | Statutory rate change → non-compliant e-invoices on submission paths. |
| 36 | Medium | M | Architecture | Inconsistent src-vs-dist export contract; `auth` type/runtime divergence | Stale-dist class of bugs: green CI, wrong runtime. |
| 37 | Medium | M | Architecture | `einvoice.ts` non-conformant (silent logger, casts, mock-typed db) | Compliance-critical router logs nothing on logger hiccup. |
| 38 | Medium | M | Code Quality | Missing `noUncheckedIndexedAccess` (+3 strict flags) | Index-access bugs ship without compiler help across 374k LOC. |
| 39 | Medium | M | Security | Secret store hardwired to in-memory stub (HMRC creds) | HMRC VAT lookups non-functional in prod; half-finished abstraction. |
| 40 | Medium | M | Security | Baseline security docs describe deleted `apps/web` | Pre-launch gating against invalid evidence; possible dropped CSP/HSTS. |
| 41 | Medium | M | Testing | No coverage thresholds | Coverage drifts down silently. |
| 42 | Medium | M | Testing | Stale test-debt handoff cited as authoritative | Navigating safety-critical routers by a stale map. |
| 43 | Medium | M | Dead Code / Style / i18n | ~400+ migration breadcrumb comments | Violates repo rule; point at deleted tree; broad noise. |
| 44 | Medium | M | i18n | Landing i18n near-ungated | Public SEO surface drifts with no CI signal. |
| 45 | Medium | L | i18n | 494 baselined missing ar/pl translations | Core EU/Gulf markets see English across admin/classification. |
| 46 | Low | S | (various) | 12 Low-severity items (see §2: 404 page, FK indexes, physical RTL classes, dead scripts, vendor-chunk rules, etc.) | Hygiene/scalability guardrails; batch into cleanup phases. |

---

## 4. Quick Wins (S-effort, high value — do first)

A checklist of the cheapest items with outsized payoff:

- [ ] **Fix `i18n:types` orphan** — add the `i18n:types` script to `apps/web-vite/package.json` so turbo runs it (unblocks CI typecheck + fresh clones). *(Backlog #2)*
- [ ] **Add the 5 CI security guards** — `lint:raw-sql`, `lint:audit-log`, `lint:raw-fetch`, `lint:idempotency`, `lint:silent-catch` into `lint:ci`. *(#3)*
- [ ] **Wire `lint:no-next`** into `lint:ci` / pre-push. *(#17)*
- [ ] **InPost webhook fail-closed** on empty secret in production. *(#4)*
- [ ] **Sentry capture in route error boundary** + a top-level `Sentry.ErrorBoundary`. *(#6)*
- [ ] **Enable Better Auth `cookieCache`**. *(#7)*
- [ ] **Add `footer.newsletter`** to `en-GB.json`/`ar-SA.json` + the patch-script `locales`. *(#9)*
- [ ] **Drop the 4 stale `'RENDERING' as any` casts**. *(#12)*
- [ ] **Lazy-import posthog-js** inside `initPostHog()`. *(#13)*
- [ ] **Lazy-load `SpendChart`** with a Suspense skeleton. *(#14)*
- [ ] **Paginate portal `listInvoices`/`listPayments`** + cap invoice/contractor/document `count()`. *(#15, #16)*
- [ ] **Delete the ~9 orphaned components** + dead placeholder `src/index.ts`. *(#18)*
- [ ] **Remove `react-icons` (inline the Linear SVG) + drop unused `@tabler/icons-react`**. *(#20)*
- [ ] **Log notification dispatch failures** (`log.warn`, keep fire-and-forget); tighten `lint-silent-catch` to reject `pre-existing`. *(#22, #23)*

---

## 5. Recommended Execution Sequence

Phases respect dependencies (enable enforcement before mass-fixing; remove dead code before refactors; fix the orphaned task before adding the typecheck gate).

### Phase A — CI Enforcement & Quick Safety (S–M, ~1 week)
**Theme:** Close the enforcement holes so nothing else regresses while we work.
Backlog #2 (`i18n:types` fix) → **then** #1 (add typecheck to CI) → #3 (5 security guards in CI) → #17 (`lint:no-next`) → #25 (async/cycle rules in pre-push). Plus the two live-security quick wins: #4 (InPost fail-closed) and #6 (Sentry error boundary).
*Dependency: #2 must land before #1.*

### Phase B — Post-Migration Dead-Code & Comment Sweep (S–M, ~1 week)
**Theme:** Remove residue before any refactor touches these files (sibling to the in-flight Wave 4 i18n cleanup).
#18 (orphan components) → #19/#43 (dead `eslint-disable` + breadcrumb codemod, one pass across Arch/Style/Dead-Code/i18n) → #33 (dead KSeF parser) → Low-severity dead scripts, dead vendor-chunk rules, placeholder `index.ts` (#46). Add the regression guards (breadcrumb/`apps/web` path, `i18n:unused` advisory) as part of this.
*Do before Phase D refactors to avoid editing files about to be deleted.*

### Phase C — Audit Trail, Auth & Observability Hardening (S–M, ~1 week)
**Theme:** The money/forensics/observability gaps.
#5 (payment `writeAuditLog` — single fix covering Arch+Security) → #7 (auth `cookieCache`) → #21 (org IBAN/BIC Zod) → #22/#23/#24 (notification logging + `lint-silent-catch` reason + scope) → #39 (secret store wiring) → #40 (security baseline docs).

### Phase D — Performance Pass (S–M, ~1 week)
**Theme:** The concrete hotspots, mostly independent.
Frontend: #13 (posthog lazy), #14 (recharts lazy), #27 (count-probe dedup). Backend: #8 (reconciliation N+1), #15/#16 (portal pagination + count caps), #29 (search id pre-fetch), #28 (soft-delete partial indexes — DB migration), Low DB items (#46: FK indexes, billingModel index).

### Phase E — Type-Safety & Boundary Validation (M–L, ~2 weeks)
**Theme:** Tighten the type/validation floor — sequenced after dead code is gone so the surface is smaller.
#10 (integration response Zod schemas — the biggest item) → #38 (`noUncheckedIndexedAccess` migration, api package first; `noImplicitReturns` now) → #31 (reverse-charge consolidation) → #32 (TRPCError throws) → #30 (currency formatter consolidation, JPY fix) → #34 (export domain enums) → #35 (VAT-rate resolver) → #37 (`einvoice.ts` conformance).
*Dependency: enable strict flags (#38) as a tracked migration; do not bundle all four flags at once.*

### Phase F — Testing, i18n Backlog & Structural Refactors (M–L, ongoing)
**Theme:** Longer-lead items that benefit from a clean tree.
#11 (rewrite Phase-74 security tests) → #41 (coverage thresholds ratchet) → #42 (resolve test-debt handoff) → #44/#45 (landing parity gate + ar/pl translation backlog) → structural: #26 (api entrypoint contract), #36 (export consistency), god-package/god-router splits (Arch Low items), `@base-ui`/`radix-ui` consolidation (#46/Dep-L). Track as standalone initiatives, not blockers.

---

## 6. Not Audited / Lower-Confidence Areas

- **Nothing was executed.** No tests, builds, `prisma migrate`, `pnpm install`, or any mutating command was run. All findings are from static analysis, `semble`, targeted file Reads, and cheap read-only Bash (`grep`/`wc`/`ls`/`find`).
- **Test pass/fail state is unknown.** The full web-vite vitest run is forbidden (RAM). The April 2026 test-debt handoff (#42) could not be confirmed or refuted — the ~16 named files still exist, but their current pass/fail status is unverified.
- **Runtime/load behavior unverified.** Performance findings (auth round-trips, N+1, count scans, bundle weight) are reasoned from code + index definitions + on-disk package sizes, not from profiling, EXPLAIN plans, or production telemetry.
- **CSP/HSTS post-migration coverage is an open question, not a confirmed regression** (#40) — the docs describe the deleted `apps/web`; whether the Fastify/Vite-host surface emits equivalent headers needs explicit verification.
- **Severity of two findings was corrected per reviewer notes** (api entrypoint high→medium; "no typecheck in CI" critical→high) and **one was reclassified as a false positive** (web-vite data-layer testing high→low: the auditor's `use-*.test.ts`-only count missed `.test.tsx` files; hooks are actually well-tested ~51%). Container test sparseness remains a real but low-priority item.
- **`packages/cms` (Payload), `apps/cron-worker` internals, and `packages/classification` scoring** received lighter coverage than `api`/`web-vite`; treat their findings as representative samples, not exhaustive.
- **Effort estimates are order-of-magnitude** (S/M/L/XL), intended for sequencing, not for committing dates.
