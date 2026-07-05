# Phase 95: Theme B — HRIS Two-Way Sync (Personio + BambooHR) - Research

**Researched:** 2026-07-05
**Domain:** Two-way HRIS sync — inbound pull (people/contracts/departments/custom-attributes) + outbound push (invoice-paid / payment-status / classification-outcome), with a hard source-of-truth field partition and a one-HRIS-per-org DB constraint. Personio (client-credentials bearer) + BambooHR (OAuth 2.0) adapters on the v2.0 integration framework.
**Confidence:** HIGH (every reuse seam read at source at current HEAD; two CONTEXT assumptions corrected against live code — see Corrections)

## Summary

Phase 95 is a **reuse-the-pattern, build-the-content** phase. HRIS connections are ordinary `IntegrationConnection` rows; the pull is a clone of the directory-sync orchestrator; the push is a new set of transactional-outbox event types; the field partition and one-HRIS-per-org constraint are the only genuinely new invariants. Every reuse seam the CONTEXT names exists and was read at source:

- The **integration adapter framework** is `packages/integrations` — the `IntegrationProviderAdapter` contract (`slug`/`displayName`/`supportsOAuth`/`getOAuthConfig`/`exchangeCodeForTokens`/`refreshToken`/`getHealthStatus`) `[VERIFIED: packages/integrations/src/types/provider.ts:39-77]`, the `OAuthConfig` env-var-named client id/secret shape `[VERIFIED: :17-32]`, and the two-tier (ESSENTIAL eager / HEAVY lazy) registration in `register-all.ts` `[VERIFIED: packages/integrations/src/adapters/register-all.ts:69-140]`. **BambooHR mirrors `JiraAdapter`** (`supportsOAuth = true` + `getOAuthConfig()`) `[VERIFIED: packages/integrations/src/adapters/jira-adapter.ts:92-101]`; **Personio mirrors `KsefAdapter`** (`supportsOAuth = false`, token/credential auth, not a browser redirect) `[VERIFIED: packages/integrations/src/adapters/ksef-adapter.ts:10-18]`.
- The **pull orchestrator** to clone is `google-workspace-sync-orchestrator.ts` — it writes an `IntegrationSyncLog(direction: INBOUND, syncType, status STARTED→SUCCESS/FAILED)` per run `[VERIFIED: packages/api/src/services/google-workspace-sync-orchestrator.ts:288-297]`, serializes per-connection with `tryAcquireAdvisoryLock(prisma, 'sync', 'google-workspace:${connectionId}')` released in `finally` `[VERIFIED: :302-363]`, persists last-synced state in `connection.configJson` and diffs against it `[VERIFIED: :117-122,212-228]`, refreshes OAuth tokens with a 5-minute buffer `[VERIFIED: :63-90]`, and records failure on both the sync log and the connection row `[VERIFIED: :233-256]`. The cron fan-out pattern (iterate CONNECTED connections, throttle by `lastSyncAt`, region-aware `getRegionalClient` + `tenantStore.run`) is in `org-definition-sync.ts` `[VERIFIED: packages/api/src/services/org-definition-sync.ts:396-497]`, driven by a cron handler `[VERIFIED: apps/cron-worker/src/jobs/handlers/org-definition-sync.ts]` + a registry entry with a `CRON_*_SCHEDULE` env `[VERIFIED: apps/cron-worker/src/jobs/registry.ts:64-67; apps/cron-worker/src/env.ts:46]`.
- The **transactional outbox** to extend is `packages/api/src/services/outbox/` — a producer calls `enqueueOutboxEvent({ tx, organizationId, eventType, payload, dedupKey, aggregateType, aggregateId })` inside its business `$transaction`, the row commits iff the write commits, and a QStash-driven drain claims rows under `FOR UPDATE SKIP LOCKED`, dispatches through a per-event handler registry, and retries with exponential backoff (max 5 attempts), passing `outboxEventId` as the downstream idempotency key `[VERIFIED: packages/api/src/services/outbox/index.ts:201-250,312-443; handlers.ts:28-116]`. Adding an event type = a literal in `OutboxEventType`, a `OutboxEventPayloadMap` entry, and a `outboxHandlerRegistry` handler `[VERIFIED: handlers.ts:7-11,28-36,82-84]`. `dedupKey` gives DB-level enqueue dedup via `@@unique([organizationId, dedupKey])` `[VERIFIED: packages/db/prisma/schema/outbox.prisma:22-56]`.
- The **connection + config** layer is `IntegrationConnection` (`configJson`, `credentialsRef`, `lastSyncAt/lastSuccessAt/lastErrorAt`, `refreshLockedAt`, `tokenExpiresAt`, tenant-owning) `[VERIFIED: packages/db/prisma/schema/integration.prisma:3-36]` + `IntegrationSyncLog` `[VERIFIED: :59-80]`, loaded per-org with the overloaded `loadOrgIntegrationConnection(db, orgId, provider, { status?, optional? })` `[VERIFIED: packages/api/src/lib/integration-connection.ts:74-127]`. The **`configJson` mapping-storage precedent** is the Teams channel-mapping router (`channelMapping?: Record<string,string>` read/written on `connection.configJson`, projected to a public subset for non-admins) `[VERIFIED: packages/api/src/routers/integrations/teams.ts:16,32-36,132-153]`.
- The **flag gates already exist** — `integration.personio-sync` + `integration.bamboohr-sync` (category `integration`, owner `integrations`, `default:false`, ship-dark) `[VERIFIED: packages/feature-flags/src/flags-core.ts:269-286]`, both registered in the signoff registry as PENDING `[VERIFIED: packages/feature-flags/src/signoff-registry-flags.json:118-125]` with the `integration.personio-`/`integration.bamboohr-` gated prefixes `[VERIFIED: packages/feature-flags/src/signoff-registry-flags.ts:75-76]`. Do not mint new keys. The whole surface additionally sits behind `module.workforce-employees` `[VERIFIED: flags-core.ts:230; packages/api/src/middleware/require-workforce-flag.ts:25-42]`, mounted dark in `conditionalWorkforceRouters` `[VERIFIED: packages/api/src/root.ts:185-196,262]`.
- The **pull target models** are shipped: `Worker.displayName`/`email` (registry name/contact), `EmployeeProfile.countryCode`/`countryFields` JSON / promoted `etat`/`employmentStatus` / encrypted `*Last4` `[VERIFIED: packages/db/prisma/schema/employee.prisma:12-63]`, and the hire/termination anchors on `PersonnelFile.hireDate`/`.terminatedAt` `[VERIFIED: packages/db/prisma/schema/personnel.prisma:34-62]`. All three are tenant-owning (absent from `globalModels`, inherit `withTenantScope`).

**The single most important finding — the field partition is the loop-break.** A naive two-way sync loops forever: a pull writes a field → that write triggers a push → the push updates the HRIS → the HRIS emits a change → the next pull writes it back. Phase 95 breaks the loop **structurally, not with heuristics**: the HRIS-owned set (name/contact/position/department/status/FTE/hire/termination/mapped-custom-attrs) and the Contractor-Ops-owned set (invoice/payment/classification/compliance/national-IDs) are **disjoint**. The inbound pull writes ONLY the HRIS-owned allowlist; the outbound push carries ONLY CO-owned business events. Because no field is written by both directions, a pull can never trigger a push and a push can never be echoed back by a pull. The `syncHash` (below) then makes the pull *idempotent within* the HRIS-owned set so an unchanged hourly snapshot is a no-op. This is a **deterministic ownership split, not AI scoring** — the ROADMAP's `ai-integration-phase` hint is explicitly declined (per CONTEXT).

**The second finding (external-dep scoping).** Both live adapters need partner credentials the founder does not have yet — Personio a client-credentials app (client id/secret), BambooHR an OAuth 2.0 app (client id/secret). Both live paths are flag-deferred behind their existing `integration.*-sync` flag with `it.skipIf(!creds)` live tests. **The entire sync engine — field partition, allowlist mapper, sync-hash idempotency, pull orchestrator, push handlers, one-HRIS-per-org constraint, IDOR scoping — is buildable + testable NOW** against recorded provider fixtures (a local mock HRIS), mirroring the Phase 94 golden-fixture / conditional-skip posture. BambooHR's **custom-attribute mapping** carries a second gate (contract unverified) — ship standard-field sync first, gate the custom-attr path behind conditional-skip tests that auto-flip when the contract is confirmed.

