# Phase 75 — Path Drift Map (MANDATORY adaptation rules)

Phase 75's plans were authored 27-Apr against the PRE-migration tree. Several
`files_modified` paths are now STALE. Every executor MUST adapt the paths below
before creating any file. Do NOT create files at the dead `apps/web/...` paths —
they no longer exist (the Next.js SPA was migrated to a Vite SPA + Fastify API).

Verified against the CURRENT tree on 2026-05-31.

## 1. Web UI — `apps/web/...` → `apps/web-vite/...`

- `apps/web/src/components/<domain>/...`  →  `apps/web-vite/src/components/<domain>/...`
  - `apps/web-vite/src/components/contracts/` EXISTS (contract-detail, hooks/, __tests__/, contracts-list-container.tsx, ...).
  - `apps/web-vite/src/components/workflow/` EXISTS (hooks/, __tests__/, calendar-* configs, ...).
- `apps/web/messages/{en,de,pl,ar}.json`  →  `apps/web-vite/messages/{en,de,pl,ar}.json` (all 4 EXIST).
- Web UI MUST follow `apps/web-vite/ARCHITECTURE.md` Page → Container → Hook → Component layering:
  - Page = thin composer (Suspense/permissions); NO useTRPC/useQuery/useMutation.
  - Container (`*-container.tsx`) = calls domain hooks; owns loading/empty/error; NO direct tRPC.
  - Hook (`components/{domain}/hooks/use-*.ts`) = the ONLY tRPC/React Query boundary.
  - Component = presentational (props in, JSX out).
  - The plans describe components in flat form; SPLIT them across these layers.
  - Run `pnpm check:web-vite-data-layer` and `pnpm check:web-vite-dialog-pattern` after UI edits.
  - Read+follow the `frontend-design` skill (SKILL.md) and run `semble search` BEFORE UI edits.
  - Dialogs: content in `DialogBody` (scroll) + actions in `DialogFooter` (sticky).

## 2. Next.js route handlers — `apps/web/src/app/api/...` → Fastify routes in `apps/api/src/routes/...`

The current webhook / QStash-callback / integration HTTP surface lives in the
**Fastify API server** (`apps/api/src/routes/`), NOT in Next.js `app/api/*/route.ts`.

- `apps/web/src/app/api/qstash/contract-health-check/route.ts` (Plan 75-06)
  →  NEW `apps/api/src/routes/contract-health.ts` (Fastify route plugin).
  - Pattern: copy `apps/api/src/routes/late-interest.ts` + `apps/api/src/routes/webhooks/process.ts`.
  - Use `guardQStashRequest` from `apps/api/src/lib/qstash-verify.js` (NOT a Next.js `Receiver` handler).
  - Use `createCronLogger`/`createWebhookLogger` from `@contractor-ops/logger`. No `console.*`, no `NextRequest/NextResponse`.
  - Body shape via Zod `safeParse` on the raw body string; 200 on success, 500 on retryable error.
  - REGISTER it inside `apps/api/src/routes/webhooks/index.ts` (the raw-body plugin scope),
    next to `registerLateInterestRenderRoute(app)`. Add the import + the call.
  - Route path suggestion: `POST /contract-health/_run`.
- `apps/web/src/app/api/webhooks/_process/route.ts` (Plan 75-08)
  →  EDIT existing `apps/api/src/routes/webhooks/process.ts` (ALREADY EXISTS).
  - The e-sign completion path already lives here (`handleSigningCompletion`, providers docusign/autenti).
  - For IP_RATIFICATION, extend the existing e-sign branch / `esign-webhook-handler.ts` rather than adding a new Next route.

## 3. Producer enqueue URL convention (Plan 75-06 Contract.create)

- Plan shows `${process.env.NEXT_PUBLIC_APP_URL}/api/qstash/contract-health-check`.
  Current convention (see `packages/api/src/routers/finance/late-payment-interest.ts:525`):
  `url: \`${getServerEnv().API_URL}/contract-health/_run\``
  - Prefer `publishJSONWithContext` (trace propagation) over raw `client.publishJSON` where an ALS frame exists.
  - `getQStashClient()` from `@contractor-ops/integrations` (services/qstash-client). `QSTASH_TOKEN` required.
  - If a new env var is needed, add it to `.env.example` + the package env schema (`getServerEnv`); no raw `process.env` in app code.

## 4. Files that ALREADY EXIST — EDIT, do NOT create

- `packages/integrations/src/services/esign-webhook-handler.ts` (EXISTS) — Plan 75-08 EDITS it.
- `apps/api/src/routes/webhooks/process.ts` (EXISTS) — Plan 75-08's `_process` edit target.
- `packages/integrations/src/adapters/claude-ocr-adapter.ts` (EXISTS) — reuse, do NOT instantiate a new Anthropic client where the plan says reuse.
- `packages/integrations/src/services/qstash-client.ts` (EXISTS).
- `packages/integrations/src/adapters/docusign-adapter.ts`, `autenti-adapter.ts` (EXIST).

## 5. Unaffected (package-level paths are CORRECT as written)

These plan paths are accurate in the current tree — no adaptation needed:
- `packages/db/...`, `packages/validators/...`, `packages/compliance-policy/...`
- `packages/api/src/services/contract-health/...` (new dir — fine)
- `packages/api/src/routers/core/contract.ts`, `packages/api/src/routers/workflow/...`
- `packages/integrations/src/adapters/contract-health-tools.ts` (new — fine)
- `packages/api/scripts/bulk-rerun-contract-health.ts` (new — fine)

## 6. Test-scaffold drift (Plan 75-01)

Plan 75-01 declares these test paths that must also be adapted:
- `apps/web/src/components/contracts/__tests__/health-check-panel.test.tsx`
  →  `apps/web-vite/src/components/contracts/__tests__/health-check-panel.test.tsx`
- All other 75-01 test paths are package-level and CORRECT.
- `apps/web-vite` tests: scope runs (`pnpm --filter @contractor-ops/web-vite test <path>`) — NEVER run the full unscoped web-vite suite (memory).

## Rule of thumb

If a plan path starts with `apps/web/` → translate per sections 1-2 above and VERIFY the
target dir exists (Glob/semble/Read) before writing. If a translated target is ambiguous
or the faithful adaptation is impossible, STOP and write the blocker to STATE.md rather
than guessing or creating a dead-path file.
