# Facts — Demo read-only mode

Source: `.planning/handoffs/demo-readonly-mode-2026-06-03.md` + interview (2026-06-03). Each bullet is a single testable/verifiable outcome.

## Demo signal & env

- A `DEMO_MODE` boolean env var (default `false`) is added to the env schema in `packages/validators/src/env.ts` and to `.env.example`, read only via `getServerEnv()` — never raw `process.env`.
- A `DEMO_ORG_IDS` env var (comma-separated list of organization IDs, default empty) is added to the same env schema and `.env.example`, parsed into a `string[]`.
- An organization is treated as "demo" **only** when its ID is in `DEMO_ORG_IDS`, or when `DEMO_MODE=true` globally. Demo status is never inferred from `metadata.profile` (mutable → not a trust boundary).
- A new explicit `demo` value is added to the org `metadata.profile` set for seeding and labelling a dedicated demo org and for driving UX, but `metadata.profile` alone never enables read-only enforcement.
- A helper `isDemoContext(ctx)` returns `true` iff `getServerEnv().DEMO_MODE === true` OR `ctx.organizationId` is in `DEMO_ORG_IDS`.

## tRPC middleware (the security boundary)

- A `demoReadOnly` tRPC middleware blocks a call when `opts.type === 'mutation'` AND `isDemoContext(ctx)` is true AND `opts.meta?.allowInDemo` is not `true`.
- A blocked mutation throws `TRPCError` with `code: 'FORBIDDEN'` and a machine-readable `DEMO_READ_ONLY` marker (in `cause`/`data`) plus a generic, leak-free message.
- Queries and subscriptions always pass through untouched, in demo or not.
- The middleware is wired into the BASE procedure builder (`publicProcedure` in `packages/api/src/init.ts`) so every procedure in both `appRouter` and `portalAppRouter` inherits it; it is not added per-router.
- The `initTRPC` builder gains a typed `Meta` interface exposing optional `allowInDemo?: boolean`.
- The `allowInDemo` allowlist mechanism ships with passing tests but tags zero procedures initially; how to opt a procedure in is documented.
- The guard runs before any handler/business logic, so a blocked mutation produces no partial Prisma write and no audit-log entry.
- The guard is region-agnostic (runs before region routing); EU and ME demo orgs both enforce identically.

## Cron-worker outbound (in scope)

- Cron-worker outbound jobs (invoice dispatch, webhooks, QStash callbacks) skip any org that is demo, using the same `DEMO_MODE` / `DEMO_ORG_IDS` signal — a demo org never triggers real outbound.
- Each skipped demo-org job emits a structured `@contractor-ops/logger` (Pino) entry noting the demo skip; no `console.*`.

## Query-resolver side effects

- Query resolvers performing Prisma writes are audited; any that fire real outbound or mutate demo-org data are made no-op under demo. Harmless writes (e.g. last-seen, counters) are documented and left as-is.

## Frontend UX (web-vite)

- The `organization.getCurrent` (whoami) response exposes an `isDemo` boolean.
- When a tRPC error carries `DEMO_READ_ONLY`, the global error handler shows a friendly i18n toast in all four locales (en, de, pl, ar RTL).
- The dashboard shell renders a persistent "DEMO" banner when `isDemo` is true; the banner renders correctly under RTL (ar).
- A `useIsDemo()` hook that pre-disables every mutating button is explicitly NOT in scope.

## Auth & edge cases

- Better Auth login/logout/session flows still work for a demo session (separate auth routes, not under `appRouter`) — verified.
- `organization.create` (a mutation) is blocked under demo — accepted as correct behavior.
- A blocked-mutation error message leaks no organization or tenant detail.
- As belt-and-braces, the demo org's KSeF / ZATCA / Peppol / HMRC connections are confirmed pointed at sandbox/test endpoints (documented even though mutations are already blocked).

## Acceptance / regression

- With `DEMO_MODE=true` or a session whose org is in `DEMO_ORG_IDS`: every tRPC mutation across `appRouter` and `portalAppRouter` returns `FORBIDDEN` / `DEMO_READ_ONLY` except allowlisted ones; all queries succeed.
- A non-demo org session: all mutations succeed normally (no regression).
- `protectedProcedure` still enforces auth; queries are unaffected by the guard.
- `pnpm typecheck --filter=@contractor-ops/api`, scoped `@contractor-ops/api` tests, and `pnpm check:no-process-env` all pass; no `console.*`, no raw `process.env`.

## Out of scope

- DEMO_DATA watermark (ASSET-24), classification-verdict reconciliation (ASSET-25), and self-serve sandbox auto-reset cron (ASSET-27) are separate tasks and not part of this goal.