**Primary recommendation:** (Wave 1) seed the RED net + the pure field-partition allowlist and loop-prevention primitives (GREEN); (Wave 2) add the `PERSONIO`/`BAMBOOHR` provider enum + the one-HRIS-per-org partial unique index + the `configJson` mapping schema; (Wave 3) build the two adapters on the framework behind their dark flags with recorded fixtures + conditional-skip live tests; (Wave 4) clone the pull orchestrator + add the three push outbox event types/handlers; (Wave 5) wire the tRPC router, cron handler, register-all, on-connect pull, and a web-vite settings surface; (Wave 6) close docs-follow-code (wiki + MEMORY + EXTERNAL-ENABLEMENT + graph/BM25).

## Corrections to CONTEXT (verified against live code — an executor MUST heed)

| # | CONTEXT / decision claim | Reality at HEAD | Consequence |
|---|--------------------------|-----------------|-------------|
| C1 | D-03 / code-context: "`invoice.paid` is already an outbox event type → add **two** (payment-status, classification-outcome)." | The only `OutboxEventType` literal is `'notification.dispatch'` `[VERIFIED: handlers.ts:28]`. `invoice.paid` exists **only** as a Stripe webhook type + an audit-log `action` string `[VERIFIED: packages/api/src/routers/__tests__/audit.test.ts:486]` — never an outbox event. | Plan 95-07 adds **all three** HRIS push event types + handlers (invoice-paid, payment-status, classification-outcome), not two. The producers that emit them (the invoice-paid / payment-status / classification-outcome mutations) must be found and given an `enqueueOutboxEvent` call inside their existing `$transaction`. |
| C2 | D-04: "partial unique index on `IntegrationConnection` (one HRIS-category connection per org)." | `IntegrationConnection` has `@@unique([organizationId, provider, userId])` `[VERIFIED: integration.prisma:31]`; Prisma `@@unique` **cannot express a filtered/partial index** — the schema even documents this limitation for `WebhookDelivery` `[VERIFIED: integration.prisma:124-128]`. | The one-HRIS-per-org constraint is a **raw-SQL partial unique index** authored in the migration body: `CREATE UNIQUE INDEX "integration_connection_one_hris_per_org" ON "IntegrationConnection"("organizationId") WHERE "provider" IN ('PERSONIO','BAMBOOHR')`. Not a Prisma `@@unique`. Insert collisions surface as P2002 → map to a typed `CONFLICT`/`PRECONDITION_FAILED` tRPC error. |
| C3 | CONTEXT: adapters go on "the v2.0 integration framework." | The `IntegrationProvider` enum ends at `ZATCA` `[VERIFIED: integration.prisma:138-160]` — **no `PERSONIO`/`BAMBOOHR`**. | Plan 95-03 adds both enum values (UPPER_SNAKE_CASE per `db:audit-enum-casing`) in the same migration as the partial index, then `pnpm db:generate`. |

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (SYNC-05):** **Allowlist projection in the pull mapper.** The pull writes only a typed HRIS-writable field allowlist (name, contact, position, department, employment status, FTE, hire/termination anchors, and the mapped registry/custom attributes). Financial/compliance/PII fields are **not present** in the pull DTO nor in the Prisma update payload — an HRIS value can never overwrite them. Code-enforced, unit-tested. Mandatory tests: cross-org leak + "protected field survives a conflicting HRIS pull".
- **D-02 (SYNC-02):** **Reuse the sync-orchestrator pattern** — cron-worker hourly (one run per connected integration) + a "Sync now" tRPC mutation + fire-and-forget on connect; `IntegrationSyncLog(INBOUND)` per run; `sync` advisory-lock; **delta via `updated-since` where the provider supports it, else snapshot-diff** against stored state; respect Personio 200 req/min + offset/limit≤200 pagination.
- **D-03 (SYNC-03):** **Reuse the `OutboxEvent` transactional outbox.** New handlers dispatch the connected HRIS adapter's push for invoice-paid / payment-status / classification-outcome. Push is transactional, idempotent (keyed on `outboxEventId`), retriable. No direct adapter calls inside domain mutations — the mutation only enqueues. (See correction C1 — three event types, not two.)
- **D-04 (SYNC-06):** **DB-enforced single HRIS per org + mapping in `configJson`.** Personio-XOR-BambooHR via a partial unique index (see C2). Field / custom-attribute mapping in `connection.configJson` (Teams precedent). Reuse `loadOrgIntegrationConnection` on both pull + push paths.
- **D-05:** Gate each adapter on its flag — `integration.personio-sync`, `integration.bamboohr-sync` (already registered; ship dark, flip post-deploy). Credentials via the `packages/integrations` store: **BambooHR OAuth 2.0** (encrypted token + refresh, refresh-lock) and **Personio client-credentials bearer**.
- **D-06:** **BambooHR custom-attribute contract is unverified** — gate/flag-defer the BambooHR *custom-attribute* mapping path with conditional-skip tests that auto-flip when the contract is confirmed; ship the verified standard-field sync first. **Personio endpoint-level rate limits are MEDIUM-confidence community data** — the 200 req/min figure is treated as a budget the limiter enforces conservatively; verify against the contract at enablement.
- **D-07:** Tenant `organizationId` from session; `writeAuditLog` on connect/disconnect + on push + on inbound writes; Zod `.strict()` on sync procedures; no `console.*` (`@contractor-ops/logger` / `createCronLogger` in the cron worker); no unsafe `as` on external payloads (`safeParse`).
- **D-08:** Reuse, don't rebuild — adapter framework, outbox, sync-orchestrator, IntegrationConnection/SyncLog, advisory-lock. Documentation-follows-code: new adapters + outbox types + sync flow → wiki (`integrations/personio.md`, `integrations/bamboohr.md`, `structure/cron-jobs.md`, domain page, `patterns/feature-flags.md`) in the same change set.

### Claude's Discretion (resolved in this research)
- Outbox event-type names + payloads → resolved in Pattern 3 / Open Q1.
- Snapshot-diff storage shape → resolved in Pattern 2 (`syncState` in `configJson`).
- `configJson` field-mapping schema → resolved in Pattern 4.
- Partial-failure handling + `IntegrationSyncLog` fields → resolved in Pattern 2 (per-record best-effort, mirror org-definition-sync).
- HRIS-category single-connection expression → resolved: provider-set `WHERE provider IN (...)` partial index (C2), not a new category column.
- Connect + field-mapping UI → resolved: new light settings surface reusing the integration-settings pattern (Open Q3).
- Adapter registration wiring → resolved: HEAVY lazy tier (both pull vendor REST clients).

