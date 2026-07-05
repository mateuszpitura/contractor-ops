# Plan 95-04 Summary — Personio adapter + shared HRIS rate limiter + env

**Wave:** 3 · **Status:** complete

## What shipped

| File | Provides |
|------|----------|
| `packages/integrations/src/adapters/personio-adapter.ts` | `PersonioAdapter` (non-OAuth bearer, `listEmployees` v2 offset≤200 pull + `updated_since`, `pushEmployeeEvent`) + `normalizePersonioPersons` |
| `packages/integrations/src/adapters/hris-rate-limiter.ts` | `RateLimiter` token-bucket (≤200/60s drip) + `createHrisRateLimiter` — shared by both HRIS adapters |
| `packages/integrations/src/types/hris.ts` | the provider wire contracts (`HrisEmployeeRecord`, `HrisProvider`, `HrisPushPayload`, `HrisPushInput`) |
| `packages/api/src/services/hris-sync/types.ts` | now re-exports the wire types from `@contractor-ops/integrations` (keeps `HrisFieldMapping`/`HrisSyncState` local) |
| `packages/validators/src/env.ts` + `.env.example` | `PERSONIO_CLIENT_ID/SECRET` (+ BambooHR pair in 05) as **optional** |
| `packages/integrations/src/index.ts` | exports the adapter, limiter, and hris wire types |

## Key decisions

- **Wire types live in the integrations layer, not api.** The api package depends on integrations (never the reverse), so `HrisEmployeeRecord`/`HrisPushPayload`/`HrisProvider` moved to `integrations/src/types/hris.ts`; the api `hris-sync/types.ts` re-exports them. This corrects the Plan-01 placement so the adapter can return them without a reverse dependency.
- **Env via `getServerEnv()`, not raw `process.env`.** The plan named a non-existent `packages/integrations/src/env.ts`; the canonical schema is `@contractor-ops/validators` `env.ts` (where every other adapter secret lives). Added an optional `hrisSchema` there and the adapter reads `getServerEnv()` lazily inside `bearer()` — this keeps the `check:no-process-env` ratchet flat (zero new raw reads).
- **Personio = KSeF-shaped non-OAuth bearer** (`supportsOAuth=false`); a valid cached `accessToken` short-circuits the mint (fixture path), so the engine is fully testable with zero credentials. Live mint is dark until `PERSONIO_CLIENT_ID/SECRET`.
- **`erasableSyntaxOnly`**: the limiter uses explicit field declarations (constructor parameter properties are banned by the tsconfig).

## Verification

- `pnpm -F @contractor-ops/integrations test personio hris-rate-limiter` → 6 passed, 1 skipped (the live `it.skipIf(!PERSONIO_CLIENT_ID)` case). The Personio adapter RED tests (95-02) are GREEN.
- `pnpm typecheck --filter=@contractor-ops/integrations` + `--filter=@contractor-ops/api` → green (api re-export intact; 34 foundation tests still pass).
- `pnpm lint:logs` green (no `console.*`). `check:no-process-env`: my HRIS files add zero raw `process.env`; the gate's pre-existing failure is `apps/public-api` (Theme C) exceeding the 182 baseline on main — unrelated to this change.

## Deferred (EXTERNAL-ENABLEMENT — registered in Plan 09)

- Live Personio pull/push needs a partner client-credentials app (`PERSONIO_CLIENT_ID/SECRET`) + `integration.personio-sync` APPROVED per org. The 200 req/min figure is MEDIUM-confidence community data; the limiter is conservative so a tighter real limit still passes.
