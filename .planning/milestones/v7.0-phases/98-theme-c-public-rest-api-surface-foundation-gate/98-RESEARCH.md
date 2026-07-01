# Phase 98: Theme C — Public REST API Surface (foundation gate) - Research

**Researched:** 2026-07-01
**Domain:** Versioned public REST API (Hono + tRPC delegate) — OpenAPI 3.1 from Zod, Scalar portal, cursor pagination, write re-impl reusing invariant helpers, mandatory scope enforcement, Speakeasy SDK codegen
**Confidence:** HIGH on architecture + write-reuse mapping (grounded in source); HIGH on package versions (npm-verified + official docs); MEDIUM on Zod-4↔`@hono/zod-openapi` metadata interop and the singular/plural scope-taxonomy reconciliation (both need a Wave-0 spike / planner lock)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (Claude's discretion — lean recorded):** Re-implement the 7 write entities' mutations in the public tRPC layer (`publicApiRouter` under `apiKeyTenantProcedure`), **reusing invariant helpers + plain services — never reimplementing business rules.** Write logic is locked inside internal `tenantProcedure.mutation()` closures coupled to `ctx.user.id` and is NOT reachable as plain service fns. Reusable pieces: invariant helpers (`payment-shared.ts` `VALID_TRANSITIONS`/`autoCompleteRunIfTerminal`, `workflow-shared.ts` `validateTransition`/`unblockDependentsAndRecomputeRun`) + plain services (`audit-writer.ts` `writeAuditLog` with `actorType:'API_KEY'`, `payment-export`/`payment-settlement`, `doc-link-service`, `personnel-classifier`). Audit actor = `API_KEY` + `apiKeyId`. Mirrors the existing delegate-to-tRPC read pattern; internal session mutations untouched. **Constraint (locked): no business-logic/invariant reimplementation; audit as API_KEY; tenant from key, never client input.** Extract-shared-service-layer alternative deferred.
- **D-02 (locked):** Write endpoints are **BUILT + SCOPE-ENFORCED in 98, but stay DARK.** (a) define write scopes now in `PUBLIC_API_SCOPES` (`scope-utils.ts:33-38`); (b) **every** write endpoint carries a mandatory `requirePermission({entity:['create'|'update']})` from day one (no exceptions); (c) whole write surface dark — `module.public-api` off + writes absent from published SDK/portal — until Phase 99. **Hard constraint (locked): NO write endpoint is ever reachable without a mandatory enforced scope.**
- **D-03 (locked):** Migrate to `@hono/zod-openapi` (OpenAPI 3.1 auto-derived from Zod) + **Scalar as a real npm dependency** (replace CDN+SRI). Adopt **cursor** pagination (mirror internal `core/audit.ts:103` opaque-token + COUNT_CAP) + `?filter[field]=` / `?sort=` conventions + `/v1/*` base + RFC 8594 `Sunset` headers. **Migrate the existing 5 read routes to the new pattern too.** Per-entity Zod DTOs use `.strict()` (`employee-country-fields.ts:63` precedent).
- **D-04 (locked):** Stand up the Speakeasy codegen pipeline + CI in 98; publish **0.x PRERELEASE (dark)**. Speakeasy (standalone binary, no day-zero npm dep) generates TS + Python SDKs from the 3.1 spec; CI publishes 0.x prerelease to npm/PyPI. **Promote to 1.0 only once writes + scopes are final (post-Phase-99).**
- **D-05 (locked):** Per-org `module.public-api` enforcement is a NEW build — flag + boot signoff gate exist (`index.ts:78`) but `app.ts` does NOT gate route mounting / per-request access per resolved tenant. Add per-org flag evaluation (404/403 if off).
- **D-06 (locked):** Reuse existing HMAC-SHA256 API-key auth (`api-key-service.ts` plain fns + `apiKeyTenantProcedure`), CORS/secure-headers/observability middleware, and the rate-limiter scaffold. Per-tier rate limits are Phase 99 (today flat 100/min).

### Claude's Discretion
- Write-exposure mechanism (D-01) — lean: public-tRPC re-impl reusing helpers.
- Cursor token encoding + `filter[field]`/`sort` grammar specifics.
- Which read entities migrate first vs the 4 net-new reads (audit_log + the read side of payments/payment_runs/workflows/workflow_tasks/classifications/compliance_documents).
- Speakeasy config + the npm/PyPI CI publish wiring + semver policy.
- Exact write-scope string taxonomy (align with Phase 99's INTEG-AUTH-02 list).

### Deferred Ideas (OUT OF SCOPE)
- API-key management UI, per-endpoint scope picker, per-tier rate limits, key rotation → Phase 99.
- Outbound webhooks + SSRF guard → Phase 100.
- Marketplace listings (Zapier/n8n/Make) + full DX portal + Postman/Insomnia → Phase 101.
- Extract-shared-service-layer refactor (vs public-tRPC re-impl) → deferred.
- Promote SDKs to public 1.0 → post-Phase-99.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INTEG-API-01 | `apps/public-api` gains read+write endpoints for 9 entities; Zod validation on every endpoint; tenant-scoped via API key; `.strict()` DTOs blocking mass-assignment of `organizationId`/`workerType`/money | § Write Re-Impl Mechanics (per-entity helper map); § Standard Stack (`.strict()` at Hono boundary + tRPC `.input`); tenant already enforced by `apiKeyTenantProcedure` (`api-key-auth.ts:65-78` — org from key); mass-assignment blocked by `.strict()` + explicit `select`/`data` allowlists |
| INTEG-API-02 | OpenAPI 3.1 auto-generated from Zod (`@hono/zod-openapi`) → Scalar portal | § @hono/zod-openapi Migration (`OpenAPIHono`+`createRoute`+`app.doc31`); § Scalar as a Real Dep (`@scalar/hono-api-reference` `Scalar({url})`) |
| INTEG-API-03 | `/v1/*` base + `Sunset` header per RFC 8594; breaking changes only on major bump | § /v1 Versioning + RFC 8594 Sunset (version-header middleware; base-path decision) |
| INTEG-API-04 | Cursor pagination + standardized `?filter[field]=`/`?sort=` across all list endpoints | § Cursor Pagination + Filter/Sort Grammar (reuse `pagination.ts` `cursorClause`/`paginateByLastKeptUndefined`; concrete opaque-cursor + bracket-filter grammar) |
| INTEG-API-05 | Auto-generated TS + Python SDKs → npm (`@contractor-ops/sdk`) + PyPI (`contractor-ops-sdk`) | § Speakeasy Pipeline + npm/PyPI Publish CI (standalone binary; `.speakeasy/workflow.yaml`; `sdk-generation-action`; 0.x prerelease; write endpoints excluded via `hide:true`) |
</phase_requirements>

## Summary

`apps/public-api` is a **thin Hono host that delegates every request to a tRPC `publicApiRouter`** (`create-caller.ts:11` → `apiKeyTenantProcedure`). Auth, tenant scoping, RBAC scope checks, and business logic all live in tRPC; Hono owns only HTTP transport, middleware (CORS/secure-headers/observability/rate-limit), boundary query parsing, and the OpenAPI/docs surface. This split is the load-bearing fact of the phase: **the `@hono/zod-openapi` migration touches only the Hono transport + spec layer, while the write re-impl and scope enforcement happen in tRPC.** Every locked decision fits this seam cleanly.

The verified stack is **`@hono/zod-openapi@1.4.0`** (peer `zod ^4.0.0`, and the repo is on **Zod 4** — `z.iso.datetime()` in `contract.ts:74` confirms it) + **`@scalar/hono-api-reference@0.11.5`** (the newest release ≥7 days old) + **Speakeasy standalone binary** (no npm runtime dep) driving a GitHub Actions publish to npm/PyPI. `@hono/zod-openapi` supplies `OpenAPIHono`, `createRoute`, and `app.doc31()` for a native OpenAPI **3.1** document — matching the existing hand-written `openapi.ts:5` spec version and killing its drift. The 7 write entities are re-implemented in new `publicApiRouter` sub-routers that call the already-plain, `tx`-taking, org-scoped invariant helpers (`payment-shared.ts`, `workflow-shared.ts`, `invoice-shared.ts`) and plain services (`writeAuditLog`, `payment-export`, `doc-link-service`, `personnel-classifier`) — the ONLY session-coupling to replace is the audit actor (`ctx.user.id`/`'USER'` → `ctx.apiKeyId`/`'API_KEY'`).

BFLA-safety is by construction: **every** write procedure carries a mandatory `requirePermission` (`rbac.ts:19-42` apiKey-mode) whose computed scope strings are added to `PUBLIC_API_SCOPES`, and the whole write surface stays dark two ways — (1) the new per-org `module.public-api` gate (mirror `assertWorkforceEnabled` from `require-workforce-flag.ts:25`) keeps the entire API dark per-tenant until Phase 99 grants any org the flag, and (2) `hide:true` on write `createRoute` definitions excludes them from the OpenAPI doc Speakeasy consumes, so they never appear in the published SDK/portal.

**Primary recommendation:** Migrate the Hono layer to `OpenAPIHono`+`createRoute` with `.strict()` Zod-4 DTOs shared between the route contract and the tRPC `.input()`; keep the delegate-to-tRPC pattern; add the 7 write sub-routers reusing invariant helpers with `writeAuditLog(actorType:'API_KEY', actorId: ctx.apiKeyId)`; gate the whole surface behind a per-org `module.public-api` tRPC middleware; mark writes `hide:true`; adopt an opaque base64url cursor + `filter[field]`/`sort` grammar reusing `pagination.ts`; wire Speakeasy standalone-binary codegen publishing 0.x prereleases with writes excluded from the spec. Run a **Wave-0 spike** to confirm plain-validators Zod-4 schemas register into the `@hono/zod-openapi` 3.1 document.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| HTTP transport, routing, middleware chain | Hono host (`apps/public-api`) | — | `app.ts:19-119` already owns CORS/secure-headers/observability/rate-limit/health |
| OpenAPI 3.1 spec derivation + Scalar portal | Hono host (`OpenAPIHono`) | Zod DTOs (validators) | Spec must reflect the HTTP contract; `createRoute` is a transport-layer construct |
| Boundary query/body validation (`.strict()`) | Hono host (`createRoute` `request`) | tRPC `.input()` (defense-in-depth) | Reject malformed input before the tRPC caller; single shared DTO |
| API-key auth + tenant resolution (org from key) | API/tRPC (`apiKeyTenantProcedure`) | — | `api-key-auth.ts:26-78` — tenant NEVER from client; region-routed DB |
| Scope enforcement (BFLA fix) | API/tRPC (`requirePermission` apiKey-mode) | `PUBLIC_API_SCOPES` allowlist | `rbac.ts:19-42` — mandatory per write procedure |
| Per-org `module.public-api` dark gate | API/tRPC middleware (new) | Boot signoff gate (`index.ts:78`) | Org/region known only after key resolves (inside tRPC) |
| Business invariants (FSM, run-completion, void) | API/tRPC (invariant helpers) | Prisma (tenant-scoped `ctx.db`) | Locked helpers in `payment-shared`/`workflow-shared`/`invoice-shared` |
| Mutation audit (`API_KEY` actor) | API/tRPC (`writeAuditLog`) | Prisma tx (atomic) | `audit-writer.ts` — lint-enforced; actor swapped to apiKeyId |
| Cursor pagination + filter/sort | API/tRPC (`.query` + `pagination.ts`) | Hono boundary parse (bracket grammar) | Keyset seek runs against `ctx.db`; Hono parses `filter[…]`/`sort` |
| SDK codegen (TS/Python) | CI (Speakeasy binary) | GitHub Actions publish | Consumes the derived 3.1 spec; no runtime dep |
| Rate limiting (flat 100/min) | Hono host (`rate-limiter.ts`) | Upstash Redis | Per-tier is Phase 99; flat scaffold reused |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@hono/zod-openapi` | `1.4.0` | `OpenAPIHono`+`createRoute`+`app.doc31()` — OpenAPI 3.1 auto-derived from Zod route defs | Official Hono middleware (honojs/middleware), 1.24M weekly downloads, peer `zod ^4.0.0` matches repo Zod 4 [VERIFIED: npm registry — v1.4.0 published 2026-05-09, 53 days old ≥7-day floor] [CITED: github.com/honojs/middleware/tree/main/packages/zod-openapi] |
| `@scalar/hono-api-reference` | `0.11.5` | `Scalar({ url })` middleware mounting the interactive docs from the derived spec — replaces the CDN+SRI hand-rolled HTML | Official Scalar package (scalar/scalar), 606K weekly downloads; `0.11.5` is the newest release ≥7 days old [VERIFIED: npm registry — v0.11.5 published 2026-06-22, 9 days old; v0.11.6/0.11.7 are <7 days, DO NOT pin] [CITED: github.com/scalar/scalar hono integration] |
| Speakeasy CLI | standalone binary (pin in CI, e.g. `speakeasy` action `@v15`) | Generate idiomatic TS + Python SDKs from the OpenAPI 3.1 spec; GitHub Actions auto-publish | Standalone binary → no day-zero npm runtime dep (satisfies D-04 + 7-day floor by construction); native OpenAPI 3.1 support [CITED: speakeasy.com/docs — sdk-generation-action, TS+Python targets] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | `^4.4.3` (already installed) | DTO schemas; `.strict()`; native `.meta()` for OpenAPI metadata | Already a dep of `@contractor-ops/validators` + `@contractor-ops/api` — no new install |
| `hono` | `^4.12.18` (already installed) | HTTP framework; `OpenAPIHono extends Hono` (basePath/use/route all inherited) | Already `apps/public-api` dep; `@hono/zod-openapi` peer `hono >=4.10.0` satisfied |
| `@upstash/ratelimit` / `@upstash/redis` | `^2.0.8` / `^1.38.0` (installed) | Rate-limit scaffold (`rate-limiter.ts`) | Reuse as-is (D-06); per-tier is Phase 99 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@hono/zod-openapi` (locked D-03) | `hono-openapi` + plain `zod-openapi` (`.meta()` only) | Speakeasy's own Zod guide uses plain `zod-openapi`; but D-03 locks `@hono/zod-openapi`, which bundles route validation + registry + `doc31` in one, matching the existing per-route Hono structure. Do not switch. |
| `@scalar/hono-api-reference` (locked D-03) | Keep CDN + SRI HTML (`app.ts:145-179`) | Rejected by D-03 (real dep, no SRI-pin fragility). The current `SCALAR_SRI_PLACEHOLDER` boot-throw (`app.ts:135`) is exactly the fragility being removed. |
| Speakeasy (locked D-04) | `openapi-generator` / `openapi-ts` | Speakeasy produces idiomatic, publishable SDKs with a first-class npm/PyPI publish action; locked. |
| Cursor pagination (locked D-03) | Keep offset `page/pageSize` (`common-inputs.ts:14`) | Offset scans deep pages on unbounded tables (payments/audit); cursor is the internal precedent (`audit.ts:103`). Migrate all lists. |

**Installation:**
```bash
# apps/public-api — pin the exact ≥7-day-old versions (NOT ^-ranged past the floor)
pnpm --filter @contractor-ops/public-api add @hono/zod-openapi@1.4.0 @scalar/hono-api-reference@0.11.5
# Speakeasy: standalone binary in CI only — NOT an npm/pnpm dependency (D-04)
#   local:  brew install speakeasy-api/homebrew-tap/speakeasy   (or curl install script)
#   CI:     uses: speakeasy-api/sdk-generation-action@v15
pnpm audit && pnpm security:scan   # per CLAUDE.md after any dep change
```

**Version verification (run before locking the plan — versions move):**
```bash
# from /tmp or with --config-dir to dodge the repo .npmrc min-release-age unit bug
npm view @hono/zod-openapi version time --json          # confirm 1.4.0 still ≥7 days
npm view @scalar/hono-api-reference version time --json  # re-pick newest ≥7-day-old (was 0.11.5)
```

## Package Legitimacy Audit

> slopcheck was **NOT installable** in this session (`pip install slopcheck` unavailable). Per the graceful-degradation protocol, packages are tagged `[ASSUMED]` and the planner SHOULD add one lightweight `checkpoint:human-verify` before the single `pnpm add` install step. Mitigating signals recorded below are strong (official monorepos, 6-figure+ weekly downloads, no postinstall scripts, confirmed via official Hono/Scalar docs).

| Package | Registry | Age | Downloads | Source Repo | postinstall | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-------------|-----------|-------------|
| `@hono/zod-openapi@1.4.0` | npm | 53 days (pkg since 2023) | ~1.24M/wk | github.com/honojs/middleware | none (verified empty) | unavailable | Approved [ASSUMED] — official Hono middleware; gate behind 1 human-verify |
| `@scalar/hono-api-reference@0.11.5` | npm | 9 days | ~606K/wk | github.com/scalar/scalar | none (verified empty) | unavailable | Approved [ASSUMED] — official Scalar pkg; gate behind 1 human-verify |
| Speakeasy CLI | binary (brew/curl) + GH Action | mature | n/a (not npm) | github.com/speakeasy-api | n/a | n/a | Approved — no npm runtime dep (D-04) |

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none (slopcheck unavailable — treat all as `[ASSUMED]`; planner inserts one `checkpoint:human-verify` before the add).

## Architecture Patterns

### System Architecture Diagram

```
External API-key consumer
        │  Authorization: Bearer co_live_<random>
        ▼
┌─────────────────────────── apps/public-api (Hono / OpenAPIHono) ───────────────────────────┐
│  basePath('/v1')  [decision: was '/api/v1']                                                 │
│  requestId → observability → secureHeaders → cors(allowlist) → rateLimit(flat 100/min)      │
│  → versionHeaders(Sunset/Deprecation, RFC 8594)                                             │
│                                                                                             │
│  OpenAPIHono routes = createRoute({method,path,request:<.strict() Zod DTO>,responses})      │
│    reads:   GET /contractors, /invoices, /payments, /payment-runs, /workflows,              │
│             /workflow-tasks, /classifications, /compliance-documents, /audit-log            │
│    writes:  POST/PATCH … (hide:true → absent from spec/SDK; scope-enforced; flag-dark)      │
│                                                                                             │
│  handler:  input = c.req.valid('query'|'json')  ──►  createPublicCaller(c)                  │
│  GET /openapi.json  = app.getOpenAPI31Document(...)   (auto-derived, no drift)              │
│  GET /docs          = Scalar({ url:'/v1/openapi.json' })   (real dep, no CDN/SRI)           │
└───────────────────────────────────────────────┬─────────────────────────────────────────────┘
                                                 ▼  tRPC caller (same process, no HTTP hop)
┌────────────────────── packages/api — publicApiRouter (tRPC) ──────────────────────┐
│  apiKeyTenantProcedure  = publicProcedure                                          │
│      .use(apiKeyAuth)         → resolveApiKey (HMAC-SHA256), org+region from key    │
│      .use(requirePublicApiEnabled)  ← NEW (D-05): evaluate('module.public-api') 404 │
│      .use(requireTier('ENTERPRISE')).use(demoReadOnly)                              │
│  each procedure: .use(requirePermission({entity:['read'|'create'|'update']}))       │
│      READ  → tenant-scoped findMany + cursorClause(input) + paginateByLastKept…     │
│      WRITE → invariant helpers (VALID_TRANSITIONS / validateTransition /            │
│              autoCompleteRunIfTerminal / unblockDependentsAndRecomputeRun)          │
│              + plain services (payment-export, payment-settlement, doc-link,        │
│              personnel-classifier) + writeAuditLog(actorType:'API_KEY',             │
│              actorId: ctx.apiKeyId)  — atomic in ctx.db.$transaction                │
└───────────────────────────────────────────────┬───────────────────────────────────┘
                                                 ▼
                        Regional Prisma client (ctx.db, org-scoped, deletedAt:null)
                                                 │
CI (GitHub Actions): Speakeasy binary ── reads /v1/openapi.json (writes hidden) ──►  TS SDK → npm @contractor-ops/sdk (0.x prerelease)
                                                                                     Python SDK → PyPI contractor-ops-sdk (0.x prerelease)
```

### Recommended Project Structure
```
apps/public-api/src/
├── app.ts                       # OpenAPIHono root; middleware chain; doc31 + Scalar mount (rewrite)
├── openapi.ts                   # DELETE hand-written literal (openapi.ts:5) — spec now derived
├── routes/
│   ├── contractors.ts           # migrate GET → createRoute; add POST/PATCH (hide:true)
│   ├── invoices.ts              # migrate; add void PATCH (hide:true)
│   ├── payments.ts              # NEW read + write (hide:true)
│   ├── payment-runs.ts          # NEW read + write (hide:true)
│   ├── workflows.ts             # NEW read + write (hide:true)
│   ├── workflow-tasks.ts        # NEW read + write (hide:true)
│   ├── classifications.ts       # NEW read + write (hide:true)
│   ├── compliance-documents.ts  # NEW read + write (hide:true)
│   ├── audit-log.ts             # NEW read (cursor)
│   ├── contracts.ts             # migrate GET → createRoute (keep read)
│   └── documents.ts             # migrate GET → createRoute (keep read)
├── lib/
│   ├── create-caller.ts         # unchanged (createPublicCaller)
│   ├── parse-list-query.ts      # extend: bracket filter[…] + sort + cursor parsing
│   ├── version-headers.ts       # NEW — RFC 8594 Sunset/Deprecation middleware
│   └── openapi-cursor.ts        # NEW — encode/decode opaque base64url cursor
packages/api/src/routers/public-api/
│   ├── index.ts                 # publicApiRouter — add 6 new sub-routers
│   ├── payment.ts               # NEW read+write (reuse payment-shared helpers)
│   ├── payment-run.ts           # NEW read+write
│   ├── workflow.ts              # NEW read+write (reuse workflow-shared helpers)
│   ├── workflow-task.ts         # NEW read+write
│   ├── classification.ts        # NEW read+write (reuse personnel-classifier)
│   ├── compliance-document.ts   # NEW read+write (reuse doc-link-service)
│   └── audit.ts                 # NEW read (mirror core/audit.ts cursor)
packages/api/src/lib/scope-utils.ts   # add write scopes to PUBLIC_API_SCOPES
packages/api/src/middleware/
│   └── require-public-api-flag.ts     # NEW — mirror require-workforce-flag.ts
packages/validators/src/public-api/index.ts  # add write DTOs (.strict()) + cursor/filter/sort DTOs
.speakeasy/workflow.yaml         # NEW — source (spec) + TS + Python targets
.github/workflows/sdk-*.yml      # NEW — sdk-generation-action (pr/direct) + publish
```

### Pattern 1: OpenAPIHono route replaces hand-written spec + `parseListQuery`
**What:** `createRoute` defines method/path/request(DTO)/responses; `app.openapi(route, handler)` validates at the boundary and hands the parsed value to the delegate caller.
**When to use:** Every read + write route (D-03: migrate the 5 existing reads too).
```ts
// Source: github.com/honojs/middleware/tree/main/packages/zod-openapi (README, v1.x)
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import { createPublicCaller } from '../lib/create-caller.js'
import { publicApiContractorListInputSchema, contractorDto } from '@contractor-ops/validators/public-api'

const contractors = new OpenAPIHono()

const listRoute = createRoute({
  method: 'get',
  path: '/contractors',
  request: { query: publicApiContractorListInputSchema },      // .strict() DTO
  responses: {
    200: { content: { 'application/json': { schema: z.object({
      data: z.array(contractorDto),
      meta: z.object({ nextCursor: z.string().nullable(), hasMore: z.boolean() }),
    }) } }, description: 'Cursor page of contractors' },
    401: { description: 'Invalid or missing API key' },
    403: { description: 'Insufficient scope, tier, or module disabled' },
  },
})

contractors.openapi(listRoute, async (c) => {
  const input = c.req.valid('query')                 // replaces parse-list-query.ts safeParse
  const caller = createPublicCaller(c)
  const { items, nextCursor } = await caller.contractor.list(input)
  return c.json({ data: items, meta: { nextCursor: nextCursor ?? null, hasMore: nextCursor != null } }, 200)
})
export default contractors
```
> `app.doc31('/openapi.json', {...})` (or `app.getOpenAPI31Document(...)`) emits the **3.1** document. Note `createRoute` `path` uses OpenAPI `{id}` syntax; `.route('/x/:id', sub)` mounts use Hono `:id` syntax.

### Pattern 2: Write re-impl in tRPC reusing invariant helpers (mandatory scope + API_KEY audit)
**What:** New `publicApiRouter` write procedure under `apiKeyTenantProcedure`, mandatory `requirePermission`, calls the plain invariant helpers inside a tenant-scoped transaction, audits as `API_KEY`.
**When to use:** All 7 write entities (D-01/D-02).
```ts
// Source: derived from payment-shared.ts:645 VALID_TRANSITIONS + :268 autoCompleteRunIfTerminal
//         + audit-writer.ts:25/118 writeAuditLog(actorType:'API_KEY')
export const publicPaymentRunRouter = router({
  transition: apiKeyTenantProcedure
    .use(requirePermission({ payment: ['update'] }))          // MANDATORY — computed scope 'payment:update' ∈ PUBLIC_API_SCOPES
    .input(paymentRunTransitionInput)                          // .strict(): { id, target } — no organizationId/money fields
    .mutation(async ({ ctx, input }) => {
      return ctx.db.$transaction(async (tx) => {
        const run = await tx.paymentRun.findFirstOrThrow({
          where: { id: input.id, organizationId: ctx.organizationId }, // tenant from key
        })
        if (!VALID_TRANSITIONS[run.status]?.includes(input.target))
          throw new TRPCError({ code: 'BAD_REQUEST', message: E.PAYMENT_INVALID_TRANSITION })
        await tx.paymentRun.update({ where: { id: run.id }, data: { status: input.target } })
        await autoCompleteRunIfTerminal(tx, run.id)
        await writeAuditLog({
          tx, organizationId: ctx.organizationId,
          actorType: 'API_KEY', actorId: ctx.apiKeyId,          // ← the ONLY session-coupling swap (was 'USER'/ctx.user.id)
          action: 'payment_run.transition',
          resourceType: 'PAYMENT_RUN', resourceId: run.id,
          metadata: { from: run.status, to: input.target },
        })
        return { id: run.id, status: input.target }
      })
    }),
})
```

### Pattern 3: Per-org `module.public-api` dark gate (D-05)
**What:** A tRPC middleware chained into `apiKeyTenantProcedure` (after auth, org/region known) that evaluates the flag and returns 404/403 when off — mirrors the proven `assertWorkforceEnabled`.
```ts
// Source: mirror of require-workforce-flag.ts:25 assertWorkforceEnabled + evaluator.ts:147 evaluate
import { evaluate } from '@contractor-ops/feature-flags'
export function assertPublicApiEnabled(organizationId: string, region: string): void {
  const evalRegion = region === 'ME' ? ('ME' as const) : ('EU' as const)
  const result = evaluate('module.public-api', { organizationId, region: evalRegion })
  if (!result.enabled) throw new TRPCError({ code: 'NOT_FOUND', message: E.PUBLIC_API_DISABLED }) // 404 hides existence
}
// Wire into api-key-auth.ts:93 chain: publicProcedure.use(apiKeyAuth).use(publicApiFlagGate).use(requireTier).use(demoReadOnly)
```
> Use **404 NOT_FOUND** (not 403) for the dark gate so a tenant without the module cannot even confirm the API exists. Composes with the boot signoff gate (`index.ts:78`) which is orthogonal (boot-time registry check, not per-request).

### Anti-Patterns to Avoid
- **Two OpenAPI sources:** deleting `openapi.ts:5` is REQUIRED — leaving the literal alongside the derived doc reintroduces the drift D-03 exists to kill.
- **Scope enforcement as opt-in:** a write procedure without `requirePermission` is a live BFLA hole (D-02 hard constraint). No exceptions — enforce with a test that asserts every write route has a scope (§ Validation Architecture).
- **Re-deriving business rules:** never re-write `VALID_TRANSITIONS`, void logic, or run-completion in the public layer — import the helpers (D-01 locked).
- **Mixing `OpenAPIHono` and plain `Hono` sub-apps:** plain Hono sub-routers do not contribute to the spec. Every route file that must appear in the doc must be an `OpenAPIHono` instance (README caveat).
- **Tenant/`workerType`/money in the request body:** `.strict()` DTOs must omit `organizationId`, `workerType`, and money/minor fields entirely so extra keys are rejected (INTEG-API-01).
- **Un-hiding writes:** write `createRoute` defs MUST carry `hide: true` in Phase 98 so they never reach the SDK/portal until Phase 99.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OpenAPI 3.1 spec | Hand-written literal (current `openapi.ts:5`) | `@hono/zod-openapi` `app.doc31()` / `getOpenAPI31Document()` | Drifts from code the moment a route changes — the exact bug D-03 fixes |
| Interactive docs page | CDN `<script>` + SRI hash pin (`app.ts:145-179`) | `@scalar/hono-api-reference` `Scalar({url})` | Removes the `SCALAR_SRI_PLACEHOLDER` boot-throw fragility (`app.ts:135`) |
| Cursor pagination | New keyset logic | `pagination.ts:64` `cursorClause` + `:94` `paginateByLastKeptUndefined` | Battle-tested; `audit.ts:149` already uses it; handles +1-take/skip/nextCursor |
| Payment-run FSM + completion | New status map | `payment-shared.ts:645` `VALID_TRANSITIONS` + `:268` `autoCompleteRunIfTerminal` | Locked invariant; money-affecting |
| Workflow task FSM + unblock | New transition logic | `workflow-shared.ts:219` `validateTransition` + `:233` `unblockDependentsAndRecomputeRun` | Locked invariant; dependency graph |
| Payment run creation | New invoice-eligibility/currency logic | `payment-shared.ts` `loadEligibleInvoices`/`validateInvoicesForRun`/`groupInvoicesByCurrency`/`allocateRunNumber`/`seedRunItems`/`applyWithholdingToRun` | All are plain, `tx`-taking, org-scoped, no `ctx.user` |
| Export file generation | New NACHA/SEPA/SWIFT writer | `payment-shared.ts:233` `_generateExportFileForFormat` + `payment-export`/`payment-settlement` services | Money serialization; hand-rolling = double-spend risk |
| Mutation audit | New audit insert | `audit-writer.ts:118` `writeAuditLog` (lint-enforced by `scripts/lint-audit-log.mjs`) | Atomic-with-tx; `API_KEY` actor already supported (`:25`) |
| API-key HMAC verify | New hashing | `api-key-service.ts:83` `verifyKey` (timing-safe) + `:107` `resolveApiKey` | HMAC-SHA256 + `timingSafeEqual` already correct |
| SDK clients | Hand-written TS/Python clients | Speakeasy from the 3.1 spec | Idiomatic, versioned, npm/PyPI-publishable; kept in sync with the spec |
| Doc→section / classification writes | New classifier | `personnel-classifier.ts` / `doc-link-service.ts` plain services | Locked plain services (D-01) |

**Key insight:** Nearly every "hard" part of this phase already exists as a **plain, `tx`-taking, org-scoped helper** because prior phases deliberately extracted the invariants out of the tRPC closures (payment-shared, workflow-shared, pagination). The public layer is assembly, not invention — the single genuinely new primitive is the per-org flag gate, and even that is a copy of `require-workforce-flag.ts`.

## Runtime State Inventory

> Rename/refactor concerns for the D-03 route migration (offset→cursor, `/api/v1`→`/v1`, spec source swap).

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None** — no persisted cursor tokens or spec snapshots. The opaque cursor is stateless (base64url of a row id); nothing stored. Verified: no cursor/token column in the public path. | none |
| Live service config | **Render `public-api` service** (`render.yaml:~401`): `healthCheckPath: /api/v1/health` is hard-coded. If base path moves `/api/v1`→`/v1`, this path AND any bound custom domain (`api.contractor-ops.com`) routing must update in the same change. `PUBLIC_API_CORS_ORIGINS`, `SCALAR_SRI_HASH`, `ENABLE_API_DOCS` env vars are set via Render dashboard (`sync:false`) — SCALAR_SRI_HASH becomes obsolete once Scalar is a real dep. | render.yaml edit + Render dashboard (drop SCALAR_SRI_HASH, ENABLE_API_DOCS gating changes) |
| OS-registered state | **None** — no OS scheduler/pm2/systemd entries embed the base path. | none |
| Secrets/env vars | `API_KEY_HMAC_SECRET` (unchanged — reused per D-06). NEW CI secrets required: `SPEAKEASY_API_KEY`, `NPM_TOKEN`, `PYPI_TOKEN` (or PyPI trusted-publishing OIDC). `SCALAR_SRI_HASH` env becomes unused (remove from `.env.example` + Render). | add 3 CI secrets; remove SCALAR_SRI_HASH from `.env.example` |
| Build artifacts / installed packages | New npm pkg `@contractor-ops/sdk` + PyPI `contractor-ops-sdk` **do not exist yet** — first publish is 0.x prerelease. `apps/public-api/Dockerfile` builds `dist/` (`dockerCommand: node apps/public-api/dist/index.js`) — adding deps changes the build but no stale artifact. | first-time package registration on npm + PyPI (name reservation); confirm Dockerfile still builds with new deps |

**The canonical question — after every repo file is updated, what still carries the old string/path?** Only the Render service config (`healthCheckPath` + custom-domain route) if the base path changes, and the now-dead `SCALAR_SRI_HASH`/`ENABLE_API_DOCS` env plumbing. Everything else in this phase is stateless.

## Common Pitfalls

### Pitfall 1: `@hono/zod-openapi` requires Zod 4 metadata to register cross-package schemas
**What goes wrong:** DTOs authored in `@contractor-ops/validators` (plain `zod`) may not surface `.openapi()`/`.meta()` component names into the derived doc if the library expects schemas from its own re-exported `z`.
**Why it happens:** `@hono/zod-openapi@1.x` bridges Zod 4's native registry; historically schemas needed `.openapi('Name')` from the package's `z`. In Zod 4 the registry is global and native `.meta({...})` is honored — but this must be **proven**, not assumed.
**How to avoid:** Run a **Wave-0 spike**: define one route with a validators-authored `.strict()` schema, call `app.getOpenAPI31Document(...)`, assert the expected `components.schemas` + parameters appear. If cross-package metadata does not register, author the route DTOs in the `apps/public-api` layer using `z` from `@hono/zod-openapi`, importing only enums/primitives from validators. [MEDIUM confidence — README shows `.openapi()` on the package `z`; Speakeasy's separate `zod-openapi` guide uses native `.meta()`; interop of plain-validators schemas is the untested seam.]
**Warning signs:** empty `components.schemas`, `$ref`s to anonymous inline objects, or Speakeasy generating `any`-typed models.

### Pitfall 2: Singular/plural scope-string mismatch between existing code and Phase 99 taxonomy
**What goes wrong:** `permissionToScopes({contractor:['read']})` produces **`contractor:read`** (singular, `scope-utils.ts:13`), and existing keys carry `contractor:read`. But INTEG-AUTH-02 enumerates **`contractors:read|write`** (plural + `write`). If Phase 98 adds plural `contractors:write` to `PUBLIC_API_SCOPES` while `requirePermission({contractor:['create']})` checks for `contractor:create`, **no key will ever satisfy the write gate** (or worse, a mismatch silently blocks/allows).
**Why it happens:** two independently-designed naming schemes meeting at the key's `scopes String[]`.
**How to avoid:** The scope strings added to `PUBLIC_API_SCOPES` MUST equal exactly what `requirePermission` computes. **Recommendation (lock in discuss/plan):** keep the granular `resource:action` strings on the key (`contractor:create`, `contractor:update`, `payment:update`, `workflow_task:update`, …) — these are what `permissionToScopes` emits — and treat the plural `entity:write` labels in INTEG-AUTH-02 as **Phase-99 display bundles** that expand to the granular set in the scope-picker UI. This keeps the existing 4 read scopes (`contractor:read` etc.) valid and defers the display-taxonomy to Phase 99. [MEDIUM — genuine unresolved design decision; see Assumptions A1.]
**Warning signs:** a write regression test with a correctly-scoped key returns 403.

### Pitfall 3: RBAC resource keys for payments/workflows/classifications may not exist in the `Permission` type
**What goes wrong:** `requirePermission({payment:['update']})` type-checks only if `payment` (and `update`) are valid keys of `@contractor-ops/auth` `Permission`. If the auth taxonomy has no `payment`/`workflow`/`workflow_task`/`classification`/`compliance` resource, the write gates won't compile.
**How to avoid:** Before writing write procedures, enumerate the `Permission` resource/action union in `@contractor-ops/auth` (semble: `Permission` type) and confirm each of the 7 write entities has a `create`/`update` action. Any missing resource must be **added to the auth Permission taxonomy** (aligned with Phase 89 RBAC + Phase 99 INTEG-AUTH-02) as an explicit plan task. [Flag for planner — the read routers only ever used `contractor`/`invoice`/`contract`/`document`, so payment/workflow/classification/compliance resources are unverified.]
**Warning signs:** TS error "Object literal may only specify known properties" on `requirePermission`.

### Pitfall 4: `basePath` on `OpenAPIHono` vs the `/v1` requirement + spec `servers`
**What goes wrong:** `createRoute` paths (`/contractors`) are relative; the OpenAPI `servers[].url` and the runtime `.basePath()` must agree, and the Scalar `url` + render `healthCheckPath` must point at the live spec path. A mismatch yields a docs page that can't reach `/openapi.json` or SDKs with the wrong server URL.
**How to avoid:** Decide the base path once (recommend **`/v1`** on the dedicated `api.contractor-ops.com` subdomain — `api.contractor-ops.com/v1/*` beats the redundant `/api/v1`), set `.basePath('/v1')`, set the doc `servers:[{url:'/v1'}]` (or the absolute origin via the `doc31` context form), point `Scalar({url:'/v1/openapi.json'})`, and update `render.yaml healthCheckPath` to `/v1/health` in the same change. [Base-path change is low-risk: app is local-only, no external consumers — see Runtime State Inventory.]

### Pitfall 5: Cursor mode drops `total`; clients/tests expecting `meta.total` break
**What goes wrong:** the existing read responses return `{ meta: { total, page, pageSize } }` (`contractors.ts:20`). Cursor mode intentionally has **no total** (audit precedent: `audit.ts:165` returns `total:null`), because COUNT on unbounded tables is the anti-pattern being removed.
**How to avoid:** the new response envelope is `{ data, meta: { nextCursor, hasMore } }`. Update the 5 existing read routes + their tests (`routes/__tests__/*.test.ts`) in the same change (D-03 migrates them). Do not offer offset+cursor dual-mode publicly (single convention).

### Pitfall 6: `.strict()` on a query DTO rejects `filter[...]`/`sort` unless the grammar is parsed first
**What goes wrong:** raw Hono `c.req.query()` yields flat keys like `"filter[status]"`; a `.strict()` object schema with a `filter` field will reject the flat key.
**How to avoid:** parse bracket params into a nested object at the Hono boundary (`parse-list-query.ts` extension) BEFORE `.strict()` validation; only whitelisted `filter[field]`/`sort` fields per entity survive (see § Code Examples).

## Code Examples

### Opaque cursor encode/decode (stateless, versioned)
```ts
// Source: wraps pagination.ts:64 cursorClause convention (cursor === row id) in an opaque envelope
export function encodeCursor(id: string): string {
  return Buffer.from(JSON.stringify({ v: 1, id })).toString('base64url')
}
export function decodeCursor(token?: string): string | undefined {
  if (!token) return undefined
  try {
    const p = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'))
    if (p?.v === 1 && typeof p.id === 'string') return p.id
  } catch { /* fall through to BAD_REQUEST at the boundary */ }
  throw new TRPCError({ code: 'BAD_REQUEST', message: 'INVALID_CURSOR' })
}
// tRPC list: const rows = await ctx.db.X.findMany({ where, orderBy, select, ...cursorClause({ cursor: decodeCursor(input.cursor), limit: input.limit }) })
//            const { items, nextCursor } = paginateByLastKeptUndefined(rows, { cursor: decodeCursor(input.cursor), limit: input.limit })
//            return { items, nextCursor: nextCursor ? encodeCursor(nextCursor) : undefined }
```

### Cursor + filter/sort list DTO (`.strict()`, per-entity field allowlist)
```ts
// Source: extends common-inputs.ts:14 paginationSchema → cursor; employee-country-fields.ts:63 .strict() precedent
export const publicListBaseSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).strict()

export const publicContractorListInputSchema = publicListBaseSchema.extend({
  filter: z.object({
    status: contractorStatusEnum.optional(),
    lifecycleStage: contractorLifecycleStageEnum.optional(),
  }).strict().optional(),
  sort: z.enum(['createdAt', '-createdAt', 'legalName', '-legalName', 'updatedAt', '-updatedAt'])
        .default('-createdAt'),   // leading '-' = desc (JSON:API convention)
}).strict()
```

### Hono boundary: parse `filter[field]=`/`sort=` before validation
```ts
// Source: extension of parse-list-query.ts:31 (safeParse boundary)
function parseBracketedQuery(q: Record<string, string | undefined>) {
  const out: Record<string, unknown> = {}
  const filter: Record<string, string> = {}
  for (const [k, v] of Object.entries(q)) {
    if (v == null) continue
    const m = k.match(/^filter\[([^\]]+)\]$/)
    if (m) filter[m[1]] = v
    else out[k] = v            // cursor, limit, sort
  }
  if (Object.keys(filter).length) out.filter = filter
  return out
}
// handler: const input = schema.parse(parseBracketedQuery(c.req.query()))  // .strict() rejects unknown filter keys
```

### RFC 8594 Sunset / Deprecation version-header middleware
```ts
// Source: RFC 8594 (Sunset HTTP header) — mechanism must exist even though /v1 is current (no Sunset emitted yet)
const VERSION_POLICY: Record<string, { deprecation?: Date; sunset?: Date; policyUrl?: string }> = {
  v1: { /* current — no deprecation/sunset in Phase 98 */ policyUrl: 'https://api.contractor-ops.com/versioning' },
}
export const versionHeaders: MiddlewareHandler = async (c, next) => {
  await next()
  const cfg = VERSION_POLICY.v1
  if (cfg.deprecation) c.header('Deprecation', cfg.deprecation.toUTCString())
  if (cfg.sunset) c.header('Sunset', cfg.sunset.toUTCString())        // RFC 8594 HTTP-date
  if (cfg.policyUrl) c.header('Link', `<${cfg.policyUrl}>; rel="sunset"`)
}
```

### Scalar mount (replaces app.ts:145-179 CDN+SRI HTML)
```ts
// Source: github.com/scalar/scalar hono integration (@scalar/hono-api-reference)
import { Scalar } from '@scalar/hono-api-reference'
app.get('/openapi.json', (c) => c.json(app.getOpenAPI31Document({ openapi: '3.1.0', info: { title: 'Contractor Ops API', version: '1.0.0' } })))
app.get('/docs', Scalar({ url: '/v1/openapi.json' }))   // no CDN, no SRI pin, no boot-throw
```

### Speakeasy `.speakeasy/workflow.yaml` (TS + Python from the 3.1 spec)
```yaml
# Source: speakeasy.com/docs — sdk-generation-action workflow reference (shape; confirm exact keys against `speakeasy quickstart` output)
workflowVersion: 1.0.0
sources:
  contractor-ops-api:
    inputs:
      - location: ./apps/public-api/openapi.snapshot.json   # spec with writes hidden (hide:true) — reads only
targets:
  typescript-sdk:
    target: typescript
    source: contractor-ops-api
    publish:
      npm: { token: $NPM_TOKEN }        # package.json name: @contractor-ops/sdk, version 0.x
  python-sdk:
    target: python
    source: contractor-ops-api
    publish:
      pypi: { token: $PYPI_TOKEN }      # dist name: contractor-ops-sdk, version 0.x
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-written OpenAPI literal (`openapi.ts:5`) | Zod-derived 3.1 via `@hono/zod-openapi` `doc31`/`getOpenAPI31Document` | this phase (D-03) | Spec can't drift from routes |
| Scalar via CDN `<script>` + SRI hash (`app.ts:128-179`) | `@scalar/hono-api-reference` `Scalar({url})` npm dep | this phase (D-03) | Removes SRI-pin boot fragility |
| Offset `page/pageSize` (`common-inputs.ts:14`) | Opaque cursor + `pagination.ts` helpers | this phase (D-03) | No deep-page scans; `total` dropped |
| `.openapi()` monkey-patch (Zod 3 era) | Zod 4 native `.meta()` registry (Zod 4.0, 2025) | already on Zod 4 in repo | `@hono/zod-openapi@1.x` required (peer `zod ^4`) |
| Hand-written API clients | Speakeasy codegen from spec | this phase (D-04) | Idiomatic TS/Python SDKs, auto-published |

**Deprecated/outdated:**
- `@hono/zod-openapi@0.x` (Zod 3): do NOT use — repo is Zod 4; 1.x is required.
- `SCALAR_SRI_HASH` / `ENABLE_API_DOCS` env gating: obsolete once Scalar is a real dep — remove.
- `parseListQuery` as the sole boundary validator: superseded by `createRoute` `c.req.valid()` (keep a thin extension only for bracket-filter parsing).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Keeping granular `resource:action` scope strings (`payment:update`) on the key, with plural `entity:write` as Phase-99 display bundles, is the right reconciliation of the existing `permissionToScopes` output vs INTEG-AUTH-02's plural taxonomy | Pitfall 2 / Scope taxonomy | If Phase 99 hard-requires plural scopes on the key, the 4 existing read scopes + all 98 write scopes must be re-strung — a breaking taxonomy change. Confirm with the Phase 99 owner before locking. |
| A2 | Plain-`zod` (validators) `.strict()` schemas register their component names into the `@hono/zod-openapi` 3.1 document via Zod 4 native metadata | Pitfall 1 / Standard Stack | If not, DTOs must be re-authored with the package's `z` in the app layer (more code, validators stay pure). De-risk with the Wave-0 spike. |
| A3 | The `Permission` type in `@contractor-ops/auth` already contains `payment`/`workflow`/`workflow_task`/`classification`/`compliance` resources with `create`/`update` actions | Pitfall 3 | If missing, an auth-taxonomy addition task is required before write procedures compile. Verify by reading the `Permission` union. |
| A4 | Base path moves `/api/v1` → `/v1`; low blast radius because app is local-only with no external consumers | Pitfall 4 / Runtime State | If an internal consumer or bookmark relies on `/api/v1`, add a redirect. Confirm no first-party caller hits `/api/v1/*`. |
| A5 | Speakeasy `.speakeasy/workflow.yaml` keys (`sources`/`targets`/`publish.npm`/`publish.pypi`) are as shown; 0.x prerelease is set via the target's version config | Speakeasy section | Exact schema must be confirmed from `speakeasy quickstart` output at plan time; wrong keys fail CI, not prod. |
| A6 | `@scalar/hono-api-reference@0.11.5` is the version to pin (newest ≥7 days as of 2026-07-01); re-verify at plan time | Standard Stack | A newer ≥7-day-old release may exist by plan time; re-run `npm view … time`. |
| A7 | `payment_runs` write in scope is limited to status transitions/export (not payout initiation) — `_initiatePayoutForRun` (`payment-shared.ts:717`, takes `userId`) is NOT re-exposed publicly in 98 | Write Re-Impl | If payout-init must be public, its `userId` audit coupling needs an API_KEY variant — larger surface. Confirm the intended write verbs per entity in discuss/plan. |

## Open Questions

1. **Which write verbs per entity?** (create/update/void/transition/export) — the CONTEXT names 7 write *entities* but not the exact mutations. Recommendation: enumerate the minimal write verb set per entity in discuss/plan (e.g. contractors: create+update; invoices: void; payments/payment_runs: create+transition+export; workflows/workflow_tasks: transition; classifications: create; compliance_documents: create/link). Each verb = one scope + one `requirePermission`.
2. **Scope taxonomy (A1)** — granular `resource:action` on the key vs plural `entity:write` bundles. Needs a cross-phase decision with Phase 99. Recommendation: granular on key, plural in UI.
3. **PyPI publish auth** — token (`PYPI_TOKEN`) vs OIDC trusted publishing. Recommendation: OIDC trusted publishing (no long-lived secret) if the CI is GitHub Actions; else `PYPI_TOKEN`.
4. **Spec snapshot for Speakeasy** — generate a committed `openapi.snapshot.json` (writes hidden) in CI from a running/booted app, or emit statically from `getOpenAPI31Document`. Recommendation: a build-time script that imports the app and writes the doc with writes `hide:true`, committed + diff-checked in CI so SDK regen is deterministic.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / pnpm | build, tests | ✓ | pnpm 10 + Turborepo | — |
| Zod 4 | `@hono/zod-openapi` peer | ✓ | `4.4.3` (installed alongside 3.25.x for legacy) | — (Zod 4 present) |
| Hono ≥4.10 | `@hono/zod-openapi` peer | ✓ | `^4.12.18` | — |
| `@hono/zod-openapi` | OpenAPI 3.1 derivation | ✗ (to add) | pin `1.4.0` | none — required (D-03) |
| `@scalar/hono-api-reference` | Docs portal | ✗ (to add) | pin `0.11.5` | keep CDN temporarily (rejected by D-03) |
| Speakeasy CLI | SDK codegen | ✗ (CI install) | `sdk-generation-action@v15` (binary) | none — required (D-04); local `brew install speakeasy` |
| Upstash Redis | rate-limit prod enforcement | ✓ (scaffold) | `@upstash/ratelimit ^2.0.8` | in-memory fallback (non-prod only) |
| npm registry (publish) | `@contractor-ops/sdk` | ✓ (needs `NPM_TOKEN`) | — | reserve name first |
| PyPI (publish) | `contractor-ops-sdk` | ✓ (needs `PYPI_TOKEN`/OIDC) | — | reserve name first |

**Missing dependencies with no fallback:** `@hono/zod-openapi@1.4.0`, `@scalar/hono-api-reference@0.11.5`, Speakeasy CLI — all install steps in the plan (Speakeasy is CI-only, no runtime dep).
**Missing dependencies with fallback:** none material — CDN Scalar exists today but is explicitly rejected by D-03.

## Validation Architecture

> `workflow.nyquist_validation = true` (`.planning/config.json`) → this section is required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.x (`apps/public-api` `test: vitest run`; `packages/api` vitest) |
| Config file | per-package `vitest` (no root config); Hono fetch-harness (no supertest) |
| Quick run command | `pnpm --filter @contractor-ops/public-api test <path>` (scoped) |
| Full suite command | `pnpm --filter @contractor-ops/public-api test` + `pnpm --filter @contractor-ops/api test <path>` (scoped) |
| Existing seam | `apps/public-api/src/__tests__/app.test.ts` — real app assembly, `createPublicCaller` stubbed via `vi.hoisted`; `*.security.test.ts` regression pattern (`rate-limit.security.test.ts`) |

> **NEVER** run the full unscoped web-vite suite (kills Mac RAM). Always scope `--filter` + a path arg. public-api/api suites are safe scoped.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INTEG-API-01 | Every write endpoint rejects a correctly-authenticated key **without** the required scope (BFLA) | security | `pnpm --filter @contractor-ops/api test public-api-scope` | ❌ Wave 0 (`public-api/__tests__/write-scope.security.test.ts`) |
| INTEG-API-01 | `.strict()` DTO rejects extra body keys incl. `organizationId`/`workerType`/money | unit | `pnpm --filter @contractor-ops/public-api test strict-dto` | ❌ Wave 0 |
| INTEG-API-01 | Cross-tenant write/read denied (org from key, not client) | security | `pnpm --filter @contractor-ops/api test tenant-isolation` (extend existing) | ✅ pattern exists (`security/tenant-isolation-extra.security.test.ts`) |
| INTEG-API-02 | `getOpenAPI31Document()` emits `openapi: 3.1.x` with all read routes + component schemas; writes **absent** (`hide:true`) | unit | `pnpm --filter @contractor-ops/public-api test openapi-doc` | ❌ Wave 0 |
| INTEG-API-03 | `/v1/*` base resolves; `versionHeaders` emits `Sunset`/`Link` when policy set (and none for current v1) | unit | `pnpm --filter @contractor-ops/public-api test version-headers` | ❌ Wave 0 |
| INTEG-API-04 | Cursor page is stable + opaque (decode round-trips; tampered cursor → BAD_REQUEST); `filter[x]`/`sort=-field` parsed + `.strict()` rejects unknown filter | unit | `pnpm --filter @contractor-ops/public-api test cursor-filter` | ❌ Wave 0 |
| INTEG-API-05 | Spec snapshot (writes hidden) diff-checks; Speakeasy target config valid | ci | `speakeasy lint`/`speakeasy run --dry` in CI | ❌ Wave 0 (CI job) |
| D-05 | Per-org `module.public-api` off → 404 for reads AND writes | integration | `pnpm --filter @contractor-ops/api test public-api-flag` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** scoped `pnpm --filter @contractor-ops/public-api test <path>` for the touched file.
- **Per wave merge:** scoped public-api full + the relevant `packages/api` public-api tests.
- **Phase gate:** public-api suite green + the new `*.security.test.ts` (write-scope + flag-gate + tenant) green before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `apps/public-api/src/__tests__/write-scope.security.test.ts` — asserts EVERY write route 403s without its scope (BFLA) — covers INTEG-API-01
- [ ] `apps/public-api/src/__tests__/strict-dto.test.ts` — extra-key rejection incl. org/workerType/money — INTEG-API-01
- [ ] `apps/public-api/src/__tests__/openapi-doc.test.ts` — 3.1 doc shape + writes hidden — INTEG-API-02
- [ ] `apps/public-api/src/__tests__/cursor-filter.test.ts` — cursor round-trip/tamper + bracket-filter/sort — INTEG-API-04
- [ ] `apps/public-api/src/__tests__/version-headers.test.ts` — RFC 8594 emission — INTEG-API-03
- [ ] `packages/api/src/__tests__/security/public-api-flag.security.test.ts` — per-org 404 dark gate — D-05
- [ ] `packages/api/src/__tests__/security/public-api-write-scope.security.test.ts` — apiKey-mode scope matrix — INTEG-API-01/D-02
- [ ] CI job — `speakeasy` lint/dry-run against the committed spec snapshot — INTEG-API-05
- [ ] **Spike (Wave 0):** prove validators `.strict()` schemas register into `getOpenAPI31Document()` (A2/Pitfall 1)

## Security Domain

> `security_enforcement` absent in config → treated as enabled.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | HMAC-SHA256 API keys, `resolveApiKey`/`verifyKey` timing-safe (`api-key-service.ts:83/107`) — reused (D-06) |
| V3 Session Management | n/a | Stateless bearer keys — no sessions on the public API |
| V4 Access Control (BFLA/BOLA) | **yes (central)** | Mandatory `requirePermission` per write (`rbac.ts:19-42`); tenant from key not client (`api-key-auth.ts:65`); `deletedAt:null` + `organizationId` filter on every query; `.strict()` blocks mass-assignment (BOLA on org/workerType) |
| V5 Input Validation | yes | Zod `.strict()` at Hono boundary (`c.req.valid`) + tRPC `.input()` defense-in-depth |
| V6 Cryptography | yes | `API_KEY_HMAC_SECRET` (min 32 chars, `api-key-service.ts:27`) — never hand-roll |
| V13 API/Web Service | yes | Versioned `/v1` + RFC 8594 Sunset; rate-limit (`rate-limiter.ts`, fail-closed prod); CORS allowlist (`app.ts:52-105`) |

### Known Threat Patterns for Hono + tRPC public API
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| BFLA — write endpoint reachable without a scope | Elevation of Privilege | Mandatory `requirePermission` on every write; regression test asserts 403-without-scope for all writes (D-02 hard constraint) |
| BOLA / mass-assignment — client sets `organizationId`/`workerType`/money | Tampering | `.strict()` DTOs omit these fields; explicit Prisma `data`/`select` allowlists; tenant from `ctx.organizationId` (key) |
| Cross-tenant read/write (IDOR) | Information Disclosure | Every query `where:{ organizationId: ctx.organizationId, deletedAt:null }`; extend `security/tenant-isolation` tests |
| Dark surface leakage — writes appear in SDK/docs pre-99 | Information Disclosure | `hide:true` on write `createRoute`; per-org `module.public-api` 404 gate; writes excluded from committed spec snapshot |
| Audit gap on external mutation | Repudiation | `writeAuditLog(actorType:'API_KEY', actorId: ctx.apiKeyId)` atomic-in-tx, lint-enforced (`scripts/lint-audit-log.mjs`) |
| Cursor tampering / enumeration | Tampering | Opaque base64url cursor decoded/validated at boundary → BAD_REQUEST on tamper; keyset scoped by `organizationId` |
| DoS via deep pagination / unbounded scans | Denial of Service | Cursor pagination (no offset scans); flat 100/min rate-limit (per-tier is Phase 99) |
| Untrusted 3rd-party docs script (current CDN+SRI risk) | Tampering | Replace CDN load with `@scalar/hono-api-reference` npm dep (removes SRI-pin fragility) |

## Sources

### Primary (HIGH confidence)
- **Codebase (this tree)** — `apps/public-api/src/{app.ts,openapi.ts,index.ts,routes/contractors.ts,lib/{create-caller,parse-list-query,rate-limiter}.ts}`; `packages/api/src/{middleware/{api-key-auth,rbac,require-workforce-flag}.ts,lib/{scope-utils,pagination}.ts,services/{api-key-service,audit-writer}.ts,routers/{public-api/*,core/audit.ts,finance/payment-shared.ts,workflow/workflow-shared.ts}}`; `packages/validators/src/{public-api/index,common-inputs}.ts`; `packages/feature-flags/src/{flags-core,evaluator}.ts`; `render.yaml`; `.planning/{REQUIREMENTS,ROADMAP,config.json}` + `98-CONTEXT.md`.
- **npm registry (verified via `npm view`)** — `@hono/zod-openapi@1.4.0` (peer `zod ^4.0.0`, `hono >=4.10.0`; published 2026-05-09); `@scalar/hono-api-reference@0.11.5` (published 2026-06-22); download counts 1.24M/606K weekly; no postinstall scripts.
- **github.com/honojs/middleware/tree/main/packages/zod-openapi** (README) — `OpenAPIHono`, `createRoute`, `.openapi()`, `doc31`/`getOpenAPI31Document`, `hide:true`, sub-router `:param` caveat.
- **github.com/scalar/scalar (hono integration)** — `Scalar({ url })` middleware.

### Secondary (MEDIUM confidence)
- **speakeasy.com/docs** — `sdk-generation-action` (pr/direct modes; `SPEAKEASY_API_KEY`/`NPM_TOKEN`/`PYPI_TOKEN`); TS+Python targets; standalone binary.
- **speakeasy.com/openapi/frameworks/zod** — Zod 4 native `.meta()` for OpenAPI metadata (informs Pitfall 1 / A2).

### Tertiary (LOW confidence — flagged for validation)
- Exact `.speakeasy/workflow.yaml` key schema + 0.x prerelease version config (A5) — confirm via `speakeasy quickstart` at plan time.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions npm-verified with publish dates ≥7-day floor; APIs from official Hono/Scalar docs; Zod-4 repo match confirmed in-tree.
- Architecture (delegate-to-tRPC split + write-reuse mapping): HIGH — every helper read from source; the split is the existing shipped pattern.
- Scope taxonomy + Zod-metadata interop: MEDIUM — two genuine unresolved seams (A1/A2) with clear Wave-0 de-risking.
- Speakeasy CI YAML specifics: MEDIUM — shape from docs; exact keys need `speakeasy quickstart` confirmation.
- Pitfalls / Security: HIGH — grounded in source + ASVS/STRIDE mapping to the concrete surface.

**Research date:** 2026-07-01
**Valid until:** 2026-07-15 (fast-moving: re-verify `@scalar/hono-api-reference` version and Speakeasy action major at plan time; `@hono/zod-openapi` stable)
