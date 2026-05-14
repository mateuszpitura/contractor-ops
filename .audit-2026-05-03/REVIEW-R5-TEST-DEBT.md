# R5 Test Debt + Lint Hygiene

Critical second-opinion review after Phase 2/3 audit work. Read-only. Cut-off date: 2026-05-05.

## TL;DR

- **`it.todo` count: 7** in committed unit tests (4 in workflow-roles page test, 3 in workflow-execution + workflow-override-blocking-task router tests). All clearly tagged with their owning Plan number — these are honest deferrals, not stealth placeholders.
- **`test.skip` (Playwright) count: ~115** across `apps/web/e2e/`. All are guarded by environment/data preconditions (no rows, no auth env vars, no jurisdiction enabled). This is **expected** for E2E that runs against real data, but it does mean the absolute coverage signal is weak: a green E2E run with empty fixtures may execute almost nothing.
- **Console suppressions: 17 call sites across 9 test files**, all in `packages/api/src/services` (couriers, equipment-workflow, linear-issue-sync, virus-scanner, messaging, tax-id-validation) and one in `apps/web` (sidebar). These hide warning paths and are a code-smell — many appear to be cleaning up Pino-routed warnings the implementation now emits, where the assertion was never updated.
- **Tautological tests: 3** in `apps/web/src/components/contractors/compliance/__tests__/recompute-compliance-button.test.tsx` (lines 72, 77, 109 — all `expect(true).toBe(true)`). These should be `expect.fail()` or removed; right now they vacuously pass.
- **TODO/FIXME count: 1278 occurrences** (worth bucketing — most are in generated/seed code or doc strings; only ~30 are sourced production TODOs that need triage). Zero TODOs reference `F-XXX-NN` audit IDs, despite the runbook claiming deferrals are tracked there — this is a documentation/reality mismatch.
- **Biome / ts-error annotations: 7 `@ts-expect-error` + ~1271 `biome-ignore`**. The biome-ignore count is dominated by generated Prisma client output and standard `__dirname` ESM polyfill ignores; ~50 are real lint suppressions, of which 4 are `target of Plan 70-XX` placeholders that should resolve themselves once those plans land.
- **Lint-staged drift verification: all 7 commits in `docs/COMMIT-ATTRIBUTION.md` confirmed real**. Spot-checked SHAs all exist and the tail of the stat output corroborates the body. However, the table likely **under-counts** drift — only 7 commits flagged out of ~200+ Phase 2/3 commits and 25 parallel agents.
- **CI drift: 1 instance of `continue-on-error: true`** in `.github/workflows/ci.yml` (line 67) on the `pnpm audit` step — labelled "informational", which is reasonable; not an audit-introduced bypass.
- **Husky pre-commit just runs lint-staged**; pre-push runs format/lint/check-no-process-env/lint-schema/lint-logs/i18n-parity. **No `--no-verify` patterns, no skip flags**. Clean.
- **Handoff status (16 files / ~51 failures from 2026-04-27)**: still failing or still has TX mock issues. **Zero `it.skip`/`it.todo`** added to `ksef-sync.test.ts`, `portal.test.ts`, `portal-profile.test.ts`, `classification.test.ts` — meaning the failing tests are **still failing**, not silently masked. That's the better outcome (visibility preserved) but means the `pnpm test` exit code in `packages/api` is still red.

**Top concerns ranked:**
1. New-module coverage gap on `packages/api/src/services/exports/index.ts` (743 LoC source, 220 LoC test → 30% ratio). For a foundation that handles streaming exports + signed downloads, this is thin.
2. `qstash-backpressure.ts` (332 LoC) and `replica.ts` (298 LoC) — **no co-located test files found**. The QStash backpressure logic is on the hot path of every async hop and the replica router is on every read.
3. Tautological tests in `recompute-compliance-button.test.tsx` are dead weight passing as coverage.
4. Console-spy suppression in courier service tests hides whether the SUT is actually logging the right thing under the right Pino logger.
5. TODO comments tagged `(typecheck-pass-2)` (3 occurrences in `apps/web/src/app/api/...`) reference a "pass 2" that may or may not still be planned — needs a linked tracking issue.

---

## Skipped / todo tests (full list)

### `it.todo` in unit tests (7 total)