### Deferred Ideas (OUT OF SCOPE)
- Bi-directional field-level **merge** → out; the source-of-truth split replaces it.
- BambooHR **custom-attribute mapping** → gated until the contract is verified (conditional-skip); standard-field sync ships first.
- Third+ HRIS providers, ATS/recruiting, performance reviews/OKR/1:1s → out of charter.
- AI-assisted conflict resolution → declined; SYNC-05 is deterministic.
- Employee self-service portal (P96), HR dashboard (P97), payroll export (P94) → other phases.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HRIS-SYNC-01 | Personio adapter on the v2.0 integration framework (client-credentials bearer, API v2, 200 req/min, offset pagination) | New `PersonioAdapter` (KsefAdapter-shaped, `supportsOAuth=false`) `[VERIFIED: ksef-adapter.ts:10-18; provider.ts:39-77]` + pull/push REST client fns; 200 req/min limiter + offset/limit≤200 pager; gate `integration.personio-sync` `[VERIFIED: flags-core.ts:269-277]`. Plan 95-04. |
| HRIS-SYNC-02 | Personio → CO one-way pull (people, contracts, departments, custom attributes) on hourly cron + on-demand | Pull orchestrator cloned from `google-workspace-sync-orchestrator.ts` `[VERIFIED: :278-364]`; `IntegrationSyncLog(INBOUND)` + `sync` advisory-lock; delta via `updated-since`; allowlist mapper (D-01). Plan 95-06. |
| HRIS-SYNC-03 | CO → HRIS push (invoice-paid, payment-status, classification-outcome) on event | Three new outbox event types + handlers dispatching the connected HRIS adapter push `[VERIFIED: handlers.ts:28-84; index.ts:201-250]` (correction C1). Plan 95-07. |
| HRIS-SYNC-04 | BambooHR adapter (OAuth 2.0, REST; same shape as Personio) | New `BambooHrAdapter` (JiraAdapter-shaped, `supportsOAuth=true` + `getOAuthConfig`) `[VERIFIED: jira-adapter.ts:92-101; provider.ts:17-32]`; same pull/push surface; **custom-attr path gated** (D-06). Plan 95-05. |
| HRIS-SYNC-05 | Source-of-truth split — HRIS owns registry fields; CO owns invoice/payment/compliance; on conflict registry updates from HRIS while financial/compliance lock against overwrite | Typed HRIS-writable allowlist + `projectToWritablePatch()` (protected fields absent from the DTO/update payload) `[VERIFIED: employee.prisma:12-63; personnel.prisma:34-62]`. Plan 95-01 (contract) + 95-06 (enforced). |
| HRIS-SYNC-06 | Per-org single-adapter choice (Personio OR BambooHR, not both) | Raw-SQL partial unique index on `IntegrationConnection(organizationId) WHERE provider IN ('PERSONIO','BAMBOOHR')` (C2). Plan 95-03. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Field-partition owner map + allowlist projection | API service (`packages/api/src/services/hris-sync/field-partition.ts`) | — | The SYNC-05 crux; pure + golden-testable; protected fields excluded at the type level. |
| Loop-prevention (sync-hash + change-origin) | API service (`hris-sync/sync-hash.ts`) | — | Pure hash + tag; makes the pull idempotent and asserts the disjoint partition. |
| Provider adapters (Personio/BambooHR OAuth+bearer+health+REST clients) | Integrations tier (`packages/integrations/src/adapters/*`) | — | OAuth/bearer + encrypted credential store + health already solved by the framework. |
| Inbound pull orchestration | API service (`hris-sync/pull-orchestrator.ts`) | DB (write `Worker`/`EmployeeProfile`/`PersonnelFile`) | Clone of the directory-sync orchestrator; `IntegrationSyncLog(INBOUND)` + advisory-lock + configJson snapshot. |
| Outbound push | API outbox handlers (`services/outbox/handlers.ts`) + producers | Integrations tier (adapter push) | Transactional, idempotent, retriable; mutations only enqueue. |
| Connection + config + one-HRIS-per-org | DB (`integration.prisma` migration) + API router | — | Partial unique index (C2) + `configJson` mapping (Teams precedent). |
| Flag gate | Feature-flags (`@contractor-ops/feature-flags`) | API middleware | `module.workforce-employees` + `integration.*-sync`; keys exist. |
| Connect + field-mapping UI | Client / SPA (`apps/web-vite`) | — | Page→Container→Hook→Component; loading/empty/error + i18n parity. |

## Standard Stack

### Core (all already installed — NO new external packages required)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@contractor-ops/integrations` | workspace:* | Personio/BambooHR adapters (OAuth/bearer + AES-256-GCM creds + health) | `[VERIFIED: provider.ts, register-all.ts]` |
| `zod` | v4 (in-tree) | `.strict()` sync-procedure inputs + `safeParse` on external payloads + mapping schema | `[VERIFIED: teams.ts:54-63]` |
| Prisma + `prisma-client` | ^7.8.0 | Read/write `Worker`/`EmployeeProfile`/`PersonnelFile`; new enum + partial index | `[VERIFIED: packages/db]` |
| `@contractor-ops/feature-flags` | workspace:* | `module.workforce-employees` + `integration.*-sync` gate | `[VERIFIED: flags-core.ts:230,269-286]` |
| `@contractor-ops/logger` | workspace:* | Structured logging (no `console.*`); `createCronLogger` in the worker | `[VERIFIED: org-definition-sync.ts:47]` |
| `node:crypto` | in-tree | `syncHash` (SHA-256) — no dep | stdlib |
| `@sentry/node` | in-tree | cron + outbox-exhaustion capture | `[VERIFIED: outbox/index.ts:66; org-definition-sync handler]` |

### Supporting (in-tree modules to reuse, not install)
| Module | Path | Purpose |
|--------|------|---------|
| directory-sync orchestrator | `packages/api/src/services/google-workspace-sync-orchestrator.ts` | The pull orchestrator to clone (SyncLog + advisory-lock + configJson snapshot + token refresh + failure record). |
| cron fan-out | `packages/api/src/services/org-definition-sync.ts:396-497` | CONNECTED-connection iteration, `lastSyncAt` throttle, region-aware tenant run. |
| advisory-lock | `packages/api/src/lib/advisory-lock.ts:36-49,78-104` | `sync` namespace (class_id 4) per-connection serialization. |
| outbox producer/drain/registry | `packages/api/src/services/outbox/{index,handlers}.ts` | Add three event types + handlers; producer `enqueueOutboxEvent`. |
| connection loader | `packages/api/src/lib/integration-connection.ts:74-127` | `loadOrgIntegrationConnection` on pull + push. |
| configJson mapping precedent | `packages/api/src/routers/integrations/teams.ts:16,32-36,132-153` | Field/attribute mapping storage + public projection. |
| adapter framework | `packages/integrations/src/{types/provider.ts,adapters/register-all.ts}` | New adapters + HEAVY-tier registration. |
| audit-writer | `packages/api/src/services/audit-writer.ts:66-121` | `writeAuditLog({ actorType, actorId, action, resourceType, resourceId, tx? })`. |
| workforce flag gate | `packages/api/src/middleware/require-workforce-flag.ts:25-42; root.ts:185-196,262` | `assertWorkforceEnabled` + dark mount. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Field partition = disjoint owner sets (loop-break by construction) | Bidirectional field-level merge + conflict scoring | Merge needs a tie-breaker per field and risks silent financial-data corruption; disjoint sets make loops structurally impossible. **Rejected by CONTEXT non-goal + D-01.** |
| Own credential store per adapter | HRIS aggregator (Merge / Finch / Kombo) | Aggregators are paid third parties + PII egress + break the own-credential-store reuse. **Rejected by research SUMMARY.** `[VERIFIED: .planning/research/SUMMARY.md:39]` |
| Personio = KsefAdapter-shaped bearer | Generic RFC-6749 OAuth2 client | Personio's bearer is **proprietary client-credentials, NOT RFC-6749** — a generic OAuth2 client mis-handles it. **Use the KSeF non-OAuth shape.** `[VERIFIED: .planning/research/SUMMARY.md:33]` |
| BambooHR OAuth 2.0 (JiraAdapter-shaped) | BambooHR Basic-auth API key | The API-key connector is deprecated for B2B multi-tenant. **OAuth 2.0 mandatory.** `[VERIFIED: .planning/research/SUMMARY.md:34,39]` |
| One-HRIS-per-org = raw-SQL partial unique index | Prisma `@@unique` on a new `integrationCategory` column | Prisma `@@unique` can't do a filtered index (schema documents this); a category column adds a write nobody else needs. **Partial index is minimal + DB-enforced.** (C2) |

**Installation:** none. Both adapters call vendor REST with `fetch` (no SDK — neither vendor ships a Node SDK) `[VERIFIED: .planning/research/SUMMARY.md:33-34]`, mirroring the existing pure-fetch adapters. If a planner elects a vendor SDK, gate the single install behind a `checkpoint:human-verify` task honoring the 7-day `minimumReleaseAge` + `pnpm audit` + typosquat check.

## Package Legitimacy Audit

**No external packages are required.** The engine uses only in-tree deps and `node:crypto`. Personio/BambooHR are pure-`fetch` REST adapters (no SDK). slopcheck / registry verification is **not applicable** unless a planner adds a vendor SDK — in which case: 7-day `minimumReleaseAge`, `pnpm audit`, `security:scan`, typosquat check, `checkpoint:human-verify`.

## Architecture Patterns

### System Architecture Diagram

