# Plan 95-06 Summary — inbound pull orchestrator + allowlist apply-patch

**Wave:** 4 · **Status:** complete

## What shipped

| File | Provides |
|------|----------|
| `packages/api/src/services/hris-sync/apply-patch.ts` | `applyPatchToWorker` — ExternalLink-resolved, org-scoped, allowlist-only write + countryFields merge + INTEGRATION audit |
| `packages/api/src/services/hris-sync/pull-orchestrator.ts` | `runHrisPull` (single connection) + `runScheduledHrisSync` (cron fan-out) |
| `packages/api/src/services/hris-sync/index.ts` | barrel for the engine's public surface |

## As-built

- **`runHrisPull` clones the directory-sync orchestrator:** `IntegrationSyncLog(direction:INBOUND, syncType:'hris_employee_sync')` STARTED→SUCCESS/FAILED; the `sync` advisory-lock keyed `hris:<connId>` (a concurrent run marks the log SUCCESS `skipped:already-running` and returns without acquiring/releasing); OAuth token refresh with a 5-min buffer (Personio's bearer is minted inside the adapter, so only OAuth adapters refresh here); delta cursor (`updated_since`) from `configJson.syncState`; per record **project → syncHash → skip-if-unchanged → applyPatchToWorker**; per-record best-effort (one bad record increments `errors`, the run continues); failure recorded on both the sync log and the connection; lock released in `finally`.
- **`applyPatchToWorker` enforces HRIS-SYNC-05 end-to-end:** it accepts only `HrisWritableEmployeePatch`, resolves the worker via `ExternalLink` filtered by org (a record for org A can never write org B's worker — the two-org IDOR fence), **merges** `countryFieldsPatch` into existing `EmployeeProfile.countryFields` (CO-owned keys survive, never a wholesale replace), and writes one `INTEGRATION` audit row inside the transaction. No ExternalLink → no-op (a new remote employee is surfaced, not auto-provisioned).
- **`runScheduledHrisSync`** mirrors the org-definition-sync fan-out: iterate CONNECTED PERSONIO/BAMBOOHR connections, throttle by `lastSyncAt` (hourly), run each inside `tenantStore.run` on the regional tenant client, per-connection try/catch → `{ evaluated, ran, skipped, runs }`.

## Verification

- `pnpm -F @contractor-ops/api test hris-pull-orchestrator hris-cross-org hris-push-loop` → 10 passed. The orchestrator, cross-org IDOR, and pull-emits-no-push RED tests (95-02) are GREEN.
- `pnpm typecheck --filter=@contractor-ops/api` → 16/16 green (`configJson` cast to `Prisma.InputJsonValue`, Teams precedent).
- `pnpm lint:audit-log` green (no direct `auditLog.create` — routes through `writeAuditLog`).

## Loop-break (as-built)

The pull writes ONLY the HRIS-owned allowlist and calls `applyPatchToWorker` — it never imports or calls `enqueueOutboxEvent`, so a pull emits no push. Combined with the disjoint push payloads (95-07) and `assertNotHrisOwnedField`, the two-way sync is acyclic by construction.
