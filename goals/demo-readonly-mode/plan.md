# Plan — Demo read-only mode

## Solution approach

Two enforcement layers sharing one demo predicate:

1. **tRPC mutation guard** — a `demoReadOnly` middleware (`type === 'mutation' && isDemoContext && !meta.allowInDemo → FORBIDDEN/DEMO_READ_ONLY`) wired onto the three **org-scoped** base procedures (`authedProcedure`, `portalProcedure`, `apiKeyTenantProcedure`), not raw `publicProcedure`. Reason: `ctx.organizationId` is only resolved *after* auth/tenant/portal middleware — at `publicProcedure` it doesn't exist yet — and unauthenticated mutations (login / magic-link) must keep working in demo. `authedProcedure` is the base of `tenantProcedure`, so a single anchor there covers the entire staff `appRouter` (including `org.create`); two more anchors cover portal + API-key surfaces. `cronProcedure` is intentionally excluded and handled by layer 2.
2. **Service-layer outbound guard** — the same predicate (`isDemoOrg(orgId)`) early-returns at each real-outbound chokepoint in `packages/api/src/services/*`, covering both `apps/cron-worker` jobs and `apps/api` QStash callback routes that funnel through those services.

Demo signal = `getServerEnv().DEMO_MODE === true` **OR** `orgId ∈ getServerEnv().DEMO_ORG_IDS` — env-controlled only; `metadata.profile` is never the gate.

## Key facts established by recon

- Base chain: `publicProcedure` (`init.ts:165`) → `authedProcedure` (`middleware/auth.ts:34`) → `tenantProcedure` (`middleware/tenant.ts:213`, sets `ctx.organizationId`). Portal: `portalProcedure` (`middleware/portal-auth.ts`, sets `ctx.organizationId`). API key: `apiKeyTenantProcedure` (`middleware/api-key-auth.ts`, sets `ctx.organizationId`).
- `initTRPC.context<Context>().create()` (`init.ts:139`) has **no** `.meta<>()` — must add it to type `allowInDemo`.
- Env schema = `packages/validators/src/env.ts:325` (`serverEnvSchema` = merged zod sub-schemas), read via `getServerEnv()`. List-parse precedent: `parseTrustedOrigins` in `packages/auth/src/env.ts:116`.
- Query-resolver write audit: **no risky writes** — only `api-key-service touchLastUsed` (harmless last-used touch). Fact "no-op risky query writes" satisfied by audit; no code change.
- Outbound chokepoints: `services/app-email.ts:sendAppEmail`, `services/notification-service.ts:dispatch`, `services/zatca-submission.ts:submitToZatca`/`submitToKsef`, `PeppolOrchestrator.submitOutboundInvoice`/`pollAndProcessInbound`/`processInboundInvoice`, `services/outbox.ts:drainOutboxBatch`, contract-health `runContractHealthCheck`.

## Ordered steps

### 1. Env vars
- `packages/validators/src/env.ts`: add a `demoSchema` (`DEMO_MODE` coerced boolean default `false`; `DEMO_ORG_IDS` string `.transform` → `string[]` mirroring `parseTrustedOrigins`), merge into `serverEnvSchema`. Add both to `.env.example` with comments.
- **Verify:** `pnpm typecheck --filter=@contractor-ops/validators`; `pnpm check:no-process-env`.

### 2. Shared demo predicate
- New `packages/api/src/lib/demo.ts`: `isDemoOrg(orgId: string | null | undefined): boolean` = `getServerEnv().DEMO_MODE || (!!orgId && getServerEnv().DEMO_ORG_IDS.includes(orgId))`; and `isDemoContext(ctx)` deriving `orgId = ctx.organizationId ?? ctx.session?.session?.activeOrganizationId ?? null` then delegating to `isDemoOrg`.
- **Verify:** unit test `lib/__tests__/demo.test.ts` — env matrix (DEMO_MODE on/off × org in/out of list × null org).

### 3. tRPC `Meta` type
- `packages/api/src/init.ts`: declare `export interface Meta { allowInDemo?: boolean }`; change builder to `initTRPC.context<Context>().meta<Meta>().create({...})`. No other call sites change (meta optional).
- **Verify:** `pnpm typecheck --filter=@contractor-ops/api`.

### 4. `demoReadOnly` middleware + error code
- Add `DEMO_READ_ONLY` constant to `packages/api/src/errors.ts`.
- New `packages/api/src/middleware/demo.ts`: `t.middleware(({ ctx, type, meta, next }) => { if (type === 'mutation' && !meta?.allowInDemo && isDemoContext(ctx)) throw new TRPCError({ code: 'FORBIDDEN', message: DEMO_READ_ONLY, cause: { code: 'DEMO_READ_ONLY' } }); return next(); })`. Optional structured `@contractor-ops/logger` line on block; no `console.*`.
- **Verify:** unit test `middleware/__tests__/demo.test.ts` — query-in-demo passes; mutation-in-demo throws `DEMO_READ_ONLY`; mutation-not-demo passes; `allowInDemo` mutation-in-demo passes.

