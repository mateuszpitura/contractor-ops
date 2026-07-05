# 98-04 SUMMARY — per-org `module.public-api` dark gate (D-05)

**Wave:** 1 · **Status:** done

## What landed
- **`packages/api/src/middleware/require-public-api-flag.ts`** (new) — `assertPublicApiEnabled(org, region)`
  mirrors `assertWorkforceEnabled` but throws **NOT_FOUND** (dark — hides existence) instead of FORBIDDEN.
- **`errors.ts`** — `PUBLIC_API_DISABLED` message.
- **`api-key-auth.ts`** — `publicApiFlagGate` middleware chained into `apiKeyTenantProcedure` AFTER
  `apiKeyAuthMiddleware` (org/region resolved), before `requireTier`/`demoReadOnly`. Every public
  procedure — reads + the dark writes — inherits it, so the whole surface is dark per-org until Phase 99.
  (ctx cast for org/region matches the `requireTier` pattern.)
- Composes with (does not replace) the boot-time `assertFlagSignoffsOrExit` registry gate.

## Consequence handled
Wiring the gate into the shared procedure means every existing public-api router test now evaluates
`module.public-api` (default OFF). Added `vi.mock('@contractor-ops/feature-flags', evaluate→enabled:true)`
to the 4 existing router tests (contractor/invoice/contract/document) so they grant the flag.

## Tests GREEN
`public-api-flag.security.test.ts` (D-05): unit off→NOT_FOUND / on→pass, AND integration —
`publicContractorRouter.list` 404s when flag OFF and passes when ON (proves the gate is WIRED into
`apiKeyTenantProcedure`). Write-half double-dark = HOLD-until-98-09 (writes inherit the same gate).

## Verify
- `pnpm --filter @contractor-ops/api test public-api-flag` — 4 passed | 1 skipped.
- 4 existing router tests — 47 passed. `pnpm typecheck --filter @contractor-ops/api` — clean.