```
        ┌──────────────── HR admin (web-vite SPA) ─────────────────┐
        │ hris settings page → container → hook (sole tRPC seam)    │
        │  connect · disconnect · Sync now · field-mapping          │
        └───────────────────────────┬──────────────────────────────┘
                                     │ hrisSync.* (gated: module.workforce-employees + integration.*-sync)
                                     ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │ tRPC hrisSyncRouter (conditionalWorkforceRouters — METHOD_NOT_FOUND dark)  │
   │  connect → loadOrgIntegrationConnection (XOR partial-index)  writeAuditLog │
   │  syncNow → runHrisPull(org, connectionId)  ── fire-and-forget on connect   │
   └───────────────┬───────────────────────────────────────┬───────────────────┘
        INBOUND pull │ (hourly cron + on-demand)             │ OUTBOUND push (event-driven)
                     ▼                                       ▼
  ┌───────────────────────────────────────┐   ┌───────────────────────────────────────────┐
  │ hris-sync/pull-orchestrator.ts         │   │ business mutation ($transaction):            │
  │  IntegrationSyncLog(INBOUND) + status  │   │   invoice-paid / payment-status /            │
  │  advisory-lock 'sync':hris:<connId>    │   │   classification-outcome                     │
  │  delta: updated-since | snapshot-diff  │   │  → enqueueOutboxEvent({tx, eventType:        │
  │  ┌─────────────────────────────────┐   │   │     'hris.<event>.push', dedupKey })          │
  │  │ field-partition.projectToWritable│  │   └───────────────────┬──────────────────────────┘
  │  │  → HrisWritableEmployeePatch     │   │                       ▼ (QStash drain → registry)
  │  │  (CO-owned/PII keys ABSENT)      │   │   ┌───────────────────────────────────────────┐
  │  │ syncHash gate → skip if unchanged│  │   │ outbox handler 'hris.<event>.push'          │
  │  └─────────────────────────────────┘   │   │  loadOrgIntegrationConnection(HRIS)          │
  │  writes Worker/EmployeeProfile/       │   │  change-origin guard (push ∌ HRIS-owned)     │
  │   PersonnelFile (allowlist only)      │   │  adapter.push*(...)  outboxEventId idempotent │
  │  writeAuditLog(INTEGRATION)           │   │  writeAuditLog(INTEGRATION)                   │
  └───────────────┬───────────────────────┘   └───────────────────┬──────────────────────────┘
                  │ adapter REST client                            │ adapter REST client
                  ▼                                                ▼
   ┌──────────────────────────────────────────────────────────────────────────┐
   │ packages/integrations adapters (HEAVY tier)                                │
   │  PersonioAdapter (bearer, KSeF-shaped, 200/min, offset≤200)  ← flag dark   │
   │  BambooHrAdapter  (OAuth 2.0, Jira-shaped, un-paginated list) ← flag dark  │
   │  live REST behind integration.*-sync + creds; else recorded-fixture path   │
   └──────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
packages/integrations/src/adapters/
├── personio-adapter.ts               # NEW: bearer (KSeF-shaped), 200/min limiter, offset≤200 pager, pull/push REST
├── bamboohr-adapter.ts               # NEW: OAuth 2.0 (Jira-shaped) getOAuthConfig/exchange/refresh, pull/push REST
├── register-all.ts                   # + register both in the HEAVY lazy tier
└── __tests__/fixtures/{personio,bamboohr}/*.json   # recorded provider responses (the local mock HRIS)

packages/api/src/services/hris-sync/
├── field-partition.ts                # owner map + HrisWritableEmployeePatch type + projectToWritablePatch()
├── sync-hash.ts                      # deterministic SHA-256 of the writable projection + change-origin tag
├── pull-orchestrator.ts              # clone of google-workspace-sync-orchestrator (INBOUND + advisory-lock + configJson snapshot)
├── mapping.ts                        # configJson field/custom-attr mapping schema (zod) + resolver
└── __tests__/                        # field-partition, sync-hash, pull-orchestrator, cross-org, push-loop tests

packages/api/src/services/outbox/
└── handlers.ts                       # + 3 event types + payload map + handlers (C1)

packages/api/src/routers/workforce/
└── hris-sync-router.ts               # NEW tRPC: connect, disconnect, syncNow, getMapping, setMapping

packages/api/src/root.ts              # mount hrisSync inside workforceRouters (conditionalWorkforceRouters)

packages/db/prisma/schema/
├── integration.prisma                # + PERSONIO, BAMBOOHR enum values
└── migrations/__<ts>_hris_two_way_sync/migration.sql   # enum add + partial unique index (raw SQL, C2)

apps/cron-worker/src/
├── jobs/handlers/hris-sync.ts        # NEW hourly handler → runScheduledHrisSync
├── jobs/registry.ts                  # + { name:'hris-sync', schedule: env.CRON_HRIS_SYNC_SCHEDULE }
└── env.ts                            # + CRON_HRIS_SYNC_SCHEDULE default '0 * * * *'

apps/web-vite/src/components/hris-sync/
├── hooks/use-hris-sync.ts            # sole tRPC boundary
├── hris-sync-settings-container.tsx  # section loading/empty/error
└── hris-sync-*.tsx                   # presentational (connect card, mapping table, sync-now)
```

### Pattern 1: Field-partition allowlist (the SYNC-05 crux)
**What:** a per-field owner map + a projection whose output type physically excludes CO-owned/PII fields, so the pull's Prisma update payload cannot carry them.
```typescript
// packages/api/src/services/hris-sync/field-partition.ts
export type FieldOwner = 'HRIS' | 'CONTRACTOR_OPS';

// The HRIS-writable target keys — the ONLY keys the pull may write.
export interface HrisWritableEmployeePatch {
  displayName?: string;                    // Worker.displayName            [VERIFIED: worker.prisma displayName]
  email?: string | null;                   // Worker.email                  [VERIFIED: worker.prisma email]
  employmentStatus?: 'ACTIVE'|'ON_LEAVE'|'SUSPENDED'|'TERMINATED';  // EmployeeProfile.employmentStatus [VERIFIED: employee.prisma:44,58-63]
  etat?: string | null;                    // EmployeeProfile.etat (Decimal(3,2) as string) [VERIFIED: employee.prisma:44]
  hireDate?: string | null;                // PersonnelFile.hireDate        [VERIFIED: personnel.prisma:49]
  terminatedAt?: string | null;            // PersonnelFile.terminatedAt    [VERIFIED: personnel.prisma:50]
  countryFieldsPatch?: Record<string, unknown>;  // MERGE into EmployeeProfile.countryFields — HRIS-owned mapped keys only (position/department/custom-attrs)
  // NOTE: NO invoice/payment/classification/compliance keys. NO *Encrypted/*Last4 (national IDs). NO organizationId/workerId.
}

// Given a raw HRIS record + the org's field mapping, produce ONLY the writable patch.
// Any HRIS attribute mapped to a CO-owned or unknown key is DROPPED (never throws — Personio omits
// unpermitted fields silently, so absence is normal). countryFieldsPatch is filtered to the configured
// HRIS-owned key allowlist; national-ID keys are rejected by the .strict() per-market schema anyway.
export function projectToWritablePatch(raw: HrisEmployeeRecord, mapping: HrisFieldMapping): HrisWritableEmployeePatch { /* ... */ }
```
**Enforcement proof (mandatory tests):** (a) feed a raw HRIS record that *includes* an invoice/payment/PESEL value mapped to a protected key → assert the returned patch has no such key and the DB row's protected columns are unchanged after applying it; (b) two-org: a Personio record for org A can never write org B's `EmployeeProfile` (tenant scope + `workerId` filtered by session org).

### Pattern 2: Pull orchestrator (clone of the directory-sync orchestrator)
**What:** a per-connection sync that logs, locks, diffs, and applies the allowlist patch. Mirrors `processDirectorySync` `[VERIFIED: google-workspace-sync-orchestrator.ts:278-364]`.
```typescript
export async function runHrisPull(params: { organizationId: string; connectionId: string; actorUserId: string | null }) {
  const syncLog = await prisma.integrationSyncLog.create({ data: {
    organizationId, integrationConnectionId: connectionId, direction: 'INBOUND', syncType: 'hris_employee_sync', status: 'STARTED', startedAt: new Date(),
  }});
  const lockKey = `hris:${connectionId}`;                                   // 'sync' namespace, class_id 4 [VERIFIED: advisory-lock.ts:45-49]
  if (!(await tryAcquireAdvisoryLock(prisma, 'sync', lockKey))) { /* mark SUCCESS skipped:already-running, return */ }
  try {
    const connection = await loadAndValidateConnection(organizationId, connectionId);  // status===CONNECTED, org match
    const adapter = getAdapter(connection.provider);                        // PersonioAdapter | BambooHrAdapter
    const creds = await ensureFreshCredentials(adapter, connectionId, decryptCredentials(connection.credentialsRef, credLabel));
    const since = (connection.configJson as HrisSyncState)?.lastSuccessfulSyncAt;     // delta cursor
    const remote = await adapter.listEmployees(creds, { updatedSince: since });        // Personio delta; BambooHR full list
    const mapping = resolveMapping(connection.configJson);
    for (const rec of remote) {                                             // per-record best-effort (mirror org-definition-sync:306-323)
      const patch = projectToWritablePatch(rec, mapping);
      const hash = syncHash(patch);
      if (hash === storedHashFor(connection, rec.externalId)) continue;     // idempotent: unchanged snapshot = no-op
      await applyPatchToWorker(tenantDb, organizationId, rec.externalId, patch, { origin: 'HRIS_PULL' });  // ExternalLink-joined; writeAuditLog INTEGRATION
    }
    await persistSyncState(connectionId, { lastSuccessfulSyncAt: new Date(), hashes });  // in configJson (snapshot-diff store)
    /* update syncLog SUCCESS + connection lastSyncAt/lastSuccessAt */
  } catch (err) { await recordSyncFailure(syncLog.id, connectionId, msg); throw err; }
  finally { await releaseAdvisoryLock(prisma, 'sync', lockKey).catch(() => undefined); }
}
```
**Delta vs snapshot-diff (D-02):** Personio API v2 supports an `updated_since` filter → pass the stored cursor. BambooHR's employee list is **un-paginated and has no updated-since** `[VERIFIED: .planning/research/SUMMARY.md:34]` → pull the full list and diff via `syncHash` against `configJson.hashes` (only changed records write). Both are idempotent by construction.

