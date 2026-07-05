---
phase: 94-theme-b-payroll-integration-adapters
plan: 08
subsystem: payroll-native-quickbooks
tags: [payroll, quickbooks, intuit, oauth, integrations, bridge, flag-deferred]
requirements: [PAYROLL-US-01]
dependency_graph:
  requires:
    - "94-01 (contract)"
    - "94-02 (quickbooks-adapter RED test)"
    - "94-06 (QuickbooksCsvProfile fallback)"
    - "94-07 (env plumbing + Gusto twin pattern)"
  provides:
    - "QuickBooksAdapter (IntegrationProviderAdapter, OAuth 2.0) + mapFeedToQuickbooksPayload"
    - "QuickBooksProfile bridge (native push when enabled+connected, else quickbooks-csv)"
  affects:
    - "94-09 (register-payroll-profiles injects the bridge deps)"
    - "94-10 (EXTERNAL-ENABLEMENT QuickBooks row)"
tech_stack:
  added: []
  patterns:
    - "Intuit OAuth: Basic-auth token redemption (client_id:client_secret) via getServerEnv()"
    - "Bridge is dependency-injected (evaluateFlag/resolveConnection/pushNative via opts)"
    - "Live token-exchange test it.skipIf(!QUICKBOOKS_CLIENT_ID) — 3 pass + 1 skip"
key_files:
  created:
    - "packages/integrations/src/adapters/quickbooks-adapter.ts"
    - "packages/payroll/src/profiles/quickbooks/{bridge,index}.ts"
    - "packages/payroll/src/__tests__/quickbooks.test.ts"
  modified:
    - "packages/integrations/src/adapters/register-all.ts (HEAVY tier: QuickBooksAdapter)"
    - "packages/payroll/src/index.ts (export QuickBooksProfile)"
decisions:
  - "mapFeedToQuickbooksPayload uses employee full name + ssn_last_4 (no full SSN); reuses payroll mapUsEmployeeToRow"
  - "Intuit token endpoint uses Basic auth (client credentials) per the Intuit OAuth 2.0 spec"
  - "Env schema/.env.example already carry QUICKBOOKS_* (landed in 94-07 as the shared payrollIntegrationsSchema)"
metrics:
  tasks_completed: 2
  files_changed: 6
  completed_date: "2026-07-05"
---

# 94-08 Summary — QuickBooks native OAuth adapter + bridge (flag-deferred)

Mirror of 94-07 (Gusto): the QuickBooks Payroll (Intuit) native OAuth adapter + a
flag-gated bridge that pushes to QuickBooks when `payroll.quickbooks` is APPROVED + the
org has connected, else falls back to the QuickBooks CSV export.

## Shipped
- **QuickBooksAdapter** (`packages/integrations`) — `IntegrationProviderAdapter` with
  `getOAuthConfig` (`QUICKBOOKS_CLIENT_ID`/`QUICKBOOKS_CLIENT_SECRET`, Intuit
  authorize/token URLs, `/api/oauth/quickbooks/callback`), `exchangeCodeForTokens` +
  `refreshToken` (Basic-auth token redemption, pure `fetch`, creds via
  `getServerEnv()`), and a pure `mapFeedToQuickbooksPayload` (full name + `ssn_last_4`).
  Registered in the HEAVY/lazy tier of `register-all.ts`.
- **QuickBooksProfile bridge** (`packages/payroll`) — dependency-injected; native push
  when enabled+connected, else `QuickbooksCsvProfile.generate` (no network when dark).

## Verification
- `pnpm -F @contractor-ops/integrations test quickbooks-adapter` — 3 pass + 1 skip
  (live `skipIf(!QUICKBOOKS_CLIENT_ID)`).
- `pnpm -F @contractor-ops/payroll test quickbooks` — 6 GREEN.
- Full payroll suite: **14 files / 38 tests GREEN**. typecheck + biome clean.

All four native/bridge tests (Gusto + QuickBooks) plus every file-export profile are now
GREEN; the whole export surface is wired into the app in 94-09.