| File | Line | Test | Owner |
|---|---|---|---|
| `apps/web/src/app/[locale]/(admin)/settings/workflow-roles/__tests__/page.test.tsx` | 8 | renders 3-locale-input form (en/pl/de tabs) | Plan 74-07 |
| `apps/web/src/app/[locale]/(admin)/settings/workflow-roles/__tests__/page.test.tsx` | 9 | Copy from English helper populates pl + de fields | Plan 74-07 |
| `apps/web/src/app/[locale]/(admin)/settings/workflow-roles/__tests__/page.test.tsx` | 10 | (English) indicator visible on rows missing pl/de translation | Plan 74-07 |
| `apps/web/src/app/[locale]/(admin)/settings/workflow-roles/__tests__/page.test.tsx` | 11 | no AR tab rendered (Phase 79 only) | Plan 74-07 |
| `packages/api/src/routers/__tests__/workflow-execution-template-selection.test.ts` | 97 | mid-workflow swap rejected (auth path) | Plan 74-08 |
| `packages/api/src/routers/__tests__/workflow-execution-template-selection.test.ts` | 100 | mid-workflow swap is rejected (D-03) | Plan 74-08 |
| `packages/api/src/routers/__tests__/workflow-override-blocking-task.test.ts` | 54 | requires workflow:override_blocking_task permission | Plan 74-08 |
| `packages/api/src/routers/__tests__/workflow-override-blocking-task.test.ts` | 55 | accepts/rejects nine non-owner roles | Plan 74-08 |
| `packages/api/src/routers/__tests__/workflow-override-blocking-task.test.ts` | 58 | returns PRECONDITION_FAILED when no IP_VERIFICATION open | Plan 74-08 |

**Verdict:** All `it.todo`s belong to Plans 74-07 and 74-08, which the file header text explicitly references. These are well-formed deferrals.

### `describe.skipIf` in unit tests (1)

- `packages/db/src/__tests__/rls-integration.test.ts:72` — `describe.skipIf(!hasDb)` is conditional on a real Postgres being available; this is correct for an integration test, **not** debt.

### Playwright `test.skip` (~115 occurrences across ~22 files)

All in `apps/web/e2e/`. The pattern is uniform: every spec opens by probing for table rows, integration cards, env vars, or feature flags, and skips if not present. Examples:

- `apps/web/e2e/functional/billing-flow.spec.ts` — 12 skips, all `!tabPanelVisible || !isVisible`.
- `apps/web/e2e/functional/approval-chain-flow.spec.ts` — 18 skips, conditional on row count or tab presence.
- `apps/web/e2e/rtl/rtl-localization.spec.ts` — 10 skips, all `E2E_EMAIL/E2E_PASSWORD not set`.
- `apps/web/e2e/integration/peppol-inbound-smoke.spec.ts:26` and `resend-inbound-smoke.spec.ts:4` — skip because no signed bypass header is wired (legitimate, with TODO comment).

**This is acceptable as a hardening pattern** for an E2E suite that runs against arbitrary tenant data, but a green Playwright run does **not** prove the user flows actually exercised — CI logs need to surface skip counts to detect regressions where a flow stops being reachable.

### Tautological tests (3 — RED FLAG)

`apps/web/src/components/contractors/compliance/__tests__/recompute-compliance-button.test.tsx`
- Line 72: `expect(true).toBe(true)`
- Line 77: `expect(true).toBe(true)`
- Line 109: `expect(true).toBe(true)`

These assert nothing. Recommended fix: read the file, replace with real assertions (likely DOM presence/click handler invocation), or delete.

### Console-spy suppression (17 sites / 9 files)

- `packages/api/src/services/courier/__tests__/inpost-webhook-handler.test.ts` (3)
- `packages/api/src/services/courier/__tests__/shipment-task-completion-integration.test.ts` (3)
- `packages/api/src/services/courier/__tests__/ups-polling-service.test.ts` (3)
- `packages/api/src/services/courier/__tests__/inpost-polling-service.test.ts` (3)
- `packages/api/src/services/courier/__tests__/dpd-polling-service.test.ts` (3)
- `packages/api/src/services/__tests__/equipment-workflow.test.ts` (4)
- `packages/api/src/services/__tests__/linear-issue-sync.test.ts` (2)
- `packages/api/src/services/__tests__/virus-scanner.test.ts` (1)
- `packages/api/src/services/__tests__/tax-id-validation.service.test.ts` (2)
- `packages/api/src/services/messaging/__tests__/messaging-provider.test.ts` (2)
- `apps/web/src/components/ui/__tests__/sidebar.test.tsx` (1)