### Pattern 3: Outbound push — three new outbox event types (correction C1)
```typescript
// handlers.ts — add THREE literals (invoice.paid is NOT already an outbox type)
export type OutboxEventType =
  | 'notification.dispatch'
  | 'hris.invoice-paid.push'
  | 'hris.payment-status.push'
  | 'hris.classification-outcome.push';

export interface OutboxEventPayloadMap {
  'notification.dispatch': NotificationEvent;
  'hris.invoice-paid.push': { workerId: string; invoiceId: string; paidAt: string; amount: string; currency: string };
  'hris.payment-status.push': { workerId: string; paymentId: string; status: string; occurredAt: string };
  'hris.classification-outcome.push': { workerId: string; classificationId: string; outcome: string; decidedAt: string };
}

// handler — resolve the org's HRIS connection, guard, push idempotently
const handleHrisPush = (event): OutboxHandler<'hris.invoice-paid.push'> => async (payload, ctx) => {
  const connection = await loadOrgIntegrationConnection(tenantDb, ctx.organizationId, hrisProviderFor(ctx.organizationId), { optional: true, status: 'CONNECTED' });
  if (!connection) return;                                                   // no HRIS connected → nothing to push (no-op, not an error)
  if (!evaluate('integration.<provider>-sync', { organizationId: ctx.organizationId, region }).enabled) return;  // dark → no-op
  assertNotHrisOwnedField(event);                                            // change-origin guard: push payload MUST NOT carry an HRIS-owned key
  const adapter = getAdapter(connection.provider);
  await adapter.pushEmployeeEvent(creds, { ...payload, idempotencyKey: ctx.outboxEventId });   // outboxEventId = downstream idempotency key
  await writeAuditLog({ organizationId: ctx.organizationId, actorType: 'INTEGRATION', action: 'hris.push.<event>', resourceType: 'WORKER', resourceId: payload.workerId });
};
```
**Producers:** the invoice-paid / payment-status / classification-outcome mutations each add one `enqueueOutboxEvent({ tx, organizationId, eventType, payload, dedupKey: `${workerId}:${eventType}:${businessEventId}` })` inside their existing `$transaction` — the mutation never calls the adapter directly (D-03). `dedupKey` collapses a retried producer transaction; `outboxEventId` collapses a redriven dispatch.

### Pattern 4: `configJson` mapping schema (Teams precedent)
```typescript
// hris-sync/mapping.ts — mirrors teams channelMapping [VERIFIED: teams.ts:16,54-63]
const hrisFieldMappingSchema = z.object({
  standard: z.object({
    displayName: z.string().optional(),          // HRIS attr key → Worker.displayName
    email: z.string().optional(),
    position: z.string().optional(),             // → countryFields.<positionKey>
    department: z.string().optional(),
    employmentStatus: z.string().optional(),
    hireDate: z.string().optional(),
    terminatedAt: z.string().optional(),
  }).strict(),
  customAttributes: z.record(z.string(), z.string()).optional(),  // HRIS custom-attr key → countryFields key; BambooHR path GATED (D-06)
}).strict();

interface HrisSyncState {                          // ALSO stored in configJson (snapshot-diff store)
  lastSuccessfulSyncAt?: string;
  hashes?: Record<string, string>;                 // externalId → syncHash (BambooHR snapshot-diff)
}
```
The public projection (mirror `publicTeamsConfig` `[VERIFIED: teams.ts:32-36]`) exposes only the mapping to non-admins — never `credentialsRef` or the raw sync-state.

### Pattern 5: Adapter registration + flag gate + dark mount
- Register both adapters in the **HEAVY lazy tier** of `register-all.ts` (they pull vendor REST clients) `[VERIFIED: register-all.ts:69-140]`; the pull/push paths `await loadHeavyAdapters()` before `getAdapter(...)` (mirror the GWS sync).
- Per-request gate on the router body: `assertWorkforceEnabled(ctx.organizationId, ctx.region)` `[VERIFIED: require-workforce-flag.ts:25-42]` + `evaluate('integration.<provider>-sync', ...)`; mount `hrisSync` in `workforceRouters` so it is absent (METHOD_NOT_FOUND) when `module.workforce-employees` is OFF `[VERIFIED: root.ts:185-196,262]`. Dev with `FLAG_SIGNOFF_BYPASS=local`.

### Anti-Patterns to Avoid
- **Bidirectional field-level merge.** Disjoint owner sets are the loop-break — never let both directions write one field.
- **Assuming `invoice.paid` is an outbox type (C1).** It is not — add all three HRIS push types.
- **Prisma `@@unique` for one-HRIS-per-org (C2).** Use a raw-SQL partial unique index.
- **Generic RFC-6749 client for Personio.** Its bearer is proprietary client-credentials → KSeF-shaped adapter.
- **BambooHR Basic-auth API key.** Deprecated for B2B → OAuth 2.0 mandatory.
- **Pull writing national-ID or financial columns.** They are absent from the allowlist type — keep it that way; a pull that "needs" them is a bug.
- **Direct adapter calls inside domain mutations.** Enqueue an outbox event; the handler pushes.
- **Hard-blocking on a Personio/BambooHR account.** The engine is fully testable against recorded fixtures; live paths are conditional-skip behind their flag.
- **Inventing flag keys.** `integration.personio-sync` / `integration.bamboohr-sync` exist.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sync orchestration (log + lock + snapshot + token refresh + failure record) | New orchestrator | Clone `google-workspace-sync-orchestrator.ts` | Every seam proven. `[VERIFIED: :278-364]` |
| Per-org sync serialization | New lock | `tryAcquireAdvisoryLock(prisma,'sync',key)` | `sync` namespace exists (class_id 4). `[VERIFIED: advisory-lock.ts:45-49]` |
| Event-driven push with retry/idempotency | New queue | `enqueueOutboxEvent` + handler registry | Transactional outbox with backoff + `outboxEventId` idempotency. `[VERIFIED: outbox/index.ts:201-250]` |
| OAuth exchange/refresh + encrypted creds | New auth plumbing | `IntegrationProviderAdapter` + `getOAuthConfig` | AES-256-GCM store + refresh-lock done. `[VERIFIED: provider.ts:39-77]` |
| Per-org connection load | Ad-hoc findFirst | `loadOrgIntegrationConnection` | Tenant-scoped + status filter + optional overload. `[VERIFIED: integration-connection.ts:74-127]` |
| Field/attribute mapping storage | New table | `connection.configJson` (+ public projection) | Teams precedent. `[VERIFIED: teams.ts:132-153]` |
| Dark-flag gating | New check | `assertWorkforceEnabled` + `evaluate('integration.*-sync')` + conditional root spread | Three-layer flag-off established. `[VERIFIED: require-workforce-flag.ts; root.ts:185-196]` |
| Cron fan-out | New scheduler | cron registry entry + `runScheduled*` | region-aware iterate + `lastSyncAt` throttle. `[VERIFIED: org-definition-sync.ts:396-497; registry.ts:64-67]` |

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Writes: `Worker` (displayName/email), `EmployeeProfile` (employmentStatus/etat/countryFields merge), `PersonnelFile` (hireDate/terminatedAt) — all via the allowlist patch. Reads for push: `Invoice`/`Payment`/classification. Sync state (`lastSuccessfulSyncAt` + per-record hashes) lives in `connection.configJson` (no new model). `ExternalLink` joins HRIS `externalId` → `workerId` `[VERIFIED: integration.prisma:38-57]`. | New migration: `PERSONIO`/`BAMBOOHR` enum + partial unique index (C2/C3). No new table required. |
| Live service config | Personio client id/secret + BambooHR OAuth client id/secret are env vars; per-org tokens in `IntegrationConnection.credentialsRef` (AES-256-GCM). | Add `PERSONIO_*` / `BAMBOOHR_CLIENT_ID/SECRET` to `.env.example` + integrations env schema; live path dark until set. |
| Secrets/env vars | New: `PERSONIO_CLIENT_ID/SECRET`, `BAMBOOHR_CLIENT_ID/SECRET`, `CRON_HRIS_SYNC_SCHEDULE`. | `.env.example` + package env schema; `pnpm check:no-process-env` when touching env access. |
| Build artifacts | New enum → `pnpm db:generate`; new outbox event types are compile-time only. | Regenerate Prisma client; `pnpm typecheck --filter=@contractor-ops/api`. |

