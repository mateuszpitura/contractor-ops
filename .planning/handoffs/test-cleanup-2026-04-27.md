# Test cleanup handoff — 2026-04-27

## Context

We just completed a major tRPC refactor (portal split + folder grouping of 55 routers into 7 domain folders). Plan: `~/.claude/plans/i-want-you-to-bright-brooks.md`. After cleanup, the build/lint/typecheck are all green. **Pre-existing test debt remains** — 16 test files / ~51 failing tests that are unrelated to the refactor.

## State summary (after cleanup)

| | before refactor | after cleanup |
|---|---|---|
| `apps/web` typecheck | 3 errors | **0** |
| `apps/public-api` typecheck | 19 errors | **0** |
| Lint (`lint:ci`) | 130 errors | **2** (preexisting cognitive complexity) |
| `packages/api` test files failed | 63 (baseline) | **16** |

## Already attempted (don't redo)

- **Logger mocks**: 71 tests had `vi.mock('@contractor-ops/logger')` missing `createIntegrationLogger`. Batch-added.
- **Feature-flags partial mocks** in 8 classification tests: `buildFlagBag`, `lazyFlagBag`, `evaluate` returning `enabled=true`. Big chunk fixed.
- **`$queryRawUnsafe` / `$executeRawUnsafe`** added to Prisma mocks in `ksef-sync.test.ts`, `ksef-sync-orchestrator.test.ts`, `google-workspace-sync-orchestrator.test.ts` — but they still fail on follow-up assertions.
- **`portal-profile.test.ts`**: added `contractor.findFirst` to Prisma mock. Now hits TX assertion mismatches.
- **`rbac-recipients.test.ts`**: fixed import (`testables` → `__testables`). Snapshot still drifts.
- **`equipment-shared.test.ts`**: removed dead `plain()` test block (function doesn't exist anymore).
- **Zod v4 `z.record` migration** in `import.ts` and `contractor.ts` (3 routers) — `z.record(value)` → `z.record(z.string(), value)`.
- **File path fixes** post-folder-grouping in `audit/calendar/jira/linear/ocr/teams.test.ts` (`path.join(sourceDir, 'X.ts')`, `expect(source).toContain('../middleware/...')`, dynamic imports).
- **trpc-http-integration.test.ts** got `endpoint: 'main' | 'portal'` parameter for the request helper.

## Remaining 16 failing files — analysis per file

### Cluster 1: Service tests with deep Prisma TX mock issues

**`src/services/__tests__/ksef-sync.test.ts` (9 failed)**
- Status: `$queryRawUnsafe` mock added → no longer crashes, but assertions about `lastSuccessAt`, `externalInvoiceId`, `sourceReference` fail. Mock returns `undefined` where test expects values.
- Approach: Trace `processKsefSync` through Prisma calls; mock needs `findUniqueOrThrow` to return the connection record. Multiple paths use same mock — sequencing matters.
- ~30-60 min per pass.

**`src/services/__tests__/ksef-sync-orchestrator.test.ts` (7 failed)**
- Same pattern as above, slightly different orchestration layer.
- Likely shares the fix.

**`src/services/__tests__/google-workspace-sync-orchestrator.test.ts` (2 failed)**
- After `$queryRawUnsafe` fix, errors match different regex. Test expects `/does not belong/` and `/not active/` from `mockFindUniqueOrThrow.mockResolvedValue({...})` but flow now reaches an earlier guard.
- Quick fix: 10 min.

### Cluster 2: Portal tests — Date serialization + procedure resolution

**`src/routers/__tests__/portal.test.ts` (6 failed)**
- 2 of 6: `expected 2026-12-01T00:00:00.000Z to be '2026-12-01T00:00:00.000Z' // Object.is` — Date object vs ISO string. The test compares with `expect(actual).toBe(stringValue)` but actual is a Date instance. Either `toBe` → `toEqual`, or stringify in test.
- 4 of 6: `submitFinancialChangeRequest` throwing `contractorNotFound` instead of `BAD_REQUEST` — the validate-no-changes path runs AFTER contractor lookup. Mock setup not satisfying `contractor.findFirst`. Same shape as portal-profile fix but in different test file.

**`src/routers/__tests__/portal-profile.test.ts` (5 failed)**
- All in `submitFinancialChangeRequest` describe block.
- After adding `findFirst` mock, errors are about TX mock — `contractorChangeRequest.findFirst` returning unexpected. Need to trace each test's mock setup.

### Cluster 3: Classification tail (3 failed)

**`src/routers/__tests__/classification.test.ts` (3 failed)**
- 28/31 now pass after partial mock fix. Remaining 3 are real assertion mismatches in business logic: `appendOnlyDraft`, edge cases.
- Per-test analysis needed.

### Cluster 4: Real test bugs / preexisting issues

**`src/__tests__/errors-i18n-parity.test.ts` (1 failed)**
- `errors.ts` exports `INVOICE_ALREADY_VOIDED = 'invoiceAlreadyVoided'` but `apps/web/messages/{en,pl}.json` `Errors` namespace lacks it.
- Quick fix: Add `"invoiceAlreadyVoided": "..."` to both locale files. Or — if key was just added in errors.ts — also remove it. Check `git blame packages/api/src/errors.ts`.

**`src/services/__tests__/rbac-recipients.test.ts` (1 failed)**
- Snapshot drift: `expected { owner: [...], ...(8) } to deeply equal { owner: [...], ...(9) }`. Test expects 9 keys, source has 8.
- Likely a role was renamed/removed in `packages/auth/src/roles.ts`. Inspect `__testables.ROLE_CONTRACTOR_ACTIONS` keys vs `roles` keys.

**`src/routers/__tests__/jira.test.ts` (1 failed)**
- After path fixes, 24/25 pass. One remaining is content-specific. Check vitest output for the single failure.

**`src/routers/__tests__/workflow-shared.test.ts` (2 failed)**
- `42 tests | 2 failed`. Pure logic tests on transitions/keys. Two specific cases are stale — diff vs source.

**`src/services/__tests__/notification-service.test.ts` (1 failed)**
- 20/21 pass. One assertion specific to a notification template or recipient logic.

**`src/services/__tests__/import-processor.test.ts` (3 failed)**
- 7/10 pass. Likely depends on the mocked Prisma's behavior after our z.record fixes upstream.

**`src/routers/__tests__/import.test.ts` (4 failed)**
- All in `commit - contracts` describe. Mock-call assertions fail (`expected to not be called, but was called 1 times`). Suggests the route now calls something the mock didn't expect — possible the route changed but test wasn't updated.

**`src/routers/__tests__/payment.test.ts` (2 failed)**
- 25/27 pass. Two specific assertions to investigate.

### Cluster 5: Service-internal handler tests

**`src/services/teams/__tests__/teams-bot-handler.test.ts` (4 failed)**
- HTTP status code mismatches: `expected 400 to be 200/403`. Bot handler is rejecting valid invokes — either Mock context lacks something the handler reads, or the handler logic was tightened.

**`src/pdf-templates/__tests__/ir35-sds.test.tsx` (1 failed)**
- PDF rendering snapshot or layout assertion. Inspect once.

## Recommended order for next session

1. **Quick wins** (~20 min total):
   - `errors-i18n-parity.test.ts` — add missing i18n key.
   - `rbac-recipients.test.ts` — update snapshot to match current roles.
   - `jira.test.ts`, `workflow-shared.test.ts`, `notification-service.test.ts`, `payment.test.ts`, `ir35-sds.test.tsx` — read each, classify as test-bug or source-bug.
   - `google-workspace-sync-orchestrator.test.ts` — adjust regex or earlier-path mocks.

2. **Portal cluster** (~45 min): fix date serialization (`toBe` → `toEqual`) and complete `contractor.findFirst` chain in both `portal.test.ts` and `portal-profile.test.ts`.

3. **Classification tail** (~20 min): investigate 3 specific assertions.

4. **Big-blob deep dives** (1-2h each):
   - ksef-sync + ksef-sync-orchestrator (shared fix probable).
   - import.test.ts + import-processor.test.ts (probably related).
   - teams-bot-handler.

## Useful commands

```bash
# Run only one file
pnpm --filter @contractor-ops/api exec vitest run src/PATH/TO/FILE.test.ts

# Get failure breakdown
pnpm --filter @contractor-ops/api run test 2>&1 | grep "❯ |api|" | grep failed

# Inspect specific failure
pnpm --filter @contractor-ops/api exec vitest run src/X.test.ts 2>&1 | grep -B2 "AssertionError\|TypeError" | head -20
```

## Key context the next session needs

- Refactor branch state: tRPC AppRouter split into main (`packages/api/src/root.ts`) + portal (`packages/api/src/portal-root.ts`). 55 internal routers in 7 domain folders: `routers/{finance,compliance,integrations,equipment,workflow,portal,core}/`.
- Test paths post-refactor: when test reads source via `path.join(sourceDir, 'X.ts')`, it must include the folder: `path.join(sourceDir, '<folder>/X.ts')`. When it asserts `expect(source).toContain("'../middleware/...")`, the path must be `'../../middleware/...'` because the moved router is one level deeper.
- Zod v4 in use (`zod@4.3.6`): `z.record(value)` is invalid — must be `z.record(keySchema, valueSchema)`.
- Prisma 7 in use; tests must mock `$queryRawUnsafe` and `$executeRawUnsafe` because tenant scoping uses raw SQL.
- TypeScript native preview (`tsgo`) is configured: `pnpm typecheck:fast` runs the whole monorepo in ~5s. CI still uses `tsc`.