### 5. Wire the guard (3 anchors)
- `middleware/auth.ts`: `authedProcedure = publicProcedure.use(authMiddleware).use(demoReadOnly)`.
- `middleware/portal-auth.ts`: append `.use(demoReadOnly)` to `portalProcedure`.
- `middleware/api-key-auth.ts`: append `.use(demoReadOnly)` to `apiKeyTenantProcedure`.
- **Verify:** integration test — `contractor.create` with demo-org session → `FORBIDDEN/DEMO_READ_ONLY`, with real-org session → success; one `portalAppRouter` mutation blocked in demo; a query (`contractor.list`) succeeds in demo. Add a regression test asserting every top-level `appRouter` + `portalAppRouter` mutation is blocked under demo (drift guard for new leaf procedures).

### 6. Allowlist mechanism (tag none)
- Mechanism already honored by step 4. Add a test proving a fixture procedure with `.meta({ allowInDemo: true })` passes in demo. Document opt-in in `middleware/demo.ts` header. Tag zero real procedures.

### 7. Expose `isDemo`
- `organization.getCurrent` resolver (`packages/api/src/routers/core/organization*`): add `isDemo: isDemoOrg(ctx.organizationId)` to the returned object + its output type/Zod shape.
- **Verify:** router test asserts `isDemo` true for demo-org ctx, false otherwise; `pnpm typecheck --filter=@contractor-ops/api`.

### 8. Service-layer outbound guards (cron in scope)
- Insert `if (isDemoOrg(orgId)) { log.info({ orgId, job }, 'demo org — skipping outbound'); return <no-op result>; }` at the entry of: `sendAppEmail`, `dispatch`, `submitToZatca`, `submitToKsef`, `PeppolOrchestrator.submitOutboundInvoice`, `pollAndProcessInbound`, `processInboundInvoice`, `drainOutboxBatch` (per-event `orgId`), `runContractHealthCheck`. Each guard needs the org id already in scope (confirmed available per recon).
- **Verify:** unit test per guarded function — demo org → no outbound call (mock asserts not called) + skip log; real org → proceeds. Confirm `apps/cron-worker` handlers funnel through these services (not a bypassing copy).

### 9. Query-write audit (no-op risky)
- Record audit result: only `touchLastUsed` (harmless) writes from a query path; no changes required. Note in commit body + this plan. (Fact satisfied by audit.)

### 10. Frontend (web-vite)
- Global tRPC error handler / toast: detect `data.cause?.code === 'DEMO_READ_ONLY'` (or `errorKey`) → i18n toast key in `Errors` namespace, translated in en/de/pl/ar.
- Dashboard shell: render persistent "DEMO" banner when `organization.getCurrent.isDemo`; RTL-correct for `ar` (use logical properties per the ml-/mr- RTL guard).
- Follow `frontend-design` skill (read SKILL.md + `semble search`) before editing web-vite.
- **Verify:** scoped `pnpm --filter @contractor-ops/web-vite test <path>` only (NEVER full suite — RAM). Manual: banner + toast in all 4 locales.

### 11. Integration sandbox belt-and-braces
- Confirm demo org's KSeF/ZATCA/Peppol/HMRC `IntegrationConnection` rows point at sandbox/test endpoints; document. No prod creds for demo org.

### 12. Final verification
- `pnpm typecheck --filter=@contractor-ops/api`
- `pnpm --filter @contractor-ops/api test`
- `pnpm check:no-process-env`
- scoped web-vite test for the toast/banner
- `pnpm audit` / `pnpm security:scan` only if deps change (none expected)

## Risks / open questions

- **`authedProcedure` is a hot base procedure** — `demoReadOnly` must be sync + cheap (`getServerEnv()` is cached at boot; array `includes` over a tiny list). No DB call in the guard.
- **`.meta<Meta>()` addition** must not break existing procedures — meta is optional; verify with full `appRouter` typecheck.
- **Cron coverage completeness** — guarding the service layer assumes every outbound path funnels through the listed chokepoints. The per-guard unit tests + a grep for direct `Resend`/`storecove`/`fetch` calls outside these services confirm no bypass; flag any direct caller found.
- **`DEMO_ORG_IDS` must be set in the demo deployment env** (and `DEMO_MODE=true` for a dedicated demo deploy). Document in `.env.example` and as a `render.yaml` note — no ad-hoc Render service change without user ask.
- **`getServerEnv()` must be populated in both `apps/api` and `apps/cron-worker`** boot paths (both call `validateServerEnv`) — confirm before relying on it in cron-worker services.
- **Drift** — a future leaf procedure added on `publicProcedure` directly (bypassing the 3 anchors) would escape the guard; the step-5 "all mutations blocked" regression test is the backstop.