**The canonical question — after every file is updated, what runtime state still holds the old assumption?** The Prisma client (regenerate after the enum add) and the migration (apply at deploy — `__`-prefixed, drift-blocked). No cache/OS state.

## Common Pitfalls

### Pitfall 1: Infinite write-back loop (the headline risk)
**What goes wrong:** pull writes a field → triggers a push → HRIS emits a change → next pull writes it back → loop.
**How to avoid:** **disjoint owner partition** — the pull writes only HRIS-owned fields (which have no push trigger); the push carries only CO-owned business events (which the pull allowlist can't map). No field is written by both directions, so no cycle exists. `syncHash` makes the pull idempotent (unchanged snapshot = no-op write, no `updatedAt` churn, no spurious event). A `change-origin` guard (`assertNotHrisOwnedField`) fails loudly if a future dev widens the allowlist into overlap. Deterministic **HRIS-wins** for the HRIS-owned set; **CO-wins** for CO-owned (pull can't touch them). No merge, no AI.

### Pitfall 2: `invoice.paid` is NOT already an outbox event (C1)
**What goes wrong:** a plan adds only two event types assuming `invoice.paid` exists.
**How to avoid:** add **three** (`hris.invoice-paid.push`, `hris.payment-status.push`, `hris.classification-outcome.push`) — literal + payload-map + handler each `[VERIFIED: handlers.ts:28-84]` — and find the three producer mutations to enqueue from.

### Pitfall 3: Prisma `@@unique` cannot enforce one-HRIS-per-org (C2)
**What goes wrong:** an executor writes `@@unique([organizationId, category])` and it either doesn't filter or requires a spurious column.
**How to avoid:** raw-SQL **partial** unique index in the migration body: `CREATE UNIQUE INDEX ... ON "IntegrationConnection"("organizationId") WHERE "provider" IN ('PERSONIO','BAMBOOHR')`. Catch P2002 on connect → typed `CONFLICT` tRPC error ("another HRIS is already connected"). Add a two-connection integration test.

### Pitfall 4: PII / financial columns reachable by the pull
**What goes wrong:** the mapper writes `peselEncrypted`/`ssnEncrypted` or an invoice field from an HRIS attribute.
**How to avoid:** `HrisWritableEmployeePatch` has no such keys — they are absent at the type level, and the `.strict()` per-market `countryFields` schema rejects national identifiers `[VERIFIED: employee.prisma:22-25]`. National IDs are CO-owned and never HRIS-writable. Test: a raw record with a PESEL mapped to a protected key leaves the encrypted column untouched.

### Pitfall 5: Cross-org leak (IDOR) on pull writes + push reads
**What goes wrong:** a pull for org A writes org B's worker; a push reads another org's connection.
**How to avoid:** `Worker`/`EmployeeProfile`/`PersonnelFile` are tenant-owning (inherit `withTenantScope`) `[VERIFIED: employee.prisma:7-10; personnel.prisma:15-18]`; the pull runs inside `tenantStore.run({ organizationId, region }, ...)` (mirror the cron) and resolves the target worker via `ExternalLink` filtered by org; the push handler resolves the connection via `loadOrgIntegrationConnection(tenantDb, ctx.organizationId, ...)`. Two-org regression test mandatory.

### Pitfall 6: Personio rate limit + pagination (MEDIUM-confidence)
**What goes wrong:** the pull bursts past 200 req/min or assumes >200/page.
**How to avoid:** a conservative token-bucket limiter (≤200 req/min per credential) inside the adapter + offset/limit pagination capped at 200 `[VERIFIED: .planning/research/SUMMARY.md:33]`. Personio credentials are **attribute-scoped** — unpermitted fields are silently omitted (absence is normal, not an error) → the mapper treats missing fields as "unmapped", never throws. The 200/min figure is community data (MEDIUM) — verify against the contract at enablement; the limiter is set conservatively so a tighter real limit still passes.

### Pitfall 7: BambooHR custom-attribute contract unverified (D-06)
**What goes wrong:** the custom-attr mapping path is built against an unconfirmed contract and breaks at enablement.
**How to avoid:** ship **standard-field** BambooHR sync first; gate the custom-attribute mapping path behind conditional-skip tests (`it.skipIf(!BAMBOOHR_CUSTOM_ATTR_VERIFIED)`) that auto-flip when the contract is confirmed. Record the gate in EXTERNAL-ENABLEMENT.

### Pitfall 8: Migration drift / enum casing
**What goes wrong:** enum added lowercase, or the migration is auto-applied.
**How to avoid:** `PERSONIO`/`BAMBOOHR` UPPER_SNAKE_CASE (`db:audit-enum-casing`); author the migration `__`-prefixed / unapplied (drift-blocked posture), `pnpm db:generate`, apply at deploy.

### Pitfall 9: web-vite data-layer / i18n guards on the settings UI
**How to avoid:** Page = thin composer (no tRPC); Container calls the hook; `use-hris-sync.ts` is the sole tRPC boundary; Component is presentational `[VERIFIED: CLAUDE.md §web-vite UI layers]`. Every string via `useTranslations` with en/de/pl/ar + en-US parity; mandatory loading/empty/error; run `check:web-vite-*` + `i18n:parity`.

## Code Examples

### syncHash (deterministic, idempotency + snapshot-diff)
```typescript
// packages/api/src/services/hris-sync/sync-hash.ts
import { createHash } from 'node:crypto';
export function syncHash(patch: HrisWritableEmployeePatch): string {
  // Stable key order so equal patches hash equal regardless of provider field order.
  const normalized = JSON.stringify(patch, Object.keys(patch).sort());
  return createHash('sha256').update(normalized).digest('hex');
}
```

### Personio adapter skeleton (KSeF-shaped bearer)
```typescript
// packages/integrations/src/adapters/personio-adapter.ts  (mirror [VERIFIED: ksef-adapter.ts:10-18])
export class PersonioAdapter extends BaseAdapter {
  readonly slug = 'personio';
  readonly displayName = 'Personio';
  readonly supportsOAuth = false;            // proprietary client-credentials bearer, NOT RFC-6749
  readonly supportsWebhooks = false;
  private async bearer(creds: CredentialBlob): Promise<string> { /* POST /auth → short-lived bearer, cached to tokenExpiresAt */ }
  async listEmployees(creds: CredentialBlob, opts: { updatedSince?: string }): Promise<HrisEmployeeRecord[]> {
    // GET /v2/persons?updated_since=...&offset=..&limit=200 under the 200 req/min limiter; safeParse each page
  }
  async pushEmployeeEvent(creds: CredentialBlob, payload: HrisPushPayload): Promise<void> { /* PATCH attribute; idempotencyKey header */ }
}
```