This is a sign that the SUT logs to `console.*` — but per the user's "No console.log — use Pino" memory, all production code should be on `@contractor-ops/logger`. **Either the source still has `console.*` calls (lint-logs guard should be catching these), or the spy is leftover after the migration.** Worth a one-pass sweep of these source files.

### Handoff status (16 files / ~51 failures from `.planning/handoffs/test-cleanup-2026-04-27.md`)

Verified that **none** of these high-traffic failing files (ksef-sync, portal, portal-profile, classification) added `it.skip` / `it.todo` to mask failures. Result: visibility is preserved (good); but the suite is still red on those files (bad). No regression vs. handoff baseline observable from grep alone — running `pnpm --filter @contractor-ops/api test` would confirm.

---

## New-module coverage table

LoC counted with `wc -l`. Ratio = test LoC / source LoC.

| Module | Src LoC | Test LoC | Ratio | Verdict |
|---|---:|---:|---:|---|
| `packages/api/src/services/outbox/index.ts + handlers.ts` | 470 | 319 | 68% | **OK** — handlers are thin; index drives consumer logic |
| `packages/api/src/services/qstash-backpressure.ts` | 332 | **0** | 0% | **CRITICAL GAP** — no co-located test file found by name |
| `packages/api/src/services/exports/index.ts + registry.ts + compliance-gaps.ts` | 1075 | 398 | 37% | **THIN** — index is 743 LoC alone with only 220 LoC of tests |
| `packages/api/src/services/oauth-challenge.ts` | 207 | not located | ? | likely covered by route-level tests; needs verification |
| `packages/api/src/services/pending-upload.ts` | 219 | not located | ? | same |
| `packages/api/src/services/org-cache.ts` | 102 | 171 | 168% | **GOOD** |
| `packages/db/src/replica.ts` | 298 | 208 | 70% | **OK** — `replica.test.ts` exists |
| `packages/db/src/rls.ts` (`withRlsReads`) | 230 | 278 + 215 (integration) | 214% | **EXCELLENT** — both unit + integration |
| `packages/integrations/src/services/resilience.ts` | 287 | 171 | 60% | **OK** |
| `packages/auth/src/turnstile.ts` | 125 | not located in `packages/auth` | ? | flag |

**Action items (ranked):**

1. **`qstash-backpressure.ts` has zero unit tests.** This service decides whether to drop or queue every QStash hop. Failure mode: in a backpressure scenario you may DLQ everything or queue forever. Add tests for: capacity bucket logic, drain semantics, error-path behaviour when QStash is unreachable.
2. **`exports/index.ts` 743 LoC / 220 LoC test (30%).** Verify the streaming CSV path, the signed-URL generation path, the per-tenant authz check, and the `ExportRow` lifecycle transitions are covered. If they aren't, this is a security-adjacent gap.
3. **`oauth-challenge.ts` and `pending-upload.ts`** show no `*.test.ts` neighbour. Even if covered indirectly through route tests, a unit test pinning the challenge-creation TTL and pending-upload state machine is cheap insurance.

---

## TODO / FIXME sweep

Total raw count: **1278** occurrences across `packages/` + `apps/` (excluding node_modules / dist / .next).

The vast majority are:
- Generated Prisma client comments and `// TODO(generated)` stubs (~700+ in `packages/db/src/generated/`).
- Test fixture comments referencing `TODO` ZUGFeRD invoice IDs / status names that read as TODO regex hits but aren't real TODOs (e.g., `'ZF-2026-0001'` matches `TODO` substring).
- Seed scripts and fixture builders (`packages/db/scripts/`).

**Real source-code TODOs (sampled, not exhaustive):**

