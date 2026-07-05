# Plan 95-02 Summary — RED net + recorded provider fixtures

**Wave:** 1 · **Status:** complete (terminal-RED as designed)

## What shipped

Recorded provider fixtures (the local mock HRIS) + the failing-proof net every downstream impl plan turns GREEN:

| File | Pins | RED reason |
|------|------|------------|
| `packages/integrations/.../fixtures/personio/employees.json` | `/v2/persons` page — 3 persons, standard + custom attrs (`gross_salary` for the protected-key-drop proof) | fixture (GREEN input) |
| `packages/integrations/.../fixtures/bamboohr/employees.json` | `/v1/employees/directory` un-paginated list — 3 employees + custom fields | fixture (GREEN input) |
| `packages/integrations/.../personio-adapter.test.ts` | `supportsOAuth===false`, fixture parse, offset/limit≤200 + `updated_since`, safeParse-no-throw; live `it.skipIf(!PERSONIO_CLIENT_ID)` | `../personio-adapter` absent |
| `packages/integrations/.../bamboohr-adapter.test.ts` | `getOAuthConfig` names `BAMBOOHR_CLIENT_ID/SECRET`, un-paginated parse, standard-field map; custom-attr `it.skipIf(!BAMBOOHR_CUSTOM_ATTR_VERIFIED)`, live `it.skipIf(!BAMBOOHR_CLIENT_ID)` | `../bamboohr-adapter` absent |
| `packages/api/.../hris-sync/__tests__/hris-pull-orchestrator.test.ts` | SyncLog(INBOUND) STARTED→SUCCESS, `sync` advisory-lock skip, per-record best-effort, lock release | `../pull-orchestrator` absent |
| `.../hris-sync/__tests__/hris-cross-org.test.ts` | `applyPatchToWorker` two-org IDOR: org-B link never written under org-A; same-org writes + audits; no ExternalLink → no auto-provision | `../apply-patch` absent |
| `.../hris-sync/__tests__/hris-one-per-org.test.ts` | `isOneHrisPerOrgViolation` recognizes P2002 on `integration_connection_one_hris_per_org`, rejects others | `../mapping` absent |
| `packages/api/.../outbox/__tests__/hris-outbox.test.ts` | 3 event types dispatch to the connected adapter with `outboxEventId` idempotency; no-connection / dark-flag → no-op | `../hris-push` + 3 event types absent |
| `.../outbox/__tests__/hris-push-loop.test.ts` | `assertNotHrisOwnedField` accepts all CO payloads, throws for every HRIS-owned key (guard half GREEN); pull imports orchestrator (RED half) | `../../hris-sync/pull-orchestrator` absent |
| `packages/api/.../workforce/__tests__/hris-sync-router.test.ts` | `hrisSyncRouter` exposes getStatus/connect/disconnect/syncNow/get·setMapping | `../hris-sync-router` absent |

## Verification

- `pnpm -F @contractor-ops/api test hris` → 6 failed (missing modules) + 15 passed (Plan 01 GREEN + the push-loop guard half). Failures are `Cannot find module`, not harness/import errors against 95-01.
- `pnpm -F @contractor-ops/integrations test personio bamboohr` → 2 failed via missing adapter modules; live + custom-attr cases `it.skipIf` (SKIP with no creds).
- Fixtures parse; `pnpm typecheck --filter=@contractor-ops/api` + `--filter=@contractor-ops/integrations` green (tests excluded from tsc).

## Deviations from the plan's literal framing (verified against live code)

- **one-per-org** is unit-tested as the `isOneHrisPerOrgViolation` P2002-recognition helper (authored in 95-03's `mapping.ts`) rather than a live-DB integration test — the api suite never runs a live DB (MEMORY constraint). The partial index itself is exercised against a migrated test DB at deploy. This makes the file turn GREEN in 95-03 as planned.
- **hris-sync-router** RED pins the procedure surface; the deep connect-XOR / audit / flag-gate behavioral coverage lands inline in Wave 5 (95-08) via the mounted `appRouter` caller harness + `root-router-gating`, where the router is actually spread into `conditionalWorkforceRouters`.
- **cross-org / orchestrator** tests assert `applyPatchToWorker` / `runHrisPull` (95-06) via hand-rolled Prisma doubles + module mocks (the `org-definition-sync.test.ts` idiom), taking `db` as a param for tenant-scoped isolation.