### BambooHR adapter skeleton (Jira-shaped OAuth 2.0)
```typescript
// packages/integrations/src/adapters/bamboohr-adapter.ts  (mirror [VERIFIED: jira-adapter.ts:92-101; provider.ts:17-32])
export class BambooHrAdapter implements IntegrationProviderAdapter {
  readonly slug = 'bamboohr'; readonly displayName = 'BambooHR';
  readonly supportsOAuth = true; readonly supportsWebhooks = false;
  getOAuthConfig(): OAuthConfig {
    return { clientIdEnvVar: 'BAMBOOHR_CLIENT_ID', clientSecretEnvVar: 'BAMBOOHR_CLIENT_SECRET',
             authorizationUrl: 'https://<subdomain>.bamboohr.com/authorize.php',
             tokenUrl: 'https://<subdomain>.bamboohr.com/token.php', scopes: ['openid','email'],
             redirectPath: '/api/oauth/bamboohr/callback' };
  }
  async exchangeCodeForTokens(code, redirectUri) { /* fetch tokenUrl → CredentialBlob */ }
  async refreshToken(creds) { /* ... */ }
  async listEmployees(creds, _opts) { /* GET /v1/employees/directory (un-paginated) → snapshot-diff */ }
  async pushEmployeeEvent(creds, payload) { /* POST /v1/employees/<id>/... idempotencyKey */ }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| HRIS = out of scope (contractor-only ops) | Two-way HRIS sync (Personio + BambooHR) | Phase 95 (this) | Two new adapters; pull orchestrator; three push outbox types; field partition. |
| Directory sync = notify-only (Google Workspace) | Employee master-data pull that WRITES registry fields | Phase 95 | Cloned orchestrator, but applies an allowlist patch instead of just notifying. |
| Outbox = notifications only | + HRIS push events | Phase 95 | Three new event types + handlers. |

**Deprecated/outdated:** Personio API **v1** deprecates 2026-07-31 → use **v2** `[VERIFIED: .planning/research/SUMMARY.md:220]`; BambooHR Basic-auth API key deprecated for B2B → OAuth 2.0.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Disjoint owner partition makes loops structurally impossible | Pitfall 1 | If a future field is co-owned, the change-origin guard fails loudly rather than looping — safe. |
| A2 | Personio API v2 supports `updated_since`; BambooHR list is un-paginated → snapshot-diff | Pattern 2 | If Personio delta differs, fall back to snapshot-diff (already implemented for BambooHR) — no redesign. |
| A3 | `syncHash` over the writable projection is sufficient idempotency | Pattern 2 | Hash collisions are negligible (SHA-256); a missed change surfaces next full pull. |
| A4 | No new Prisma model needed (sync-state in configJson) | Runtime State | If per-record audit history is wanted later, add a model + `__` migration; discretion, not required. |
| A5 | `invoice.paid`/payment/classification producer mutations exist to hook | Pattern 3 / C1 | Executor must locate them (semble "invoice paid mutation", "payment status", "classification outcome"); if a business event lacks a single mutation seam, enqueue at the nearest committing `$transaction`. |
| A6 | Personio bearer ≈ KSeF non-OAuth credential shape | Standard Stack | If Personio needs a refresh cycle, mirror the token-refresh buffer from the GWS orchestrator. |

## Open Questions (RESOLVED)

1. **Outbox event-type names + payloads (Discretion).** RESOLVED: `hris.invoice-paid.push` / `hris.payment-status.push` / `hris.classification-outcome.push`, payloads carry `workerId` + the business id + minimal denormalized fields (Pattern 3). Three types, not two (C1). Plan 95-07.
2. **Snapshot-diff storage (Discretion).** RESOLVED: `configJson.hashes` (externalId→syncHash) + `configJson.lastSuccessfulSyncAt` — no new model (Pattern 4). Plan 95-06.
3. **Connect + field-mapping UI (Discretion).** RESOLVED: a new light HRIS settings surface (connect card + mapping table + Sync-now) reusing the integration-settings pattern; mandatory loading/empty/error + i18n parity. Plan 95-08.
4. **HRIS-category single-connection expression (Discretion).** RESOLVED: raw-SQL partial unique index `WHERE provider IN ('PERSONIO','BAMBOOHR')` — provider-set, not a new column (C2). Plan 95-03.
5. **BambooHR custom-attributes (D-06 gate).** RESOLVED: standard-field sync ships; custom-attr path conditional-skip behind a verification gate (Pitfall 7); EXTERNAL-ENABLEMENT row. Plan 95-05.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `packages/integrations` framework | both adapters | ✓ | in-tree | — |
| directory-sync orchestrator (clone source) | pull | ✓ | in-tree | — |
| transactional outbox | push | ✓ | in-tree | — |
| `advisory-lock` `sync` namespace | pull serialization | ✓ | `advisory-lock.ts:45-49` | — |
| `integration.personio-sync` / `integration.bamboohr-sync` flags | gating | ✓ | `flags-core.ts:269-286` | — |
| `module.workforce-employees` gate | dark mount | ✓ | `flags-core.ts:230` | — |
| Phase 90 `EmployeeProfile` + Phase 91 `PersonnelFile` | pull target | ✓ | `employee.prisma`, `personnel.prisma` | — |
| Personio client-credentials app (id/secret) | Personio live pull/push | ✗ (partner setup) | — | **Engine + fixtures ship; live path dark behind `integration.personio-sync`** |
| BambooHR OAuth app (id/secret) | BambooHR live pull/push | ✗ (partner setup) | — | **Engine + fixtures ship; live path dark behind `integration.bamboohr-sync`** |
| BambooHR custom-attribute contract | custom-attr mapping | ✗ (unverified) | — | **Standard-field sync ships; custom-attr path conditional-skip until verified** |

**Missing dependencies with no fallback:** none — every external dependency has a buildable-now fallback (recorded fixtures / standard-field-only / non-live path).

## Validation Architecture

> `nyquist_validation: true` — section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (`vitest run`) `[VERIFIED: outbox/__tests__/outbox.test.ts]` |
| Config file | `packages/api/vitest.config.ts`; `packages/integrations/vitest.config.ts` |
| Quick run | `pnpm --filter @contractor-ops/api test <path>` / `pnpm --filter @contractor-ops/integrations test <path>` |
| Full suite | `pnpm --filter @contractor-ops/api test` (scoped by path) |

**MEMORY WARNING:** NEVER run the full web-vite suite unscoped — always `pnpm --filter @contractor-ops/web-vite test <path>` `[VERIFIED: MEMORY feedback_test_run_memory]`.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HRIS-SYNC-05 | `projectToWritablePatch` drops CO-owned/PII keys; protected field survives a conflicting HRIS pull | unit | `pnpm -F @contractor-ops/api test field-partition` | ❌ Wave 1 |
| HRIS-SYNC-02 | `syncHash` deterministic; equal patch → skip write (idempotent pull) | unit | `pnpm -F @contractor-ops/api test sync-hash hris-pull` | ❌ Wave 1 RED |
| HRIS-SYNC-03 | push loop-prevention: a pull emits no push event; push payload carries no HRIS-owned key (guard) | unit | `pnpm -F @contractor-ops/api test hris-push-loop` | ❌ Wave 1 RED |
| HRIS-SYNC-06 | one-HRIS-per-org: second HRIS connect → P2002/CONFLICT | integration | `pnpm -F @contractor-ops/api test hris-one-per-org` | ❌ Wave 1 RED |
| HRIS-SYNC-* | cross-org: a Personio record for org A never writes org B's worker | integration | `pnpm -F @contractor-ops/api test hris-cross-org` | ❌ Wave 1 RED |
| HRIS-SYNC-01 | Personio adapter bearer/pager/limiter + payload map; live call `it.skipIf(!creds)` | unit + conditional | `pnpm -F @contractor-ops/integrations test personio` | ❌ Wave 1 RED |
| HRIS-SYNC-04 | BambooHR adapter OAuthConfig + list/push; standard-field map; custom-attr `it.skipIf(!verified)`; live `it.skipIf(!creds)` | unit + conditional | `pnpm -F @contractor-ops/integrations test bamboohr` | ❌ Wave 1 RED |
| HRIS-SYNC-02 | pull orchestrator: SyncLog(INBOUND) STARTED→SUCCESS, advisory-lock, delta cursor, per-record best-effort | integration | `pnpm -F @contractor-ops/api test hris-pull-orchestrator` | ❌ Wave 1 RED |
| HRIS-SYNC-03 | outbox: three event types dispatch to the connected adapter; dark/no-connection → no-op; `outboxEventId` idempotent | unit | `pnpm -F @contractor-ops/api test hris-outbox` | ❌ Wave 1 RED |
| HRIS-SYNC-* | router mounted dark: absent from appRouter when `module.workforce-employees` OFF (METHOD_NOT_FOUND) | unit (regression) | `pnpm -F @contractor-ops/api test root-router-gating` | ✅ extend |

### Sampling Rate
- **Per task commit:** scoped `pnpm -F @contractor-ops/<pkg> test <changed-path>` (< 30s).
- **Per wave merge:** `pnpm -F @contractor-ops/api test` (scoped) + `pnpm -F @contractor-ops/integrations test` + `pnpm typecheck --filter=@contractor-ops/api` + touched guards (`lint:schema`, `lint:audit-log`, `lint:raw-sql`, `lint:logs`, `i18n:parity`, `check:web-vite-*`, `pnpm standards:check`, `pnpm check:no-process-env` when env touched).
- **Phase gate:** full scoped api + integrations suites green + `pnpm check:wiki-brain` green before `/gsd:verify-work`.

### Wave 0/1 Gaps (the RED net)
- [ ] `packages/api/src/services/hris-sync/__tests__/field-partition.test.ts` — allowlist projection + protected-field-survives (GREEN as part of 95-01, the pure module)
- [ ] `.../sync-hash.test.ts` — deterministic hash + idempotent-skip (GREEN in 95-01)
- [ ] `.../hris-pull-orchestrator.test.ts` — SyncLog/lock/delta/best-effort (RED via missing orchestrator)
- [ ] `.../hris-cross-org.test.ts` — two-org IDOR (RED)
- [ ] `.../hris-one-per-org.test.ts` — partial-index P2002 (RED via missing enum/migration)
- [ ] `.../hris-outbox.test.ts` + `.../hris-push-loop.test.ts` — three event types + change-origin guard (RED via missing handlers)
- [ ] `packages/integrations/src/adapters/__tests__/personio-adapter.test.ts` — bearer/pager/limiter + live `skipIf` (RED via missing adapter)
- [ ] `packages/integrations/src/adapters/__tests__/bamboohr-adapter.test.ts` — OAuthConfig + list/push + custom-attr/live `skipIf` (RED)
- [ ] `packages/api/src/routers/workforce/__tests__/hris-sync-router.test.ts` — connect XOR + syncNow + mapping + flag gate + audit (RED)

## Security Domain

> `security_enforcement` absent = enabled. Included.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | **yes** | `assertWorkforceEnabled` + `integration.*-sync` gate; `withTenantScope` on Worker/EmployeeProfile/PersonnelFile; HR-role RBAC (P89) on connect/disconnect/mapping; one-HRIS-per-org DB constraint. |
| V5 Input Validation | **yes** | Zod `.strict()` on connect/syncNow/mapping; `safeParse` on every Personio/BambooHR payload (no unsafe `as`); reject injected `organizationId`. |
| V6 Cryptography | no (reuse) | Tokens in AES-256-GCM `credentialsRef` (P90 keys); national IDs stay in encrypted columns, never HRIS-writable. |
| V7/V8 Logging & Data Protection | **yes** | `writeAuditLog` on connect/disconnect/pull-write/push; `outboxEventId` idempotency; no PII/token in logs. |

### Known Threat Patterns for {multi-tenant HRIS two-way sync}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Write-back loop / data corruption | Tampering | Disjoint owner partition + syncHash idempotency + change-origin guard (Pitfall 1). |
| HRIS overwrites a financial/compliance field | Tampering | Allowlist patch type excludes CO-owned keys (D-01). |
| Cross-org employee write/read (IDOR) | Information Disclosure | `withTenantScope` + `tenantStore.run` + `ExternalLink`/`loadOrgIntegrationConnection` filtered by session org + two-org test. |
| Three-way sync (two HRIS on one org) | Tampering | Partial unique index → P2002 → CONFLICT (C2). |
| National ID leaking via pull/logs | Information Disclosure | National-ID keys absent from the allowlist; `.strict()` countryFields rejects them; never logged. |
| Flag-off / signoff-PENDING adapter still syncs | Elevation | Conditional root spread (METHOD_NOT_FOUND) + per-request `assertWorkforceEnabled` + `evaluate('integration.*-sync')`. |
| OAuth/bearer token theft or cross-org reuse | Spoofing | Tokens in AES-256-GCM `credentialsRef` keyed on org+provider; refresh-lock; live path dark until APPROVED. |

## Project Constraints (from CLAUDE.md)
- **Tenant from session** (`organizationId`, region) — never client input; `withTenantScope` + `tenantStore.run` on the cron.
- **`writeAuditLog`** on connect/disconnect + pull writes + push (pass `tx` in transactions).
- **Zod `.strict()`** on sync procedures; `safeParse` on Personio/BambooHR payloads (no unsafe `as`).
- **No `console.*`** — `@contractor-ops/logger`; `createCronLogger` in the worker.
- **Feature flags** only via `@contractor-ops/feature-flags` (`module.workforce-employees` + `integration.*-sync`); keys exist.
- **i18n parity** en/de/pl/ar (+ en-US); no hardcoded strings; mandatory loading/empty/error states.
- **web-vite layering:** Page (thin) → Container → Hook (sole tRPC) → Component; run `check:web-vite-*`.
- **New env** (`PERSONIO_*`/`BAMBOOHR_*`/`CRON_HRIS_SYNC_SCHEDULE`) → `.env.example` + package env schema; `pnpm check:no-process-env`.
- **Prisma enum** UPPER_SNAKE_CASE (`db:audit-enum-casing`); migration `__`-prefixed / unapplied (drift-blocked); raw SQL for the partial index (`lint:raw-sql` annotation).
- **Deps:** no new external packages; any SDK → 7-day `minimumReleaseAge` + `pnpm audit` + `security:scan` + `checkpoint:human-verify`.
- **Docs-follow-code:** wiki (`integrations/personio.md`, `integrations/bamboohr.md`, `integrations/_index`, `structure/cron-jobs.md`, `structure/api-routers-catalog.md`, `structure/prisma-schema-areas.md`, `patterns/feature-flags.md`, new `domains/hris-sync.md`), `MEMORY.md` invariant, `EXTERNAL-ENABLEMENT.md` rows, graph/BM25 — SAME change set; `pnpm check:wiki-brain`.
- **Git safety:** no `git stash`/`reset --hard`/`restore` without explicit approval.
- **`.planning/phases` is a symlink** — stage planning commits via real `milestones/v7.0-phases/` path.

## Sources

### Primary (HIGH confidence — in-tree, current HEAD)
- `packages/integrations/src/types/provider.ts` + `adapters/{register-all,jira-adapter,ksef-adapter}.ts` — adapter contract, OAuthConfig, lazy registration, OAuth vs bearer shapes
- `packages/api/src/services/google-workspace-sync-orchestrator.ts` — the pull orchestrator to clone (SyncLog + advisory-lock + configJson snapshot + token refresh + failure record)
- `packages/api/src/services/org-definition-sync.ts` — cron fan-out + `lastSyncAt` throttle + region-aware tenant run + per-record best-effort
- `packages/api/src/services/outbox/{index,handlers}.ts` + `packages/db/prisma/schema/outbox.prisma` — transactional outbox producer/drain/registry + dedupKey
- `packages/api/src/lib/{advisory-lock,integration-connection}.ts` — `sync` namespace + `loadOrgIntegrationConnection`
- `packages/api/src/routers/integrations/teams.ts` — `configJson` mapping-storage + public projection precedent
- `packages/db/prisma/schema/{integration,employee,personnel}.prisma` — connection/sync-log + pull-target models + hire/terminatedAt anchors + tenant-owning headers + enum + `@@unique` (C2)
- `packages/feature-flags/src/{flags-core.ts,signoff-registry-flags.json,signoff-registry-flags.ts}` — the two `integration.*-sync` flags + `module.workforce-employees` + signoff gate
- `packages/api/src/middleware/require-workforce-flag.ts` + `root.ts:185-196,262` — flag gate + dark mount
- `apps/cron-worker/src/jobs/{registry.ts,handlers/org-definition-sync.ts}` + `env.ts` — cron registration + `CRON_*_SCHEDULE`
- `.planning/EXTERNAL-ENABLEMENT.md` — the flag-defer register to extend

### Secondary (research docs — confidence as noted)
- `.planning/research/SUMMARY.md:33-34,39,121,220-221` — Personio (v2, proprietary bearer, 200/min, offset≤200, attribute-scoped) + BambooHR (OAuth 2.0, un-paginated list, no Node SDK) + field-partition/loop pitfall + deprecations (HIGH on SDK absence; MEDIUM on exact Personio rate limits)
- Vendor docs (developer.personio.de API v2; documentation.bamboohr.com) — endpoint/scope specifics pinned by the executor against the current published contract at build time.

## Metadata

**Confidence breakdown:**
- Reuse seams (adapter framework / orchestrator / outbox / advisory-lock / connection / flags / cron): HIGH — every seam read at source at current HEAD.
- Field partition + loop-prevention design: HIGH — grounded in the shipped `EmployeeProfile`/`PersonnelFile`/`Worker` models + the disjoint-set argument.
- Personio API (v2, bearer, offset≤200): HIGH on framework fit; MEDIUM on exact endpoint-level rate limits (community changelog; limiter set conservatively; verify at enablement).
- BambooHR API (OAuth 2.0, list shape): HIGH on OAuth requirement; MEDIUM on custom-attribute contract (explicit D-06 gate).

**Research date:** 2026-07-05
**Valid until:** 2026-08-05 (stable repo infra; re-verify line numbers if HEAD advances — Theme B phases execute concurrently).