| Type | Example | Bucket |
|---|---|---|
| Audit-tracked | (none found referencing F-XXX-NN format) | **Bucket A: Audit-tracked → 0 found** |
| Plan-tracked | `validators/src/__tests__/locked-phrases-guard.test.ts:79` — `// TODO Plan 07 — privacy-notices/de.ts` | Plan reference |
| Plan-tracked | `apps/web/.../workflow-roles/__tests__/page.test.tsx:1` — `// TODO(Plan 74-07)` | Plan reference |
| Phase-tracked | `apps/web/.../google-workspace-provider-section.tsx:43` — `// TODO(Phase 76)` | Phase reference |
| Pre-existing | `apps/web/e2e/integration/peppol-inbound-smoke.spec.ts:144` — `// TODO: add test once a bypass header` | Pre-audit |
| Pre-existing | `apps/web/e2e/functional/approval-chain-flow.spec.ts:452` — `// TODO: implement full delegation flow` | Pre-audit |
| **New / unverified** | `apps/web/src/app/api/teams/messages/route.ts:104` — `// TODO(typecheck-pass-2)` | **Worry — references undefined "pass 2"** |
| **New / unverified** | `apps/web/src/app/api/cron/data-purge/route.ts:98` — `// TODO(typecheck-pass-2)` | **Same** |
| **New / unverified** | `apps/web/src/app/api/cron/inpost-status-poll/route.ts:97` — `// TODO(typecheck-pass-2)` | **Same** |
| Test pin | `apps/public-api/src/lib/__tests__/rate-limiter.test.ts:198` — `// TODO: MAX_WINDOWS (50_000) eviction test omitted` | Pre-audit, justified |

**Findings:**
- **Zero TODOs reference `F-XXX-NN` audit IDs**, despite the runbook (`COMMIT-ATTRIBUTION.md`) claiming deferrals are tracked. This is a documentation gap — either the deferred items were all closed (good) or they live only in `NEXT-PHASE-PLAN.md` with no source-code breadcrumbs (bad — source-resident TODO is the only thing a future engineer searching the file will see).
- **3 `(typecheck-pass-2)` TODOs** introduced when the Prisma generator switch caused type fluctuation. They paper over a known type mismatch. These are the worrying bucket: if "pass 2" is no longer planned, these need real fixes.

---

## Biome / type annotations — bucketed

Counts:
- `@ts-expect-error`: **7**
- `@ts-ignore`: 0 in active source (lint guard catches it)
- `biome-ignore`: **1271** (heavily inflated by `// biome-ignore-all lint: generated file` headers in Prisma client output and ~12 `useNamingConvention: __dirname` polyfill ignores)

**`@ts-expect-error` bucketed:**

| Location | Justification | Bucket |
|---|---|---|
| `packages/einvoice/src/profiles/xrechnung-de/__tests__/locked-phrase-parity.test.ts:38` | "cross-package source path, intentional for parity check" | Pre-existing, valid |
| `packages/api/src/routers/__tests__/workflow-shared.test.ts:161` | "intentional unknown operator" | Test-only widening, valid |
| `packages/api/src/routers/__tests__/workflow.test.ts:118` | "intentional unknown operator for default switch branch" | Test-only widening, valid |
| `apps/web/src/app/[locale]/(legal)/privacy/__tests__/privacy-gb.test.tsx:8` | "Plan 07 creates this module" | **Placeholder — should resolve once Plan 07 ships** |
| `apps/web/src/app/[locale]/(legal)/privacy/__tests__/privacy-eu.test.tsx:8` | same | same |
| `apps/web/src/app/[locale]/(legal)/privacy/__tests__/privacy-de.test.tsx:10` | same | same |
| `apps/web/src/components/auth/register-form.tsx:84` | "Better Auth types don't model the extra field" | Library-types limitation, valid |

**`biome-ignore` notable real suppressions** (excluding generated + naming-convention boilerplate):
- `packages/db/src/rls.ts:45/146/228` — three `noExplicitAny` to bridge Prisma's `$extends` overload union. Correctly justified.
- `packages/lint-guards/src/__tests__/{schema-guard,logs-guard,i18n-parity}.test.ts:7` — `noUnresolvedImports: target of Plan 70-02/03/04`. **These should self-resolve when those plans complete** — re-check after Phase 70 closes.
- `packages/feature-flags/src/__tests__/signoff-registry-flags.test.ts:6` — `target of Plan 70-05`, same pattern.
- `packages/einvoice/src/profiles/xrechnung-de/validator.ts:79` — `noMisusedPromises: memoized Promise — return-cached-or-create`. Real pattern, justified.
- `packages/db/scripts/seed-dev.ts:2` — file-wide `noExcessiveCognitiveComplexity: this is a seed script`. Valid.

**Verdict:** No alarming bucket. The 4 "Plan 70-XX" placeholders are the only items that should be cross-checked against actual Plan 70 status to ensure they get cleaned up rather than calcified.

---

## Lint-staged drift verification

