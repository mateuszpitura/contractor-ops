# Plan 95-05 Summary — BambooHR adapter (OAuth 2.0) + custom-attr gate

**Wave:** 3 · **Status:** complete

## What shipped

| File | Provides |
|------|----------|
| `packages/integrations/src/adapters/bamboohr-adapter.ts` | `BambooHrAdapter` (OAuth 2.0, `getOAuthConfig`, `exchangeCodeForTokens`/`refreshToken`, un-paginated `listEmployees`, `pushEmployeeEvent`) + `normalizeBambooDirectory` |
| `packages/integrations/src/index.ts` | exports `BambooHrAdapter` + `normalizeBambooDirectory` |
| `.env.example` | `BAMBOOHR_CLIENT_ID/SECRET` + `BAMBOOHR_CUSTOM_ATTR_VERIFIED` (env schema already added in 95-04) |

## Key decisions

- **JiraAdapter-shaped OAuth 2.0** (`supportsOAuth=true`, `getOAuthConfig` names `BAMBOOHR_CLIENT_ID/SECRET`, `redirectPath: /api/oauth/bamboohr/callback`). The deprecated Basic-auth API key is not used. Same pull/push surface + shared rate limiter as Personio.
- **Un-paginated directory** (`/v1/employees/directory`) → the pull returns the full snapshot; the orchestrator (95-06) diffs it via `syncHash` (no `updated_since`).
- **Custom-attribute contract gate (D-06):** `normalizeBambooDirectory(payload, includeCustom)` withholds every non-standard field unless the contract is verified. The adapter reads `BAMBOOHR_CUSTOM_ATTR_VERIFIED` through a `try/catch`-wrapped `getServerEnv()` so a missing/unvalidated env degrades to "standard-field only" rather than throwing — standard sync ships regardless; the custom-attr path activates (and its `it.skipIf(!BAMBOOHR_CUSTOM_ATTR_VERIFIED)` test flips GREEN) only once the flag is set. Constructor also accepts an `includeCustomAttributes` override for wiring.
- Env via `getServerEnv()` (no raw `process.env`); token exchange/refresh wrapped in `withResilience` + `parseJsonResponse` (no unsafe `as`).

## Verification

- `pnpm -F @contractor-ops/integrations test bamboohr personio hris-rate-limiter` → 9 passed, 3 skipped (Personio live, BambooHR live, BambooHR custom-attr — all `it.skipIf`). The BambooHR standard-field RED tests (95-02) are GREEN.
- `pnpm typecheck --filter=@contractor-ops/integrations` → 8/8 green.

## Deferred (EXTERNAL-ENABLEMENT — registered in Plan 09)

- Live BambooHR needs a partner OAuth app (`BAMBOOHR_CLIENT_ID/SECRET`) + `integration.bamboohr-sync` APPROVED per org. The live authorize/token endpoints are company-subdomain specific (resolved from the connection at enablement). The custom-attribute mapping path is gated behind `BAMBOOHR_CUSTOM_ATTR_VERIFIED` until the tenant's contract is confirmed.
