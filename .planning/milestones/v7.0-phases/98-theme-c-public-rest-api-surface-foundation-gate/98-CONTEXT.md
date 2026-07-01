# Phase 98: Theme C — Public REST API Surface (foundation gate) - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning

<domain>
## Phase Boundary

A versioned public REST API on **`apps/public-api` (Hono, already exists)** exposing read+write for
nine core entities — contractors, invoices, payments, payment_runs, workflows, workflow_tasks,
classifications, compliance_documents, audit_log — delivering five locked requirements
(INTEG-API-01..05):

- Every endpoint: Zod input validation, **API-key tenant scoping** (org from key, never client),
  `.strict()` DTOs blocking mass-assignment of `organizationId`/`workerType`/money fields.
- **OpenAPI 3.1 auto-generated from Zod** (`@hono/zod-openapi`) → Scalar developer portal.
- `/v1/*` base path + `Sunset` headers (RFC 8594); breaking changes only on major bump.
- **Cursor** pagination + standardized `?filter[field]=` / `?sort=` across all list endpoints.
- Auto-generated **TypeScript + Python SDKs** (Speakeasy) → npm (`@contractor-ops/sdk`) + PyPI
  (`contractor-ops-sdk`).

**This is the Theme C serialization gate** — Phases 99/100/101 wait on it. Depends only on Phase 82
(the `module.public-api` flag, already registered PENDING with a boot signoff gate).

**NOT greenfield:** `apps/public-api` already ships 5 read-only entities (contractors/invoices/
contracts/documents/feature-flags) via a delegate-to-tRPC pattern. **NOT this phase:** API-key
management UI + per-endpoint scope UI + per-tier rate limits + key rotation (Phase 99); outbound
webhooks + SSRF (Phase 100); marketplace listings + full DX portal (Phase 101).
</domain>

<decisions>
## Implementation Decisions

### Write-Entity Reuse (INTEG-API-01)
- **D-01 (Claude's discretion — lean recorded):** Write exposure is planner's discretion. **Lean:
  re-implement the 7 write entities' mutations in the public tRPC layer** (`publicApiRouter` under
  `apiKeyTenantProcedure`), **reusing the invariant helpers + plain services — never reimplementing
  business rules.** The scout confirmed write logic is locked inside internal `tenantProcedure
  .mutation()` closures coupled to `ctx.user.id` (session actor) and is NOT reachable as plain
  service fns. Reusable pieces: invariant helpers (`payment-shared.ts` `VALID_TRANSITIONS`/
  `autoCompleteRunIfTerminal`, `workflow-shared.ts` `validateTransition`/`unblockDependentsAnd
  RecomputeRun`) + plain services (`audit-writer.ts` `writeAuditLog` with `actorType:'API_KEY'`,
  `payment-export`/`payment-settlement`, `doc-link-service`, `personnel-classifier`). Audit actor
  = `API_KEY` + `apiKeyId` (`audit-writer` already supports the enum member). This mirrors the
  existing delegate-to-tRPC read pattern and keeps the internal session mutations untouched (small
  blast radius). **Constraint (locked): no business-logic/invariant reimplementation; audit as
  API_KEY; tenant from key, never client input.** The alternative (extract shared service layer
  first) is deferred as it would refactor stable internal finance/workflow routers during a
  parallel-execution window.

### Write-Endpoint Sequencing / BFLA Safety (INTEG-API-01 × Phase 99)
- **D-02 (locked):** **Write endpoints are BUILT + SCOPE-ENFORCED in 98, but stay DARK.** The scout
  confirmed `PUBLIC_API_SCOPES` (`scope-utils.ts:33-38`) has ONLY `:read` scopes and scope
  enforcement is **opt-in** per procedure — so a write endpoint without a mandatory scope is a live
  BFLA hole. Therefore: (a) define the write scopes now (`contractors:write`, `invoices:write`,
  `payments:write`, etc.) in `PUBLIC_API_SCOPES`; (b) **every** write endpoint carries a mandatory
  `requirePermission({entity:['create'|'update']})` from day one (no exceptions); (c) the whole
  write surface is dark — `module.public-api` off + writes absent from the published SDK/portal —
  until Phase 99 lands key-management/rate-limits/scope-picker UI and flips it on. **Hard constraint
  (locked): NO write endpoint is ever reachable without a mandatory enforced scope.** This satisfies
  SC#1's write half while eliminating the write-before-99 BFLA risk.

### OpenAPI + Pagination (INTEG-API-02, -03, -04)
- **D-03 (locked):** **Migrate to `@hono/zod-openapi` + cursor pagination.** Add `@hono/zod-openapi`
  (OpenAPI 3.1 spec auto-derived from Zod route definitions — kills the current hand-written
  `openapi.ts` drift) and **Scalar as a real npm dependency** (replacing the CDN+SRI load). Adopt
  **cursor** pagination in the public layer (mirror the internal `core/audit.ts:103` opaque-token +
  COUNT_CAP pattern) + `?filter[field]=` / `?sort=` conventions + `/v1/*` base + RFC 8594 `Sunset`
  headers. **Migrate the existing 5 read routes to the new pattern too** (single convention, no
  offset/cursor split). Per-entity Zod DTOs use `.strict()` (the `employee-country-fields.ts:63`
  precedent) to reject mass-assignment.