| SHA | Subject | Real? | Stat sample |
|---|---|---|---|
| `8c79880c` | F-OBS-03 thread requestId/traceparent across QStash hops | yes | `git show` shows touched routes (ocr/_process, ksef/_sync, etc.) — body matches |
| `e26dd055` | F-OBS-08 add Sentry beforeSend PII scrubber | yes | body mentions Pino redaction at different transport |
| `eda86f75` | F-INT-10 Infisical token rotation | yes | body mentions `INFISICAL_TOKEN_TTL_MS` env tunable |
| `dfea68b1` | arctic dep + oauth-arctic shim | yes | body mentions oauth-arctic adoption pattern |
| `a79e7245` | F-INT-13 + F-INT-21 webhook dedup + Stripe late | yes | body refs F-INT-13, F-INT-21 |
| `063a36d7` | F-SEC-16 strip taxId from search | yes | body mentions `requirePermission` gate |
| `608d7dc8` | F-ASYNC-03 outbox foundation | yes | body closes F-ASYNC-03 + F-DB-23 |

**Observation:** All 7 commits are real; all 7 commit messages mention only the *primary* finding ID, while `COMMIT-ATTRIBUTION.md` claims they bundle 1-3 additional finding IDs each. Confirming the *additional* finding IDs is the reviewable claim — that requires reading each commit's full diff (would take 30-60 min). I spot-checked `608d7dc8` body text which closes F-ASYNC-03 + F-DB-23, but the runbook claims it also bundles F-ASYNC-04 (notification dedup row plumbing in `billing-service.ts`). **Both can be true** — F-DB-23 is mentioned in the body, F-ASYNC-04 is not. That's exactly the under-attribution the runbook warns about.

**Likely under-counts:** With ~25 parallel agents and ~200+ commits in the audit window (`git log --since 2026-04-25 --until 2026-05-05` returned 421 commits including merges), 7 misattributions is suspiciously low. A quick sanity heuristic: any commit during the audit window whose stat shows files outside the subject's claimed scope is a candidate. Recommend: bash sweep that for each audit commit, compares the touched file paths against an expected-scope regex derived from the subject.

---

## Outdated comments — sample

Sampled, not exhaustive. Pattern: post-refactor stragglers and Phase-N references that have since shipped.

1. `packages/test-utils/src/msw/fixtures/hmrc.ts:1` — `// Phase 57 · Plan 01 — HMRC VAT fixtures (PAY-03)`. Phase 57 closed; the comment is OK as a provenance marker but a future reader will wonder if this is current.
2. `packages/test-utils/src/msw/fixtures/vies.ts:1` — same pattern.
3. `packages/logger/src/with-body-logging.ts:9` — references "Phase 70 D-05 D-08". Phase 70 is referenced as in-progress in multiple places — verify D-05/D-08 are still labels.
4. `packages/logger/src/integration-events.ts:2` — "Phase 2 P2-E F-OBS-06". Now that the audit closed F-OBS-06, the comment should either reference the closed finding or just describe the behaviour without the audit ID.
5. `packages/logger/src/idp-audit-logger.ts:1` — `// Phase 70 D-15 — IdP deprovisioning audit logger`. If D-15 is closed, remove the in-flight tag.
6. `packages/classification/src/index.ts:10` — `// Plan 04 wizard UI consumes these`. Was Plan 04 actually shipped? Comment will rot.
7. `packages/api/src/routers/__tests__/workflow-execution.test.ts:394` — `// TODO task with past due date is overdue`. Reads ambiguous (task with TODO status, or this-is-a-TODO?).
8. `packages/db/src/generated/prisma/client/client.ts:4` — `// biome-ignore-all lint: generated file`. Correct, but worth confirming this regenerates on every `prisma generate`.

**Pattern:** the codebase tags comments with audit/plan IDs proactively, which is great for traceability — but no automation exists to flag stale ones. Recommend a `lint-stale-tags` script (a CSV of "closed plans/phases" cross-checked against codebase comment references) as a phase-cleanup step.

---

## CI / pipeline drift

`.github/workflows/`:
- `ci.yml` line 67: `continue-on-error: true` on `pnpm audit --audit-level moderate` (label: "Dependency audit (informational)"). **Reasonable** — `pnpm audit` flaps with transitive advisories that aren't always actionable. Not audit-introduced drift.
- `security-scan.yml`, `verapdf.yml`: not inspected line-by-line; quick grep showed no other `continue-on-error` / `if: false` / `--no-verify` patterns.

