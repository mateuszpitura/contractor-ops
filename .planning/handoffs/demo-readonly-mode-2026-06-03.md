# Handover: Demo read-only mode (block all mutations when demo)

**Created:** 2026-06-03 · **For:** implementing agent · **Status:** not started · **Origin:** sales-demo strategy (`.planning/campaigns/2026-06-cold-wave-1/demo-strategy.md` Gate 2 + ASSET-23).

## Goal

When running in a demo context, block **all write operations** so a sales demo tenant cannot be mutated and cannot fire real outbound (e.g. KSeF/ZATCA/Peppol submissions hitting government sandboxes or — worse — prod). Read everything, write nothing.

## Core design decision (locked)

1. **Enforce server-side in a tRPC middleware on the base procedure builder — NOT in the UI.** UI-only disabling is bypassable via direct API calls; it is UX, not protection. The middleware is the security layer.
2. **One chokepoint via `type`.** tRPC v11 middleware receives `opts.type` (`'query' | 'mutation' | 'subscription'`). Block when `type === 'mutation' && isDemo(ctx)`. Queries pass untouched — a single middleware on the base procedure covers the entire surface.
3. **Demo signal = OR of two sources:**
   - **Global env kill-switch** `DEMO_MODE=true` — for a dedicated demo deployment.
   - **Per-tenant**: the session's organization is a demo org (`organization.metadata.profile` ∈ {`qa-default-org`, `qa-empty-org`, `qa-stress-org`, and a new explicit `demo`}) — so shared infra can host demo + real orgs simultaneously. This mirrors the existing pattern: `packages/feature-flags/src/evaluator.ts` already keys off `QA_DEFAULT_ORG_ID` + `metadata.profile`.
4. **Allowlist.** A few mutations must still work in demo (logout/session; a future "reset demo" action). Default = block; opt out per-procedure via a tRPC meta flag `allowInDemo: true`.
5. **Error shape.** Throw `TRPCError({ code: 'FORBIDDEN', message: 'Demo mode is read-only', cause: { code: 'DEMO_READ_ONLY' } })` (or equivalent machine-readable field in `data`) so the frontend can detect and toast a friendly message rather than a raw error.

## Files to investigate FIRST (verify before editing — do not trust blindly)

Paths below are from a 2026-06-03 read-only recon; **confidence noted. The implementing agent MUST `semble search` / `Read` to confirm exact shapes before editing** (per CLAUDE.md: verify, read-before-edit, match existing patterns).

| What | Path | Confidence |
|------|------|------------|
| tRPC init + procedure builders (`t.procedure`, `publicProcedure`, `protectedProcedure`, middleware composition) | `packages/api/src/trpc.ts` **or** `init.ts` — LOCATE it | needs confirm |
| Tenant/context middleware (resolves `ctx.session`, `ctx.organization`, `ctx.dataRegion`, RLS) | `packages/api/src/middleware/tenant.ts` | confirmed by recon |
| Demo/QA org detection pattern to reuse | `packages/feature-flags/src/evaluator.ts` (uses `QA_DEFAULT_ORG_ID` + `metadata.profile`) | confirmed by recon |
| Org `metadata.profile` values + seeding | `packages/db/scripts/seed-dev.ts` (`qa-default-org` etc.) | confirmed by recon |
| API env schema (add `DEMO_MODE`) | `packages/api/src/env.ts` | needs confirm |
| Portal router (separate procedure surface — guard must cover it too) | `packages/api/src/portal-root.ts` | confirmed by recon |
| Main router | `packages/api/src/root.ts` | confirmed |
| Audit writer (ensure no half-write — guard runs before handler, so OK) | `packages/api/src/services/audit-writer.ts` | confirmed |

## Implementation steps