### SDK Generation + Publish Maturity (INTEG-API-05)
- **D-04 (locked):** **Stand up the Speakeasy codegen pipeline + CI in 98; publish 0.x PRERELEASE
  (dark).** Speakeasy (standalone binary, no day-zero npm dep) generates TS + Python SDKs from the
  3.1 spec; CI publishes as **0.x prerelease** to npm/PyPI. **Promote to 1.0 only once writes +
  scopes are final (post-Phase-99)** — do not ship a public v1 SDK for a read-only-partial API whose
  surface changes in 99. Satisfies INTEG-API-05 (pipeline + publish exists) without churning early
  adopters with a breaking 2.0.

### Cross-Cutting (carried)
- **D-05 (locked):** Per-org `module.public-api` enforcement is a NEW build — the flag + boot
  signoff gate exist (`index.ts:78`) but `app.ts` does NOT yet gate route mounting / per-request
  access on the flag per resolved tenant. Add per-org flag evaluation (404/403 if off).
- **D-06 (locked):** Reuse the existing HMAC-SHA256 API-key auth (`api-key-service.ts` plain fns +
  `apiKeyTenantProcedure`), CORS/secure-headers/observability middleware, and the rate-limiter
  scaffold. Per-tier rate limits themselves are Phase 99 (today it's a flat 100/min).

### Claude's Discretion
- Write-exposure mechanism (D-01) — lean: public-tRPC re-impl reusing helpers.
- Cursor token encoding + `filter[field]`/`sort` grammar specifics.
- Which read entities migrate first vs the 4 net-new reads (audit_log + the read side of payments/
  payment_runs/workflows/workflow_tasks/classifications/compliance_documents).
- Speakeasy config + the npm/PyPI CI publish wiring + semver policy.
- Exact write-scope string taxonomy (align with Phase 99's INTEG-AUTH-02 list).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone planning
- `.planning/REQUIREMENTS.md` — INTEG-API-01..05 (lines 161-165) verbatim; INTEG-AUTH-01..05
  (169-173, Phase 99 — the write-scope taxonomy to align with); line 24 (HMAC-SHA256 supersedes
  bcrypt); line 27 (quality > scope — defer half-done to v7.5).
- `.planning/ROADMAP.md` (Phase 98 entry) — goal + 4 success criteria + research flag (Hono host +
  OrganizationApiKey.scopes + rate-limiter exist; Speakeasy; writes must not ship before Phase 99).

### Existing public-api host (extend, do not rebuild)
- `apps/public-api/src/app.ts` (`basePath('/api/v1')` :19, middleware chain :76-106, route mounts
  :109-119, Scalar docs :145-180) + `src/index.ts` (Sentry/env/flag-signoff boot :53-88) +
  `src/routes/*.ts` (contractors/invoices/contracts/documents/feature-flags read routes) +
  `src/lib/create-caller.ts:11` (`createPublicCaller` → tRPC `publicApiRouter`).
- `render.yaml:401-409` (Render Web Service, port 4100).

### API-key auth + scopes + rate-limit (reuse)
- `packages/db/prisma/schema/api-key.prisma:3-22` (`OrganizationApiKey` — prefix/hash/`scopes String[]`).
- `packages/api/src/services/api-key-service.ts:50/75/83/107/152` (`generateApiKey`/`hashKey` HMAC-
  SHA256/`verifyKey` timingSafeEqual/`resolveApiKey`/`touchLastUsed` — **plain reusable fns**).
- `packages/api/src/middleware/api-key-auth.ts:26/52/65/93` (`apiKeyTenantProcedure`, enriches
  `apiKeyScopes`) + `middleware/rbac.ts:19-42` (`requirePermission` apiKey-mode scope check — the
  MANDATORY line every write endpoint needs) + `lib/scope-utils.ts:33-38` (`PUBLIC_API_SCOPES` —
  **only `:read` today; add write scopes here**).
- `apps/public-api/src/lib/rate-limiter.ts:23/118/131` (Upstash sliding-window, flat 100/min, fail-
  closed — per-tier is Phase 99).

### Domain reuse for writes (invariant helpers + plain services; NOT the tRPC orchestration)
- `packages/api/src/routers/finance/payment-shared.ts` (`VALID_TRANSITIONS`, `autoCompleteRunIfTerminal`),
  `payment-run-ops.ts:16` (inline FSM — mirror, reuse helpers), services `payment-export.ts`,
  `payment-settlement.ts`.
- `packages/api/src/routers/workflow/workflow-shared.ts` (`validateTransition`, `unblockDependents
  AndRecomputeRun`), `workflow-execution-tasks.ts:42` (inline mutation).
- `packages/api/src/routers/finance/invoice-shared.ts`, `invoice-actions.ts:19` (void inline).
- `packages/api/src/services/audit-writer.ts:25` (`actorType` incl. `'API_KEY'`) / `writeAuditLog`
  — mandatory + lint-enforced (`scripts/lint-audit-log.mjs`).
- `packages/api/src/services/{doc-link-service,personnel-classifier}.ts` — plain services.
- Internal read for `audit_log`: `packages/api/src/routers/core/audit.ts:103` (cursor + COUNT_CAP —
  the cursor pattern to mirror publicly).

### DTOs + pagination precedent
- `packages/validators/src/public-api/index.ts:39-72` (existing public DTOs — offset today) +
  `common-inputs.ts:14-17` (`paginationSchema`) + `.strict()` precedent
  `employee-country-fields.ts:63/93/118/135`.
- `apps/public-api/src/lib/parse-list-query.ts:31` (`safeParse` at the Hono boundary).

### OpenAPI / Scalar / flag / SDK (new build)
- `apps/public-api/src/openapi.ts:5` (hand-written literal — replace with `@hono/zod-openapi`);
  Scalar CDN+SRI `app.ts:128/146-176` (make it a dep). `@hono/zod-openapi` is NOT yet a dependency.
- `packages/feature-flags/src/flags-core.ts:239-247` (`module.public-api`, default false, ship-dark)
  + `apps/public-api/src/index.ts:78` (`assertFlagSignoffsOrExit`) — add per-org flag enforcement in
  `app.ts` (new).
- No Speakeasy / SDK package / npm-PyPI publish CI exists — entirely new.

### Documentation-follows-code (update in the SAME change set)
- `.planning/brain/wiki/domains/` (public-api domain), `wiki/structure/{packages.md, api-routers-
  catalog.md (publicApiRouter), key-services.md}`, `wiki/integrations/` (developer-portal),
  `wiki/patterns/{feature-flags, tenant-and-audit (API_KEY actor), rate-limit}`, `wiki/log.md` +
  `hot.md`; `.planning/MEMORY.md` (public-write-BFLA-scope-mandatory + API_KEY-audit-actor +
  cursor-pagination invariants); `pnpm check:wiki-brain`.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`apps/public-api` Hono host + delegate-to-tRPC read pattern** — copy for the 4 net-new reads.
- **HMAC-SHA256 API-key auth** (`api-key-service.ts` plain fns + `apiKeyTenantProcedure`) — reuse.
- **`requirePermission` apiKey-scope check** — the mandatory guard for every write endpoint (D-02).
- **Invariant helpers + plain services** (`payment-shared`, `workflow-shared`, `audit-writer`,
  `doc-link-service`, `personnel-classifier`) — reuse under public writes (D-01).
- **`core/audit.ts:103` cursor pattern** — mirror for public cursor pagination (D-03).
- **`module.public-api` flag + boot signoff gate** — extend with per-org enforcement (D-05).

### Established Patterns
- **Thin Hono routes delegate to tRPC; no business logic in Hono.**
- **Tenant from the API key, never client input; soft-delete `deletedAt:null` filter.**
- **`.strict()` DTOs to block mass-assignment.**
- **Ship-dark behind a flag with signoff PENDING→APPROVED** (every v7.0 surface).
- **Audit every external mutation (`API_KEY` actor) via the lint-enforced `writeAuditLog`.**

### Integration Points
- `publicApiRouter` (tRPC) grows read+write procedures; `apps/public-api` Hono routes mount them.
- Write scopes added to `PUBLIC_API_SCOPES`; enforced via `requirePermission`; aligned with Phase
  99's INTEG-AUTH-02 taxonomy.
- `@hono/zod-openapi` derives the 3.1 spec → Scalar portal; Speakeasy consumes the spec → SDKs.

</code_context>

<specifics>
## Specific Ideas

- **Reads = plumbing, writes = the real cost** — the 4 net-new reads mirror the shipped pattern; the
  7 writes must be re-implemented in the public tRPC layer reusing invariants (their orchestration is
  session-actor-coupled, not plain-service-reachable).
- **BFLA-safe by construction** — write scopes defined + mandatory `requirePermission` from day one;
  the whole write surface dark until Phase 99. No unscoped mutating endpoint ever exists.
- **Kill spec drift** — Zod-first OpenAPI (`@hono/zod-openapi`) replaces the hand-written spec.
- **Don't ship a premature v1 SDK** — 0.x prerelease until the surface stabilizes post-99.

</specifics>

<deferred>
## Deferred Ideas

- **API-key management UI, per-endpoint scope picker, per-tier rate limits, key rotation** → Phase 99.
- **Outbound webhooks + SSRF guard** → Phase 100.
- **Marketplace listings (Zapier/n8n/Make) + full DX portal + Postman/Insomnia** → Phase 101.
- **Extract-shared-service-layer refactor** (vs public-tRPC re-impl) → deferred (D-01); revisit if the
  write duplication becomes costly.
- **Promote SDKs to public 1.0** → post-Phase-99 (surface-stable).

None expand the phase scope — discussion stayed within the public REST API foundation boundary
(INTEG-API-01..05).

</deferred>

---

*Phase: 98-theme-c-public-rest-api-surface-foundation-gate*
*Context gathered: 2026-07-01*