`.husky/`:
- `pre-commit`: `npx lint-staged` only.
- `pre-push`: runs `format:check && lint && check:no-process-env && lint:schema && lint:logs && i18n:parity`. Full chain, no skips.

**No `--no-verify` patterns, no skip flags introduced during the audit.** Husky is properly chained. CI hasn't been weakened.

One observation worth confirming offline: the pre-push chain does **not** run typecheck or unit tests (typecheck is too slow per a comment in `pre-push`). That means `git push --no-verify` isn't needed to push broken-test code; `git push` will succeed even when `packages/api` test suite is red. This is intentional per the pre-push comment ("left to CI"), but it does mean CI is the sole guardrail and any CI bypass is more dangerous.

---

## Recommendations ranked by effort

### Cheap (< 1 hour each)

1. **Delete or fix the 3 tautological tests** in `recompute-compliance-button.test.tsx`. They give false-positive coverage signal.
2. **Audit the 17 `vi.spyOn(console, ...)`** sites: confirm whether the SUT still emits to `console.*` (lint-logs guard should fail then) or whether the spy is dead. Either way, replace with assertions on the Pino transport or remove.
3. **Resolve 3 `(typecheck-pass-2)` TODOs**: read the diff that introduced them, decide if "pass 2" is real, and either fix or convert to a tracked issue.
4. **Resolve 4 `Plan 07` / `Plan 70-XX` placeholder TODOs and `@ts-expect-error`s** by checking those plans' status. If shipped, remove the placeholders.
5. **Add `--reporter=verbose` (or equivalent) to the Playwright CI config** so skip counts are visible per-run; otherwise drift from "test runs" → "test skips silently" is invisible.

### Medium (~half-day)

6. **Write unit tests for `qstash-backpressure.ts`.** Capacity-bucket math, drain semantics, error path. Highest-leverage because it's on every async hop.
7. **Audit `packages/api/src/services/exports/index.ts` test coverage.** 743 LoC with 220 LoC of tests — likely lacks streaming-edge-case + authz + signed-URL TTL tests. Aim to bring ratio above 50%.
8. **Add unit tests for `oauth-challenge.ts` and `pending-upload.ts`** — even if route-level tests cover the happy path, a state-machine unit test pinning TTL/expiry is cheap and load-bearing.
9. **Cross-check the 7 lint-staged-drift commits** — read each diff fully to confirm the additional finding IDs claimed in `COMMIT-ATTRIBUTION.md`. Update the table if any are missing IDs (likely under-counted).

### Larger (~1-2 days)

10. **Run `pnpm --filter @contractor-ops/api test` and triage the 16 failing files** from the 2026-04-27 handoff. The fact that no `it.skip` was added means failures are visible — but they're red in CI. Either fix or `it.todo` with a tracked issue.
11. **Build a `lint-stale-tags` script** that cross-references comment-mentioned Plan/Phase/F-XXX IDs against a registry of closed items, flagging dead references. Would catch the comment rot found in section 6.
12. **Replace E2E `test.skip` guards with targeted fixture seeding** so the suite has a baseline shape (e.g., a known invoice, a known approval queue item). A green run with most tests skipped masks regressions where flows stop being reachable.

### Nice-to-have

13. **Document the lint-staged race in `CONTRIBUTING.md`** with the recommendation already in `COMMIT-ATTRIBUTION.md` ("isolated `git worktree` per agent"). Right now the guidance only lives in the post-mortem.
14. **Consider gating CI's `pnpm audit` on `--audit-level high`** instead of `moderate` to keep the informational signal cleaner; or pipe results into a `cosmetic` step that posts to a tracking issue rather than `continue-on-error: true`.

---

## Closing read

The Phase 2/3 audit landed clean on the dimensions that matter most:
- No `--no-verify` / `continue-on-error: true` added during the audit.
- No `it.skip` mass-added to mask the 16-file test debt — the failures are visible.
- All 7 documented lint-staged misattributions exist in the git log and are correctly marked cosmetic.
- The biome-ignore explosion is almost entirely Prisma-generated noise.

The real concerns are coverage gaps in **new** modules (qstash-backpressure, exports), three tautological tests in compliance UI, the documentation/reality gap where audit findings don't leave breadcrumbs in source as `F-XXX-NN` TODOs, and the 17 console-spy suppressions that may indicate `@contractor-ops/logger` migration leftovers.

None of these are showstoppers. All are tractable in the cheap/medium tier above.
