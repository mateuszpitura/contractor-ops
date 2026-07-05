# Plan 95-08 Summary — router + register-all + cron + web-vite surface

**Wave:** 5 · **Status:** complete

## What shipped

| File | Provides |
|------|----------|
| `packages/api/src/routers/workforce/hris-sync-router.ts` | `hrisSyncRouter` — getStatus / connect (XOR) / disconnect / syncNow / getMapping / setMapping |
| `packages/api/src/root.ts` | `hrisSync` mounted in `workforceRouters` (dark inside `conditionalWorkforceRouters`) |
| `packages/api/package.json` | `./services/hris-sync` subpath export (barrel resolves for the cron worker) |
| `packages/integrations/src/adapters/register-all.ts` | `PersonioAdapter` + `BambooHrAdapter` registered in the HEAVY lazy tier |
| `apps/cron-worker/src/jobs/{handlers/hris-sync.ts, registry.ts, env.ts}` | hourly `hris-sync` cron → `runScheduledHrisSync`, `CRON_HRIS_SYNC_SCHEDULE` default `0 * * * *` |
| `apps/web-vite/src/components/hris-sync/*` + `pages/dashboard/settings/integrations-hris.tsx` | Page → Container → Hook → Components settings surface |
| `apps/web-vite/messages/{en,en-US,de,pl,ar}.json` | `HrisSync` i18n namespace (5 locales, parity) |

## As-built

- **Router (flag-gated + audited):** every mutating procedure calls `assertWorkforceEnabled` + `evaluate('integration.<provider>-sync')` (dark → FORBIDDEN). `connect` is **XOR** — a P2002 from the one-HRIS-per-org partial index is recognized by `isOneHrisPerOrgViolation` and mapped to `CONFLICT`; on success it audits and fires a **fire-and-forget** `runHrisPull` so registry fields populate. `disconnect` + `setMapping` audit; `getStatus`/`getMapping` return the credential-safe `publicHrisConfig`. Zod `.strict()` inputs.
- **Dark mount:** `hrisSync` lives in `workforceRouters`, so it is absent from `appRouter` (METHOD_NOT_FOUND) when `module.workforce-employees` is OFF — `root-router-gating` stays green.
- **Adapters** registered in the HEAVY tier (both pull vendor REST); the pull/push paths `await loadHeavyAdapters()` before `getAdapter(...)`.
- **Cron:** `hris-sync` hourly handler mirrors `org-definition-sync` (createCronLogger + Sentry capture). The registry's inline `env` type + the env schema both gained `CRON_HRIS_SYNC_SCHEDULE`.
- **UI:** the hook (`use-hris-sync`) is the sole tRPC boundary; the container owns loading / empty / error; the page is a thin composer (no tRPC — only `useTranslations`). Connect card (provider picker + token + connect/disconnect + sync-now + last-sync) and a standard-field mapping editor are presentational.

## Verification

- `pnpm typecheck --filter=@contractor-ops/api --filter=@contractor-ops/cron-worker --filter=@contractor-ops/web-vite` → all green (17 + 18 tasks).
- `pnpm -F @contractor-ops/api test hris-sync-router` → GREEN (procedure surface).
- `pnpm i18n:parity` + `pnpm check:web-vite-data-layer` + `pnpm check:web-vite-page-shells` → all OK. All 5 message files parse.

## Deviations (verified against live code)

- **Env accessor / file path:** the plan named a page at `pages/settings/hris-sync-page.tsx` and per-feature `i18n/locales/en/hris-sync.json`; the codebase uses `pages/dashboard/settings/` + shared flat `messages/*.json` (nested namespaces). Placed the page at `pages/dashboard/settings/integrations-hris.tsx` and added a `HrisSync` namespace to all five locale files.
- **Cron env:** the registry uses an **inline** `env` type literal in `getJobDefinitions` (not `z.infer<Env>`), so `CRON_HRIS_SYNC_SCHEDULE` was added there as well as in `env.ts`.
- de/pl/ar copy is translated for parity; native-quality review is deferred (EXTERNAL-ENABLEMENT #9).