1. **Env:** add `DEMO_MODE` (boolean, default `false`) to `packages/api/src/env.ts` + `.env.example`. If an `APP_ENV` enum already exists, prefer adding a `'demo'` member instead — **check first**. Must go through the env schema (not raw `process.env`) — `pnpm check:no-process-env` enforces this.
2. **Helper `isDemoContext(ctx)`:** returns `true` if `env.DEMO_MODE` OR the session org's `metadata.profile` indicates demo. Co-locate with tenant/context utils. **DRY:** the QA-org detection already lives in `feature-flags/src/evaluator.ts` — consider exporting a shared `isQaOrDemoOrg(org)` from a shared package and reusing it in both places rather than duplicating the profile list.
3. **Middleware `demoReadOnly`:** `if (opts.type === 'mutation' && isDemoContext(ctx) && !opts.meta?.allowInDemo) throw new TRPCError({ code: 'FORBIDDEN', cause: { code: 'DEMO_READ_ONLY' } })`. Use `@contractor-ops/logger` if logging; no `console.*`.
4. **Wire into the BASE procedure** so every query + mutation inherits it — in **both** `appRouter` and `portalAppRouter` builders. Single composition point; do NOT sprinkle per-router.
5. **Meta type:** extend the tRPC meta interface with optional `allowInDemo?: boolean`. Tag the exceptions (logout / session-refresh if they're tRPC; future demo-reset).
6. **Expose `isDemo` in session/whoami** response so the UI can render a "DEMO" banner + disable actions (UX layer, ties to ASSET-24 watermark).
7. **Frontend (web-vite):** in the global tRPC error handler / toast, detect `DEMO_READ_ONLY` → show i18n toast ("Tryb demo — zmiany wyłączone" / "Demo mode — changes are disabled") in all 4 locales (en, de, pl, ar RTL). Optionally a `useIsDemo()` hook to pre-disable buttons (defense-in-depth UX, not the security boundary).

## Edge cases / gotchas

- **Queries with side effects.** The guard only blocks `mutation`. Grep for Prisma writes inside *query* resolvers (lazy provisioning, last-seen, view counters) — those bypass it. Either make them no-op under demo or accept them. Flag any found.
- **Better Auth flows** (login/logout/session) are likely separate auth routes, NOT under `appRouter` — so unaffected, but **confirm** they still work in demo.
- **Non-tRPC outbound:** `apps/cron-worker` jobs (invoice dispatch, webhooks, QStash callbacks) act on orgs directly. The middleware does NOT cover these. **Ensure demo orgs are excluded from real cron sends** — separate follow-up; flag explicitly. This is the highest-risk gap (a cron could send a real invoice for the demo org even though tRPC is locked).
- **Integration env:** even with mutations blocked, confirm the demo org's KSeF/ZATCA/Peppol/HMRC connections are set to sandbox/test (per `demo-strategy.md` Gate 2) as belt-and-braces.
- **org-create** is a mutation → blocked in demo (fine).
- **Multi-region:** guard runs in middleware before region routing — region-agnostic, OK.
- **No info leak:** keep the FORBIDDEN message generic.

## Testing

- **Unit (middleware):** query in demo → passes; mutation in demo → throws `DEMO_READ_ONLY`; mutation when not demo → passes; allowlisted mutation in demo → passes.
- **Integration:** real mutation (e.g. `contractor.create`) with a demo-org session → `FORBIDDEN/DEMO_READ_ONLY`; same with a real org → success. Cover one `portalAppRouter` mutation too.
- **Regression:** `protectedProcedure` still enforces auth; queries unaffected.

## Verify commands

```bash
pnpm typecheck --filter=@contractor-ops/api      # CI-canonical tsc
pnpm --filter @contractor-ops/api test           # scope to api (NEVER full web-vite suite unscoped — eats RAM)
pnpm check:no-process-env                         # env access touched
```

## Acceptance criteria

- With `DEMO_MODE=true` **or** a demo-org session: every tRPC mutation across `appRouter` + `portalAppRouter` returns `FORBIDDEN` / `DEMO_READ_ONLY`, except allowlisted; all queries succeed.
- UI shows a demo banner + a friendly i18n toast (en/de/pl/ar) on a blocked action.
- Cron/outbound path for demo orgs reviewed (no real sends) — or explicitly ticketed if out of scope.
- `pnpm typecheck --filter=@contractor-ops/api` green; scoped tests green; `check:no-process-env` green.
- No `console.*` (use `@contractor-ops/logger`); no raw `process.env`; minimal diff; matches existing middleware patterns.

## Out of scope (note for the agent)

- The DEMO_DATA watermark (ASSET-24) and classification-verdict reconciliation (ASSET-25) are separate tasks in `demo-strategy.md` — do not bundle.
- Self-serve sandbox auto-reset cron (ASSET-27) is wave 1.5 — not this task.

## Cross-refs

- `.planning/campaigns/2026-06-cold-wave-1/demo-strategy.md` (Gates 1–4, Tier 1 golden tenant)
- `.planning/campaigns/2026-06-cold-wave-1/positioning-and-liability.md` (why no real outbound / no verdict in demo)
