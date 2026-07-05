---
phase: 94-theme-b-payroll-integration-adapters
plan: 07
subsystem: payroll-native-gusto
tags: [payroll, gusto, oauth, integrations, bridge, flag-deferred]
requirements: [PAYROLL-US-01]
dependency_graph:
  requires:
    - "94-01 (contract)"
    - "94-02 (gusto-adapter RED test)"
    - "94-06 (GustoCsvProfile fallback)"
  provides:
    - "GustoAdapter (IntegrationProviderAdapter, OAuth 2.0) + mapFeedToGustoPayload"
    - "GustoProfile bridge (native push when enabled+connected, else gusto-csv)"
    - "GUSTO_* + QUICKBOOKS_* env schema + .env.example (optional; dark by default)"
  affects:
    - "94-08 (QuickBooks mirrors this)"
    - "94-09 (register-payroll-profiles injects the bridge deps)"
    - "94-10 (EXTERNAL-ENABLEMENT Gusto row)"
tech_stack:
  added:
    - "packages/integrations depends on @contractor-ops/payroll (for PayrollFeed + mapUsEmployeeToRow)"
  patterns:
    - "OAuth client id/secret read via getServerEnv() (no raw process.env — ratchet-safe)"
    - "Bridge is dependency-injected (evaluateFlag/resolveConnection/pushNative via opts) so packages/payroll imports nothing from api/db/integrations"
    - "Live token-exchange test it.skipIf(!GUSTO_CLIENT_ID) — 3 pass + 1 skip"
key_files:
  created:
    - "packages/integrations/src/adapters/gusto-adapter.ts"
    - "packages/payroll/src/profiles/gusto/{bridge,index}.ts"
    - "packages/payroll/src/__tests__/gusto.test.ts"
  modified:
    - "packages/integrations/src/adapters/register-all.ts (HEAVY tier: GustoAdapter)"
    - "packages/integrations/package.json (+@contractor-ops/payroll)"
    - "packages/validators/src/env.ts (payrollIntegrationsSchema: GUSTO_*/QUICKBOOKS_* optional)"
    - "packages/payroll/src/index.ts (export GustoProfile)"
    - ".env.example (Gusto/QuickBooks native OAuth section)"
decisions:
  - "mapFeedToGustoPayload reuses payroll mapUsEmployeeToRow (ssn_last_4 only, no full SSN); integrations->payroll is a clean one-way dep (no cycle — payroll uses DI callbacks)"
  - "GUSTO_*/QUICKBOOKS_* are .optional() so the app boots without creds; the live adapter throws only when a token redemption is attempted without them"
  - "Env plumbing for both Gusto + QuickBooks landed here as one payrollIntegrationsSchema unit; 94-08 adds only the QuickBooks adapter + bridge"
metrics:
  tasks_completed: 2
  files_changed: 9
  completed_date: "2026-07-05"
---

# 94-07 Summary — Gusto native OAuth adapter + bridge (flag-deferred)

Added the Gusto native OAuth adapter on the integrations framework and a flag-gated
bridge payroll profile that pushes to Gusto when `payroll.gusto` is APPROVED + the org
has connected, else falls back to the Gusto CSV export.

## Shipped
- **GustoAdapter** (`packages/integrations`) — `IntegrationProviderAdapter` with
  `getOAuthConfig` (env-var-named `GUSTO_CLIENT_ID`/`GUSTO_CLIENT_SECRET`, Gusto
  authorize/token URLs, `/api/oauth/gusto/callback`), `exchangeCodeForTokens`,
  `refreshToken` (pure `fetch`, no SDK; creds via `getServerEnv()`), and a pure
  `mapFeedToGustoPayload` (reuses `mapUsEmployeeToRow` — `ssn_last_4` only). Registered
  in the HEAVY/lazy tier of `register-all.ts`.
- **GustoProfile bridge** (`packages/payroll`) — `generate()` resolves via a
  dependency-injected bridge: native push when the flag is enabled AND a connection
  exists, else `GustoCsvProfile.generate`. The DI callbacks keep `packages/payroll`
  free of api/db/integrations imports.
- **Env** — `GUSTO_*` + `QUICKBOOKS_*` added to the validators env schema (optional —
  dark by default) and `.env.example`. Read via `getServerEnv()`, so the
  `check:no-process-env` ratchet is unaffected.

## Verification
- `pnpm -F @contractor-ops/integrations test gusto-adapter` — 3 pass + 1 skip (the
  live token-exchange `skipIf(!GUSTO_CLIENT_ID)` auto-runs when creds land).
- `pnpm -F @contractor-ops/payroll test gusto` — 6 GREEN (fallback-when-dark,
  fallback-when-unconnected, native-when-connected).
- `pnpm -F @contractor-ops/payroll typecheck` + `pnpm -F @contractor-ops/integrations typecheck` + biome — clean.

## Note
`pnpm check:no-process-env` is red at the repo level (baseline 182) from pre-existing
`apps/*`/`packages/*` drift on main — this plan adds **zero** raw `process.env` reads
(OAuth creds go through `getServerEnv()`), so it is not a regression here.
